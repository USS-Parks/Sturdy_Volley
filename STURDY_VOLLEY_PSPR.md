# Sturdy Volley: Giant P-SPR for an Original In-Browser Cozy Life Sim

Prepared: 2026-06-18  
Target: browser-first, mobile-ready, controller-friendly cozy life sim  
Format: P-SPR, meaning Plan-Sequential Prompt Roster  
Core promise: a long-life cozy adventure about restoring a storm-worn coastal town through farming, friendships, animal care, fishing, mining, foraging, crafting, cooking, festivals, and seasonal community life.

Title note: the title "Sturdy Volley" is provisional and under review. The original name was a Stardew-Valley-style pun built around a volleyball theme that has since been removed; the pun is now defunct. A rename (for example "Willa Crick") is under consideration, but the title is kept as "Sturdy Volley" throughout this document until the rename is confirmed.

Revision status: Revised 2026-06-18 to remove volleyball (an erroneous editing-pass drift); the game has nothing to do with volleyball or any sport. It is a cozy life sim modeled after Stardew Valley, rendered in 3D with Babylon.js in the Theme 3 original N64-era low-poly adventure style. Theme 3 approved. Babylon.js is the required 3D engine (with Havok physics and glTF/.glb assets). Production direction is original N64-era low-poly 3D with model turnarounds, wireframes, reusable rigs, authored movement/posture libraries, and a complete validated item catalog.

---

## 1. Research Capsule

### Stardew Valley design lessons to learn from

Stardew Valley works because it layers many modest activities into a dense, emotionally legible routine. Official materials describe the baseline loop: inherit an old farm, clear overgrown land, plant crops, raise animals, fish, craft, explore caves, customize home/farm, and become part of a community of more than 30 residents, including 12 romance candidates. Sources: [official site](https://www.stardewvalley.net/), [Steam page](https://store.steampowered.com/app/413150/Stardew_Valley/).

The durable retention design is built on overlapping clocks:

- A daily clock with energy, bedtime pressure, shop schedules, weather, and route planning.
- Four 28-day seasons, with seasonal crops, fish, forage, festivals, dialogue, and visual identity.
- Skill progression across farming, mining, foraging, fishing, and combat.
- Relationship progression with daily greetings, gifts, birthdays, heart events, mail, and quests.
- Area progression through community restoration, tool upgrades, unlockable regions, mines, and late-game systems.
- Collection progression through museum donations, bundles, recipes, animals, fish, artifacts, achievements, and secrets.

Stardew's official 1.6 changelog is especially useful for scope planning. It added new festivals, mastery, a new animal-focused farm type, multiple pets, new dynamic NPC dialogue, more seasonal outfits, map improvements, new crops, new machines, books, mystery boxes, UI tabs, new pets, new achievements, visual improvements, multiplayer improvements, balance adjustments, quality-of-life fixes, audio improvements, and performance improvements. Source: [Stardew Valley 1.6 changelog](https://www.stardewvalley.net/stardew-valley-1-6-update-full-changelog/).

The wiki documents several production-grade mechanics worth using as reference patterns, not as copy targets:

- Skills level through specific actions, unlock recipes and professions, and reduce tool energy cost. Source: [Skills wiki](https://stardewvalleywiki.com/Skills).
- Friendship uses points, gifts, daily talk, quests, heart events, romance caps, room access, and decay. Source: [Friendship wiki](https://stardewvalleywiki.com/Friendship).
- Quests include story quests and short "help wanted" style requests with clear objectives and rewards. Source: [Quests wiki](https://stardewvalleywiki.com/Quests).
- Festivals interrupt or reshape normal schedules, add shops/minigames, and become ritual anchors in the calendar. Source: [Festivals wiki](https://stardewvalleywiki.com/Festivals).
- Farm maps trade general tillable space for identity and skill bias, such as fishing, foraging, mining, combat, animals, or multiplayer. Source: [Farm Maps wiki](https://stardewvalleywiki.com/Farm_Maps).

### Source code and build-file reality check

No official Stardew Valley source code repository appears to be publicly available. Treat the commercial game code, art, audio, dialogue, maps, names, and data as proprietary. Do not decompile, copy, extract, or reproduce it.

Useful public ecosystem references do exist:

- Stardew Valley uses C# and MonoGame/XNA lineage according to public technical references and modding documentation. The modder guide says SMAPI mods are written in C# using .NET and that Stardew Valley uses MonoGame for drawing, input, and game logic. Source: [Modder Guide/Get Started](https://stardewvalleywiki.com/Modding:Modder_Guide/Get_Started).
- SMAPI, the community modding framework, is open source and has public build folders/source folders. It is a reference for mod-loader architecture, API events, cross-platform compatibility concerns, logging, save backup, and compatibility checks, not a source for Sturdy Volley game logic. Source: [SMAPI GitHub](https://github.com/Pathoschild/SMAPI).
- Content-pack style modding shows that data-driven maps, sprites, item definitions, dialogue, and quests are crucial for a long-life life sim. Source: [Modding guide](https://stardewvalleywiki.com/Modding:Modder_Guide/Get_Started).

### Legal and creative boundaries for Sturdy Volley

Sturdy Volley should be a spiritual answer, not a clone. It must not use Stardew Valley's code, sprites, audio, dialogue, maps, item names that are distinctive to Stardew, character names, Pelican Town, Joja, Junimos, bundles, heart-event scripts, exact crop economics, or exact layouts.

Borrow only general genre ideas:

- Daily life sim rhythm.
- Farm/craft/fish/explore/socialize loop.
- Seasonal calendar and festivals.
- NPC schedules and relationship arcs.
- Skill progression and unlocks.
- Community restoration.
- Secrets and long-tail collection goals.

Make the identity new:

- Setting: a cliffside harbor town on a storm-battered coast, rebuilding after a century storm.
- Core theme: steadiness, craft, tide ecology, mutual aid, and chosen community.
- Signature mechanic: a tide-and-season community-restoration loop in which farming, animal care, fishing, mining, foraging, crafting, and cooking intersect with friendship, town rebuilding, weather, festivals, and exploration.

---

## 2. Game Pillars

1. Cozy routine with meaningful pressure  
   Every day gives the player more they want to do than they can do, but failure rarely ends a path.

2. Community restoration is the heart  
   Rebuilding Ballast Bay is not a side activity. Repairing the harbor, the market hall, the boardwalk, and the lighthouse beacon ties farming, crafting, gifts, quests, and festivals together so that the player's everyday work visibly heals the town.

3. A living coastal town  
   The town breathes through tides, gullies, sea caves, ferry schedules, cliff paths, market days, fog, lantern nights, storm debris, and NPC movement.

4. Years of gentle discovery  
   Long-tail secrets, character arcs, community projects, collections, new farm layouts, and seasonal events should keep a player curious after many in-game years.

5. Browser-native delight  
   Fast load, responsive mobile controls, offline saves, expressive low-poly 3D animation, cozy audio, haptics where available, and no install friction.

---

## 3. Original World Design

### Title and place

Game title: Sturdy Volley  
Town name: Ballast Bay  
Region name: The Sturdy Coast  
Player property: Breakpoint Farm  
Primary landmark: The Old Netlight, a lighthouse whose dark beacon must be relit to guide boats home again  
Main conflict: a massive storm damaged the town's farms, harbor, tide pools, lighthouse, and trade routes. The player inherits Breakpoint Farm and helps rebuild Ballast Bay by growing food, restoring habitats, repairing the harbor and lighthouse beacon, building community trust, and reviving the town's annual Founders Harvest Fair.

### Core map regions

1. Breakpoint Farm  
   Flexible farm with soil plots, windbreak hedges, animal paddocks, a kitchen garden, old shed, tide-fed irrigation channel, orchard bluff, greenhouse ruin, and optional terrain themes.

2. Ballast Bay Town  
   Dense walkable town with market lane, clinic, schoolhouse, library, gear shop, bakery, fishmonger, community hall, apartment row, tram stop, and beach access.

3. Netlight Point  
   Lighthouse, beacon room, observatory deck, signal puzzles, late-night NPC scenes, cliff-top stargazing, secret storm-cellar archive.

4. Driftwood Beach  
   Shell collecting, beach forage, tidepooling, crab pots, picnic dates, summer festivals, turtle nesting protection, tide events.

5. Kelpglass Reefs  
   Low-tide reef exploration, snorkeling minigame, seaweed farming, coral restoration, rare fish, ocean-weather secrets.

6. Belltide Marsh  
   Wetland forage, frogs, reeds, medicinal herbs, boardwalk repairs, fog navigation, birdwatching collection.

7. Ironroot Quarry  
   Mining, crystal caves, old rail lifts, hazards, crafting metals, earth fauna, underground machine ruins.

8. The Rainhall Caverns  
   Combat-light exploration with echo creatures, mineral springs, ancient flooded halls, tide doors, rhythm puzzles, and rare crafting resources.

9. Splitwind Ridge  
   Mountain forage, windmills, glider shortcuts, snow-season foraging, goats, high-altitude crops, storm chaser quests.

10. Outer Islets  
   Late-game ferry unlocks with unusual crops, migratory animals, traveling merchant visits, map fragments, and eco-restoration projects.

### Farm map variants

Each farm type changes layout, starting perk, and early-game strategy.

1. Open Meadow Farm  
   Most tillable space. Starts with a wide cleared field and a sturdy old shed. Best for balanced, large-scale farming.

2. Tideplot Farm  
   Less soil, more water channels. Starts with crab pots and seaweed beds. Best for fishing and aquatic crafting.

3. Grovewall Farm  
   Dense trees, medicinal shrubs, and mushrooms. Best for foraging, bees, and animals that enjoy shade.

4. Quarryline Farm  
   Rocky slopes and ore nodes. Best for mining, tool upgrades, and sturdy building projects.

5. Marshlight Farm  
   Wetland plots, frogs, reeds, and rare flowers. Best for ecology quests and potion/cooking ingredients.

6. Fourwinds Farm  
   Four corner-like zones for local co-op or NPC helper assignment. Best for multiplayer and automation.

7. Pasturewell Farm  
   Starts with two mooncalf hens, sweetgrass pasture, and a small barn. Best for animal husbandry.

8. Stormbreak Farm  
   Hard mode. Debris, wind, uneven terrain, rare storm resources, and early hazard cleanup. Best for challenge runs.

---

## 4. Core Gameplay Systems

### Daily loop

Morning:

- Wake to weather, tide, mail, pet/animal needs, calendar, and optional morning stretch buff.
- Choose a short-term plan: farm, fish, mine, forage, cook, shop, socialize, explore, or take on a quest.

Day:

- Spend stamina and time on contextual world actions, movement, dialogue, crafting, cooking, and exploration.
- Tides reshape beaches and reefs twice per day.
- NPCs follow schedules influenced by season, weather, relationship, festivals, and town repairs.

Night:

- Shops close, lighting changes, rare NPC scenes appear, nocturnal forage emerges.
- Bedtime summary resolves crops, machines, animals, skill XP, relationship mail, and town project progress.

### Main skills

1. Cultivation  
   Crops, soil, irrigation, orchards, greenhouses, seed breeding.

2. Husbandry  
   Animal friendship, products, training, habitats, barns, pet gifts.

3. Foraging  
   Flora, mushrooms, shelling, woodcutting, wild seeds, habitat knowledge.

4. Angling  
   Fishing, crab pots, snorkeling, fish ponds, bait crafting.

5. Crafting  
   Machines, buildings, artisan goods, home decor, building parts.

6. Exploring  
   Mines, reefs, caves, ruins, secrets, map shortcuts.

7. Combat  
   Self-defense tools, dodging, knockback, monster lore, dungeon survival, hazard handling in the quarry and caverns.

8. Rapport  
   Dialogue choices, gift insight, mutual aid, diplomacy, conflict repair.

Skill levels unlock recipes, tool moves, movement options, perks, defensive techniques, map access, and profession branches. Do not clone Stardew's exact XP numbers or profession tree.

### Mining, caverns, and combat-light dungeons

The quarry-and-caverns system gives the game its long-tail "one more level" pull, the same way Stardew's mines do. It should feel calm and exploratory on the surface and tense but fair at depth.

Descent model:

- Ironroot Quarry and the Rainhall Caverns are layered into descending floors reached by ladders, shafts, and an elevator-style lift that banks checkpoints every few floors so a run never wastes a full day.
- Each floor is procedurally dressed from authored room kits: ore pockets, breakable rock, geode clusters, mineral springs, collapsed rail, tide doors, and the occasional carved chamber that hides lore or a rare resource.
- Light is a resource: lanterns, glow mushrooms, and crystal seams push back the dark, and deeper floors demand better light or grant less preview.

Resources and hazards:

- Ore tiers, gems, geodes, clay, coal, fossils, and rare storm-fused minerals gate tool upgrades, building parts, and artisan recipes.
- Hazards stay readable: falling rock, flooded tide-door rooms, slick stone, fragile floors, and timed mineral-spring vents.
- A health bar separate from stamina governs combat-light danger; defeat sends the player home with a recoverable, non-punishing setback rather than a game over.

Combat-light encounters:

- Original, non-gory creatures — echo crawlers, cave moths, glimmer slimes, rail wraiths, quarry geckos gone feral — telegraph attacks clearly and reward patience over reflexes.
- Defensive tools (a sturdy pick, a tide-iron blade, a thrown lure bomb, a shield charm) read at a glance and respect the Combat skill's perks.
- Encounters scale with depth and with the Combat skill, and an assist mode widens timing windows and reduces incoming damage for players who want exploration without pressure.

Progression:

- The Combat skill unlocks moves, perks, and professions: deeper safe-descent, better drop quality, knockback control, hazard resistance, and a defender/forager profession split.
- Mine depth gates a mid-game boss chamber and a late-game "deepest floor" mystery tied to the Storm Archive.
- Quarry Lift restoration unlocks rail carts, faster returns, and access to the rare-ore floors.

### Farming and ecology

Crops are original and coastal:

- Spring: bell peas, rainroot, blush radish, glasslettuce, poppy kale, tide turnip.
- Summer: sunmelon, saltcorn, bright okra, blueleaf basil, harborlime, shellbean.
- Fall: ember squash, copper beet, dusk yam, maplenut, velvet cabbage, cider pear.
- Winter: frost fennel, snowmoss, lantern leek, powderberry, ice carrot.
- Reef crops: kelp ribbons, pearl algae, brine lotus, coral mint.
- Greenhouse/late-game: starfruit-like rarity must be original, such as prism guava, cloud cacao, echo pepper.

Crop attributes:

- Season, grow days, regrow, water need, salt tolerance, wind tolerance, soil preference, quality, artisan paths, favorite NPCs, festival uses.

Animals:

- Mooncalf hens: eggs, feathers, affection coos.
- Bluff goats: milk, wool tufts, cliff grazing.
- Sand ducks: eggs, down, beach foraging.
- Kelp sheep: wool, lanolin, seaweed happiness buff.
- Shellback pigs: truffles, shell fragments, dig assist.
- Lantern bees: honey, wax, night garden glow.
- Tide turtles: late-game sanctuary animals, no exploitation, friendship gifts.
- Mistral cats and dock dogs: pets with fetch, comfort, and alert behaviors.

Animal care:

- Feeding, water, petting, brushing, habitat cleanliness, outdoor time, weather shelter, toys, training, and personality traits.
- Animals should have visible moods and small idle animations.

### Crafting, machines, and economy

Crafting categories:

- Farm tools: sprinklers, windbreaks, scare kites, composters, seed press.
- Artisan machines: brine barrel, herb dryer, cheese drum, honey spinner, oil press, pickle crock, smokehouse.
- Preserving and refining gear: kiln, loom, mayonnaise churn, preserves jar, seed maker, bait maker, ore furnace.
- Exploration gear: lantern, rope kit, reef shoes, mine cart battery, glider canvas.
- Decor: furniture, wall pieces, rugs, hanging banners, planters, aquariums, trophies.

Economy principles:

- Avoid one dominant crop. Use rotating demand, weather effects, shipping contracts, artisan time, storage pressure, and NPC preferences.
- Let players earn through farming, fishing, mining, foraging, commissions, animal products, crafting, cooking, and exploration.
- Add fair late-game automation, but preserve player choice and tactile charm.

### Community restoration

Replace the "community center bundle" idea with original civic projects:

1. The Netlight Beacon  
   Relights the lighthouse, makes night sailing safe again, unlocks the observatory deck, and triggers key character scenes.

2. Market Lane Canopies  
   Restores shops, traveling vendors, and rainy-day schedules.

3. Belltide Boardwalk  
   Unlocks marsh forage, birding, and medicine quests.

4. Ferry Winch  
   Unlocks Outer Islets and late-game trade.

5. Reef Nursery  
   Unlocks ecological restoration, snorkeling, and turtle sanctuary.

6. Quarry Lift  
   Unlocks deeper mining, rail carts, and rare ore.

7. Community Hall Stage  
   Unlocks plays, concerts, town meetings, and relationship events.

8. Storm Archive  
   Reveals town history, old rivalries, and the final mystery route.

Projects require item sets, money, relationship backing, skill checks, and occasional playable scenes.

---

## 5. Characters and NPC Roster

All characters are original. Each major NPC needs daily schedule tables, gift tastes, birthdays, portraits, animation sets, relationship arcs, conflict, growth, and at least 8 major scenes. Romance candidates should have consent-forward arcs and lives outside the player.

### Romance candidates

1. Mara Vale  
   Role: harbor mechanic and former shipwright's apprentice.  
   Personality: direct, funny, guarded, precise.  
   Arc: rebuilding trust after a salvage-fraud accusation she did not deserve.  
   Gameplay: repairs machines, unlocks workshop gadgets, advanced tool tinkering.  
   Loved gifts: gear oil blend, harborlime tart, polished copper beet, stormglass charm.

2. Jun Park  
   Role: bakery owner and beach cleanup organizer.  
   Personality: gentle, stubborn, secretly competitive.  
   Arc: choosing between family expectations and civic leadership.  
   Gameplay: cooking buffs, bread delivery quests, community hall events.  
   Loved gifts: honey loaf, blush radish jam, mooncalf egg custard, tide tea.

3. Sol Aranda  
   Role: cliffside botanist and seed archivist.  
   Personality: dreamy, rigorous, easily distracted by plants.  
   Arc: restoring extinct coastal crops from storm-buried seed caches.  
   Gameplay: seed breeding, greenhouse upgrades, rare flora.  
   Loved gifts: prism guava, pressed fern, lantern bee wax, field journal.

4. Niko Venn  
   Role: courier, glider pilot, and wind reader.  
   Personality: charming, restless, avoids grief through motion.  
   Arc: confronting the storm night when they failed to deliver a warning.  
   Gameplay: shortcuts, glider traversal, wind-route foraging tips.  
   Loved gifts: feather charm, cloud cacao, smoked shellbean, ridge map.

5. Cora Bell  
   Role: clinic apprentice and marsh singer.  
   Personality: warm, sharp, quietly ambitious.  
   Arc: balancing medicine, family caregiving, and her own dreams.  
   Gameplay: stamina tonics, health tutorials, marsh quests.  
   Loved gifts: lantern leek soup, medicinal reeds, pearl algae balm, songbook.

6. Tavi Stone  
   Role: quarry sculptor and stoneworker.  
   Personality: calm, tactile, protective, slow to speak.  
   Arc: learning to make art for joy after years of commission work.  
   Gameplay: stone decor, mining perks, geode cutting.  
   Loved gifts: echo crystal, ember squash stew, carved driftwood, goat cheese.

7. Lio Marin  
   Role: fishmonger and reef diver.  
   Personality: flamboyant, generous, conflict-avoidant.  
   Arc: admitting fear of deep water after the storm.  
   Gameplay: fishing lures, snorkeling, reef restoration.  
   Loved gifts: cave jelly, harborlime ceviche, reef mint, rare shell.

8. Petra Quill  
   Role: librarian, local historian, rules expert.  
   Personality: dry wit, patient, intense about archives.  
   Arc: uncovering how old town rivalries worsened storm damage.  
   Gameplay: lore, books, map fragments, dialogue insight perks.  
   Loved gifts: storm archive page, dusk yam curry, inkcap mushroom, old whistle.

9. Zed Romero  
   Role: traveling musician and festival announcer.  
   Personality: magnetic, evasive, emotionally observant.  
   Arc: deciding whether Ballast Bay can become home.  
   Gameplay: music layers, festival performances, seasonal song variants.  
   Loved gifts: honeyed tea, rare vinyl, velvet cabbage roll, stage lantern.

10. Imani Brooks  
   Role: carpenter and town planner.  
   Personality: practical, hilarious, perfectionist.  
   Arc: learning that rebuilding community is not the same as controlling it.  
   Gameplay: buildings, home renovations, town projects.  
   Loved gifts: hardwood resin, copper beet pie, blueprint tube, shellback truffle.

11. Elsie Rowan  
   Role: animal sanctuary keeper.  
   Personality: tender, chaotic, observant.  
   Arc: protecting animals without shutting people out.  
   Gameplay: animal training, sanctuary, pets, rare animal care.  
   Loved gifts: sweetgrass, mooncalf feather, lantern honey, turtle charm.

12. Bash Calder  
   Role: former harbor rescue diver, now schoolhouse groundskeeper and youth mentor.  
   Personality: loud, kind, secretly insecure.  
   Arc: redefining worth after the injury that ended his rescue career.  
   Gameplay: schoolhouse repair quests, kids' nature-club quests, confidence buffs.  
   Loved gifts: protein stew, woven banner, sunmelon juice, polished brass compass.

### Core non-romance NPCs

- Mayor Alma Dace: civic leader with a complicated history around the storm warnings.
- Milo and Min Bell: twins who run the general store and disagree about modernization.
- Dr. Oren Quay: clinic lead, collector of odd shells.
- Aunt Nessa: player's relative, writes tutorial letters, visits seasonally.
- Elder Rell: retired master forager and quarry hand who unlocks skill mastery and late-game deep-cavern access.
- Fern: shy school kid who names stray animals and starts the turtle sanctuary quest.
- Captain Oda: ferry captain whose boat is damaged until the winch project is complete.
- Sable: blacksmith with a soft spot for poetry and high-quality ore.
- Rumi: bathhouse owner and weather watcher.
- Etta Finch: elderly birdwatcher who tracks seasonal fauna.
- The Brine Club: three salty old fisherfolk who bicker, swap tall tales, and warm to the player over many shared seasons on the docks.

### Relationship mechanics

- 10 friendship levels for most NPCs; 14 for spouse/partner equivalent if romance exists.
- Daily talk, gifts, birthdays, quests, shared work, festival participation, and dialogue choices affect rapport.
- Each NPC has at least:
  - 120 ambient lines.
  - 40 seasonal/weather lines.
  - 20 town-project reaction lines.
  - 12 gift reactions.
  - 8 relationship scenes.
  - 3 conflict scenes where the player can help, worsen, or delay resolution.
  - 2 shared-project or working-side-by-side scenes.
  - 1 late-game "years later" scene.

---

## 6. Flora, Fauna, Weather, and Ambience

### Flora

- Salt pine, glassleaf willow, bell reeds, copper moss, lantern fern, tide clover, blush poppy, stormvine, kelp ribbons, mooncap mushrooms, cliff lavender, sea oats, prism guava trees, cider pear trees.

### Fauna

- Sandpipers, bright crabs, fog frogs, reef minnows, cliff goats, tide turtles, marsh herons, cave moths, lantern bees, silver eels, rain snails, quarry geckos, dusk bats.

### Weather

- Sunny, overcast, rain, heavy rain, sea fog, windstorm, heat shimmer, green tide, meteor shower, first frost, lantern mist.

Weather must alter:

- Crop growth.
- NPC schedules.
- Mining and cavern hazards.
- Fish tables.
- Ambient audio.
- Lighting and shadows.
- Available scenes.
- Travel shortcuts.

### Visual style

- Approved direction: Theme 3, an original late-1990s N64-era low-poly 3D adventure aesthetic. It should evoke the technical charm of that era without copying Zelda characters, symbols, costumes, locations, props, UI, or compositions.
- Chunky low-polygon geometry, strong silhouettes, hand-painted low-resolution textures, restrained texture filtering, vertex-color accents, baked ambient shading, atmospheric distance fog, and jewel-toned environmental lighting.
- Characters use expressive simplified anatomy, reusable humanoid rigs, readable hands and feet, face texture swaps or lightweight facial joints, and personality-specific posture layers.
- Every character, animal, plant, building, tool, machine, crop, and collectible receives a model reference set: hero render, orthographic turnaround, wireframe/topology view, UV/material sheet, scale comparison, and movement/posture sheet where applicable.
- Character motion library includes idle, walk, jog, sprint, pivot, stop, slope, stair, carry, tool, gift, converse, emote, mine, chop, fish, defend/dodge, swim/snorkel, sit, sleep, and festival variants.
- Creature motion includes breathing, looking, locomotion, feeding, grazing, playing, resting, weather reaction, affection, product behavior, and species-specific personality loops.
- Flora motion uses lightweight wind phases, growth stages, harvest reactions, seasonal transitions, shoreline movement, and distance-based animation reduction.
- Environmental animation includes grass sway, shoreline foam, tide lines, window lights, moths, drifting pollen, flags, hanging fishing nets, water caustics, fog volumes, and lantern flicker.
- Camera uses a three-quarter third-person adventure view with smooth orbit constraints, context-sensitive framing, occlusion handling, indoor camera volumes, and mobile-safe zoom bands.
- Day/night rendering combines directional light, ambient/hemisphere light, baked lightmaps where useful, vertex color, localized lights, fog, and restrained post-processing.
- Approved reference images live under `art-production/style-themes/theme-03-n64-low-poly-adventure/` and are the visual source of truth.

---

## 7. Browser Technical Plan

Recommended stack:

- Engine/rendering: Babylon.js with a small game-layer architecture built around Babylon scenes, `AssetContainer` lifecycle, animation groups, cameras, lighting, materials, particles, and interaction systems.
- Language: TypeScript.
- Build: Vite.
- Data: JSON or YAML converted to typed JSON at build time.
- 3D authoring: Blender using shared unit scale, naming, rig, origin, transform, UV, and export conventions.
- Runtime assets: glTF 2.0 binary `.glb`, Draco or Meshopt geometry compression, KTX2/Basis texture compression, and split animation libraries where beneficial.
- Physics/collision: Havok (via the Babylon.js Havok plugin) for character, trigger, and lightweight rigid-body collision. Keep farming interactions grid-aware while rendering the world freely in 3D.
- Navigation: baked navigation meshes with schedule waypoints, local avoidance, doors, off-mesh links, and recovery behavior.
- Maps: modular 3D scene chunks assembled from authored terrain, buildings, props, collision proxies, navigation data, spawn points, camera volumes, and interaction anchors.
- Saves: IndexedDB with localStorage fallback and export/import save files.
- Audio: WebAudio with layered music stems, ambience zones, positional emitters, and pooled one-shots.
- UI: responsive HTML/CSS overlay with Babylon.js world-space indicators only where spatial context is necessary.
- Tests: Vitest for pure logic; Playwright for smoke, layout, save/load, and mobile viewport checks.

3D production rules:

- Use meters consistently: a standard adult character is approximately 1.7 to 1.8 world units tall.
- Freeze transforms before export and use predictable origins, pivots, sockets, and forward axes.
- Share rigs across compatible humanoids and animals; do not create a unique skeleton for every cosmetic variant.
- Favor one material per simple prop and tightly controlled materials per character or building kit.
- Use small hand-painted texture atlases, vertex colors, and reusable trim sheets instead of high-resolution unique textures everywhere.
- Separate collision meshes from visible meshes. Collision must remain simple, stable, and invisible.
- Author explicit animation clip names and loop rules. Root motion is reserved for controlled cutscenes or special scripted actions.
- Preserve topology around shoulders, elbows, hips, knees, neck, wrists, ankles, jaws, tails, wings, and plant bend points.
- Build level-of-detail variants for large scenery and expensive repeated assets. Use impostors or billboards only when their transition is visually acceptable.

Performance targets:

- First playable load under 5 seconds on average broadband after caching.
- 60 FPS target on desktop, 30-60 FPS on midrange mobile.
- Stable frame pacing is more important than maximum effects quality.
- Initial interactive download target under 35 MB, with later regions streamed on demand.
- Typical visible scene target: under 250 draw calls on desktop and under 140 on target mobile after batching/instancing.
- Typical active triangle target: under 500,000 on desktop and under 220,000 on target mobile, measured after culling and LOD.
- Limit simultaneously active skinned characters; distance-throttle animation and schedule updates.
- Use texture atlases, compressed textures, instancing, occlusion/frustum culling, pooled effects, and lazy-loaded region bundles.
- Lazy-load late-game maps.
- Simulate distant NPC schedules abstractly instead of pathfinding every offscreen character.
- Deterministic simulation for save/load and replayable testing.
- Add automated canvas-pixel checks to detect blank, misframed, or failed 3D scenes.

Accessibility:

- Remappable controls.
- Touch, keyboard, mouse, and controller.
- Reduce motion option.
- High-contrast interaction and targeting reticle.
- Dyslexia-friendly font option for UI text.
- No time pressure assist mode.
- Fishing and combat timing assist.
- Colorblind-safe quality markers.

---

## 8. Sequential Prompt Roster

Use the following prompts in order with a coding agent. Each prompt assumes the previous prompt has been completed, tested, and committed or checkpointed. For every prompt: keep assets original, use placeholder art only when needed, keep data-driven systems extensible, and follow the approved Theme 3 low-poly 3D art bible. Execute the mandatory Theme 3 Production Track after Prompt 003 and before Prompt 004.

### Prompt 001 - Project scaffold and quality bar

Build the initial browser game project for Sturdy Volley using TypeScript, Vite, Babylon.js, Vitest, and Playwright. Create a clean folder structure for rendering, simulation, animation, physics, navigation, game data, modular 3D scenes, UI, compressed assets, tests, and design docs. Add scripts for dev, build, test, lint, asset validation, and preview. Add a title screen with a lightweight animated 3D Ballast Bay diorama that loads without console errors on desktop and mobile viewports.

Acceptance criteria:

- `npm run dev`, `npm run build`, and `npm test` succeed.
- Playwright opens the title screen at desktop and mobile sizes.
- The title screen has Start, Continue disabled, Settings, and Credits.
- Canvas-pixel checks confirm that the 3D title scene is visible and correctly framed.
- No Stardew Valley assets, code, names, or extracted data are present.

### Prompt 002 - Game design constants and typed data pipeline

Create a typed data pipeline for crops, items, NPCs, animals, maps, quests, recipes, skills, weather, festivals, dialogue, and shops. Use JSON data files with TypeScript schema validation. Add a developer-only data validation screen.

Acceptance criteria:

- Invalid data fails tests with useful errors.
- At least 10 sample items, 4 crops, 2 NPCs, 2 animals, and 2 recipes load from data.
- Data IDs are stable and human-readable.

### Prompt 003 - Scene manager and save bootstrap

Implement scene transitions for Boot, Preload, Title, NewGame, Farm, Town, Interior, Beach, Mine, and UI overlay. Add a save model with player identity, day, season, time, inventory, map state, relationships, skills, and flags.

Acceptance criteria:

- New Game creates a save.
- Continue loads the save after refresh.
- Save export/import works through a settings menu.
- Scene transition fades are smooth and interrupt-safe.

## Mandatory Theme 3 Production Track

Execute this track after Prompt 003 and before Prompt 004. These prompts lock the visual production system before large-scale world or content implementation.

### Theme 3 Prompt A01 - Final 3D art bible

Convert the approved images in `art-production/style-themes/theme-03-n64-low-poly-adventure/` into a production art bible. Define model proportions, polygon density, silhouette rules, texture resolution tiers, palette families, vertex-color use, fog ranges, lighting recipes, camera framing, animation exaggeration, and UI integration. Include explicit originality rules that exclude copied Zelda characters, symbols, locations, costumes, creatures, props, or UI.

Acceptance criteria:

- Player, NPC, animal, prop, building, plant, and environment examples share one recognizable visual language.
- The bible distinguishes deliberate N64-era constraints from accidental low quality.
- Desktop and mobile reference captures remain readable at gameplay scale.

### Theme 3 Prompt A02 - Model specification and budget matrix

Create a model specification matrix for every asset class. Define approximate triangle ranges, materials, texture dimensions, LOD count, skeleton limits, collision type, animation needs, attachment sockets, shadow behavior, and expected screen size.

Acceptance criteria:

- Budgets exist for hero characters, background NPCs, large animals, small animals, crops, trees, tools, machines, buildings, modular terrain, cave/mine props, and collectibles.
- Repeated assets have stricter draw-call and instancing requirements.
- Every item in the art roster can be assigned to a documented class.

### Theme 3 Prompt A03 - Shared humanoid rigs and character topology

Design a shared humanoid skeleton family for player and adult NPCs, plus compatible variants for children, broad bodies, tall bodies, and older posture profiles. Create topology references for deformation at shoulders, elbows, wrists, fingers, spine, hips, knees, ankles, neck, jaw, and face texture regions.

Acceptance criteria:

- At least 80 percent of humanoid clips can be reused across compatible characters.
- Character individuality comes from proportions, posture, timing, accessories, materials, and additive poses rather than incompatible skeletons.
- Wireframes remain economical and deformation-safe.

### Theme 3 Prompt A04 - Character locomotion and posture library

Build the base humanoid movement library: neutral idle, personality idle overlays, walk, brisk walk, jog, sprint, start, stop, 45/90/180-degree pivots, strafe, slope ascent/descent, stairs, balance recovery, crouch, kneel, sit, stand, sleep, wake, swim, snorkel, ladder, and carry locomotion. Define posture profiles for confident, guarded, tired, elderly, injured, shy, exuberant, and precise characters.

Acceptance criteria:

- Clips have named loop, transition, contact, and event frames.
- Foot contacts and root movement are documented.
- Player controls feel immediate while NPC locomotion retains personality.
- Reduced-motion alternatives exist for exaggerated camera or body movement.

### Theme 3 Prompt A05 - Work, social, and emotional animation library

Build reusable actions for hoeing, watering, chopping, mining, harvesting, planting, brushing animals, feeding, milking, shearing, fishing, cooking, crafting, reading, writing, shopping, repairing, lifting, pushing, pulling, opening, picking up, giving, receiving, hugging, waving, pointing, listening, arguing, apologizing, laughing, crying, celebrating, worrying, and resting.

Acceptance criteria:

- Each action includes anticipation, contact, follow-through, and interrupt rules.
- Hand props attach through named sockets and align through authored interaction anchors.
- Social clips can be mirrored or lightly retargeted without obvious errors.

### Theme 3 Prompt A06 - Combat, tool-impact, and festival animation library

Create the full action motion set: ready stance, dodge roll, sidestep, guard, light and heavy tool/weapon swings, thrown-item wind-up and release, hit reaction, knockback, stagger, get-up, mining strike, ore-break recovery, exhaustion, celebration, disappointment, congratulatory clap, and injury-safe fall recovery. Add festival and social-event motions: dance steps, cheering, toasting, lantern lifting, and crowd idle loops. Define exact contact frames and tool/hand impact zones.

Acceptance criteria:

- Gameplay owns hit detection and damage while animation supplies readable timing and contact events.
- Each action has beginner, skilled, and personality variants where valuable.
- Transitions remain responsive on keyboard, touch, and controller.

### Theme 3 Prompt A07 - Animal rigs, behavior, and posture library

Create rig families and movement sheets for mooncalf hens, chicks, bluff goats, sand ducks, kelp sheep, shellback pigs, tide turtles, cats, dogs, frogs, crabs, reef fish, cave moths, quarry geckos, and seasonal birds. Cover idle, locomotion, feeding, social behavior, sleep, affection, fear, weather response, product behavior, play, and species-specific actions.

Acceptance criteria:

- Related species reuse skeletons or animation patterns when anatomy permits.
- Each species has at least three personality-rich idle behaviors.
- Small fauna can use vertex animation, texture animation, or simple joint chains instead of expensive full rigs.

### Theme 3 Prompt A08 - Flora and environmental motion library

Define growth models and motion for every crop, tree, flower, mushroom, reed, kelp, seaweed, and environmental effect. Include growth stages, wind tiers, rain weight, harvest reaction, regrowth, seasonal death, snow load, tide movement, underwater sway, and distance-throttled animation.

Acceptance criteria:

- Motion originates from plausible bend points.
- Shared shaders or animation phases prevent every plant from moving in sync.
- Far vegetation becomes cheaper without obvious popping.

### Theme 3 Prompt A09 - Complete item and prop library

Build a master inventory of all tools, seeds, crops, forage, fish, ore, wood, stone, shells, food, recipes, gifts, quest objects, weapons and defensive gear, machines, furniture, clothing, books, letters, trophies, building parts, and festival props. For each item define world model, inventory icon render, held orientation, collision, scale, material, quality variants, animation needs, and destruction/placement rules.

Acceptance criteria:

- No gameplay item exists only as an undocumented name.
- Held and placed items use consistent sockets, pivots, and scale.
- Inventory icons are rendered from approved models with controlled lighting and backgrounds.
- The library includes production status, dependencies, and validation checks.

### Theme 3 Prompt A10 - Blender-to-browser validation pipeline

Create automated and manual validation for `.blend` source conventions and exported `.glb` files. Check transforms, scale, pivots, naming, missing textures, material count, texture sizes, triangle budgets, skeleton size, clip names, loop flags, bounding volumes, collision proxies, LODs, sockets, and compression.

Acceptance criteria:

- Invalid assets fail with actionable messages before entering a release build.
- A browser model viewer previews animation clips, wireframe, normals, UV/material assignments, collision, LODs, and mobile lighting.
- Every approved model has a thumbnail and searchable metadata entry.

### Prompt 004 - 3D world renderer, terrain, and collision

Create the first playable Breakpoint Farm as a modular low-poly 3D scene using original placeholder models that obey the Theme 3 scale and material rules. Add terrain chunks, grid-aware farming cells, simple collision proxies, interaction anchors, animated water, instanced grass, doors, camera volumes, occlusion handling, and world bounds.

Acceptance criteria:

- Player can walk around the farm with keyboard and touch.
- Collision is correct for fences, water, rocks, trees, buildings, props, slopes, stairs, and cliffs.
- Camera follows without jitter, avoids clipping, and reframes indoors.
- Farm cells remain deterministic and addressable even though the world renders freely in 3D.
- Mobile viewport keeps the player and UI readable.

### Prompt 005 - Player controller and interaction model

Implement third-person player movement, facing, jogging, sprinting, acceleration, braking, pivots, slope/stair handling, stamina drain, contextual interact button, tool slot selection, and 3D action targeting. Add an interaction resolver for farm cell, prop, NPC, animal, machine, door, pickup, ore node, water entry, and climb link interactions. Drive movement through a reusable humanoid rig and animation state machine.

Acceptance criteria:

- One interaction button handles multiple nearby targets predictably.
- Touch controls support virtual stick and tap-to-move mode.
- Keyboard/controller controls are remappable.
- Interaction prompts never overlap the hotbar.
- Locomotion blends cleanly between idle, walk, jog, sprint, pivot, stop, slope, and stair clips.
- Foot placement, facing, and interaction alignment remain believable without requiring expensive full-body inverse kinematics on mobile.

### Prompt 006 - Time, calendar, and day resolution

Implement time from 6:00 AM to 2:00 AM, four 28-day seasons, weekdays, birthdays, festivals, weather forecast, tide schedule, and bedtime/day-summary flow.

Acceptance criteria:

- Time advances, can pause in menus, and accelerates only in debug.
- Passing out after 2:00 AM returns player home with configurable penalty.
- Day summary shows income, skill XP, relationship changes, and next-day notices.

### Prompt 007 - Inventory, hotbar, chests, and item quality

Build inventory with stackable items, quality tiers, hotbar, drag/drop, split stacks, trash, shipping bin, chest storage, and item tooltips.

Acceptance criteria:

- Inventory works with mouse, touch, keyboard, and controller.
- Chests persist contents.
- Shipping bin sells overnight.
- Tooltips show source, tags, sell value, quality, and gift category when known.

### Prompt 008 - Soil, crops, watering, and harvesting

Implement tilling, planting, watering, crop growth, seasonal death, fertilizer, quality rolls, harvest animation, and seed packets.

Acceptance criteria:

- Four original crops grow across multiple days.
- Watered state visibly changes.
- Harvest adds items with quality.
- Rain waters outdoor crops.

### Prompt 009 - Tools and upgrades

Add low-poly hoe, watering can, axe, pick, sickle, fishing rod, and a basic defensive blade/tool model. Add hand sockets, carried/stowed states, tool levels, charge actions, 3D area previews projected onto terrain, contact events, and upgrade-specific materials.

Acceptance criteria:

- Tools consume stamina according to skill and upgrade level.
- Upgraded tools affect wider areas or tougher objects.
- Tool animations have anticipation, impact, and recovery frames.
- Each tool aligns to the shared rig without hand sliding or incorrect pivots.

### Prompt 010 - Foraging, debris, trees, and regrowth

Create seasonal forage spawn tables, farm debris, tree growth, chopping, stumps, grass, shells, mushrooms, and daily regrowth rules.

Acceptance criteria:

- Forage spawns in valid map regions.
- Trees and grass regrow over time.
- Foraged item quality can be influenced by skill.

### Prompt 011 - NPC schedule engine

Implement NPC schedule data with daily, seasonal, weather, festival, relationship, and event overrides. Add navigation-mesh pathfinding, off-mesh links, door transitions, local avoidance, posture profiles, personality idles, facing, interaction alignment, animation throttling, and conversation availability.

Acceptance criteria:

- At least 4 NPCs follow schedules across farm, town, interiors, and beach.
- NPCs avoid obstacles and recover if blocked.
- Debug overlay can show current schedule target.
- Offscreen NPCs advance through abstract schedules without consuming full navigation or animation cost.

### Prompt 012 - Dialogue engine

Create a dialogue system with portraits, typewriter option, branching choices, conditions, flags, affection changes, item checks, and scene triggers.

Acceptance criteria:

- Dialogue supports daily repeats, once-only lines, weather lines, and relationship lines.
- Choices can set flags and change rapport.
- Dialogue can start quests and cutscenes.

### Prompt 013 - Friendship and gifts

Implement relationship points, levels, daily talk tracking, weekly gift limits, birthdays, liked/loved/neutral/disliked/hated gifts, and gift discovery UI.

Acceptance criteria:

- NPC relationship panel updates correctly.
- Birthday gifts multiply relationship impact.
- Gift reactions are data-driven.
- No exact Stardew friendship values are copied.

### Prompt 014 - Cutscene and event scripting

Build a 3D cutscene runner for authored cameras, camera splines, character blocking, look targets, animation clips, additive postures, dialogue, emotes, held props, item changes, sound cues, restrained screen shakes, fades, lighting cues, and choices.

Acceptance criteria:

- At least 2 relationship scenes and 1 town project scene are implemented.
- Cutscenes are skippable after first viewing.
- Events cannot soft-lock the player.
- Cutscene blocking remains readable at desktop, tablet, and phone aspect ratios.

### Prompt 015 - Ballast Bay town map

Create the main town as streamed modular low-poly 3D scene chunks with market lane, bakery, clinic, library, gear shop, community hall, schoolhouse, blacksmith, apartments, harbor, and beach access. Use shared building kits, trim textures, prop families, navigation meshes, collision proxies, camera volumes, LODs, and baked lighting data where appropriate.

Acceptance criteria:

- Buildings have working doors and open/closed schedules.
- Map feels navigable on mobile.
- Ambient animations include flags, water, birds, windows, and market details.
- Scene streaming and culling stay within the documented mobile budgets.

### Prompt 016 - Shops and economy

Add general store, bakery, fishmonger, blacksmith, carpenter, animal sanctuary, and gear shop. Implement stock tables, seasonal stock, price modifiers, opening hours, and cart/wallet UI.

Acceptance criteria:

- Buying and selling works.
- Shops close on schedule and during active festivals.
- Stock can react to town projects.

### Prompt 017 - Crafting and recipes

Implement crafting menu, known recipes, recipe unlocks, ingredient checks, machine placement, and recipe categories.

Acceptance criteria:

- At least 20 recipes exist.
- Recipes unlock through skills, NPCs, shops, and quests.
- Placed crafted objects persist on maps.

### Prompt 018 - Machines and artisan goods

Implement machine processing with input slots, fuel rules where needed, timers, output quality, ready animations, and batch collection.

Acceptance criteria:

- Brine barrel, herb dryer, cheese drum, honey spinner, and oil press work.
- Machines process across day transitions.
- Audio and visual states make readiness obvious.

### Prompt 019 - Animal husbandry

Add barns/coops/pastures, feeding, petting, mood, product generation, animal names, animal animations, doors, weather shelter, and affection.

Acceptance criteria:

- Mooncalf hens and bluff goats are fully functional.
- Animals path outdoors and return indoors.
- Animal tab summarizes needs and mood.

### Prompt 020 - Pets and companion behaviors

Add starter pet selection, pet affection, water bowl, fetch scenes, comfort buffs, cosmetic collars, and pet gifts.

Acceptance criteria:

- Pet follows or idles naturally.
- Pet never blocks doors permanently.
- Max affection unlocks a useful but nonmandatory perk.

### Prompt 021 - Fishing and crab pots

Build fishing with cast distance, fish bite timing, tension minigame, seasonal fish tables, weather/tide modifiers, treasure chance, crab pots, bait, and first-catch notification.

Acceptance criteria:

- At least 12 original fish exist.
- Fishing works by mouse, touch, keyboard, and controller.
- Assist mode reduces timing difficulty.

### Prompt 022 - Low-tide reef and snorkeling

Implement tide-dependent reef access, oxygen meter, swimming movement, collectible shells, reef crops, coral nursery, and harmless sea-life interactions.

Acceptance criteria:

- Reef changes between low and high tide.
- Snorkeling is readable on mobile.
- Reef restoration changes visuals over time.

### Prompt 023 - Mining and cave exploration

Create Ironroot Quarry and Rainhall Caverns with breakable rocks, ore nodes, ladders/doors, hazards, simple creatures, loot, lighting, and stamina/health.

Acceptance criteria:

- At least 20 cave levels or room variants exist.
- Progress can be saved through elevator-style checkpoints.
- Combat is light, readable, and optional-friendly where possible.

### Prompt 024 - Defensive tools and NPC daily-life depth

Implement the foundational self-defense layer (simple defensive tools, knockback, creature telegraphs, a health bar, invulnerability frames, and loot) that Prompts 025-026 build on. Then deepen NPC daily life: richer schedule branches by season/weather/relationship, idle "living" behaviors (eating, browsing shops, chatting in pairs, working their trade), reactive greetings that reference recent player actions, and small unscripted moments that make the town feel inhabited.

Acceptance criteria:

- Defensive encounters support keyboard, touch, and controller, and player defeat is recoverable and not overly punitive.
- NPCs visibly do more than stand and wait: at least four show distinct, schedule-driven daily-life behaviors.
- Creature designs are original and non-gory; NPC reactions are data-driven and never soft-lock the player.

### Prompt 025 - Mine depth, elevator, and boss chamber

Build the deterministic descending-floor system for Ironroot Quarry and the Rainhall Caverns: procedurally dressed floors from authored room kits, ladders and shafts, an elevator-style checkpoint lift, ore/geode/fossil nodes, breakable rock, tide-door and flooded-room hazards, light-as-resource lanterns, a separate health bar, and a mid-game boss chamber gated by depth.

Acceptance criteria:

- Player can descend, bank checkpoints at the lift, and return home safely after a defeat with a recoverable, non-punishing setback.
- Floor generation is deterministic from a seed for save/load and testing.
- The boss chamber has a clear telegraphed pattern and a fair, optional-assist-friendly fight.
- Mobile controls feel playable with one thumb plus an action button.

### Prompt 026 - Combat-light creatures, AI, and difficulty

Add original non-gory cave creatures with telegraphed attacks, simple defensive AI roles (patrol, chase, retreat, swarm), knockback, invulnerability frames, loot drops, and difficulty profiles that scale with depth and the Combat skill.

Acceptance criteria:

- Encounters are playable with keyboard, touch, and controller.
- AI makes believable decisions without perfect reactions, and assist mode widens timing windows.
- Creature designs are original, non-gory, and readable at gameplay scale and mobile size.

### Prompt 027 - Skill professions and mastery

Add the skill XP, level, and profession system for Cultivation, Husbandry, Foraging, Angling, Crafting, Exploring, Combat, and Rapport: branching profession choices at milestone levels, perk effects on tool cost and yields, a trainer/mentor NPC, and a late-game mastery track that re-engages maxed skills.

Acceptance criteria:

- At least one branching profession choice exists per skill.
- Profession perks measurably change play (energy cost, yield, drop quality, prices, hazard resistance) without trivializing progression.
- Tutorials and mastery prompts are playable and skippable, and no exact Stardew XP numbers or profession tree are copied.

### Prompt 028 - Quest system

Implement quest journal, story quests, daily requests, special orders, objectives, timers, rewards, relationship effects, progress notifications, and cancellation rules.

Acceptance criteria:

- At least 12 quests exist across farming, fishing, crafting, mining, foraging, exploration, and social arcs.
- Quest UI is touch-friendly.
- Failed timed quests do not break story paths.

### Prompt 029 - Community restoration projects

Implement civic project board, contribution UI, item/money/relationship requirements, project phases, visual map changes, opening ceremonies, and reward unlocks.

Acceptance criteria:

- At least 3 projects are fully functional.
- Completed projects visibly alter maps and schedules.
- Project ceremonies include NPC reactions.

### Prompt 030 - Festivals phase one

Create the seasonal festival framework and implement three festivals: Spring Seed Blessing, Summer Glowtide Night, and Fall Harvest Fair.

Acceptance criteria:

- Festival days alter schedules, shops, map setup, and music.
- Each festival has at least one non-sport minigame (a foraging hunt, a cook-off, a lantern release, a fishing contest), special shop, and relationship opportunity.
- Multiplayer hooks are considered even if multiplayer is later.

### Prompt 031 - Festivals phase two

Add the Winter Frostlight Festival, Lantern Tide, Marsh Chorus, the Founders Harvest Fair, and rotating second-year variants.

Acceptance criteria:

- Festivals have year-two dialogue/map variations.
- The Founders Harvest Fair depends on town-restoration progress (lighthouse beacon, market hall, boardwalk) and NPC relationship arcs.
- Festival rewards are unique but not mandatory for main progression.

### Prompt 032 - Mail, news, and world reactivity

Add mail system, town notice board, weather/tide forecast, shipping and town-restoration progress notes, birthday reminders, lost-and-found, and dynamic news after player actions.

Acceptance criteria:

- Mail can deliver items, recipes, quests, and story.
- Notice board creates daily and weekly reasons to visit town.
- News reacts to projects, festivals, and restoration milestones.

### Prompt 033 - Cooking and buffs

Implement kitchen, recipes, ingredient tags, cooking UI, food buffs, favorite meals, picnic scenes, and shared meals at festivals and community work days.

Acceptance criteria:

- At least 25 original recipes exist.
- Buffs affect stamina, skill, movement, fishing, mining, foraging, or combat.
- NPC meal preferences integrate with relationships.

### Prompt 034 - Home, decor, and customization

Add farmhouse interiors, furniture placement, wallpaper/flooring, renovations, wardrobe, player appearance, decorative banners, trophy and curio shelves, and photo mode.

Acceptance criteria:

- Decor placement works with touch and mouse.
- Player appearance can be changed after start.
- Photo mode hides UI and saves screenshots where browser permits.

### Prompt 035 - Audio architecture

Implement music manager, ambient layers, positional sound, UI sounds, tool sounds, mine and cavern sounds, weather ambience, festival stingers, and accessibility volume controls.

Acceptance criteria:

- Music changes by region, season, time, weather, and event.
- Ambience crossfades cleanly.
- Audio can be muted by category.

### Prompt 036 - Visual polish pass one

Replace placeholders for farm, player, core tools, first 4 NPCs, first animals, crops, and UI with validated Theme 3 `.glb` models and compressed textures. Integrate approved topology, shared rigs, posture profiles, held-item sockets, animation state machines, LODs, collision proxies, icon renders, squash/stretch where appropriate, impact particles, water ripples, footstep puffs, and harvest effects.

Acceptance criteria:

- The first 15 minutes look cohesive.
- Animations have anticipation and follow-through.
- UI remains legible over bright and dark maps.
- Wireframe, texture, rig, scale, and movement references exist for every integrated hero asset.

### Prompt 037 - Visual polish pass two

Add seasonal material/prop variants, weather particles and fog, day/night lighting, indoor lighting transitions, window glows, festival crowd reactions, animated flora/fauna, shoreline/tide meshes, water caustics, vertex-color variation, and distance-based effect reduction.

Acceptance criteria:

- Each season feels distinct within 5 seconds of looking.
- Weather affects both mood and gameplay readability.
- Performance remains within target.
- Lighting preserves the approved N64-era character while remaining clear and comfortable on modern screens.

### Prompt 038 - NPC content expansion

Expand the roster to 12 romance candidates and 12 core town NPCs with schedules, portraits, gift tastes, birthdays, and relationship scenes.

Acceptance criteria:

- Each NPC has at least 80 lines before launch alpha.
- No NPC exists only as a shop interface.
- Relationship arcs interconnect through town events.

### Prompt 039 - Narrative act structure

Implement the main story in three acts: Arrival and Repair, Trust and Old Wounds, and the Storm Archive and Founders Harvest Fair. Add act gates, optional routes, moral choices, and post-credits year-two content.

Acceptance criteria:

- Main story can be completed without romance.
- Choices change scenes and town flavor without locking core features unfairly.
- Ending celebrates community restoration, not total domination.

### Prompt 040 - Secrets and long-tail goals

Add hidden rooms, rare weather events, secret crops, legendary fish, deep-cavern relics, animal personalities, map fragments, archive mysteries, and multi-year scenes.

Acceptance criteria:

- Secrets are hinted through lore and environment, not random obscurity alone.
- At least 20 secrets exist by beta.
- Completion log avoids spoiling undiscovered secrets.

### Prompt 041 - Save migration and data versioning

Add save schema versioning, migrations, backup slots, corruption recovery, autosave, manual save export, and cloud-save-ready abstraction.

Acceptance criteria:

- Old test saves migrate after schema changes.
- Corrupt saves fail gracefully.
- Exported save can be imported on another browser.

### Prompt 042 - Mobile optimization

Polish mobile UI, touch targets, safe areas, virtual controls, camera distance, occlusion, dynamic resolution, shadow tiers, fog range, LOD bias, animation update rate, texture residency, battery-aware effects, streamed asset loading, orientation handling, and PWA install.

Acceptance criteria:

- Works on 360x740 and tablet viewports.
- No required button is under 44x44 CSS pixels.
- PWA can launch offline after first load.
- Target mobile scenes remain within triangle, draw-call, texture-memory, and active-rig budgets.

### Prompt 043 - Controller and console-style feel

Add full controller navigation, focus rings, radial menus, rumble hooks where browser supports it, and couch-friendly UI scaling.

Acceptance criteria:

- Entire first day is playable with controller only.
- Menus have predictable focus order.
- Button prompts update by input device.

### Prompt 044 - Accessibility complete pass

Add final accessibility settings for motion, flashing, timing assists, contrast, text size, font, color markers, audio cues, and remapping.

Acceptance criteria:

- Fishing and combat-light encounters can be completed with assist settings.
- Important information is not color-only.
- Settings are available before gameplay starts.

### Prompt 045 - Automated test suite

Create tests for crop growth, inventory, shops, relationships, quests, festivals, saves, machines, animals, mine-floor generation and combat resolution, scene smoke loads, GLB validation, animation clip availability, interaction anchors, collision proxies, navigation links, and visual canvas output.

Acceptance criteria:

- Core logic has deterministic tests.
- Playwright smoke covers desktop and mobile.
- CI-ready scripts run without manual browser interaction.
- Screenshot and canvas-pixel checks detect blank scenes, broken cameras, missing models, failed materials, and major framing regressions.

### Prompt 046 - Balancing tools

Build debug dashboards for economy, crop profits, XP pacing, gift discovery, quest rewards, festival rewards, machine throughput, and mine/combat difficulty.

Acceptance criteria:

- Designers can export balance tables.
- Debug tools are excluded from production builds or hidden behind a flag.
- Economy outliers are visible.

### Prompt 047 - Content authoring guide

Write documentation for adding NPCs, crops, items, recipes, quests, festivals, modular 3D maps, dialogue, cutscenes, animals, and mine floors and creatures. Include Blender scene setup, model budgets, rig reuse, clip naming, interaction anchors, collision, navigation, LOD, texture compression, `.glb` export, icon rendering, and browser validation.

Acceptance criteria:

- A new contributor can add a simple NPC without touching engine code.
- Docs include examples and validation rules.
- Data naming conventions are clear.
- A new contributor can export and validate a simple prop without hand-editing runtime files.

### Prompt 048 - Alpha vertical slice

Assemble an alpha slice covering the first 7 in-game days: 3D farm basics, town intro, 4 fully rigged NPCs with posture profiles, 2 animated animals, fishing, one mine room with a combat-light encounter, one story quest, one civic project, one mini festival teaser, and a representative validated item library.

Acceptance criteria:

- A new player understands the game without external explanation.
- Slice has no progression blockers.
- End of slice invites continued play.

### Prompt 049 - Beta content expansion

Expand to one full in-game year with all seasons, all major modular 3D maps, 24 rigged NPCs, the complete documented crop/item/prop library, 40 recipes, 30 quests, 8 festivals, 4 farm variants, and complete mine-depth and skill-mastery progression.

Acceptance criteria:

- A year-one playthrough has varied goals every week.
- Every major system intersects with at least two others.
- No single money strategy trivializes progression.

### Prompt 050 - Release candidate polish

Finish Theme 3 asset replacement, model/rig/animation validation, lighting, audio, localization hooks, bug fixing, performance, save stability, credits, analytics-free privacy-first telemetry option, and final QA.

Acceptance criteria:

- Build passes all tests.
- Lighthouse/PWA basics are healthy.
- No known save-destroying bugs.
- Credits and licenses are complete.

---

## 9. First-Year Content Calendar

### Spring

- Day 1: arrival, farm cleanup, meet Aunt Nessa by mail.
- Day 3: first rain tutorial.
- Day 5: Mara introduces the lighthouse beacon repair.
- Day 7: Market Lane reopening request.
- Day 10: first quarry mining run with Elder Rell.
- Day 13: Spring Seed Blessing festival.
- Day 16: reef low-tide tutorial.
- Day 20: deeper quarry access.
- Day 24: Marsh Chorus.
- Day 28: storm memory scene.

### Summer

- Heat and longer beach schedules.
- Glowtide Night.
- Turtle nesting protection.
- First summer fishing contest.
- Reef Nursery project.
- Niko wind-glider shortcut.

### Fall

- Harvest Fair.
- The Brine Club's tall-tale season begins on the docks.
- Orchard and artisan economy opens.
- Storm Archive clues.
- Quarry Lift project and the mid-game boss chamber.

### Winter

- Frostlight Festival.
- Snow crops and indoor crafting.
- Deep Rainhall Caverns.
- Relationship-heavy indoor scenes.
- Founders Harvest Fair preparations.
- Year-end town review.

---

## 10. MVP Scope Versus Dream Scope

### MVP vertical slice

- One modular low-poly 3D farm map.
- One modular low-poly 3D town map.
- One production-ready player model with shared humanoid rig and complete MVP locomotion/tool/combat clips.
- Four rigged NPCs with unique proportions, materials, posture profiles, and reusable animation coverage.
- Two rigged animals with complete daily behavior loops.
- Twelve crops.
- A validated starter library of tools, machines, furniture, forage, food, quest props, and inventory icon renders.
- Fishing.
- Basic crafting.
- One mine room with a combat-light encounter.
- One civic project.
- One festival.
- Save/load.
- Mobile controls.
- Desktop and mobile 3D performance validation.

### Launch scope

- Eight farm maps.
- Ten regions.
- Twenty-four fully modeled NPCs using compatible shared rig families.
- Eight animals plus pets.
- Complete documented model/item library with icons, pivots, sockets, materials, LODs, collision, and production status.
- Complete locomotion, work, social, emotional, combat, creature, and flora motion libraries.
- Four seasons.
- Eight festivals.
- Full relationship arcs.
- Full mine-depth and skill-mastery progression.
- Mines, reef, marsh, ridge, and islets.
- Home customization.
- PWA offline play.

### Expansion scope

- Online co-op.
- Mod/content-pack support.
- Advanced farm and home layout editor.
- Player-shared farm and decor blueprints.
- New island chain.
- Expanded marriage/partnership life.
- Seasonal story DLC.

---

## 11. Quality Checklist

Before calling any build complete, verify:

- The player always knows at least three attractive next goals.
- Every system creates stories, not just resources.
- NPCs feel like they live in town when the player is absent.
- Community restoration is woven through farming, crafting, relationships, and festivals rather than tracked as a checklist.
- Mobile play is first-class.
- Theme 3 is consistent across models, animation, materials, lighting, environments, items, icons, and UI.
- Every visible hero asset has an approved turnaround, wireframe/topology view, material/UV reference, scale reference, and movement/posture reference where applicable.
- Every gameplay item has a documented world model or deliberate icon-only exception, inventory render, scale, pivot, material, and interaction behavior.
- Characters and creatures communicate personality through posture, timing, and movement rather than dialogue alone.
- Reused rigs and clips still preserve each character's identity.
- No scene exceeds agreed mobile draw-call, triangle, texture-memory, or active-rig budgets without an approved exception.
- 3D scenes are tested for blank canvas output, camera framing, clipping, occlusion, collision, navigation, and missing assets.
- The game remains original in names, assets, data, maps, dialogue, and code.
- The first hour is gentle, but the hundredth hour still contains mystery.

---

## 12. Source Index

- Official Stardew Valley site: https://www.stardewvalley.net/
- Stardew Valley Steam page: https://store.steampowered.com/app/413150/Stardew_Valley/
- Stardew Valley 1.6 changelog: https://www.stardewvalley.net/stardew-valley-1-6-update-full-changelog/
- Stardew Valley Wiki, Skills: https://stardewvalleywiki.com/Skills
- Stardew Valley Wiki, Friendship: https://stardewvalleywiki.com/Friendship
- Stardew Valley Wiki, Quests: https://stardewvalleywiki.com/Quests
- Stardew Valley Wiki, Festivals: https://stardewvalleywiki.com/Festivals
- Stardew Valley Wiki, Farm Maps: https://stardewvalleywiki.com/Farm_Maps
- Stardew Valley Wiki, Modder Guide/Get Started: https://stardewvalleywiki.com/Modding:Modder_Guide/Get_Started
- SMAPI GitHub repository: https://github.com/Pathoschild/SMAPI
