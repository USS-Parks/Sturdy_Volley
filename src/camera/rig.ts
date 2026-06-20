/**
 * Camera rig (WEF-01b, Prompt 029): the Babylon binding that drives an
 * ArcRotateCamera from a CameraProfile each frame. It holds no tuning of its
 * own — constrained orbit, recenter grace, look-ahead, follow smoothing, and
 * obstruction pull-in/occluder-fade all come from the pure profile math in
 * ./orbit + ./profiles, so behaviour is reproducible and tunable from data.
 *
 * The rig manages alpha/beta/radius/target manually (no Babylon attachControl);
 * manual orbit comes from CameraInputController so the constraints apply.
 */
import { ArcRotateCamera, Ray, Vector3, type AbstractMesh, type Scene } from '@babylonjs/core';
import {
  betaFromPitchDeg,
  fovRadFromDeg,
  profileById,
  type CameraProfile,
} from './profiles';
import {
  applyYawInput,
  dampPlanar,
  dampToward,
  lookAheadLead,
  stepObstruction,
  stepRecenter,
  type Planar,
} from './orbit';
import type { CameraInput } from './input';
import { pickVolumeSticky, type CameraVolume } from './volumes';

export interface FollowTarget {
  /** World position of the framed point (e.g. the player's chest). */
  position(): Vector3;
  /** Planar velocity (m/s) for look-ahead. */
  velocity(): Planar;
  /** Meshes that must never count as occluders (player capsule, etc.). */
  ignore?(): readonly AbstractMesh[];
}

/** How an occluder between camera and target is treated (WEF-01c). `fade` is the
 *  locked baseline rule; `cutaway` is the recorded fallback for opaque interiors. */
export type ObstructionMode = 'fade' | 'cutaway';

export interface CameraRigState {
  profileId: string;
  context: string;
  variant: string;
  /** Effective downward view this frame (deg). */
  pitchDeg: number;
  fovDeg: number;
  distance: number;
  /** Manual orbit offset from rest heading (deg). */
  yawOffsetDeg: number;
  /** Occluder fade 0..1. */
  fade: number;
  recentering: boolean;
  reducedMotion: boolean;
  obstructionMode: ObstructionMode;
  /** Id of the authored camera volume currently selected, or null when outside all. */
  activeVolumeId: string | null;
}

const RAD2DEG = 180 / Math.PI;
const MAX_PITCH_OFFSET = 0.32; // rad — small manual tilt either way
const BETA_MIN = 0.08;
const BETA_MAX = 1.45;

export class CameraRig {
  readonly camera: ArcRotateCamera;
  private profile: CameraProfile;
  /** Profile actually driving the frame (base profile or a volume override). */
  private activeProfile: CameraProfile;
  private volumes: readonly CameraVolume[] = [];
  private target: FollowTarget | null = null;

  private restYaw: number;
  private yawOffset = 0;
  private pitchOffset = 0;
  private timeSinceInput = Number.POSITIVE_INFINITY;
  private recenterRequested = false;

  private followPos: Planar;
  private followY: number;
  private currentDistance: number;
  private currentBeta: number;
  private currentFov: number;
  private fade = 0;
  private occluder: AbstractMesh | null = null;
  private reducedMotion = false;
  private obstructionMode: ObstructionMode = 'fade';
  /** Mode actually used this frame (a volume may override the global mode). */
  private effectiveObstructionMode: ObstructionMode = 'fade';
  /** Sticky-selected volume id (drives blend-boundary hysteresis). */
  private currentVolumeId: string | null = null;

  constructor(scene: Scene, profile: CameraProfile, restYaw = -Math.PI / 2) {
    this.profile = profile;
    this.activeProfile = profile;
    this.restYaw = restYaw;
    this.followPos = { x: 0, z: 0 };
    this.followY = 1.2;
    this.currentDistance = profile.followDistance;
    this.currentBeta = betaFromPitchDeg(profile.pitchDeg);
    this.currentFov = fovRadFromDeg(profile.fovDeg);

    this.camera = new ArcRotateCamera('rig-cam', restYaw, this.currentBeta, this.currentDistance, Vector3.Zero(), scene);
    this.camera.minZ = 0.1;
    this.camera.fov = this.currentFov;
    scene.activeCamera = this.camera;
  }

  setTarget(target: FollowTarget): void {
    this.target = target;
    const p = target.position();
    this.followPos = { x: p.x, z: p.z };
    this.followY = p.y;
  }

  setVolumes(volumes: readonly CameraVolume[]): void {
    this.volumes = volumes;
  }

  setProfile(profile: CameraProfile): void {
    this.profile = profile;
    // Reflect the new base immediately; update() re-derives it each frame and a
    // volume override (if the target is inside one) supersedes it next frame.
    this.activeProfile = profile;
  }

  /** Reduced-motion mode (Prompt 030 locks the policy): drop the look-ahead /
   *  recenter impulses and use conservative blend timing. */
  setReducedMotion(on: boolean): void {
    this.reducedMotion = on;
  }

  /** Switch occluder handling between the locked `fade` rule and the `cutaway`
   *  fallback (WEF-01c). */
  setObstructionMode(mode: ObstructionMode): void {
    if (this.occluder) this.occluder.visibility = 1;
    if (this.occluder) this.occluder.isVisible = true;
    this.obstructionMode = mode;
    this.effectiveObstructionMode = mode; // until a volume overrides next frame
  }

  getProfile(): CameraProfile {
    return this.profile;
  }

  requestRecenter(): void {
    this.recenterRequested = true;
  }

  update(dt: number, input: CameraInput): void {
    if (dt <= 0) return;

    // Authored-volume override: while the framed target is inside a volume, use
    // its profile (and yaw-limit / target-offset / obstruction overrides).
    // Selection is sticky (blend-boundary hysteresis) so adjacent volumes never
    // oscillate at a shared edge; an unresolved profile falls back safely.
    let active = this.profile;
    let yawLimitOverride: number | null | undefined;
    let activeVolume: CameraVolume | null = null;
    if (this.volumes.length && this.target) {
      const p = this.target.position();
      const vol = pickVolumeSticky({ x: p.x, y: p.y, z: p.z }, this.volumes, this.currentVolumeId);
      this.currentVolumeId = vol ? vol.id : null;
      if (vol) {
        activeVolume = vol;
        const vp = profileById(vol.profileId) ?? (vol.fallbackProfileId ? profileById(vol.fallbackProfileId) : undefined);
        if (vp) active = vp;
        yawLimitOverride = vol.yawLimitDeg;
      }
    }
    // Effective obstruction mode: a volume may override the global rule.
    this.effectiveObstructionMode = activeVolume?.obstructionMode ?? this.obstructionMode;
    this.activeProfile = active;
    const limitProfile =
      yawLimitOverride === undefined ? active : { ...active, yawLimitDeg: yawLimitOverride };

    // --- Manual orbit input + recenter grace --------------------------------
    const hadInput = input.yawDelta !== 0 || input.pitchDelta !== 0;
    if (hadInput) {
      this.yawOffset = applyYawInput(this.yawOffset, input.yawDelta, limitProfile);
      this.pitchOffset = clamp(this.pitchOffset + input.pitchDelta, -MAX_PITCH_OFFSET, MAX_PITCH_OFFSET);
      this.timeSinceInput = 0;
    } else {
      this.timeSinceInput += dt;
    }
    if (input.recenter || this.recenterRequested) {
      this.recenterRequested = false;
      this.timeSinceInput = active.recenterDelay; // begin recenter immediately
    }

    this.yawOffset = stepRecenter(this.yawOffset, this.timeSinceInput, active, dt);
    if (this.timeSinceInput >= active.recenterDelay) {
      this.pitchOffset = dampToward(this.pitchOffset, 0, 0.25, dt);
    }

    // --- Framed target + look-ahead -----------------------------------------
    if (this.target) {
      const raw = this.target.position();
      const off = activeVolume?.targetOffset;
      const base = off ? new Vector3(raw.x + off.x, raw.y + off.y, raw.z + off.z) : raw;
      const lead = this.reducedMotion ? { x: 0, z: 0 } : lookAheadLead(this.target.velocity(), active);
      const desired: Planar = { x: base.x + lead.x, z: base.z + lead.z };
      // Reduced motion uses a steadier follow lag (no snappy lead/settle).
      const followLag = this.reducedMotion ? Math.max(active.followLag, 0.28) : active.followLag;
      this.followPos = dampPlanar(this.followPos, desired, followLag, dt);
      this.followY = dampToward(this.followY, base.y, followLag, dt);
    }

    // --- Pitch (beta) + FOV blend toward the active profile -----------------
    const blendLag = this.reducedMotion ? 0.4 : 0.18;
    const desiredBeta = clamp(betaFromPitchDeg(active.pitchDeg) - this.pitchOffset, BETA_MIN, BETA_MAX);
    this.currentBeta = dampToward(this.currentBeta, desiredBeta, blendLag, dt);
    this.currentFov = dampToward(this.currentFov, fovRadFromDeg(active.fovDeg), blendLag, dt);

    // --- Obstruction --------------------------------------------------------
    const alpha = this.restYaw + this.yawOffset;
    const targetPos = new Vector3(this.followPos.x, this.followY, this.followPos.z);
    const desiredDistance = active.followDistance;
    const hit = this.probeObstruction(targetPos, alpha, this.currentBeta, desiredDistance);
    const ob = stepObstruction(this.currentDistance, desiredDistance, hit, active, dt);
    this.currentDistance = ob.distance;
    this.fade = ob.fade;
    this.applyOccluderFade();

    // --- Commit to the Babylon camera ---------------------------------------
    this.camera.target.copyFrom(targetPos);
    this.camera.alpha = alpha;
    this.camera.beta = this.currentBeta;
    this.camera.radius = this.currentDistance;
    this.camera.fov = this.currentFov;
  }

  /** Distance (m) from target to the nearest occluder along the camera ray, or
   *  null when the line of sight is clear. */
  private probeObstruction(target: Vector3, alpha: number, beta: number, distance: number): number | null {
    const dir = new Vector3(
      Math.cos(alpha) * Math.sin(beta),
      Math.cos(beta),
      Math.sin(alpha) * Math.sin(beta),
    );
    const scene = this.camera.getScene();
    const ray = new Ray(target, dir, distance);
    const ignore = new Set(this.target?.ignore?.() ?? []);
    const pick = scene.pickWithRay(ray, (m) => m.isPickable && m.isVisible && !ignore.has(m));
    if (pick?.hit && pick.pickedMesh) {
      this.setOccluder(pick.pickedMesh);
      return pick.distance;
    }
    this.setOccluder(null);
    return null;
  }

  private setOccluder(mesh: AbstractMesh | null): void {
    if (this.occluder && this.occluder !== mesh) {
      this.occluder.visibility = 1; // restore the previous occluder
      this.occluder.isVisible = true;
    }
    this.occluder = mesh;
  }

  private applyOccluderFade(): void {
    if (!this.occluder) return;
    if (this.effectiveObstructionMode === 'cutaway') {
      // Hard cutaway once the blocker meaningfully occludes the target.
      this.occluder.visibility = 1;
      this.occluder.isVisible = this.fade < 0.5;
    } else {
      this.occluder.isVisible = true;
      this.occluder.visibility = 1 - this.fade;
    }
  }

  getState(): CameraRigState {
    return {
      profileId: this.activeProfile.id,
      context: this.activeProfile.context,
      variant: this.activeProfile.variant,
      pitchDeg: (Math.PI / 2 - this.currentBeta) * RAD2DEG,
      fovDeg: this.currentFov * RAD2DEG,
      distance: this.currentDistance,
      yawOffsetDeg: this.yawOffset * RAD2DEG,
      fade: this.fade,
      recentering: this.timeSinceInput >= this.profile.recenterDelay && Math.abs(this.yawOffset) > 1e-3,
      reducedMotion: this.reducedMotion,
      obstructionMode: this.effectiveObstructionMode,
      activeVolumeId: this.currentVolumeId,
    };
  }

  dispose(): void {
    this.setOccluder(null);
    this.camera.dispose();
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
