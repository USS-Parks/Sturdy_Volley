export const ASSET_FAMILIES = [
  'character', 'npc', 'animal', 'mount', 'flora',
  'building', 'terrain', 'tool', 'machine', 'prop',
] as const;

export type AssetFamily = (typeof ASSET_FAMILIES)[number];
export type GrayModelPolicy = 'foundation' | 'visual' | 'hybrid';

export interface GrayModelDefinition {
  id: string;
  assetId: string;
  family: AssetFamily;
  dimensions: readonly [width: number, height: number, depth: number];
  sourceRefs: readonly string[];
  policy: GrayModelPolicy;
  priority: 'P0' | 'P1' | 'P2';
}

export const GRAY_MODEL_REGISTRY = [
  { id: 'terrain-ground-grass', assetId: 'sv_terrain_ground-grass', family: 'terrain', dimensions: [1, 0.12, 1], sourceRefs: ['C-040', 'O-213'], policy: 'visual', priority: 'P0' },
  { id: 'terrain-path-straight', assetId: 'sv_terrain_path-straight', family: 'terrain', dimensions: [1.6, 0.1, 2], sourceRefs: ['C-040', 'B-012'], policy: 'visual', priority: 'P0' },
  { id: 'terrain-fence-wood-straight', assetId: 'sv_terrain_fence-wood-straight', family: 'terrain', dimensions: [2, 1, 0.18], sourceRefs: ['C-040'], policy: 'hybrid', priority: 'P0' },
  { id: 'building-farmhouse-shell', assetId: 'sv_building_farmhouse-shell', family: 'building', dimensions: [8, 6.5, 7], sourceRefs: ['B-012', 'B-023', 'J-150', 'P-230'], policy: 'hybrid', priority: 'P0' },
  { id: 'prop-raised-bed', assetId: 'sv_prop_raised-bed', family: 'prop', dimensions: [3, 0.45, 1.2], sourceRefs: ['B-012', 'I-121', 'P-230'], policy: 'visual', priority: 'P0' },
  { id: 'prop-crate', assetId: 'sv_prop_crate', family: 'prop', dimensions: [0.8, 0.8, 0.8], sourceRefs: ['J-140', 'N-203', 'P-230'], policy: 'hybrid', priority: 'P0' },
  { id: 'prop-farm-well', assetId: 'sv_prop_farm-well', family: 'prop', dimensions: [2, 2.4, 2], sourceRefs: ['B-012', 'P-230'], policy: 'hybrid', priority: 'P0' },
  { id: 'flora-redwood', assetId: 'sv_flora_redwood', family: 'flora', dimensions: [4, 14, 4], sourceRefs: ['I-127', 'D-041', 'P-230'], policy: 'hybrid', priority: 'P0' },
  { id: 'flora-rock-cluster', assetId: 'sv_flora_rock-cluster', family: 'flora', dimensions: [2.5, 1.5, 2], sourceRefs: ['D-041', 'P-230'], policy: 'visual', priority: 'P0' },
  { id: 'flora-marsh-reed', assetId: 'sv_flora_marsh-reed', family: 'flora', dimensions: [0.6, 1.4, 0.6], sourceRefs: ['B-017', 'D-052'], policy: 'visual', priority: 'P0' },
  { id: 'building-village-house', assetId: 'sv_building_village-house', family: 'building', dimensions: [7, 6, 6], sourceRefs: ['B-013', 'B-026', 'P-230'], policy: 'hybrid', priority: 'P0' },
  { id: 'prop-market-stall', assetId: 'sv_prop_market-stall', family: 'prop', dimensions: [3, 2.8, 2.2], sourceRefs: ['B-026', 'K-169', 'P-230'], policy: 'visual', priority: 'P0' },
  { id: 'prop-common-lantern', assetId: 'sv_prop_common-lantern', family: 'prop', dimensions: [0.45, 2.3, 0.45], sourceRefs: ['D-049', 'K-170', 'P-230'], policy: 'visual', priority: 'P0' },
  { id: 'terrain-dock-straight', assetId: 'sv_terrain_dock-straight', family: 'terrain', dimensions: [2, 0.4, 4], sourceRefs: ['B-027', 'D-050', 'P-230'], policy: 'hybrid', priority: 'P0' },
  { id: 'prop-working-skiff', assetId: 'sv_prop_working-skiff', family: 'prop', dimensions: [2.2, 1.2, 5], sourceRefs: ['B-027', 'D-050', 'P-230'], policy: 'visual', priority: 'P0' },
  { id: 'building-lighthouse', assetId: 'sv_building_lighthouse', family: 'building', dimensions: [6, 18, 6], sourceRefs: ['B-015', 'D-047', 'P-230'], policy: 'hybrid', priority: 'P0' },
  { id: 'terrain-marsh-boardwalk', assetId: 'sv_terrain_marsh-boardwalk', family: 'terrain', dimensions: [1.8, 0.35, 4], sourceRefs: ['B-017', 'D-052', 'P-230'], policy: 'hybrid', priority: 'P0' },
  { id: 'building-quarry-gantry', assetId: 'sv_building_quarry-gantry', family: 'building', dimensions: [10, 9, 5], sourceRefs: ['B-018', 'D-053', 'P-230'], policy: 'hybrid', priority: 'P0' },
  { id: 'terrain-ridge-cliff', assetId: 'sv_terrain_ridge-cliff', family: 'terrain', dimensions: [16, 12, 8], sourceRefs: ['B-020', 'D-055', 'P-230'], policy: 'hybrid', priority: 'P0' },
  { id: 'character-player-proxy', assetId: 'sv_player_gray-proxy', family: 'character', dimensions: [0.7, 1.8, 0.55], sourceRefs: ['A-007', 'A-008', 'E-063'], policy: 'visual', priority: 'P0' },
  { id: 'npc-townsfolk-proxy', assetId: 'sv_npc_townsfolk-proxy', family: 'npc', dimensions: [0.7, 1.75, 0.55], sourceRefs: ['F-066', 'G-078', 'P-229'], policy: 'visual', priority: 'P0' },
  { id: 'animal-dog-proxy', assetId: 'sv_animal_dog-proxy', family: 'animal', dimensions: [0.55, 0.75, 1.05], sourceRefs: ['H-113', 'P-230'], policy: 'visual', priority: 'P0' },
] as const satisfies readonly GrayModelDefinition[];

const FORBIDDEN_ID_SEGMENT = /(^|-)(volleyball|court|net|ball|team|tournament|trophy)(-|$)/;

export function grayModelDefinition(id: string): GrayModelDefinition | undefined {
  return GRAY_MODEL_REGISTRY.find((entry) => entry.id === id);
}

export function validateGrayModelRegistry(registry: readonly GrayModelDefinition[] = GRAY_MODEL_REGISTRY): string[] {
  const issues: string[] = [];
  const ids = new Set<string>();
  const assetIds = new Set<string>();
  for (const entry of registry) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.id)) issues.push(`invalid-id:${entry.id}`);
    if (!entry.id.startsWith(`${entry.family}-`)) issues.push(`family-prefix:${entry.id}`);
    if (FORBIDDEN_ID_SEGMENT.test(entry.id)) issues.push(`sports-id:${entry.id}`);
    if (ids.has(entry.id)) issues.push(`duplicate-id:${entry.id}`);
    if (assetIds.has(entry.assetId)) issues.push(`duplicate-asset-id:${entry.assetId}`);
    if (entry.dimensions.some((value) => value <= 0)) issues.push(`invalid-dimensions:${entry.id}`);
    if (entry.sourceRefs.length === 0) issues.push(`missing-source:${entry.id}`);
    ids.add(entry.id);
    assetIds.add(entry.assetId);
  }
  return issues;
}
