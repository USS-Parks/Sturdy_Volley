/**
 * Machine-readable map schema + validator (WEF-06a, master Prompt 037).
 *
 * Zod schemas for an authored world-map document: coordinate frame, chunks,
 * anchors, camera volumes, collision references, navigation references, routes,
 * variants, and transitions. `validateMapDocument` runs the schema *and* the
 * semantic cross-checks the spatial grammar requires (routes clear every body,
 * camera contexts resolve, anchor ids are unique, references are not dangling),
 * so a malformed atlas/blockout (Prompts 038/039) or graybox map (046–049) fails
 * fast at author time instead of producing a broken world.
 *
 * `.strict()` everywhere so typos become errors; ids are kebab-case (matching
 * `src/data/schemas.ts`). The document is pure data — no Babylon, no geometry;
 * collision/navigation entries are *references* (§3.1 separation of concerns).
 */
import { z } from 'zod';
import { idSchema, seasonSchema } from '../data/schemas';
import { CAMERA_CONTEXTS } from '../camera/profiles';
import { routeWidthOk } from './metric-kit';

const vec2Schema = z.object({ x: z.number(), z: z.number() }).strict();
const vec3Schema = z.object({ x: z.number(), y: z.number(), z: z.number() }).strict();

/** Runtime coordinate frame: region id + world-space local origin (the §3.1 floating origin). */
export const coordinateFrameSchema = z
  .object({
    regionId: idSchema,
    label: z.string().min(1),
    origin: vec2Schema,
    forwardAxis: z.literal('+z'),
    units: z.literal('meters'),
  })
  .strict();

export const chunkSchema = z
  .object({
    cx: z.number().int(),
    cz: z.number().int(),
    size: z.number().positive(),
  })
  .strict();

/** A named vertical elevation band (the dimensioned blockout's Y axis). */
export const elevationBandSchema = z
  .object({
    name: z.string().min(1),
    minY: z.number(),
    maxY: z.number(),
  })
  .strict()
  .refine((b) => b.maxY > b.minY, { message: 'elevation band maxY must exceed minY' });

export const anchorSchema = z
  .object({
    id: idSchema,
    kind: z.string().min(1),
    at: vec3Schema,
    facing: z.number().optional(),
  })
  .strict();

const obstructionModeSchema = z.enum(['fade', 'cutaway']);

export const cameraVolumeSchema = z
  .object({
    id: idSchema,
    min: vec3Schema,
    max: vec3Schema,
    /** `context:variant`. The context is validated against CAMERA_CONTEXTS. */
    profileId: z.string().min(1),
    fallbackProfileId: z.string().min(1).optional(),
    targetOffset: vec3Schema.optional(),
    yawLimitDeg: z.number().nullable().optional(),
    obstructionMode: obstructionModeSchema.optional(),
    blendBoundary: z.number().nonnegative().optional(),
    priority: z.number(),
  })
  .strict();

export const collisionRefSchema = z
  .object({
    id: idSchema,
    kind: z.enum(['box', 'mesh', 'proxy']),
    /** Optional anchor this collider is registered against. */
    anchorId: idSchema.optional(),
  })
  .strict();

export const navigationRefSchema = z
  .object({
    id: idSchema,
    kind: z.enum(['patch', 'link']),
    width: z.number().positive(),
    fromAnchorId: idSchema.optional(),
    toAnchorId: idSchema.optional(),
  })
  .strict();

export const routeSchema = z
  .object({
    id: idSchema,
    kind: z.enum(['path', 'road', 'desire-line', 'dock', 'bridge', 'corridor']),
    width: z.number().positive(),
    points: z.array(vec2Schema).min(2),
  })
  .strict();

export const variantRuleSchema = z
  .object({
    anchorId: idSchema,
    hideOnTide: z.enum(['low', 'high']).optional(),
    restorationMinStage: z.number().int().nonnegative().optional(),
    seasonAppearance: z.record(seasonSchema, z.string()).optional(),
  })
  .strict();

export const transitionSchema = z
  .object({
    id: idSchema,
    fromRegion: idSchema,
    fromAnchor: vec2Schema,
    toRegion: idSchema,
    toAnchor: vec2Schema,
    facing: z.number(),
    /** Camera context to hand off to on arrival; validated against CAMERA_CONTEXTS. */
    cameraContext: z.string().min(1),
  })
  .strict();

export const mapDocumentSchema = z
  .object({
    schemaVersion: z.literal(1),
    coordinateFrame: coordinateFrameSchema,
    chunks: z.array(chunkSchema).default([]),
    elevation: z.array(elevationBandSchema).default([]),
    anchors: z.array(anchorSchema).default([]),
    cameraVolumes: z.array(cameraVolumeSchema).default([]),
    collision: z.array(collisionRefSchema).default([]),
    navigation: z.array(navigationRefSchema).default([]),
    routes: z.array(routeSchema).default([]),
    variants: z.array(variantRuleSchema).default([]),
    transitions: z.array(transitionSchema).default([]),
  })
  .strict();

export type MapDocument = z.infer<typeof mapDocumentSchema>;

export interface MapIssue {
  code:
    | 'schema'
    | 'duplicate-anchor-id'
    | 'route-too-narrow'
    | 'unknown-camera-context'
    | 'dangling-anchor-ref'
    | 'transition-region-mismatch'
    | 'inconsistent-chunk-size'
    | 'elevation-band-overlap';
  message: string;
}

export interface MapValidationResult {
  ok: boolean;
  /** The parsed document when the schema passed, else null. */
  data: MapDocument | null;
  issues: MapIssue[];
}

/** The camera context part of a `context:variant` profile id. */
function contextOf(profileId: string): string {
  return profileId.split(':')[0];
}

const KNOWN_CONTEXTS = new Set<string>(CAMERA_CONTEXTS);

/**
 * Validate a map document: schema first, then the semantic cross-checks the
 * spatial grammar requires. Returns every issue found (empty = valid).
 */
export function validateMapDocument(input: unknown): MapValidationResult {
  const parsed = mapDocumentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      data: null,
      issues: parsed.error.issues.map((i) => ({ code: 'schema', message: `${i.path.join('.') || '(root)'}: ${i.message}` })),
    };
  }
  const doc = parsed.data;
  const issues: MapIssue[] = [];
  const anchorIds = new Set<string>();

  for (const a of doc.anchors) {
    if (anchorIds.has(a.id)) issues.push({ code: 'duplicate-anchor-id', message: `anchor id "${a.id}" is not unique` });
    anchorIds.add(a.id);
  }

  // Every route must clear the bodies relevant to its kind (capsule + small
  // animal always; road/dock/bridge also the large-animal body).
  for (const r of doc.routes) {
    if (!routeWidthOk(r.kind, r.width)) {
      issues.push({ code: 'route-too-narrow', message: `route "${r.id}" (${r.kind}) width ${r.width} m does not clear its required bodies` });
    }
  }

  // Camera volume + transition contexts must resolve to a real camera context.
  for (const v of doc.cameraVolumes) {
    if (!KNOWN_CONTEXTS.has(contextOf(v.profileId))) {
      issues.push({ code: 'unknown-camera-context', message: `camera volume "${v.id}" profile "${v.profileId}" has no known camera context` });
    }
  }
  for (const t of doc.transitions) {
    if (!KNOWN_CONTEXTS.has(contextOf(t.cameraContext))) {
      issues.push({ code: 'unknown-camera-context', message: `transition "${t.id}" cameraContext "${t.cameraContext}" is not a known camera context` });
    }
    // A map owns its *outgoing* transitions: the source region must be this map's.
    if (t.fromRegion !== doc.coordinateFrame.regionId) {
      issues.push({ code: 'transition-region-mismatch', message: `transition "${t.id}" fromRegion "${t.fromRegion}" ≠ map region "${doc.coordinateFrame.regionId}"` });
    }
  }

  // Collision / navigation / variant references must point at declared anchors.
  const refCheck = (id: string | undefined, owner: string): void => {
    if (id !== undefined && !anchorIds.has(id)) {
      issues.push({ code: 'dangling-anchor-ref', message: `${owner} references unknown anchor "${id}"` });
    }
  };
  for (const c of doc.collision) refCheck(c.anchorId, `collision "${c.id}"`);
  for (const n of doc.navigation) {
    refCheck(n.fromAnchorId, `navigation "${n.id}"`);
    refCheck(n.toAnchorId, `navigation "${n.id}"`);
  }
  for (const v of doc.variants) refCheck(v.anchorId, `variant rule for`);

  // All chunks share one size (the region's chunk grid is uniform).
  if (doc.chunks.length > 1) {
    const size = doc.chunks[0].size;
    if (doc.chunks.some((c) => Math.abs(c.size - size) > 1e-9)) {
      issues.push({ code: 'inconsistent-chunk-size', message: `chunks have mixed sizes; the region grid must be uniform` });
    }
  }

  // Elevation bands must not overlap (a dimensioned blockout stacks them).
  const bands = [...doc.elevation].sort((a, b) => a.minY - b.minY);
  for (let i = 1; i < bands.length; i++) {
    if (bands[i].minY < bands[i - 1].maxY - 1e-9) {
      issues.push({ code: 'elevation-band-overlap', message: `elevation bands "${bands[i - 1].name}" and "${bands[i].name}" overlap` });
    }
  }

  return { ok: issues.length === 0, data: doc, issues };
}
