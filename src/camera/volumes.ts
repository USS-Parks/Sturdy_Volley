/**
 * Camera volumes (WEF-01b, Prompt 029; extended WEF-05, Prompt 036): authored
 * world regions that override the active camera profile (and optionally the
 * target offset / yaw bounds / obstruction mode) while the framed target is
 * inside them — e.g. an interior swaps to a closer profile with wall fade.
 *
 * Prompt 036 adds the full authored-volume contract: per-volume **obstruction
 * mode**, a **blend boundary** (an exit-hysteresis margin so adjacent volumes
 * never oscillate at a shared edge), and a **safe fallback** profile used when a
 * volume's primary profile id fails to resolve. Pure model + selection here; the
 * rig (src/camera/rig.ts) binds it to Babylon.
 */

export type VolumeObstructionMode = 'fade' | 'cutaway';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface CameraVolume {
  id: string;
  /** Axis-aligned bounds in world metres. */
  min: Vec3;
  max: Vec3;
  /** Profile id (`context:variant`) to activate inside the volume. */
  profileId: string;
  /** Profile id used if `profileId` fails to resolve (safe fallback). */
  fallbackProfileId?: string;
  /** Optional framed-target offset while inside (m). */
  targetOffset?: Vec3;
  /** Optional manual-orbit limit override (deg); null = unbounded. */
  yawLimitDeg?: number | null;
  /** Optional per-volume occluder handling override. */
  obstructionMode?: VolumeObstructionMode;
  /** Exit-hysteresis margin (m): the target must leave the volume by this much
   *  before selection releases it, so two adjacent volumes don't flip-flop at a
   *  shared boundary. 0 / undefined = release immediately on exit. */
  blendBoundary?: number;
  /** Higher priority wins when volumes overlap. */
  priority: number;
}

export function containsPoint(v: CameraVolume, p: Vec3): boolean {
  return (
    p.x >= v.min.x &&
    p.x <= v.max.x &&
    p.y >= v.min.y &&
    p.y <= v.max.y &&
    p.z >= v.min.z &&
    p.z <= v.max.z
  );
}

/** Whether a point is within a volume's bounds expanded by `margin` on each axis. */
export function containsPointWithMargin(v: CameraVolume, p: Vec3, margin: number): boolean {
  return (
    p.x >= v.min.x - margin &&
    p.x <= v.max.x + margin &&
    p.y >= v.min.y - margin &&
    p.y <= v.max.y + margin &&
    p.z >= v.min.z - margin &&
    p.z <= v.max.z + margin
  );
}

/** Highest-priority volume containing the point, or null when outside all. */
export function pickVolume(p: Vec3, volumes: readonly CameraVolume[]): CameraVolume | null {
  let best: CameraVolume | null = null;
  for (const v of volumes) {
    if (!containsPoint(v, p)) continue;
    if (!best || v.priority > best.priority) best = v;
  }
  return best;
}

/**
 * Stable (sticky) volume selection with exit hysteresis: the previously-selected
 * volume is retained while the target is still inside it expanded by its
 * `blendBoundary`, unless a strictly-higher-priority volume now strictly
 * contains the target. Otherwise the highest-priority strictly-containing volume
 * is chosen. This stops two adjacent/overlapping volumes from oscillating at a
 * shared edge while a player loiters on the boundary — the cause of camera
 * judder during interior↔interior transitions.
 */
export function pickVolumeSticky(
  p: Vec3,
  volumes: readonly CameraVolume[],
  currentId: string | null,
): CameraVolume | null {
  const strict = pickVolume(p, volumes);
  if (currentId !== null) {
    const current = volumes.find((v) => v.id === currentId);
    if (current && containsPointWithMargin(current, p, current.blendBoundary ?? 0)) {
      // Keep the current volume unless something strictly higher-priority is in play.
      if (!strict || strict.priority <= current.priority) return current;
    }
  }
  return strict;
}
