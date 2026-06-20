/**
 * World atlas — region adjacency + authoritative spatial sheets (WEF-06b,
 * master Prompt 038).
 *
 * Machine-readable companion to `docs/world/ATLAS.md`: the twelve §4.2 core
 * regions as typed `RegionSheet` data, the global adjacency graph, the
 * two-community + river **spine** (Willa Crick ↔ Klam-ity River ↔ Ballast Bay),
 * and the starting-farm attachments. `validateAtlas` enforces the structural
 * invariants (adjacency symmetry, a connected graph, the spine intact, unique
 * production order, provisional flags only where dimensioned art is missing) so
 * the atlas can't silently drift as the Prompt 039 blockouts + 046–049 graybox
 * maps fill it in. Pure data — no Babylon.
 *
 * Originality (§0.7): every region's purpose, topology, and landmark is original
 * to Ballast Bay, grounded in its authoritative top-down board (overworld
 * `sv_map_011`, per-region `sv_map_012`–`021`), not copied from any other game.
 */

import { CAMERA_CONTEXTS } from '../camera/profiles';

export type Community = 'willa-crick' | 'ballast-bay' | 'corridor';
export type ActivityDensity = 'low' | 'medium' | 'high';
export type VariantAxis = 'tide' | 'season' | 'weather' | 'restoration';

export interface RegionSheet {
  id: string;
  name: string;
  community: Community;
  /** One-line purpose / role in the world. */
  purpose: string;
  /** Approximate playable footprint (m): width × depth. */
  footprint: { width: number; depth: number };
  /** Named elevation bands low→high (metres are set in the Prompt 039 blockout). */
  elevationBands: string[];
  /** Region ids reachable directly from here (must be symmetric). */
  adjacencies: string[];
  /** The landmark that keeps the player oriented from a distance. */
  sightlineLandmark: string;
  /** Traversal verbs this region exercises. */
  traversalVocabulary: string[];
  /** Ambient activity / population density. */
  activityDensity: ActivityDensity;
  /** Approximate streaming-cell (32 m chunk) count at full extent. */
  streamingCells: number;
  /** Which content-variant axes change this region. */
  variants: VariantAxis[];
  /** Interiors this region must provide (graybox in 046+). */
  requiredInteriors: string[];
  /** The dominant camera context (must be a real CAMERA_CONTEXTS entry). */
  cameraContext: string;
  /** Known camera framing risks to design around. */
  cameraRisks: string[];
  /** Known navigation risks to design around. */
  navigationRisks: string[];
  /** Build sequence rank (1 = earliest). Unique across the atlas. */
  productionOrder: number;
  /** True while the region lacks a dimensioned art board (role fixed, metrics TBD). */
  provisional?: boolean;
}

/** A selectable starting farm + the community it attaches to. */
export interface StartingFarm {
  id: string;
  name: string;
  community: Community;
  perk: string;
}

export const ATLAS: RegionSheet[] = [
  {
    id: 'willa-crick',
    name: 'Willa Crick',
    community: 'willa-crick',
    purpose: 'Inland redwood community: creekside homesteads, mill, and the gateway up to the ridge.',
    footprint: { width: 192, depth: 160 },
    elevationBands: ['creek flat', 'terraced homesteads', 'forest shelf'],
    adjacencies: ['klam-ity-river', 'splitwind-ridge'],
    sightlineLandmark: 'the Old Crick Mill wheel',
    traversalVocabulary: ['walk', 'path', 'road', 'bridge', 'ford', 'stairs', 'doorway', 'mount'],
    activityDensity: 'medium',
    streamingCells: 30,
    variants: ['season', 'weather', 'restoration'],
    requiredInteriors: ['crick-mill', 'homestead'],
    cameraContext: 'exterior',
    cameraRisks: ['tall redwood trunks occluding the chase camera'],
    navigationRisks: ['creek crossings forcing fords/bridges'],
    productionOrder: 10,
    provisional: true,
  },
  {
    id: 'klam-ity-river',
    name: 'The Klam-ity River',
    community: 'corridor',
    purpose: 'River corridor linking the two communities; the showcase route for mounted traversal.',
    footprint: { width: 288, depth: 96 },
    elevationBands: ['riverbed', 'bank path', 'cliff shelf'],
    adjacencies: ['willa-crick', 'breakpoint-farm', 'ballast-bay-town'],
    sightlineLandmark: 'the twin-span Klam-ity Bridge',
    traversalVocabulary: ['walk', 'path', 'road', 'bridge', 'ford', 'wade', 'cliff', 'mount'],
    activityDensity: 'low',
    streamingCells: 27,
    variants: ['season', 'weather', 'restoration'],
    requiredInteriors: [],
    cameraContext: 'exterior',
    cameraRisks: ['cliff walls pinching the orbit along the bank'],
    navigationRisks: ['ford depth vs swim boundary', 'horse-speed seam preload at the community transition'],
    productionOrder: 9,
    provisional: true,
  },
  {
    id: 'breakpoint-farm',
    name: 'Breakpoint Farm',
    community: 'ballast-bay',
    purpose: "The player's coastal homestead: soil plots, paddocks, kitchen garden, orchard bluff, greenhouse ruin.",
    footprint: { width: 128, depth: 128 },
    elevationBands: ['tide-fed lowland', 'farmyard', 'orchard bluff'],
    adjacencies: ['ballast-bay-town', 'klam-ity-river', 'belltide-marsh'],
    sightlineLandmark: 'the leaning greenhouse ruin',
    traversalVocabulary: ['walk', 'path', 'bridge', 'wade', 'stairs', 'doorway', 'cliff'],
    activityDensity: 'medium',
    streamingCells: 16,
    variants: ['tide', 'season', 'weather', 'restoration'],
    requiredInteriors: ['farmhouse', 'shed', 'greenhouse'],
    cameraContext: 'farm',
    cameraRisks: ['orchard-bluff cliff edge keeping the horizon stable'],
    navigationRisks: ['irrigation channels splitting walkable plots'],
    productionOrder: 1,
  },
  {
    id: 'ballast-bay-town',
    name: 'Ballast Bay Town',
    community: 'ballast-bay',
    purpose: 'Dense walkable town: market lane, harbor approach, community hall, shops, beach access.',
    footprint: { width: 192, depth: 160 },
    elevationBands: ['harborfront', 'market lane', 'upper terraces'],
    adjacencies: ['breakpoint-farm', 'klam-ity-river', 'netlight-point', 'driftwood-beach', 'belltide-marsh'],
    sightlineLandmark: 'the Old Netlight beacon on the point',
    traversalVocabulary: ['walk', 'path', 'road', 'stairs', 'doorway', 'dock', 'elevation-link'],
    activityDensity: 'high',
    streamingCells: 30,
    variants: ['tide', 'season', 'weather', 'restoration'],
    requiredInteriors: ['community-hall', 'bakery', 'fishmonger', 'general-store', 'clinic', 'library'],
    cameraContext: 'exterior',
    cameraRisks: ['terraced rooflines occluding the player on the market lane'],
    navigationRisks: ['crowded market NPC density', 'stair seams between terraces'],
    productionOrder: 2,
  },
  {
    id: 'netlight-point',
    name: 'Netlight Point',
    community: 'ballast-bay',
    purpose: 'Cliff-top lighthouse: beacon room, observatory deck, storm-cellar archive, signal puzzles.',
    footprint: { width: 96, depth: 96 },
    elevationBands: ['approach path', 'point plateau', 'beacon gallery'],
    adjacencies: ['ballast-bay-town', 'driftwood-beach'],
    sightlineLandmark: 'the Old Netlight tower itself',
    traversalVocabulary: ['walk', 'path', 'stairs', 'doorway', 'climb', 'elevation-link'],
    activityDensity: 'low',
    streamingCells: 9,
    variants: ['weather', 'restoration'],
    requiredInteriors: ['beacon-room', 'storm-cellar-archive'],
    cameraContext: 'exterior',
    cameraRisks: ['exposed cliff with a 4 m+ drop on three sides'],
    navigationRisks: ['narrow spiral approach to the gallery'],
    productionOrder: 6,
  },
  {
    id: 'driftwood-beach',
    name: 'Driftwood Beach',
    community: 'ballast-bay',
    purpose: 'Tidal beach: shell + forage gathering, tidepools, crab pots, picnic dates, turtle nesting.',
    footprint: { width: 160, depth: 96 },
    elevationBands: ['surf line', 'wet sand', 'dune backshore'],
    adjacencies: ['ballast-bay-town', 'netlight-point', 'kelpglass-reefs'],
    sightlineLandmark: 'the great bleached driftwood arch',
    traversalVocabulary: ['walk', 'wade', 'swim', 'path', 'dock'],
    activityDensity: 'medium',
    streamingCells: 15,
    variants: ['tide', 'season', 'weather'],
    requiredInteriors: [],
    cameraContext: 'water',
    cameraRisks: ['keeping shore + horizon legible while wading'],
    navigationRisks: ['tide reshaping the walkable sand twice a day'],
    productionOrder: 3,
  },
  {
    id: 'kelpglass-reefs',
    name: 'Kelpglass Reefs',
    community: 'ballast-bay',
    purpose: 'Low-tide reef + snorkeling: seaweed farming, coral restoration, rare fish, ocean-weather secrets.',
    footprint: { width: 128, depth: 128 },
    elevationBands: ['reef flat (low tide)', 'channel', 'open water (high tide)'],
    adjacencies: ['driftwood-beach', 'outer-islets'],
    sightlineLandmark: 'the glassy kelp-curtain shoal',
    traversalVocabulary: ['wade', 'swim', 'path'],
    activityDensity: 'low',
    streamingCells: 16,
    variants: ['tide', 'season', 'weather', 'restoration'],
    requiredInteriors: [],
    cameraContext: 'water',
    cameraRisks: ['underwater framing while snorkeling'],
    navigationRisks: ['tide gating which reef cells are reachable'],
    productionOrder: 7,
  },
  {
    id: 'belltide-marsh',
    name: 'Belltide Marsh',
    community: 'ballast-bay',
    purpose: 'Wetland: forage, medicinal herbs, frogs, reeds, boardwalk repairs, fog navigation, birdwatching.',
    footprint: { width: 160, depth: 160 },
    elevationBands: ['open water', 'reed flats', 'boardwalk'],
    adjacencies: ['ballast-bay-town', 'breakpoint-farm', 'ironroot-quarry'],
    sightlineLandmark: 'the lantern-hung belltide boardwalk gate',
    traversalVocabulary: ['walk', 'wade', 'path', 'bridge'],
    activityDensity: 'low',
    streamingCells: 25,
    variants: ['tide', 'season', 'weather', 'restoration'],
    requiredInteriors: [],
    cameraContext: 'exterior',
    cameraRisks: ['fog draw distance vs landmark sightline'],
    navigationRisks: ['broken boardwalk segments forcing detours'],
    productionOrder: 5,
  },
  {
    id: 'ironroot-quarry',
    name: 'Ironroot Quarry',
    community: 'ballast-bay',
    purpose: 'Open-pit mining: ore + crystal nodes, rail lifts, hazards, earth fauna, machine ruins.',
    footprint: { width: 128, depth: 128 },
    elevationBands: ['pit floor', 'terraced benches', 'rim road'],
    adjacencies: ['belltide-marsh', 'rainhall-caverns', 'splitwind-ridge'],
    sightlineLandmark: 'the rusted rail-lift gantry',
    traversalVocabulary: ['walk', 'path', 'stairs', 'ladder', 'lift', 'elevation-link', 'doorway'],
    activityDensity: 'low',
    streamingCells: 16,
    variants: ['season', 'restoration'],
    requiredInteriors: ['quarry-office', 'cavern-mouth'],
    cameraContext: 'cave',
    cameraRisks: ['terraced benches occluding lower pit'],
    navigationRisks: ['ledge links + lift checkpoints'],
    productionOrder: 8,
  },
  {
    id: 'rainhall-caverns',
    name: 'The Rainhall Caverns',
    community: 'ballast-bay',
    purpose: 'Combat-light cave exploration: echo creatures, mineral springs, flooded halls, tide doors, rhythm puzzles.',
    footprint: { width: 160, depth: 128 },
    elevationBands: ['upper galleries', 'spring pools', 'flooded deep'],
    adjacencies: ['ironroot-quarry'],
    sightlineLandmark: 'the luminous mineral-spring pool',
    traversalVocabulary: ['walk', 'wade', 'swim', 'stairs', 'ladder', 'climb', 'doorway', 'elevation-link'],
    activityDensity: 'low',
    streamingCells: 20,
    variants: ['restoration'],
    requiredInteriors: ['boss-chamber'],
    cameraContext: 'cave',
    cameraRisks: ['tight passage → open chamber framing swings'],
    navigationRisks: ['tide-door flooding changing reachable halls'],
    productionOrder: 4,
  },
  {
    id: 'splitwind-ridge',
    name: 'Splitwind Ridge',
    community: 'willa-crick',
    purpose: 'High mountain: windmills, glider shortcuts, snow-season forage, goats, high-altitude crops, storm quests.',
    footprint: { width: 160, depth: 160 },
    elevationBands: ['lower switchbacks', 'windmill shelf', 'summit crags'],
    adjacencies: ['willa-crick', 'ironroot-quarry'],
    sightlineLandmark: 'the three ridgeline windmills',
    traversalVocabulary: ['walk', 'path', 'stairs', 'climb', 'bridge', 'elevation-link', 'mount'],
    activityDensity: 'low',
    streamingCells: 25,
    variants: ['season', 'weather'],
    requiredInteriors: ['windmill', 'ridge-shelter'],
    cameraContext: 'exterior',
    cameraRisks: ['high wind exposure + steep drop sightlines'],
    navigationRisks: ['switchback slopes near the motor slope limit'],
    productionOrder: 11,
  },
  {
    id: 'outer-islets',
    name: 'Outer Islets',
    community: 'ballast-bay',
    purpose: 'Late-game ferry isles: unusual crops, migratory animals, traveling merchants, map fragments, eco-restoration.',
    footprint: { width: 192, depth: 160 },
    elevationBands: ['tidal flats', 'islet cores', 'lookout knolls'],
    adjacencies: ['kelpglass-reefs'],
    sightlineLandmark: 'the weathered ferry-dock totem',
    traversalVocabulary: ['walk', 'wade', 'swim', 'path', 'dock', 'ferry'],
    activityDensity: 'low',
    streamingCells: 30,
    variants: ['tide', 'season', 'weather', 'restoration'],
    requiredInteriors: ['merchant-hut'],
    cameraContext: 'exterior',
    cameraRisks: ['open-water horizon between scattered islets'],
    navigationRisks: ['ferry gating + inter-islet wading channels'],
    productionOrder: 12,
  },
];

/** The two-community + river spine, in order. */
export const WORLD_SPINE: readonly string[] = ['willa-crick', 'klam-ity-river', 'ballast-bay-town'];

/** Selectable starting farms + their community attachment (master roster §1.3). */
export const STARTING_FARMS: StartingFarm[] = [
  { id: 'open-meadow', name: 'Open Meadow Farm', community: 'ballast-bay', perk: 'Most tillable space; wide cleared field + sturdy shed.' },
  { id: 'tideplot', name: 'Tideplot Farm', community: 'ballast-bay', perk: 'Water channels; starts with crab pots + seaweed beds.' },
  { id: 'grovewall', name: 'Grovewall Farm', community: 'willa-crick', perk: 'Dense trees + medicinal shrubs; best for foraging + bees.' },
  { id: 'quarryline', name: 'Quarryline Farm', community: 'willa-crick', perk: 'Rocky slopes + ore nodes; mining + sturdy builds.' },
  { id: 'marshlight', name: 'Marshlight Farm', community: 'ballast-bay', perk: 'Wetland plots + rare flowers; ecology + cooking.' },
  { id: 'fourwinds', name: 'Fourwinds Farm', community: 'willa-crick', perk: 'Four corner zones; helper assignment + automation.' },
  { id: 'pasturewell', name: 'Pasturewell Farm', community: 'ballast-bay', perk: 'Sweetgrass pasture + small barn; animal husbandry.' },
  { id: 'stormbreak', name: 'Stormbreak Farm', community: 'willa-crick', perk: 'Hard mode: debris, wind, uneven terrain, storm resources.' },
];

export interface AtlasIssue {
  code:
    | 'duplicate-region-id'
    | 'asymmetric-adjacency'
    | 'unknown-adjacency'
    | 'disconnected-graph'
    | 'broken-spine'
    | 'duplicate-production-order'
    | 'unknown-camera-context'
    | 'unattached-starting-farm';
  message: string;
}

const KNOWN_CONTEXTS = new Set<string>(CAMERA_CONTEXTS);

/** Validate the atlas structural invariants. Empty result = valid. */
export function validateAtlas(atlas: RegionSheet[] = ATLAS, farms: StartingFarm[] = STARTING_FARMS): AtlasIssue[] {
  const issues: AtlasIssue[] = [];
  const ids = new Set<string>();
  for (const r of atlas) {
    if (ids.has(r.id)) issues.push({ code: 'duplicate-region-id', message: `region id "${r.id}" is not unique` });
    ids.add(r.id);
  }

  // Adjacencies reference known regions and are symmetric.
  const byId = new Map(atlas.map((r) => [r.id, r]));
  for (const r of atlas) {
    for (const adj of r.adjacencies) {
      const other = byId.get(adj);
      if (!other) {
        issues.push({ code: 'unknown-adjacency', message: `region "${r.id}" lists unknown adjacency "${adj}"` });
        continue;
      }
      if (!other.adjacencies.includes(r.id)) {
        issues.push({ code: 'asymmetric-adjacency', message: `adjacency "${r.id}"→"${adj}" is not mirrored` });
      }
    }
    if (!KNOWN_CONTEXTS.has(r.cameraContext)) {
      issues.push({ code: 'unknown-camera-context', message: `region "${r.id}" cameraContext "${r.cameraContext}" is unknown` });
    }
  }

  // Production order is unique.
  const orders = new Map<number, string>();
  for (const r of atlas) {
    const prev = orders.get(r.productionOrder);
    if (prev) issues.push({ code: 'duplicate-production-order', message: `production order ${r.productionOrder} shared by "${prev}" and "${r.id}"` });
    orders.set(r.productionOrder, r.id);
  }

  // The graph is connected (every region reachable from the first).
  if (atlas.length > 0) {
    const seen = new Set<string>([atlas[0].id]);
    const stack = [atlas[0].id];
    while (stack.length) {
      const cur = byId.get(stack.pop() as string);
      for (const adj of cur?.adjacencies ?? []) {
        if (!seen.has(adj) && byId.has(adj)) {
          seen.add(adj);
          stack.push(adj);
        }
      }
    }
    if (seen.size !== atlas.length) {
      const missing = atlas.filter((r) => !seen.has(r.id)).map((r) => r.id);
      issues.push({ code: 'disconnected-graph', message: `regions not reachable from "${atlas[0].id}": ${missing.join(', ')}` });
    }
  }

  // The spine is a connected chain in order.
  for (let i = 0; i < WORLD_SPINE.length - 1; i++) {
    const a = byId.get(WORLD_SPINE[i]);
    const b = WORLD_SPINE[i + 1];
    if (!a || !a.adjacencies.includes(b)) {
      issues.push({ code: 'broken-spine', message: `world spine broken between "${WORLD_SPINE[i]}" and "${b}"` });
    }
  }

  // Every starting farm attaches to a community that exists in the atlas.
  const communities = new Set(atlas.map((r) => r.community));
  for (const f of farms) {
    if (!communities.has(f.community)) {
      issues.push({ code: 'unattached-starting-farm', message: `starting farm "${f.id}" attaches to absent community "${f.community}"` });
    }
  }

  return issues;
}

export interface AtlasReportRow {
  name: string;
  count: number;
  ok: boolean;
  issues: string[];
}

/** Atlas validation in the data-report shape (Title "Dev · Validate data"). */
export function getAtlasReport(): AtlasReportRow[] {
  const issues = validateAtlas();
  return [{ name: `atlas: ${ATLAS.length} regions`, count: ATLAS.length, ok: issues.length === 0, issues: issues.map((i) => `${i.code}: ${i.message}`) }];
}
