import { describe, it, expect } from 'vitest';
import {
  loadGameContent,
  validateContent,
  getContentReport,
  type RawContent,
} from '../../src/data/content';
import { itemSchema, KEBAB_CASE } from '../../src/data/schemas';

const EMPTY_RAW: RawContent = {
  items: [],
  crops: [],
  animals: [],
  recipes: [],
  npcs: [],
  skills: [],
  weather: [],
  festivals: [],
  quests: [],
  shops: [],
  projects: [],
  maps: [],
  dialogue: [],
};

describe('content pipeline', () => {
  const content = loadGameContent();

  it('loads bundled content without throwing', () => {
    expect(content).toBeTruthy();
  });

  it('meets the minimum sample counts from the acceptance criteria', () => {
    expect(content.items.length).toBeGreaterThanOrEqual(10);
    expect(content.crops.length).toBeGreaterThanOrEqual(4);
    expect(content.npcs.length).toBeGreaterThanOrEqual(2);
    expect(content.animals.length).toBeGreaterThanOrEqual(2);
    expect(content.recipes.length).toBeGreaterThanOrEqual(2);
  });

  it('uses stable kebab-case ids that are unique within each collection', () => {
    for (const [name, rows] of Object.entries(content)) {
      const ids = (rows as Array<{ id: string }>).map((r) => r.id);
      for (const id of ids) {
        expect(id, `${name} id "${id}"`).toMatch(KEBAB_CASE);
      }
      expect(new Set(ids).size, `${name} ids should be unique`).toBe(ids.length);
    }
  });

  it('marks every bundled collection OK in the dev report', () => {
    expect(getContentReport().every((s) => s.ok)).toBe(true);
  });
});

describe('content validation errors are useful', () => {
  it('reports the path of a missing required field', () => {
    const result = itemSchema.safeParse({ id: 'x', name: 'X' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'));
      expect(paths).toContain('description');
      expect(paths).toContain('category');
    }
  });

  it('rejects non-kebab ids with a readable message', () => {
    const result = itemSchema.safeParse({
      id: 'Bad ID',
      name: 'x',
      description: 'd',
      category: 'misc',
      sellPrice: 1,
      stackable: true,
      tags: [],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toMatch(/kebab/);
    }
  });

  it('rejects unknown keys (catches typos) via strict schemas', () => {
    const result = itemSchema.safeParse({
      id: 'x',
      name: 'X',
      description: 'd',
      category: 'misc',
      sellPrice: 1,
      stackable: true,
      sellPriec: 99,
    });
    expect(result.success).toBe(false);
  });

  it('flags a broken cross-reference with the offending id in the message', () => {
    const raw: RawContent = {
      ...EMPTY_RAW,
      crops: [
        {
          id: 'mystery-gourd',
          name: 'Mystery Gourd',
          seedItemId: 'no-such-seed',
          produceItemId: 'no-such-produce',
          seasons: ['spring'],
          growthDays: 4,
        },
      ],
    };
    const { content, issues } = validateContent(raw);
    expect(content).toBeNull();
    expect(issues.some((i) => i.message.includes('no-such-seed'))).toBe(true);
  });

  it('flags duplicate ids within a collection', () => {
    const raw: RawContent = {
      ...EMPTY_RAW,
      skills: [
        { id: 'cultivation', name: 'A', description: 'a' },
        { id: 'cultivation', name: 'B', description: 'b' },
      ],
    };
    const { issues } = validateContent(raw);
    expect(issues.some((i) => i.message.includes('duplicate id'))).toBe(true);
  });
});
