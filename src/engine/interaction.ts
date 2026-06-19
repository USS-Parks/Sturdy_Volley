/**
 * Renderer-agnostic interaction resolver (Prompt 005): "one interaction button
 * handles multiple nearby targets predictably." Given the player position and a
 * set of in-world targets, pick the single best target — highest priority, then
 * nearest. Pure + deterministic.
 */
export type InteractKind =
  | 'farm-cell'
  | 'prop'
  | 'npc'
  | 'animal'
  | 'machine'
  | 'door'
  | 'pickup'
  | 'ore-node'
  | 'water-entry'
  | 'climb';

export interface InteractTarget {
  id: string;
  kind: InteractKind;
  label: string;
  x: number;
  z: number;
  radius: number;
  priority?: number;
}

/** Returns the best in-range target, or null if none are reachable. */
export function resolveInteraction(
  targets: readonly InteractTarget[],
  px: number,
  pz: number,
): InteractTarget | null {
  let best: InteractTarget | null = null;
  let bestScore = -Infinity;
  for (const t of targets) {
    const dx = t.x - px;
    const dz = t.z - pz;
    const dist2 = dx * dx + dz * dz;
    if (dist2 > t.radius * t.radius) continue;
    // Higher priority wins; ties broken by proximity.
    const score = (t.priority ?? 0) * 1_000_000 - dist2;
    if (score > bestScore) {
      bestScore = score;
      best = t;
    }
  }
  return best;
}
