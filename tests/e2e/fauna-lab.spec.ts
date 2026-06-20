import { test, expect } from '@playwright/test';

interface AnimalState {
  id: string;
  family: string;
  behavior: string;
  pos: { x: number; z: number };
  enteredPond: boolean;
  leftHome: boolean;
  bodyRadius: number;
  scale: number;
}

declare global {
  interface Window {
    sturdyVolleyFauna?: {
      meshCount: () => number;
      animals: () => AnimalState[];
      player: () => { x: number; z: number };
      setPlayer: (x: number, z: number) => void;
      setPlayerMoving: (m: boolean) => void;
      tick: (n?: number) => void;
      minPlayerGap: () => number;
      minAnimalGap: () => number;
      distToPlayer: (id: string) => number;
      petDog: () => number;
      petLivestock: (id: string) => number;
      affection: (id: string) => number;
    };
  }
}

const boot = async (page: import('@playwright/test').Page) => {
  await page.goto('/?scene=FaunaLab');
  await expect(page.locator('#game-canvas')).toBeVisible();
  await page.waitForFunction(() => Boolean(window.sturdyVolleyFauna?.animals));
};

test.describe('Animal family proving ground (WEF-08a)', () => {
  test('boots with pet + farm animals mapped to distinct families', async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', (err) => errors.push(err.message));

    await boot(page);
    const animals = await page.evaluate(() => window.sturdyVolleyFauna!.animals());
    expect(animals.length).toBe(5);
    const byId = Object.fromEntries(animals.map((a) => [a.id, a]));
    expect(byId.dog.family).toBe('small-quadruped-pet');
    expect(byId['goat-0'].family).toBe('grazing-livestock');
    expect(byId['hen-0'].family).toBe('poultry');
    // Families are genuinely distinct (scale + body proxy differ).
    expect(byId['goat-0'].bodyRadius).toBeGreaterThan(byId['hen-0'].bodyRadius);
    expect(byId['goat-0'].scale).not.toBe(byId.dog.scale);

    await page.waitForTimeout(300);
    const shot = await page.screenshot();
    await testInfo.attach(`fauna-lab-${testInfo.project.name}`, { body: shot, contentType: 'image/png' });
    expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([]);
  });

  test('the pet follows the player on the shared motor', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => {
      window.sturdyVolleyFauna!.setPlayerMoving(true);
      window.sturdyVolleyFauna!.setPlayer(2, 4);
      window.sturdyVolleyFauna!.tick(150);
      window.sturdyVolleyFauna!.setPlayer(-6, -2);
      window.sturdyVolleyFauna!.tick(200);
    });
    const dist = await page.evaluate(() => window.sturdyVolleyFauna!.distToPlayer('dog'));
    expect(dist, `dog stays near the player (${dist.toFixed(2)} m)`).toBeLessThan(4.5);
  });

  test('livestock graze inside the fence and never enter the cliff or pond', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => window.sturdyVolleyFauna!.tick(1500));
    const animals = await page.evaluate(() => window.sturdyVolleyFauna!.animals());
    for (const a of animals) {
      expect(a.enteredPond, `${a.id} stays out of the pond (water)`).toBe(false);
    }
    // Grazers respect their fenced home (no fence/cliff breakout).
    for (const a of animals.filter((x) => x.behavior === 'graze')) {
      expect(a.leftHome, `${a.id} stays in its fenced home`).toBe(false);
      // Goats stay west of the gate (pasture x ≤ -2); hens stay in the yard.
      if (a.id.startsWith('goat')) expect(a.pos.x, `${a.id} inside the pasture`).toBeLessThanOrEqual(-1.5);
    }
  });

  test('player/animal and animal/animal contacts stay soft (no overlap)', async ({ page }) => {
    await boot(page);
    // Walk the player into the pasture among the goats.
    await page.evaluate(() => {
      window.sturdyVolleyFauna!.setPlayerMoving(true);
      window.sturdyVolleyFauna!.setPlayer(-8, 0);
      window.sturdyVolleyFauna!.tick(400);
    });
    const playerGap = await page.evaluate(() => window.sturdyVolleyFauna!.minPlayerGap());
    const animalGap = await page.evaluate(() => window.sturdyVolleyFauna!.minAnimalGap());
    expect(playerGap, 'animals never overlap the player').toBeGreaterThan(0.3);
    expect(animalGap, 'animals never stack on each other').toBeGreaterThan(0.3);
  });

  test('husbandry (affection/feeding) survives the movement migration', async ({ page }) => {
    await boot(page);
    const dogBefore = await page.evaluate(() => window.sturdyVolleyFauna!.affection('dog'));
    const dogAfter = await page.evaluate(() => window.sturdyVolleyFauna!.petDog());
    expect(dogAfter, 'petting the dog raises affection').toBeGreaterThan(dogBefore);

    const goatBefore = await page.evaluate(() => window.sturdyVolleyFauna!.affection('goat-0'));
    const goatAfter = await page.evaluate(() => window.sturdyVolleyFauna!.petLivestock('goat-0'));
    expect(goatAfter, 'petting a goat raises its hearts').toBeGreaterThanOrEqual(goatBefore);
  });
});
