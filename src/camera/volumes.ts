/**
 * Camera volumes (WEF-01b, Prompt 029): authored world regions that override
 * the active camera profile (and optionally the target offset / yaw bounds)
 * while the framed target is inside them — e.g. an interior swaps to a closer
 * profile with wall fade. Pure model + selection here; the full authored
 * interior-volume kit with blend boundaries lands in Prompt 036.
 */

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
  /** Optional framed-target offset while inside (m). */
  targetOffset?: Vec3;
  /** Optional manual-orbit limit override (deg); null = unbounded. */
  yawLimitDeg?: number | null;
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

/** Highest-priority volume containing the point, or null when outside all. */
export function pickVolume(p: Vec3, volumes: readonly CameraVolume[]): CameraVolume | null {
  let best: CameraVolume | null = null;
  for (const v of volumes) {
    if (!containsPoint(v, p)) continue;
    if (!best || v.priority > best.priority) best = v;
  }
  return best;
}
