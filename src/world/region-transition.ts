/**
 * Region transition payload (master Prompt 046 / §3.1). The data a
 * `SceneManager.goTo(key, data)` carries between two production-foundation
 * regions so the arriving scene recovers the player onto a stable destination
 * anchor with the right facing + camera handoff, and the state that must survive
 * a transition (clock, NPC token) crosses **unchanged**.
 *
 * Pure data — no Babylon. Both `BreakpointFarmScene` and `FarmhouseInteriorScene`
 * read it in `enter(data)`.
 */
import type { CameraContextId } from '../camera/profiles';

export interface RegionTransitionData {
  /** Destination anchor (XZ, region-local metres) to recover the player onto. */
  toAnchor: { x: number; z: number };
  /** Facing (rad, about +Y) the player arrives with. */
  facing: number;
  /** Camera context to hand off to on arrival. */
  cameraContext: CameraContextId;
  /** Wall-clock minutes — carried across the seam and never mutated. */
  clockMinutes: number;
  /** Opaque NPC-state token — carried across the seam and never mutated. */
  npcToken: string;
  /** Scene key to return to (interior → exterior), if any. */
  returnRegion?: string;
  /** Exterior pose to restore when returning, if any. */
  returnAnchor?: { x: number; z: number; facing: number };
}

/** The proving-ground clock both regions start from (9:00 AM). */
export const DEFAULT_CLOCK_MINUTES = 9 * 60;
/** The proving-ground NPC-state token a transition must preserve. */
export const NPC_STATE_TOKEN = 'npc-state-v1';

/** A transition payload's preserved fields are unchanged vs. the source. */
export function preservedIntact(
  data: RegionTransitionData,
  clockMinutes: number,
  npcToken: string,
): boolean {
  return data.clockMinutes === clockMinutes && data.npcToken === npcToken;
}
