# Sturdy Volley: Giant P-SPR for an Original In-Browser Cozy Life Sim

Prepared: 2026-06-18  
Target: browser-first, mobile-ready, controller-friendly cozy life sim  
Format: P-SPR, meaning Plan-Sequential Prompt Roster  
Core promise: a long-life cozy adventure about restoring a storm-worn coastal town through farming, friendships, animal care, exploration, crafting, festivals, and expressive volleyball play.

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

- Setting: a cliffside volleyball harbor town rebuilding after a century storm.
- Core theme: steadiness, teamwork, craft, tide ecology, and chosen community.
- Signature mechanic: a cozy-athletic volleyball system that intersects with friendship, town rebuilding, animals, weather, festivals, and exploration.

---

## 2. Game Pillars

1. Cozy routine with meaningful pressure  
   Every day gives the player more they want to do than they can do, but failure rarely ends a path.

2. Sport as social language  
   Volleyball is not a separate arcade mode. Passing, setting, serving, blocking, and rally rhythm become ways to befriend NPCs, solve quests, train animals, celebrate festivals, and unlock areas.

3. A living coastal town  
   The town breathes through tides, gullies, sea caves, ferry schedules, cliff paths, market days, fog, lantern nights, storm debris, and NPC movement.

4. Years of gentle discovery  
   Long-tail secrets, character arcs, community projects, collections, new farm layouts, and seasonal events should keep a player curious after many in-game years.

5. Browser-native delight  
   Fast load, responsive mobile controls, offline saves, smooth 2D animation, cozy audio, haptics where available, and no install friction.

---

## 3. Original World Design

### Title and place

Game title: Sturdy Volley  
Town name: Ballast Bay  
Region name: The Sturdy Coast  
Player property: Breakpoint Farm  
Primary landmark: The Old Netlight, a lighthouse with a half-court built into its storm wall  
Main conflict: a massive storm damaged the town's court, farms, harbor, tide pools, and trade routes. The player inherits Breakpoint Farm and helps rebuild Ballast Bay by growing food, restoring habitats, repairing courts, building community trust, and reviving the annual Skyserve Cup.

### Core map regions

1. Breakpoint Farm  
   Flexible farm with soil plots, windbreak hedges, animal paddocks, a practice court, old shed, tide-fed irrigation channel, orchard bluff, greenhouse ruin, and optional terrain themes.

2. Ballast Bay Town  
   Dense walkable town with market lane, clinic, schoolhouse, library, gear shop, bakery, fishmonger, community hall, apartment row, tram stop, and beach court.

3. Netlight Point  
   Lighthouse, cliff court, observatory deck, signal puzzles, late-night NPC scenes, wind training, secret storm-cellar archive.

4. Driftwood Beach  
   Shell collecting, beach forage, volleyball pickup games, crab pots, picnic dates, summer festivals, turtle nesting protection, tide events.

5. Kelpglass Reefs  
   Low-tide reef exploration, snorkeling minigame, seaweed farming, coral restoration, rare fish, ocean-weather secrets.

6. Belltide Marsh  
   Wetland forage, frogs, reeds, medicinal herbs, boardwalk repairs, fog navigation, birdwatching collection.

7. Ironroot Quarry  
   Mining, crystal caves, old rail lifts, hazards, crafting metals, earth fauna, underground court ruins.

8. The Rainhall Caverns  
   Combat-light exploration with echo creatures, mineral springs, ancient ball courts, tide doors, rhythm puzzles, and rare crafting resources.

9. Splitwind Ridge  
   Mountain forage, windmills, glider shortcuts, snow-season training, goats, high-altitude crops, storm chaser quests.

10. Outer Islets  
   Late-game ferry unlocks with unusual crops, migratory animals, tournaments, map fragments, and eco-restoration projects.

### Farm map variants

Each farm type changes layout, starting perk, and early-game strategy.

1. Open Court Farm  
   Most tillable space. Starts with a damaged practice court. Best for balanced farming and volleyball training.

2. Tideplot Farm  
   Less soil, more water channels. Starts with crab pots and seaweed beds. Best for fishing and aquatic crafting.

3. Grovewall Farm  
   Dense trees, medicinal shrubs, and mushrooms. Best for foraging, bees, and animals that enjoy shade.

4. Quarryline Farm  
   Rocky slopes and ore nodes. Best for mining, tool upgrades, and sturdy building projects.

5. Marshlight Farm  
   Wetland plots, frogs, reeds, and rare flowers. Best for ecology quests and potion/cooking ingredients.

6. Rallystead Farm  
   Four corner-like zones for local co-op or NPC helper assignment. Best for multiplayer and automation.

7. Meadowcup Farm  
   Starts with two mooncalf hens, sweetgrass pasture, and a small barn. Best for animal husbandry.

8. Stormbreak Farm  
   Hard mode. Debris, wind, uneven terrain, rare storm resources, and early court hazards. Best for challenge runs.

---

## 4. Core Gameplay Systems

### Daily loop

Morning:

- Wake to weather, tide, mail, pet/animal needs, calendar, and optional morning stretch buff.
- Choose a short-term plan: farm, fish, train, shop, socialize, explore, quest, or tournament.

Day:

- Spend stamina and time on tile actions, movement, dialogue, crafting, court play, and exploration.
- Tides reshape beaches and reefs twice per day.
- NPCs follow schedules influenced by season, weather, relationship, festivals, and town repairs.

Night:

- Shops close, lighting changes, rare NPC scenes appear, nocturnal forage emerges.
- Bedtime summary resolves crops, machines, animals, skill XP, relationship mail, court ranking, and town project progress.

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
   Machines, buildings, court equipment, artisan goods, home decor.

6. Exploring  
   Mines, reefs, caves, ruins, secrets, map shortcuts.

7. Volleycraft  
   Serving, receiving, setting, spiking, blocking, stamina control, court strategy, team synergy.

8. Rapport  
   Dialogue choices, gift insight, team chemistry, diplomacy, conflict repair.

Skill levels unlock recipes, tool moves, movement options, perks, court techniques, map access, and profession branches. Do not clone Stardew's exact XP numbers or profession tree.

### Volleyball system

The volleyball system should feel simple enough for mobile but deep enough to master.

Core controls:

- Tap/click/press to move target marker.
- Hold and release to charge serve, set, or spike.
- Swipe or stick direction controls shot angle.
- Context chooses bump, set, spike, block, dive, or soft tip based on ball height and player stance.
- Optional assist mode gives generous timing windows.

Rally model:

- Ball has position, velocity, spin, arc, shadow, target zone, and hit-state.
- Player/NPC athletes have speed, jump, focus, power, technique, stamina, and teamwork.
- Court surfaces alter bounce and slide: sand, packed clay, cliff stone, spring grass, ice, festival mats.
- Weather affects play: wind bends arcs, rain reduces traction, heat drains stamina, fog narrows preview.

Modes:

- Practice drills: serves, receives, quick sets, blocks, dives.
- Pickup games: casual social play.
- Quest matches: custom rules for NPC arcs.
- Festivals: bracket tournaments, trick-shot contests, glowball nights.
- Doubles and triples: team composition matters.
- Animal assist exhibitions: noncompetitive cute events with trained animals fetching, cheering, or creating buffs.

Progression:

- Volleycraft skill unlocks shot types: float serve, topspin serve, soft roll, quick set, line spike, cross spike, jump block, rescue dive, tide lob, wind read.
- Friendship unlocks team synergy moves with NPCs.
- Gear changes style, not raw pay-to-win dominance.
- Court repairs unlock new training stations and local leagues.

### Farming and ecology

Crops are original and coastal:

- Spring: bell peas, rainroot, blush radish, glasslettuce, poppy kale, tide turnip.
- Summer: sunmelon, saltcorn, bright okra, blueleaf basil, courtlime, shellbean.
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
- Court gear: net upgrades, ball press, chalk line kit, agility ladder, rebound wall, training posts.
- Exploration gear: lantern, rope kit, reef shoes, mine cart battery, glider canvas.
- Decor: furniture, wall pieces, rugs, court banners, planters, aquariums, trophies.

Economy principles:

- Avoid one dominant crop. Use rotating demand, weather effects, shipping contracts, artisan time, storage pressure, and NPC preferences.
- Let players earn through farming, fishing, matches, commissions, animal products, crafting, cooking, and exploration.
- Add fair late-game automation, but preserve player choice and tactile charm.

### Community restoration

Replace the "community center bundle" idea with original civic projects:

1. The Netlight Court  
   Restores practice, local games, tournaments, and character scenes.

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
   Role: harbor mechanic and former league setter.  
   Personality: direct, funny, guarded, precise.  
   Arc: rebuilding trust after a match-fixing accusation she did not commit.  
   Gameplay: repairs machines, unlocks court gadgets, elite setting drills.  
   Loved gifts: gear oil blend, courtlime tart, polished copper beet, stormglass charm.

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
   Gameplay: shortcuts, glider traversal, wind serve techniques.  
   Loved gifts: feather charm, cloud cacao, smoked shellbean, ridge map.

5. Cora Bell  
   Role: clinic apprentice and marsh singer.  
   Personality: warm, sharp, quietly ambitious.  
   Arc: balancing medicine, family caregiving, and her own dreams.  
   Gameplay: stamina tonics, health tutorials, marsh quests.  
   Loved gifts: lantern leek soup, medicinal reeds, pearl algae balm, songbook.

6. Tavi Stone  
   Role: quarry sculptor and defensive blocker.  
   Personality: calm, tactile, protective, slow to speak.  
   Arc: learning to make art for joy after years of commission work.  
   Gameplay: stone decor, mining perks, block training.  
   Loved gifts: echo crystal, ember squash stew, carved driftwood, goat cheese.

7. Lio Marin  
   Role: fishmonger, reef diver, and trick-shot legend.  
   Personality: flamboyant, generous, conflict-avoidant.  
   Arc: admitting fear of deep water after the storm.  
   Gameplay: fishing lures, snorkeling, reef restoration.  
   Loved gifts: cave jelly, courtlime ceviche, reef mint, rare shell.

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
   Gameplay: music layers, rhythm drills, festival variants.  
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
   Role: former pro spiker, now school coach.  
   Personality: loud, kind, secretly insecure.  
   Arc: redefining worth after injury.  
   Gameplay: spike drills, youth team quests, confidence buffs.  
   Loved gifts: protein stew, court banner, sunmelon juice, polished knee brace.

### Core non-romance NPCs

- Mayor Alma Dace: civic leader with a complicated history around the storm warnings.
- Milo and Min Bell: twins who run the general store and disagree about modernization.
- Dr. Oren Quay: clinic lead, collector of odd shells.
- Aunt Nessa: player's relative, writes tutorial letters, visits seasonally.
- Coach Rell: retired champion who unlocks mastery and late-game tournaments.
- Fern: shy school kid who names stray animals and starts the turtle sanctuary quest.
- Captain Oda: ferry captain whose boat is damaged until the winch project is complete.
- Sable: blacksmith with a soft spot for poetry and high-quality ore.
- Rumi: bathhouse owner and weather watcher.
- Etta Finch: elderly birdwatcher who tracks seasonal fauna.
- The Brine Club: three rival athletes who become friends over multiple tournaments.

### Relationship mechanics

- 10 friendship levels for most NPCs; 14 for spouse/partner equivalent if romance exists.
- Daily talk, gifts, birthdays, quests, team play, festival participation, and dialogue choices affect rapport.
- Each NPC has at least:
  - 120 ambient lines.
  - 40 seasonal/weather lines.
  - 20 town-project reaction lines.
  - 12 gift reactions.
  - 8 relationship scenes.
  - 3 conflict scenes where the player can help, worsen, or delay resolution.
  - 2 volleyball/team chemistry scenes.
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
- Court physics.
- Fish tables.
- Ambient audio.
- Lighting and shadows.
- Available scenes.
- Travel shortcuts.

### Visual style

- 2D pixel-art or high-resolution pixel-inspired tile art.
- Four-direction characters with idle, walk, run, tool, carry, emote, serve, set, spike, block, dive, swim/snorkel, sit, sleep, and festival variants.
- Layered environmental animation: grass sway, shoreline foam, tide lines, window lights, moths, drifting pollen, flags, hanging nets, water caustics.
- Smooth camera with zoom bands for desktop and mobile.
- Day/night lighting using tinted overlays and localized light sprites.

---

## 7. Browser Technical Plan

Recommended stack:

- Engine: Phaser 3 or PixiJS plus a custom ECS-like system. Phaser is preferred for tilemaps, input, animation, arcade physics, cameras, mobile support, and fast prototyping.
- Language: TypeScript.
- Build: Vite.
- Data: JSON or YAML converted to typed JSON at build time.
- Maps: Tiled `.tmx` or JSON exports.
- Saves: IndexedDB with localStorage fallback and export/import save files.
- Audio: WebAudio with sprites and layered music stems.
- UI: HTML/CSS overlay for menus, or Phaser UI if visual consistency is easier.
- Tests: Vitest for pure logic; Playwright for smoke, layout, save/load, and mobile viewport checks.

Performance targets:

- First playable load under 5 seconds on average broadband after caching.
- 60 FPS target on desktop, 30-60 FPS on midrange mobile.
- Asset atlas packing.
- Lazy-load late-game maps.
- Avoid more than 150 active pathfinding NPC agents per scene.
- Deterministic simulation for save/load and replayable testing.

Accessibility:

- Remappable controls.
- Touch, keyboard, mouse, and controller.
- Reduce motion option.
- High-contrast targeting reticle for volleyball.
- Dyslexia-friendly font option for UI text.
- No time pressure assist mode.
- Fishing and volleyball timing assist.
- Colorblind-safe quality markers.

---

## 8. Sequential Prompt Roster

Use the following prompts in order with a coding agent. Each prompt assumes the previous prompt has been completed, tested, and committed or checkpointed. For every prompt: keep assets original, use placeholder art only when needed, and keep data-driven systems extensible.

### Prompt 001 - Project scaffold and quality bar

Build the initial browser game project for Sturdy Volley using TypeScript, Vite, Phaser 3, Vitest, and Playwright. Create a clean folder structure for engine systems, game data, maps, scenes, UI, assets, tests, and design docs. Add scripts for dev, build, test, lint, and preview. Add a title screen that loads without console errors on desktop and mobile viewports.

Acceptance criteria:

- `npm run dev`, `npm run build`, and `npm test` succeed.
- Playwright opens the title screen at desktop and mobile sizes.
- The title screen has Start, Continue disabled, Settings, and Credits.
- No Stardew Valley assets, code, names, or extracted data are present.

### Prompt 002 - Game design constants and typed data pipeline

Create a typed data pipeline for crops, items, NPCs, animals, maps, quests, recipes, skills, weather, festivals, dialogue, and shops. Use JSON data files with TypeScript schema validation. Add a developer-only data validation screen.

Acceptance criteria:

- Invalid data fails tests with useful errors.
- At least 10 sample items, 4 crops, 2 NPCs, 2 animals, and 2 recipes load from data.
- Data IDs are stable and human-readable.

### Prompt 003 - Scene manager and save bootstrap

Implement scene transitions for Boot, Preload, Title, NewGame, Farm, Town, Interior, Court, Mine, and UI overlay. Add a save model with player identity, day, season, time, inventory, map state, relationships, skills, and flags.

Acceptance criteria:

- New Game creates a save.
- Continue loads the save after refresh.
- Save export/import works through a settings menu.
- Scene transition fades are smooth and interrupt-safe.

### Prompt 004 - Tilemap renderer and collision

Create the first playable Breakpoint Farm tilemap using original placeholder tiles. Add collision layers, object layers, depth sorting, animated water, grass, and camera bounds.

Acceptance criteria:

- Player can walk around the farm with keyboard and touch.
- Collision is correct for fences, water, rocks, trees, house, and cliffs.
- Camera follows without jitter.
- Mobile viewport keeps the player and UI readable.

### Prompt 005 - Player controller and interaction model

Implement player movement, facing, sprinting, stamina drain, contextual interact button, tool slot selection, and action targeting. Add an interaction resolver for tile, object, NPC, animal, machine, door, and pickup interactions.

Acceptance criteria:

- One interaction button handles multiple nearby targets predictably.
- Touch controls support virtual stick and tap-to-move mode.
- Keyboard/controller controls are remappable.
- Interaction prompts never overlap the hotbar.

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

Add hoe, watering can, axe, pick, sickle, fishing rod, net wrench, and training ball. Add tool levels and charge actions with area previews.

Acceptance criteria:

- Tools consume stamina according to skill and upgrade level.
- Upgraded tools affect wider areas or tougher objects.
- Tool animations have anticipation, impact, and recovery frames.

### Prompt 010 - Foraging, debris, trees, and regrowth

Create seasonal forage spawn tables, farm debris, tree growth, chopping, stumps, grass, shells, mushrooms, and daily regrowth rules.

Acceptance criteria:

- Forage spawns in valid map regions.
- Trees and grass regrow over time.
- Foraged item quality can be influenced by skill.

### Prompt 011 - NPC schedule engine

Implement NPC schedule data with daily, seasonal, weather, festival, relationship, and event overrides. Add pathfinding, door transitions, idle behavior, facing, and conversation availability.

Acceptance criteria:

- At least 4 NPCs follow schedules across farm, town, interiors, and beach.
- NPCs avoid obstacles and recover if blocked.
- Debug overlay can show current schedule target.

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

Build a cutscene runner for camera moves, character movement, dialogue, emotes, item changes, sound cues, screen shakes, fades, and choices.

Acceptance criteria:

- At least 2 relationship scenes and 1 town project scene are implemented.
- Cutscenes are skippable after first viewing.
- Events cannot soft-lock the player.

### Prompt 015 - Ballast Bay town map

Create the main town map with market lane, bakery, clinic, library, gear shop, community hall, schoolhouse, blacksmith, apartments, and beach access.

Acceptance criteria:

- Buildings have working doors and open/closed schedules.
- Map feels navigable on mobile.
- Ambient animations include flags, water, birds, windows, and market details.

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

- Brine barrel, herb dryer, cheese drum, honey spinner, and ball press work.
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

### Prompt 024 - Combat-light creature encounters

Implement simple defensive tools, knockback, creature telegraphs, health, invulnerability frames, loot, and difficulty scaling.

Acceptance criteria:

- Encounters support keyboard, touch, and controller.
- Player defeat is recoverable and not overly punitive.
- Creature designs are original and non-gory.

### Prompt 025 - Volleyball physics prototype

Build the volleyball court scene with ball physics, serve, receive, set, spike, block, scoring, court bounds, net collision, shadows, and timing windows.

Acceptance criteria:

- Player can complete a rally against a simple AI.
- Ball arc and shadow make height clear.
- Mobile controls feel playable with one thumb plus action button.

### Prompt 026 - Volleyball AI and team play

Add teammate/opponent AI roles, positioning, shot choice, stamina, mistakes, communication bubbles, and difficulty profiles.

Acceptance criteria:

- Doubles matches are playable.
- AI makes believable decisions without perfect reactions.
- Team chemistry modifies behavior subtly.

### Prompt 027 - Volleyball progression and drills

Add Volleycraft XP, drills, skill unlocks, trainer NPC, gear, court upgrades, and technique tutorials.

Acceptance criteria:

- At least 8 drills exist.
- New shot types unlock through progression.
- Tutorials are playable and skippable.

### Prompt 028 - Quest system

Implement quest journal, story quests, daily requests, special orders, objectives, timers, rewards, relationship effects, progress notifications, and cancellation rules.

Acceptance criteria:

- At least 12 quests exist across farming, fishing, crafting, exploration, social, and volleyball.
- Quest UI is touch-friendly.
- Failed timed quests do not break story paths.

### Prompt 029 - Community restoration projects

Implement civic project board, contribution UI, item/money/relationship requirements, project phases, visual map changes, opening ceremonies, and reward unlocks.

Acceptance criteria:

- At least 3 projects are fully functional.
- Completed projects visibly alter maps and schedules.
- Project ceremonies include NPC reactions.

### Prompt 030 - Festivals phase one

Create the seasonal festival framework and implement three festivals: Spring Netraising, Summer Glowball Night, and Fall Harvest Rally.

Acceptance criteria:

- Festival days alter schedules, shops, map setup, and music.
- Each festival has at least one minigame, special shop, and relationship opportunity.
- Multiplayer hooks are considered even if multiplayer is later.

### Prompt 031 - Festivals phase two

Add Winter Icecourt Classic, Lantern Tide, Marsh Chorus, Skyserve Cup, and rotating second-year variants.

Acceptance criteria:

- Festivals have year-two dialogue/map variations.
- Skyserve Cup depends on court restoration and NPC team arcs.
- Festival rewards are unique but not mandatory for main progression.

### Prompt 032 - Mail, news, and world reactivity

Add mail system, town notice board, weather/tide forecast, sports standings, birthday reminders, lost-and-found, and dynamic news after player actions.

Acceptance criteria:

- Mail can deliver items, recipes, quests, and story.
- Notice board creates daily and weekly reasons to visit town.
- News reacts to projects, festivals, and tournaments.

### Prompt 033 - Cooking and buffs

Implement kitchen, recipes, ingredient tags, cooking UI, food buffs, favorite meals, picnic scenes, and team meals before matches.

Acceptance criteria:

- At least 25 original recipes exist.
- Buffs affect stamina, skill, movement, fishing, mining, or volleyball.
- NPC meal preferences integrate with relationships.

### Prompt 034 - Home, decor, and customization

Add farmhouse interiors, furniture placement, wallpaper/flooring, renovations, wardrobe, player appearance, court banners, trophy shelves, and photo mode.

Acceptance criteria:

- Decor placement works with touch and mouse.
- Player appearance can be changed after start.
- Photo mode hides UI and saves screenshots where browser permits.

### Prompt 035 - Audio architecture

Implement music manager, ambient layers, positional sound, UI sounds, tool sounds, court sounds, weather ambience, festival stingers, and accessibility volume controls.

Acceptance criteria:

- Music changes by region, season, time, weather, and event.
- Ambience crossfades cleanly.
- Audio can be muted by category.

### Prompt 036 - Visual polish pass one

Replace placeholders for farm, player, core tools, first 4 NPCs, first animals, crops, and UI with original polished assets. Add squash/stretch, impact particles, water ripples, footstep puffs, and harvest effects.

Acceptance criteria:

- The first 15 minutes look cohesive.
- Animations have anticipation and follow-through.
- UI remains legible over bright and dark maps.

### Prompt 037 - Visual polish pass two

Add seasonal map variants, weather overlays, day/night lighting, indoor lighting transitions, window glows, court crowd reactions, animated flora/fauna, and tide visuals.

Acceptance criteria:

- Each season feels distinct within 5 seconds of looking.
- Weather affects both mood and gameplay readability.
- Performance remains within target.

### Prompt 038 - NPC content expansion

Expand the roster to 12 romance candidates and 12 core town NPCs with schedules, portraits, gift tastes, birthdays, and relationship scenes.

Acceptance criteria:

- Each NPC has at least 80 lines before launch alpha.
- No NPC exists only as a shop interface.
- Relationship arcs interconnect through town events.

### Prompt 039 - Narrative act structure

Implement the main story in three acts: Arrival and Repair, Trust and Rivalry, Storm Archive and Skyserve Cup. Add act gates, optional routes, moral choices, and post-credits year-two content.

Acceptance criteria:

- Main story can be completed without romance.
- Choices change scenes and town flavor without locking core features unfairly.
- Ending celebrates community restoration, not total domination.

### Prompt 040 - Secrets and long-tail goals

Add hidden rooms, rare weather events, secret crops, legendary fish, court trick titles, animal personalities, map fragments, archive mysteries, and multi-year scenes.

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

Polish mobile UI, touch targets, safe areas, virtual controls, battery-aware effects, asset loading, orientation handling, and PWA install.

Acceptance criteria:

- Works on 360x740 and tablet viewports.
- No required button is under 44x44 CSS pixels.
- PWA can launch offline after first load.

### Prompt 043 - Controller and console-style feel

Add full controller navigation, focus rings, radial menus, rumble hooks where browser supports it, and couch-friendly UI scaling.

Acceptance criteria:

- Entire first day is playable with controller only.
- Menus have predictable focus order.
- Button prompts update by input device.

### Prompt 044 - Accessibility complete pass

Add final accessibility settings for motion, flashing, timing assists, contrast, text size, font, color markers, audio cues, and remapping.

Acceptance criteria:

- Volleyball and fishing can be completed with assist settings.
- Important information is not color-only.
- Settings are available before gameplay starts.

### Prompt 045 - Automated test suite

Create tests for crop growth, inventory, shops, relationships, quests, festivals, saves, machines, animals, court scoring, and scene smoke loads.

Acceptance criteria:

- Core logic has deterministic tests.
- Playwright smoke covers desktop and mobile.
- CI-ready scripts run without manual browser interaction.

### Prompt 046 - Balancing tools

Build debug dashboards for economy, crop profits, XP pacing, gift discovery, quest rewards, festival rewards, machine throughput, and match difficulty.

Acceptance criteria:

- Designers can export balance tables.
- Debug tools are excluded from production builds or hidden behind a flag.
- Economy outliers are visible.

### Prompt 047 - Content authoring guide

Write documentation for adding NPCs, crops, items, recipes, quests, festivals, maps, dialogue, cutscenes, animals, and volleyball drills.

Acceptance criteria:

- A new contributor can add a simple NPC without touching engine code.
- Docs include examples and validation rules.
- Data naming conventions are clear.

### Prompt 048 - Alpha vertical slice

Assemble an alpha slice covering the first 7 in-game days: farm basics, town intro, 4 NPCs, 2 animals, fishing, one mine room, one volleyball drill, one story quest, one civic project, and one mini festival teaser.

Acceptance criteria:

- A new player understands the game without external explanation.
- Slice has no progression blockers.
- End of slice invites continued play.

### Prompt 049 - Beta content expansion

Expand to one full in-game year with all seasons, all major maps, 24 NPCs, 50 crops/items, 40 recipes, 30 quests, 8 festivals, 4 farm variants, and complete court league progression.

Acceptance criteria:

- A year-one playthrough has varied goals every week.
- Every major system intersects with at least two others.
- No single money strategy trivializes progression.

### Prompt 050 - Release candidate polish

Finish asset replacement, audio, localization hooks, bug fixing, performance, save stability, credits, analytics-free privacy-first telemetry option, and final QA.

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
- Day 5: Mara introduces court repair.
- Day 7: Market Lane reopening request.
- Day 10: first pickup game.
- Day 13: Spring Netraising festival.
- Day 16: reef low-tide tutorial.
- Day 20: quarry access.
- Day 24: Marsh Chorus.
- Day 28: storm memory scene.

### Summer

- Heat and longer beach schedules.
- Glowball Night.
- Turtle nesting protection.
- First doubles bracket.
- Reef Nursery project.
- Niko wind-glider shortcut.

### Fall

- Harvest Rally.
- Rival Brine Club arrives.
- Orchard and artisan economy opens.
- Storm Archive clues.
- Quarry Lift project.

### Winter

- Icecourt Classic.
- Snow crops and indoor crafting.
- Deep Rainhall Caverns.
- Relationship-heavy indoor scenes.
- Skyserve Cup qualifiers.
- Year-end town review.

---

## 10. MVP Scope Versus Dream Scope

### MVP vertical slice

- One farm map.
- One town map.
- Four NPCs.
- Two animals.
- Twelve crops.
- Fishing.
- Basic crafting.
- One court drill and one match.
- One civic project.
- One festival.
- Save/load.
- Mobile controls.

### Launch scope

- Eight farm maps.
- Ten regions.
- Twenty-four NPCs.
- Eight animals plus pets.
- Four seasons.
- Eight festivals.
- Full relationship arcs.
- Full volleyball league.
- Mines, reef, marsh, ridge, and islets.
- Home customization.
- PWA offline play.

### Expansion scope

- Online co-op.
- Mod/content-pack support.
- Advanced court editor.
- Player-made tournaments.
- New island chain.
- Expanded marriage/partnership life.
- Seasonal story DLC.

---

## 11. Quality Checklist

Before calling any build complete, verify:

- The player always knows at least three attractive next goals.
- Every system creates stories, not just resources.
- NPCs feel like they live in town when the player is absent.
- Volleyball is a relationship and progression system, not a pasted-on minigame.
- Mobile play is first-class.
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

