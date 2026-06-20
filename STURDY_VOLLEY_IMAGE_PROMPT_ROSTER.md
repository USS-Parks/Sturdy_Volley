# Sturdy Volley: ChatGPT Image Creator Prompt Roster

Prepared: 2026-06-18
Revised: 2026-06-19 — every volleyball, court, sport, league, tournament, trophy, coach, drill, and score reference has been replaced with cozy community-life equivalents (gatherings, work, craft, festivals, neighborly collaboration). The provisional project title is kept in this planning document only; no generated image should render a title, logo, wordmark, or initials. See `art-production/CURRENT_ART_DIRECTION.md` for the active art direction override and `STURDY_VOLLEY_PSPR.md` for the canonical world, characters, festivals, and crops.

Purpose: create 200+ unique image files as firm visual design reference for the game currently filed under "Sturdy Volley" (the title is provisional; "Willa Crick" is under consideration).
Target output: concept art, sprite reference sheets, environment paintings, UI mockups, prop sheets, maps, mood pieces, festival scenes, and animation reference frames.

---

## Master Art Direction

Use this shared style brief at the beginning of every prompt unless a prompt says otherwise:

```text
Create original visual development art for a cozy browser/mobile life sim set in a storm-restored coastal village named Ballast Bay on the Sturdy Coast. The game is a rural, community-focused life sim about farming, fishing, foraging, animal care, mining, crafting, cooking, friendships, festivals, and rebuilding a small coastal town after a century storm — there is no sport, no volleyball, no league, no tournament, and no court. Inspiration draws on the atmosphere of remote northwestern California coast: redwood and fir forest, creek and river corridors, fog, rain, moss, modest homesteads, weathered timber buildings, small farms, wildlife, handmade community spaces, and Pacific shoreline. The art must be unique and must not imitate or reproduce Stardew Valley, its characters, maps, sprites, UI, names, or layouts. Style: warm hand-painted 2D concept art with pixel-art readability, crisp silhouettes, practical game-design clarity, cozy coastal detail, expressive character shapes, readable props, and bright but grounded color. Mood: hopeful, tactile, lived-in, weather-aware, and slightly mysterious. No logos, no watermark, no copyrighted characters, no copied game assets, and no rendered title, wordmark, or initials inside the image.
```

Recommended aspect ratios:

- Character portrait: `1024x1024`
- Full-body character sheet: `1024x1536`
- Environment key art: `1536x1024` or `2048x1152`
- Map/layout reference: `2048x2048`
- UI mockup: `1536x1024`
- Sprite/prop/tile sheet reference: `2048x2048`
- Mobile screen mockup: `1024x1536`

Filename convention:

```text
sv_[category]_[###]_[short_slug].png
```

Prompting rules:

- Ask for "design reference", not final production asset, unless the prompt is specifically for a UI mockup or sprite sheet.
- For character sheets, ask for front, side, back, expression callouts, and palette swatches.
- For tile sheets, ask for clean separated clusters on a simple neutral background.
- For UI screens, specify "legible placeholder text only" unless exact text is requested.
- Keep every image original. Do not mention Stardew Valley inside generation prompts except as a negative constraint if needed.
- Avoid in-image text whenever possible. Generated text can be unreliable.
- Never render a title, logo, wordmark, or initials. The project title is provisional.
- Never depict volleyball, any sport, any court, any net, any league or tournament, or any sports equipment. Replace any inherited sport idea with community life, work, craft, festival, wildlife care, traversal, or neighborly collaboration.

---

## Prompt Roster

### A. Global Style and Visual Bible

001. `sv_style_001_core_key_art.png`
Prompt: Create a sweeping key art image of Ballast Bay at sunrise: a cliffside harbor village, restored village common with gathering circle and garden plots, lighthouse on the bluff, terraced farms, tide pools, small fishing boats, weathered flags, drying nets on racks, and villagers starting their day. Wide cinematic composition, clear cozy-life-sim identity, inviting first-look art.

002. `sv_style_002_four_season_grid.png`
Prompt: Create a 2x2 seasonal visual bible for the same Ballast Bay overlook in spring, summer, fall, and winter. Keep layout identical in each panel while changing crops, trees, weather, clothing hints, lighting, wildlife, market-day decor, and seasonal festival flags.

003. `sv_style_003_color_script.png`
Prompt: Create a color-script board for the game showing 12 small mood panels: dawn farm, rainy town, sunny driftwood beach, fog marsh, reef low tide, quarry interior, winter ridge, festival night, cozy kitchen, mine lantern, sunset harbor, late-night lighthouse.

004. `sv_style_004_shape_language.png`
Prompt: Create a visual shape-language guide: rounded cozy farm forms, sturdy nautical structures, angular quarry rocks, flowing reef plants, wind-shaped ridge trees, handmade festival lanterns and quilts, woven baskets, and expressive NPC silhouettes.

005. `sv_style_005_materials_board.png`
Prompt: Create a materials and texture board: weathered cedar, sea-smoothed stone, rope netting, salt-stained canvas, copper hardware, wet sand, tide glass, packed garden paths, mossy boardwalk, lantern wax, polished shells, greenhouse glass, hand-woven reed, quilted cotton.

006. `sv_style_006_lighting_board.png`
Prompt: Create a lighting reference sheet for the game world: warm sunrise, noon clarity, golden hour, blue dusk, lantern night, fog diffusion, storm light, indoor hearth glow, reef caustics, mine lantern pools, festival colored light.

007. `sv_style_007_camera_scale_guide.png`
Prompt: Create an isometric/top-down game scale guide with a player character, NPC, mooncalf hen, bluff goat, crop plot, tree, cottage door, garden trellis, shipping crate, chest, and boulder, all arranged on a neutral grid for size comparison.

008. `sv_style_008_sprite_readability.png`
Prompt: Create a readability guide showing the same player character at tiny mobile gameplay scale, medium dialogue scale, and full concept scale. Include clear silhouette, color blocks, a tool pose, a basket-carry pose, and no text.

009. `sv_style_009_ui_mood_board.png`
Prompt: Create a UI mood board for a cozy coastal browser game: inventory panels, round-corner tooltips, tide/weather badges, relationship icons, calendar tile, festival banner, quest journal tabs, restoration project pip — all without copying existing game UI.

010. `sv_style_010_icon_language.png`
Prompt: Create an icon design language sheet with 40 small original icons: crops, tools, heart, stamina, tide, wind, rain, sun, lantern, quest, gift, animal mood, fish, ore, recipe, festival, calendar, mail, basket, quilt, map, settings.

### B. World Maps and Region Layouts

011. `sv_map_011_ballast_bay_overworld.png`
Prompt: Create a top-down illustrated overworld map of Ballast Bay and the Sturdy Coast: farm, town, beach, lighthouse point, marsh, quarry, caverns, ridge, reefs, outer islets, ferry routes, and footpaths. Design it as a game planning map, not a tourist poster.

012. `sv_map_012_breakpoint_farm_layout.png`
Prompt: Create a top-down game layout reference for Breakpoint Farm with farmhouse, old shed, kitchen garden, soil fields, irrigation channel, pasture, orchard bluff, greenhouse ruin, pond, debris, paths, and cliff boundaries.

013. `sv_map_013_ballast_bay_town_layout.png`
Prompt: Create a top-down town layout reference for Ballast Bay: market lane, bakery, clinic, library, gear shop, fishmonger, schoolhouse, blacksmith, carpenter, apartments, community hall, beach stairs, village common with gathering circle, and harbor.

014. `sv_map_014_driftwood_beach_layout.png`
Prompt: Create a top-down beach layout for Driftwood Beach with picnic spots and benches, shell beds, community fire ring, crab pot dock, tide pools, turtle nesting zone, driftwood arches, beach grass, and low-tide paths.

015. `sv_map_015_netlight_point_layout.png`
Prompt: Create a top-down layout of Netlight Point: lighthouse, signal deck, observatory rail, cliff-edge overlook lawn, storm cellar entrance, wind flags, narrow paths, lookout benches, and dramatic sea cliffs.

016. `sv_map_016_kelpglass_reef_layout.png`
Prompt: Create a top-down low-tide reef map with coral nurseries, shallow channels, shell patches, snorkel entry points, kelp beds, tide gates, rare fish pools, and safe walking stones.

017. `sv_map_017_belltide_marsh_layout.png`
Prompt: Create a top-down marsh boardwalk map with reeds, fog pools, frog ponds, medicinal herb patches, bird blinds, broken bridge repairs, lantern posts, and hidden wetland paths.

018. `sv_map_018_ironroot_quarry_layout.png`
Prompt: Create a top-down quarry map with mine entrance, ore terraces, old rail lift, blacksmith path, crystal outcrops, tool shed, abandoned stone-cutters' yard ruin, safety ropes, and breakable rock clusters.

019. `sv_map_019_rainhall_caverns_layout.png`
Prompt: Create a modular cave-room layout board for Rainhall Caverns: lantern pools, tide doors, echo crystals, mineral springs, rope ladders, breakable rocks, gentle creature paths, and hidden archive doors.

020. `sv_map_020_splitwind_ridge_layout.png`
Prompt: Create a top-down mountain ridge map with windmills, goat trails, glider launch, snow common with brazier, highland crops, storm watcher cabin, pine groves, and switchback paths.

021. `sv_map_021_outer_islets_layout.png`
Prompt: Create an island-chain map for late-game Outer Islets with ferry dock, tiny farms, community beach, sea cave, turtle sanctuary, old shrine, spice grove, and reef-ringed paths.

022. `sv_map_022_town_interiors_grid.png`
Prompt: Create a grid of 8 cozy interior layout thumbnails: bakery, clinic, library, gear shop, fishmonger, blacksmith, carpenter workshop, and community hall. Each should be top-down and readable for game production.

023. `sv_map_023_farmhouse_interior_starter.png`
Prompt: Create a top-down starter farmhouse interior: bed, small kitchen corner, storage chest, worn rug, work desk, window, fireplace, plant shelf, and space for future renovations.

024. `sv_map_024_greenhouse_ruin.png`
Prompt: Create a top-down and three-quarter concept of a broken coastal greenhouse ruin with cracked glass, salt-tolerant weeds, old irrigation pipes, missing panels, and restoration potential.

025. `sv_map_025_community_hall_restored.png`
Prompt: Create a top-down and exterior reference of the restored Ballast Bay community hall with stage, bulletin board, festival storage, ribbon-and-quilt display wall, seating, lantern rafters, and civic project board.

026. `sv_map_026_market_lane_rainy.png`
Prompt: Create an environment concept of Market Lane during gentle rain with canvas canopies, shop windows, wet cobblestones, puddle reflections, villagers under umbrellas, and a cozy coastal palette.

027. `sv_map_027_harbor_evening.png`
Prompt: Create an evening harbor concept with small fishing boats, warm window lights, gull flags, dock ropes, crab pots, fishmonger stall, tide marks, and the lighthouse glowing in the distance.

028. `sv_map_028_common_progression_sheet.png`
Prompt: Create a three-stage visual progression sheet for the Ballast Bay village common: storm-damaged (cracked gathering circle, fallen lantern posts, tangled debris), repaired (swept paving, replanted garden beds, fresh benches), and festival-ready (lanterns strung, ribbon poles, banner arches, produce tables). Same angle in all three panels.

029. `sv_map_029_town_project_before_after.png`
Prompt: Create a before-and-after board for four town restoration projects: boardwalk, ferry winch, reef nursery, and market canopies. Show each pair from the same angle with clear visual upgrades.

030. `sv_map_030_secret_archive_room.png`
Prompt: Create a mysterious but cozy storm archive room beneath the lighthouse: old maps, preserved weather instruments, water-stained ledgers, glass buoys, signal lamps, and a hidden town crest carved into the stone.

### C. Farm Variants

031. `sv_farm_031_open_meadow_farm.png`
Prompt: Create a top-down concept for Open Meadow Farm with generous fields, a wide cleared central meadow with a weathered gathering circle, simple paths, farmhouse, sturdy old shed, pond, and balanced expansion zones.

032. `sv_farm_032_tideplot_farm.png`
Prompt: Create a top-down concept for Tideplot Farm with winding water channels, brackish crop plots, crab pot docks, seaweed beds, wooden bridges, and fewer but strategic soil fields.

033. `sv_farm_033_grovewall_farm.png`
Prompt: Create a top-down concept for Grovewall Farm with dense trees, mushroom logs, medicinal shrubs, shaded animal clearings, beehives, wildflower paths, and hidden forage corners.

034. `sv_farm_034_quarryline_farm.png`
Prompt: Create a top-down concept for Quarryline Farm with rocky slopes, ore nodes, stone terraces, rugged paths, mine cart remnants, limited soil pockets, and sturdy building space.

035. `sv_farm_035_marshlight_farm.png`
Prompt: Create a top-down concept for Marshlight Farm with wetland plots, reed beds, frogs, plank paths, lantern posts, misty ponds, rare flowers, and raised animal platforms.

036. `sv_farm_036_fourwinds_farm.png`
Prompt: Create a top-down concept for Fourwinds Farm divided into four cooperative corner zones with a shared central commons, four mini-fields, animal corner, crafting corner, fishing pond, and common farmhouse path — designed for multiplayer or NPC-helper assignment.

037. `sv_farm_037_pasturewell_farm.png`
Prompt: Create a top-down concept for Pasturewell Farm with sweetgrass pasture, small barn, mooncalf hen coop, flower meadows, orchard strip, cozy fencing, and a gentle beginner layout focused on animal husbandry.

038. `sv_farm_038_stormbreak_farm.png`
Prompt: Create a top-down concept for Stormbreak Farm with storm debris, broken fences, uneven terrain, wind-bent trees, rare stormglass stones, narrow fields, and a dramatic challenge-run mood.

039. `sv_farm_039_farm_debris_sheet.png`
Prompt: Create a prop sheet of farm debris: driftwood logs, salt-crusted rocks, broken trellis posts, seaweed piles, old planks, rusted buckets, cracked pots, stormglass shards, weeds, and fallen branches.

040. `sv_farm_040_farm_paths_fences_sheet.png`
Prompt: Create a tile reference sheet for farm paths and fences: packed sand, worn grass, cobblestone, boardwalk planks, kitchen-garden tile border, rope fence, cedar fence, stone wall, shell border.

### D. Environments and Biome Key Art

041. `sv_env_041_breakpoint_morning.png`
Prompt: Create a three-quarter environment painting of Breakpoint Farm in early spring morning: dew on crops, farmhouse chimney smoke, a weathered garden trellis leaning, pet bowl, birds, soft sunlight, and ocean haze.

042. `sv_env_042_farm_rainstorm.png`
Prompt: Create a dramatic but cozy rainstorm view of Breakpoint Farm with windblown crops, water channels filling, animals sheltered, player lantern glow, and distant lightning over the sea.

043. `sv_env_043_town_sunny_market.png`
Prompt: Create a lively sunny Market Lane scene with villagers shopping, bakery steam, produce crates, festival flyers on a notice board, hanging fish signs, kids running, and layered storefront details.

044. `sv_env_044_town_winter_lanterns.png`
Prompt: Create a winter evening town scene with snow on roofs, lanterns, warm windows, bundled villagers, frozen fountain edge, festival ribbons strung overhead, and soft blue shadows.

045. `sv_env_045_driftwood_beach_summer.png`
Prompt: Create a beach environment painting with warm sand, community fire ring, tide pools, sea oats, turtle nesting signs, picnic blankets, shell glints, and gentle waves.

046. `sv_env_046_lantern_tide_night.png`
Prompt: Create a magical but grounded Lantern Tide nighttime beach scene with floating paper lanterns drifting on dark water, strung lanterns along the strand, bioluminescent surf, villagers standing quietly in remembrance, and warm coastal atmosphere with no fantasy creatures.

047. `sv_env_047_netlight_storm.png`
Prompt: Create a stormy Netlight Point scene with lighthouse beam, cliff overlook benches, whipping flags, rain-slick stone, churning ocean, and tiny warm windows showing safety.

048. `sv_env_048_lighthouse_dawn.png`
Prompt: Create a peaceful lighthouse dawn scene with cliff flowers, repaired signal rigging, gull flags, sunlit mist, a bench, signal mirrors, and the harbor below.

049. `sv_env_049_reef_low_tide.png`
Prompt: Create a low-tide reef environment with shallow pools, kelp ribbons, coral nursery frames, shells, tiny fish, wet stones, and sunlit water reflections.

050. `sv_env_050_reef_underwater.png`
Prompt: Create an underwater snorkeling concept for Kelpglass Reefs with soft caustics, seaweed beds, safe colorful fish, coral restoration markers, shell trails, and clear gameplay lanes.

051. `sv_env_051_marsh_fog_morning.png`
Prompt: Create a foggy Belltide Marsh morning with boardwalk, reeds, herons, frog ponds, lantern posts, medicinal herbs, soft green-gray light, and visible navigation silhouettes.

052. `sv_env_052_marsh_sunset.png`
Prompt: Create a sunset marsh scene with orange reflections, birds taking off, glowing reeds, a repaired bridge, NPC silhouettes, and cozy wetland atmosphere.

053. `sv_env_053_quarry_noon.png`
Prompt: Create an Ironroot Quarry noon scene with terraced stone, copper ore, rail lift, blacksmith smoke, safety ropes, hardy plants, and sunlit dust.

054. `sv_env_054_quarry_cave_mouth.png`
Prompt: Create the Rainhall Caverns entrance: damp stone arch, mineral glow, weather-worn miners' pictograms carved in rock, lantern hooks, puddles, and inviting mystery.

055. `sv_env_055_cavern_lantern_pool.png`
Prompt: Create a cave room with lantern pools, echo crystals, small harmless creatures, rope ladder, mineral spring, breakable rocks, and readable gameplay platforms.

056. `sv_env_056_ridge_windy_day.png`
Prompt: Create a Splitwind Ridge windy day scene with windmills, goat trail, cloth streamers, distant sea, glider launch, alpine crops, and bent pines.

057. `sv_env_057_ridge_snow_gathering.png`
Prompt: Create a Splitwind Ridge winter gathering scene with a packed snow walkway through pines, lantern markers, a warming brazier with kettle, bundled villagers passing mugs, goats nearby in a wind shelter, and bright cold light.

058. `sv_env_058_outer_islet_arrival.png`
Prompt: Create a late-game ferry arrival scene at an outer islet: small dock, turquoise reef, festival welcome flags, spice grove, turtle sanctuary sign, and adventurous welcome.

059. `sv_env_059_player_kitchen_evening.png`
Prompt: Create a cozy farmhouse kitchen evening scene with simmering pot, crop baskets, recipe notes, pet nearby, rain at the window, and warm lamplight.

060. `sv_env_060_bathhouse_interior.png`
Prompt: Create a relaxing coastal bathhouse interior with mineral pools, wood beams, shell tiles, towel shelves, steam, plants, and calm restorative lighting.

### E. Main Character and Customization

061. `sv_player_061_default_full_body.png`
Prompt: Create a full-body reference sheet for the default player character: practical farm clothes, sturdy coastal boots, tool belt, work gloves, foraging satchel, four poses, palette swatches, front/side/back views.

062. `sv_player_062_player_portrait_set.png`
Prompt: Create a portrait expression sheet for the player avatar with 12 emotions: neutral, happy, tired, surprised, determined, embarrassed, proud, worried, laughing, focused, sleepy, grateful.

063. `sv_player_063_skin_hair_variants.png`
Prompt: Create a customization reference sheet with diverse skin tones, hairstyles, hair textures, face shapes, and body types for the player avatar, consistent cozy game style, respectful and varied.

064. `sv_player_064_outfit_variants.png`
Prompt: Create a player outfit sheet: farm work outfit, rain gear, beach wading outfit, winter coat, festival outfit, mining gear, snorkeling outfit, and formal community hall outfit.

065. `sv_player_065_tool_animation_sheet.png`
Prompt: Create an animation reference sheet for the player using tools: hoe, watering can, axe, pick, sickle, fishing rod, carry yoke, and mending kit. Show anticipation, impact, recovery poses.

066. `sv_player_066_work_action_sheet.png`
Prompt: Create an action pose sheet for everyday work and traversal actions: hauling, planting, watering, chopping, hammering, lantern lift, basket carry, gift handoff, neighborly wave, kneel-and-tend, climb, and balance-recover. Dynamic but readable for sprite animation.

067. `sv_player_067_mobile_scale_mock.png`
Prompt: Create a mobile gameplay mock image showing the player on the farm with touch controls, hotbar, stamina, weather/tide badges, and readable scale. Use placeholder UI text only.

068. `sv_player_068_home_decor_pose.png`
Prompt: Create a charming reference image of the player placing furniture in a farmhouse room, with ghost placement preview, cozy decor, and clear UI interaction idea.

### F. Romance Candidate Character References

069. `sv_npc_069_mara_vale_full_body.png`
Prompt: Create a full-body character sheet for Mara Vale, harbor mechanic and former shipwright's apprentice. Direct, funny, guarded, precise. Include work overalls, mechanic's vest, tool gloves, copper grease details, front/side/back views, and expression callouts.

070. `sv_npc_070_mara_portraits.png`
Prompt: Create a portrait expression sheet for Mara Vale with neutral, smirk, suspicious, laughing, focused, vulnerable, angry, proud, and surprised expressions. Coastal mechanic style, original character.

071. `sv_npc_071_jun_park_full_body.png`
Prompt: Create a full-body sheet for Jun Park, gentle bakery owner and beach cleanup organizer with a secretly competitive streak about civic projects. Include apron, rolled sleeves, flour dust, cleanup gloves, and casual everyday work outfit, front/side/back.

072. `sv_npc_072_jun_portraits.png`
Prompt: Create a portrait sheet for Jun Park: warm smile, shy laugh, stubborn focus, quietly competitive grin, concern, tired baker, festival joy, thoughtful quiet, and determined leadership.

073. `sv_npc_073_sol_aranda_full_body.png`
Prompt: Create a full-body sheet for Sol Aranda, cliffside botanist and seed archivist. Dreamy but rigorous. Include plant satchel, field journal, seed tubes, sun hat, greenhouse outfit, front/side/back.

074. `sv_npc_074_sol_portraits.png`
Prompt: Create a portrait sheet for Sol Aranda with dreamy, analytical, distracted, delighted, worried, windblown, intense discovery, bashful, and soft smile expressions.

075. `sv_npc_075_niko_venn_full_body.png`
Prompt: Create a full-body sheet for Niko Venn, courier, glider pilot, and wind reader. Charming, restless, emotionally guarded. Include lightweight jacket, messenger bag, glider straps, wind ribbons, and sturdy traveling shoes.

076. `sv_npc_076_niko_portraits.png`
Prompt: Create a portrait sheet for Niko Venn: grin, evasive smile, guilt, thrill, wind-focused, tender, joking, startled, and resolved expressions.

077. `sv_npc_077_cora_bell_full_body.png`
Prompt: Create a full-body sheet for Cora Bell, clinic apprentice and marsh singer. Warm, sharp, quietly ambitious. Include clinic apron, herb pouch, marsh boots, songbook, and practical field clothes.

078. `sv_npc_078_cora_portraits.png`
Prompt: Create a portrait sheet for Cora Bell with kind smile, dry wit, medical focus, singing calm, exhaustion, ambition, worry, joy, and stern care expressions.

079. `sv_npc_079_tavi_stone_full_body.png`
Prompt: Create a full-body sheet for Tavi Stone, quarry sculptor and stoneworker. Calm, tactile, protective, slow to speak. Include stone dust, carving tools, sturdy boots, soft scarf, and a steady grounded stance.

080. `sv_npc_080_tavi_portraits.png`
Prompt: Create a portrait sheet for Tavi Stone: quiet neutral, rare smile, protective glare, creative focus, embarrassed, peaceful, concerned, proud, and laughing softly.

081. `sv_npc_081_lio_marin_full_body.png`
Prompt: Create a full-body sheet for Lio Marin, fishmonger and reef diver. Flamboyant, generous, conflict-avoidant, hiding a fear of deep water. Include bright scarf, fishmonger apron, snorkel gear, and a beachcombing outfit.

082. `sv_npc_082_lio_portraits.png`
Prompt: Create a portrait sheet for Lio Marin with theatrical grin, sincere worry, boastful laugh, underwater fear, generous warmth, dramatic shock, sly wink, tired honesty, and victory joy.

083. `sv_npc_083_petra_quill_full_body.png`
Prompt: Create a full-body sheet for Petra Quill, librarian, local historian, and rules expert. Dry wit, patient, intense about archives. Include layered cardigan, archive keys, annotated tome, and practical walking shoes.

084. `sv_npc_084_petra_portraits.png`
Prompt: Create a portrait sheet for Petra Quill: raised eyebrow, tiny smile, archival intensity, lecture mode, surprise, softened empathy, suspicion, amusement, and late-night focus.

085. `sv_npc_085_zed_romero_full_body.png`
Prompt: Create a full-body sheet for Zed Romero, traveling musician and festival announcer. Magnetic, evasive, emotionally observant. Include portable instrument, festival jacket, stage scarf, and a hand-held microphone.

086. `sv_npc_086_zed_portraits.png`
Prompt: Create a portrait sheet for Zed Romero: stage smile, private sadness, flirtatious tease, careful listening, performance focus, nervous honesty, laughter, awe, and quiet affection.

087. `sv_npc_087_imani_brooks_full_body.png`
Prompt: Create a full-body sheet for Imani Brooks, carpenter and town planner. Practical, hilarious, perfectionist. Include tool belt, rolled blueprint, pencil behind ear, sawdust, sturdy work boots.

088. `sv_npc_088_imani_portraits.png`
Prompt: Create a portrait sheet for Imani Brooks: confident smile, deadpan joke, perfectionist worry, construction focus, frustration, big laugh, apology, pride, and tender surprise.

089. `sv_npc_089_elsie_rowan_full_body.png`
Prompt: Create a full-body sheet for Elsie Rowan, animal sanctuary keeper. Tender, chaotic, observant. Include patched overalls, animal treats, straw in hair, soft boots, field vest, rescue gloves.

090. `sv_npc_090_elsie_portraits.png`
Prompt: Create a portrait sheet for Elsie Rowan: delighted, overwhelmed, protective, gentle focus, messy laugh, concern, soft grief, determined, and animal-whispering calm.

091. `sv_npc_091_bash_calder_full_body.png`
Prompt: Create a full-body sheet for Bash Calder, former harbor rescue diver now schoolhouse groundskeeper and youth mentor. Loud, kind, secretly insecure after the injury that ended his rescue career. Include groundskeeper jacket, knee brace, whistle, ranger compass, weather-worn rescue diver's pin, powerful but approachable silhouette.

092. `sv_npc_092_bash_portraits.png`
Prompt: Create a portrait sheet for Bash Calder: booming grin, mentoring focus, insecurity, encouraging warmth, hidden injury pain, proud tears, protective fire, embarrassment, and calm wisdom.

### G. Core Town NPC References

093. `sv_npc_093_mayor_alma_dace.png`
Prompt: Create a full-body and portrait reference for Mayor Alma Dace, older civic leader with complicated history around the storm warnings. Elegant practical coastal clothes, silver hair, weathered dignity, warm but burdened eyes.

094. `sv_npc_094_milo_min_bell.png`
Prompt: Create a twin shopkeeper character sheet for Milo and Min Bell, general store siblings who disagree about modernization. Similar family features, distinct fashion, expressive contrast, friendly storekeeper poses.

095. `sv_npc_095_dr_oren_quay.png`
Prompt: Create a character sheet for Dr. Oren Quay, clinic lead and odd shell collector. Calm, precise, slightly eccentric, with medical coat, shell pin, glasses, and gentle bedside expression.

096. `sv_npc_096_aunt_nessa.png`
Prompt: Create a character sheet for Aunt Nessa, the player's wise relative who visits seasonally. Weatherproof travel coat, letters, kind smile, practical farm history, cozy mentor energy.

097. `sv_npc_097_elder_rell.png`
Prompt: Create a character sheet for Elder Rell, retired master forager and former quarry hand who unlocks skill mastery and late-game deep-cavern access. Older weathered build, calm intensity, worn field coat, foraging satchel, lantern, kind eyes, legendary quiet presence.

098. `sv_npc_098_fern_schoolkid.png`
Prompt: Create a character sheet for Fern, shy school kid who loves naming stray animals and starts the turtle sanctuary quest. Backpack, sketchbook, oversized rain boots, hopeful cautious expression.

099. `sv_npc_099_captain_oda.png`
Prompt: Create a character sheet for Captain Oda, ferry captain with damaged boat and big laugh. Salt-weathered coat, rope belt, captain cap, sea maps, sturdy boots, ferry repair pose.

100. `sv_npc_100_sable_blacksmith.png`
Prompt: Create a character sheet for Sable, blacksmith with a secret love of poetry. Strong arms, soot marks, apron, delicate notebook, hammer, warm forge light, thoughtful expression.

101. `sv_npc_101_rumi_bathhouse.png`
Prompt: Create a character sheet for Rumi, bathhouse owner and weather watcher. Flowing robe layers, barometer pendant, towel stack, calm posture, serene smile, storm-aware eyes.

102. `sv_npc_102_etta_finch.png`
Prompt: Create a character sheet for Etta Finch, elderly birdwatcher tracking seasonal fauna. Binoculars, field hat, notebook, bird pins, sharp humor, gentle posture, marsh color palette.

103. `sv_npc_103_brine_club_fisherfolk.png`
Prompt: Create a group reference for the three Brine Club fisherfolk — salty older docksiders who bicker, swap tall tales, and warm to the player over many shared seasons. Distinct silhouettes: a wiry net-mender with a pipe, a barrel-chested storyteller with a battered rod, and a quiet rod-keeper with a coil of line. Salt-stained coastal gear, weathered humor, dock-side warmth.

104. `sv_npc_104_school_children_group.png`
Prompt: Create a group sheet of Ballast Bay school children with diverse designs, backpacks, beach toys, field notebooks, foraging baskets, lantern-craft kits, and lively town-child personality.

### H. Animals and Pets

105. `sv_animal_105_mooncalf_hen.png`
Prompt: Create a creature design sheet for mooncalf hens: plump coastal chickens with moon-pale feathers, tiny luminous speckles, friendly round shapes, egg variants, idle poses, and coop scale.

106. `sv_animal_106_mooncalf_chick.png`
Prompt: Create a cute mooncalf chick reference sheet with hatchling poses, sleepy pose, pecking pose, running pose, feather detail, and scale next to a boot.

107. `sv_animal_107_bluff_goat.png`
Prompt: Create a creature sheet for bluff goats: sturdy cliff-grazing goats with soft coats, little sea-bell collars, confident climbing poses, milk product callout, and friendly eyes.

108. `sv_animal_108_sand_duck.png`
Prompt: Create a creature sheet for sand ducks: beach-loving ducks with sandy plumage, blue bill accents, paddling, waddling, nesting, and egg product references.

109. `sv_animal_109_kelp_sheep.png`
Prompt: Create a creature sheet for kelp sheep: fluffy sheep with green-tinted curls, gentle faces, seaweed snack poses, wool product swatches, and pasture scale.

110. `sv_animal_110_shellback_pig.png`
Prompt: Create a creature sheet for shellback pigs: cheerful pigs with natural shell-like back markings, digging poses, truffle and shell fragment references, friendly farm design.

111. `sv_animal_111_lantern_bees_hive.png`
Prompt: Create a design sheet for lantern bees and their hive boxes: tiny glowing bees, honey jars, wax comb, nighttime garden glow, safe cute insect style, and apiary layout.

112. `sv_animal_112_tide_turtle.png`
Prompt: Create a tide turtle sanctuary reference: gentle coastal turtles, hatchling trail, nesting sign, caretaker bucket, protected habitat, warm conservation mood, no exploitation.

113. `sv_animal_113_mistral_cat.png`
Prompt: Create a pet reference sheet for mistral cats with several coat variants, lounging, following, fetching a small acorn, sleeping, stretching, and affectionate poses.

114. `sv_animal_114_dock_dog.png`
Prompt: Create a pet reference sheet for dock dogs with several coat variants, wagging, carrying driftwood, alert bark pose, sleeping by door, and playful fetch pose.

115. `sv_animal_115_marsh_frogs.png`
Prompt: Create a fauna sheet for fog frogs and marsh frogs: small varied designs, lily pad poses, singing throat bubble, rainy-day animation reference, and wetland palette.

116. `sv_animal_116_bright_crabs.png`
Prompt: Create a fauna sheet for bright crabs: colorful tide-pool crabs, scuttle poses, hiding in shells, tiny claw wave, collectible but nonthreatening design.

117. `sv_animal_117_reef_fish_sheet.png`
Prompt: Create a reef fish design sheet with 12 original fish silhouettes for Kelpglass Reefs, readable shapes, color-coded habitats, and no realistic brand/species labels.

118. `sv_animal_118_cave_moths.png`
Prompt: Create a creature sheet for cave moths: soft luminous moths, wing pattern variants, flutter poses, lantern attraction, harmless cave ambience, readable silhouettes.

119. `sv_animal_119_quarry_geckos.png`
Prompt: Create a small fauna sheet for quarry geckos with copper markings, rock-perching poses, blink animation reference, and tiny footprints.

120. `sv_animal_120_seasonal_birds.png`
Prompt: Create a birdwatching collection sheet with 16 original coastal birds for different seasons, simple readable shapes, perch poses, flight poses, and color notes.

### I. Crops, Flora, and Food Ingredients

121. `sv_crop_121_spring_crops_sheet.png`
Prompt: Create a crop sheet for spring crops: bell peas, rainroot, blush radish, glasslettuce, poppy kale, tide turnip. Show seed packet, sprout, mid-growth, mature plant, harvested item.

122. `sv_crop_122_summer_crops_sheet.png`
Prompt: Create a crop sheet for summer crops: sunmelon, saltcorn, bright okra, blueleaf basil, harborlime, shellbean. Show growth stages and harvested produce.

123. `sv_crop_123_fall_crops_sheet.png`
Prompt: Create a crop sheet for fall crops: ember squash, copper beet, dusk yam, maplenut, velvet cabbage, cider pear. Include growth stages and harvest icons.

124. `sv_crop_124_winter_crops_sheet.png`
Prompt: Create a crop sheet for winter crops: frost fennel, snowmoss, lantern leek, powderberry, ice carrot. Show snowy soil versions and harvested produce.

125. `sv_crop_125_reef_crops_sheet.png`
Prompt: Create a reef crop sheet: kelp ribbons, pearl algae, brine lotus, coral mint. Show underwater/low-tide beds, harvested forms, and clean game icon silhouettes.

126. `sv_crop_126_late_game_crops.png`
Prompt: Create a late-game rare crop sheet: prism guava, cloud cacao, echo pepper, stormgrain, starless plum, tide saffron. Magical but grounded coastal agriculture style.

127. `sv_flora_127_trees_sheet.png`
Prompt: Create a tree reference sheet: salt pine, glassleaf willow, cider pear tree, prism guava tree, maplenut tree, wind-bent ridge pine, young and mature versions.

128. `sv_flora_128_flowers_sheet.png`
Prompt: Create a flower and herb sheet: tide clover, blush poppy, cliff lavender, lantern fern, bell reeds, stormvine blossom, medicinal marsh herb, honey flower.

129. `sv_flora_129_mushrooms_sheet.png`
Prompt: Create a mushroom and moss sheet: mooncap mushrooms, copper moss, snowmoss, inkcap cluster, cave bloom fungus, driftwood shelf mushroom, with game icon clarity.

130. `sv_flora_130_seaweed_shells_sheet.png`
Prompt: Create a beach forage sheet: kelp ribbons, dry seaweed, rare shell, stormglass shard, drift pearl, sand dollar, crab molt, tide-polished stone.

131. `sv_food_131_recipe_icons_breakfast.png`
Prompt: Create a food icon sheet for breakfast recipes: mooncalf egg custard, honey loaf, blush radish toast, harborlime scone, tide tea, goat cheese omelet, powderberry porridge.

132. `sv_food_132_recipe_icons_savory.png`
Prompt: Create a food icon sheet for savory recipes: ember squash stew, copper beet pie, lantern leek soup, smoked shellbean, dusk yam curry, harborlime ceviche, velvet cabbage roll.

133. `sv_food_133_recipe_icons_sweets.png`
Prompt: Create a food icon sheet for sweets: sunmelon ice, cloud cacao tart, honeyed tea cake, powderberry jam, prism guava parfait, cider pear crumble, shellbean cookie.

134. `sv_crop_134_seed_packets.png`
Prompt: Create an original seed packet design sheet for the game's crops. Show 20 packets with simple crop icons, color bands, no readable brand text, clean game UI style.

135. `sv_crop_135_crop_quality_variants.png`
Prompt: Create a visual reference for crop quality tiers using original produce: normal, bright, prime, heirloom. Show subtle sparkle/shape/color differences without relying only on color.

### J. Tools, Items, Machines, and Buildings

136. `sv_tool_136_basic_tools_sheet.png`
Prompt: Create a tool sheet with hoe, watering can, axe, pick, sickle, fishing rod, carry yoke, and mending kit, each with wooden/copper starter material and clear silhouette.

137. `sv_tool_137_tool_upgrade_sheet.png`
Prompt: Create a four-tier upgrade sheet for core tools: driftwood, copper, stormsteel, tideglass. Show consistent forms becoming sturdier and more elegant.

138. `sv_tool_138_watering_can_action.png`
Prompt: Create an action concept of the player using an upgraded watering can with visible area preview tiles, splash animation, wet soil, and mobile-readable effects.

139. `sv_tool_139_mending_kit_action.png`
Prompt: Create an action concept of the player repairing a split-rail fence or wind-toppled garden trellis with a mending kit — pliers, cord, brace nails, tool belt — sawdust puffs, rope tension, and a restoration-progress mood.

140. `sv_item_140_inventory_items_sheet.png`
Prompt: Create a 60-item inventory icon sheet: crops, shells, ore, wood, stone, fish, cooked meals, gifts, crafting parts, festival props, and everyday household items. Clean separated icons, no text.

141. `sv_machine_141_brine_barrel.png`
Prompt: Create a machine design sheet for the brine barrel: idle, processing, ready states, ingredient slot idea, bubbling brine, coastal wood and copper hoops, readable game prop.

142. `sv_machine_142_herb_dryer.png`
Prompt: Create a machine design sheet for the herb dryer: hanging herbs, warm airflow, empty/processing/ready states, cedar frame, mesh trays, cozy farm utility.

143. `sv_machine_143_cheese_drum.png`
Prompt: Create a machine design sheet for the cheese drum: rounded wooden drum, milk input, turning handle, ready cheese, clean farm prop silhouette.

144. `sv_machine_144_honey_spinner.png`
Prompt: Create a machine design sheet for the honey spinner: glass jar, wax comb, crank, golden honey motion, lantern bee motif, idle/ready states.

145. `sv_machine_145_oil_press.png`
Prompt: Create a machine design sheet for the oil press: compact workshop device, sturdy lever, copper drip spout, jar slot, pressure gauge, idle/processing/ready states, warm artisan farm-utility style.

146. `sv_building_146_barn_coop_sheet.png`
Prompt: Create a building sheet for small coop, upgraded coop, small barn, upgraded barn. Coastal farm architecture, rope details, weather vanes, animal doors, warm interiors visible.

147. `sv_building_147_greenhouse_restored.png`
Prompt: Create a before/after building sheet for the greenhouse: broken storm ruin and restored glasshouse with saltproof panels, irrigation channels, hanging plants, and warm night glow.

148. `sv_building_148_ferry_winch.png`
Prompt: Create a prop/building reference for the ferry winch restoration: rusted broken state, repaired state, ropes, gears, dock beams, ferry access, and civic project clarity.

149. `sv_building_149_reef_nursery_frames.png`
Prompt: Create a design sheet for reef nursery frames, coral markers, floating buoys, seed baskets, snorkel signs, and restoration progress stages.

150. `sv_building_150_home_renovations.png`
Prompt: Create a farmhouse renovation progression sheet: starter cabin, expanded kitchen, extra room, partner room, cellar/workshop, decorated porch, all with same camera angle.

### K. Community Spaces and Gathering Scenes

151. `sv_common_151_village_yard_day.png`
Prompt: Create a reference image of the Ballast Bay village common at sunny midday: paved gathering circle with benches around a fire pit, garden plots and herb beds along one edge, a community bake oven, picnic tables, drying nets on racks at the far side, tide pools beyond, harvest bins, and readable composition for a key gathering hub.

152. `sv_common_152_cliff_lookout_wind.png`
Prompt: Create a reference image of the Netlight Point cliffside lookout: wind flags, stone overlook benches, safety ropes along the cliff edge, lighthouse wall behind, ocean drop beyond, signal mirrors on a post, and dramatic readable space for cliff-top scenes.

153. `sv_common_153_snow_gathering.png`
Prompt: Create a reference image of a winter community gathering on Splitwind Ridge: packed snow walkway through pines, lantern markers, a warming brazier with kettle, bundled villagers passing mugs, wind streamers, and safe playful winter atmosphere.

154. `sv_common_154_lantern_tide_beach.png`
Prompt: Create a reference image of a nighttime Lantern Tide gathering on the beach: floating paper lanterns drifting on dark water, strung lanterns along the strand, bioluminescent surf, villagers along the high-water mark, the lighthouse beam in the distance, and gentle remembrance atmosphere.

155. `sv_craft_155_handmade_lantern_designs.png`
Prompt: Create a handmade lantern and festival-prop design sheet with 12 originals: starter paper lantern, repaired patchwork lantern, tideglass lantern, stormsteel lantern, festival floating lantern, winter wool-wrapped lantern, reef-shell lantern, woven reed lantern, marsh fog lantern, archive brass lantern, ribbon-and-bell prop, harvest garland — no logos.

156. `sv_action_156_hauling_frame.png`
Prompt: Create a dynamic action reference of the player hauling a heavy crate or wagon: charge posture, foot placement, weighted lift, breath ribbon, ground shadow, and clear game animation timing.

157. `sv_action_157_planting_frame.png`
Prompt: Create an action reference of a low crouching planting and tide-pooling pose: arms reaching together to soil or shallow water, contact spark, target reticle for the tile, and readable body mechanics.

158. `sv_action_158_handoff_frame.png`
Prompt: Create an action reference of a two-villager handoff: passing a basket, jar, or tool, open posture, anticipation, partner ready stance, soft glow on the exchanged object, clean silhouette.

159. `sv_action_159_chopping_frame.png`
Prompt: Create an action reference of woodchopping: full strike pose, motion streak, log shadow, chip puffs, and an energetic but cozy farm style.

160. `sv_action_160_raising_frame.png`
Prompt: Create a group action reference of a community workday — neighbors raising a fence rail, barn beam, or signpost together. Strong vertical pose, partner brace, clear groundline, hands gripping wood, and a shared-effort mood.

161. `sv_action_161_rescue_frame.png`
Prompt: Create an action reference of a wildlife rescue moment: stretched reach for a stray chick, escaped goat kid, or struggling tide turtle. Sand puff, gentle focused expression, no injury emphasis.

162. `sv_collab_162_neighbor_mara.png`
Prompt: Create a collaboration scene with the player and Mara Vale: side-by-side at a windmill or harbor crane repair, precise quick handoffs of parts, mechanical timing motif, copper spark accents, focused partnership.

163. `sv_collab_163_neighbor_jun.png`
Prompt: Create a collaboration scene with the player and Jun Park: kitchen handoff at the bakery oven, gentle teamwork on a tray of festival bread, flour-dust sparkle, supportive hearth warmth.

164. `sv_collab_164_neighbor_niko.png`
Prompt: Create a collaboration scene with the player and Niko Venn: a wind-routed delivery handoff at the glider launch, wind ribbons showing airflow, agile courier movement, twilight light over the ridge.

165. `sv_festival_165_founders_fair_scene.png`
Prompt: Create a Founders Harvest Fair scene at the restored market square: produce tables, judges' ribbon stand, neighbors arriving with baskets, banners, livestock pen for show animals, musicians on a small stage, and lively community celebration energy.

166. `sv_skill_166_community_workstations.png`
Prompt: Create a community workshop reference sheet showing 8 skill-building stations: split-rail fence repair, seedling row planting, fish-cleaning bench, lantern-weaving table, kiln firing, mending corner with cloth and thread, forage trail with herb baskets, and a cooking-demo stand.

167. `sv_ui_167_calendar_task_mock.png`
Prompt: Create a gameplay UI mockup for a daily task and calendar view: season strip, day grid with festival and birthday markers, stamina and focus bars, friendship hearts, wind/tide badge, restoration progress pip, mobile-friendly buttons, clean readable screen.

168. `sv_tiles_168_ground_material_sheet.png`
Prompt: Create a ground material reference sheet: packed sand, packed clay, cliff stone, spring grass, snow, festival mat, reef shell path, indoor wood, marsh boardwalk, kitchen-garden tile. Show texture tiles and footprint marks.

169. `sv_npc_169_brine_club_poster.png`
Prompt: Create an in-world poster-style reference for the Brine Club fisherfolk trio, with no readable text. Sea-weathered stances, distinct silhouettes, salty humor, lantern light, a coil of rope and a battered rod between them.

170. `sv_event_170_animal_care_day.png`
Prompt: Create a noncompetitive community animal-care day at the sanctuary paddock: mooncalf hens being weighed in a basket scale, a dock dog getting a brush-down, a bluff goat at a grooming station, and villagers laughing as Fern leads a hatchling-naming circle. Safe, playful, not chaotic.

### L. UI and UX Mockups

171. `sv_ui_171_title_screen.png`
Prompt: Create a title screen mockup for the game: Ballast Bay lighthouse and village common at sunrise, Start/Continue/Settings/Credits buttons as clean placeholder UI, cozy browser-game polish, no rendered title or wordmark in the artwork.

172. `sv_ui_172_new_game_screen.png`
Prompt: Create a new game setup UI mockup with player customization, farm type selection, pet choice, name fields as placeholder boxes, and a coastal paper-and-wood interface.

173. `sv_ui_173_hud_farm_mobile.png`
Prompt: Create a mobile farm gameplay HUD mockup: hotbar, stamina, time, season, weather, tide, wallet, quest ping, virtual controls, and player watering crops. Keep UI readable.

174. `sv_ui_174_hud_desktop_farm.png`
Prompt: Create a desktop farm gameplay HUD mockup with keyboard-friendly hotbar, top status strip, compact quest tracker, inventory shortcut, and clear crop interaction prompt.

175. `sv_ui_175_inventory_screen.png`
Prompt: Create an inventory screen mockup with item grid, hotbar, character preview, wallet, sort buttons, trash, tooltip, quality markers, coastal materials, and legible placeholder text.

176. `sv_ui_176_relationship_screen.png`
Prompt: Create a relationship screen mockup showing NPC portraits, friendship hearts, birthday icons, known gift hints, shared-work markers, and filter tabs. Use placeholder names or short labels.

177. `sv_ui_177_calendar_screen.png`
Prompt: Create a calendar UI mockup for a 28-day season with birthdays, festivals, weather forecast strip, tide notes, and clean touch-friendly cells.

178. `sv_ui_178_quest_journal.png`
Prompt: Create a quest journal UI mockup with story quests, daily requests, civic projects, rewards, objective checkboxes, map hint thumbnail, and warm notebook styling.

179. `sv_ui_179_crafting_screen.png`
Prompt: Create a crafting screen mockup with recipe categories, ingredient slots, output preview, machine filters, unlock hints, and item icons in a tidy coastal workshop interface.

180. `sv_ui_180_shop_screen.png`
Prompt: Create a shop UI mockup for Market Lane: merchant portrait, seasonal stock grid, cart, item tooltip, wallet, buy/sell tabs, and open-hours indicator.

181. `sv_ui_181_dialogue_screen.png`
Prompt: Create a dialogue UI mockup with a large NPC portrait, dialogue box, two choice buttons, small affection feedback icon, and background scene slightly dimmed.

182. `sv_ui_182_day_summary.png`
Prompt: Create a bedtime day-summary UI mockup showing shipped items, income, skill XP, relationship changes, town restoration progress, and next-day notices on a cozy ledger page.

183. `sv_ui_183_map_screen.png`
Prompt: Create an in-game map UI mockup with Ballast Bay regions, player marker, shop icons, NPC hints, tide overlay toggle, and soft parchment coastal style.

184. `sv_ui_184_settings_accessibility.png`
Prompt: Create an accessibility/settings UI mockup with controls for text size, reduce motion, timing assist, contrast, audio categories, remapping, and touch layout. Use readable placeholder labels.

185. `sv_ui_185_photo_mode.png`
Prompt: Create a photo mode UI mockup with the player and NPCs posing in the village common at sunset, camera frame, hide UI button, filters, stickers as icons, and no complex text.

### M. Festivals and Narrative Key Scenes

186. `sv_festival_186_spring_seed_blessing.png`
Prompt: Create Spring Seed Blessing festival key art: villagers gathered around the village common with hand-painted seed jars, flower garlands, fresh crop bouquets, kids helping plant the first row, civic pride, bright spring morning.

187. `sv_festival_187_summer_glowtide_night.png`
Prompt: Create Summer Glowtide Night key art: villagers gathered on Driftwood Beach under strung lanterns, bioluminescent surf, night market snacks at small stalls, glowing tide pools, kids chasing tiny glow-crabs along the foam line, warm magical coastal atmosphere.

188. `sv_festival_188_fall_harvest_fair.png`
Prompt: Create Fall Harvest Fair key art: produce displays on long market tables, ribbon-judging stand, orange leaves drifting, cider pear crates, artisan machines on demo, friendly neighbors comparing baskets, cozy harvest energy.

189. `sv_festival_189_winter_frostlight.png`
Prompt: Create Winter Frostlight Festival key art: snow-covered village common, bundled villagers around a warming brazier, hot drinks, lanterns hung from pine boughs, breath mist, festive crowd singing, and playful winter celebration mood.

190. `sv_festival_190_lantern_tide.png`
Prompt: Create Lantern Tide festival key art: floating lanterns near the harbor, tide pools glowing, quiet remembrance, villagers together, lighthouse beam, tender evening atmosphere.

191. `sv_festival_191_marsh_chorus.png`
Prompt: Create Marsh Chorus festival key art: boardwalk stage, singers, frogs, reeds, lantern posts, foggy sunset, villagers seated on benches, music visible through light and motion.

192. `sv_festival_192_founders_harvest_fair.png`
Prompt: Create Founders Harvest Fair grand-celebration key art: the year-end community gathering at the restored market square and village common, banners across the lighthouse path, ribbon-pinned produce winners, neighbors carrying lanterns and baskets, musicians at the community hall stage, and the lighthouse beacon shining behind it all — triumphant but neighborly mood.

193. `sv_story_193_arrival_scene.png`
Prompt: Create the opening arrival scene: player stepping off a small bus or ferry with suitcase, seeing storm-worn Ballast Bay and Breakpoint Farm path ahead, hopeful beginning.

194. `sv_story_194_first_beacon_repair.png`
Prompt: Create a story scene of the player and Mara repairing the lighthouse beacon mount at sunset: tools scattered, coiled rope, an open mechanism crate, quiet trust forming between them, and Ballast Bay's lights warming up behind.

195. `sv_story_195_greenhouse_discovery.png`
Prompt: Create a story scene with Sol and the player discovering seed caches in the greenhouse ruin, dust motes, cracked glass light, old labels, wonder and scientific excitement.

196. `sv_story_196_niko_storm_memory.png`
Prompt: Create a dramatic emotional scene with Niko at the cliff during a windstorm, messenger bag clutched, lighthouse beam, player nearby, unresolved guilt without melodrama.

197. `sv_story_197_lio_deep_water.png`
Prompt: Create a tender reef scene where Lio faces fear of deep water, standing at snorkel entry with player support, clear sea, safety rope, quiet courage.

198. `sv_story_198_petra_archive_reveal.png`
Prompt: Create a narrative scene in the storm archive with Petra revealing an old map, lantern light, water stains, hidden truth, focused expressions, cozy mystery.

199. `sv_story_199_elsie_turtle_rescue.png`
Prompt: Create a sanctuary scene with Elsie, Fern, and the player guiding turtle hatchlings safely toward moonlit surf, protective ropes, gentle awe.

200. `sv_story_200_bash_quiet_scene.png`
Prompt: Create a quiet schoolhouse-shed scene with Bash holding an old rescue diver's compass and knee brace, player listening, weather-worn rescue pins and a photograph in the background, vulnerability and resilience.

201. `sv_story_201_community_hall_opening.png`
Prompt: Create a restored community hall opening ceremony with villagers, ribbons, stage, music, food tables, project board, and a sense of shared accomplishment.

202. `sv_story_202_final_storm_rally.png`
Prompt: Create an epic late-game scene of villagers securing town during a storm: animals sheltered, market canopies tied down, lighthouse active, player coordinating calmly, teamwork and safety.

203. `sv_story_203_year_end_review.png`
Prompt: Create a warm year-end town review scene in winter: villagers gathered around a board of completed projects, lanterns, snow outside, gratitude and future plans.

204. `sv_story_204_partner_picnic.png`
Prompt: Create a romantic but wholesome picnic scene on the cliff with the player and an unspecified partner silhouette option, food basket, blanket on the grass, the harbor below, sunset sea, customizable ambiguity.

205. `sv_story_205_family_found.png`
Prompt: Create a group scene of Ballast Bay residents around a long outdoor table after a festival, player included, animals nearby, warm lights, found-family feeling.

### N. Props, Decor, and Interiors

206. `sv_decor_206_furniture_sheet_starter.png`
Prompt: Create a furniture sheet for starter farmhouse decor: bed, table, chair, chest, rug, lamp, bookshelf, kitchen counter, wall shelf, plant stand, all separated and readable.

207. `sv_decor_207_furniture_sheet_coastal.png`
Prompt: Create a coastal decor furniture sheet: rope hammock, shell lamp, driftwood table, blue cabinet, net wall hanging, porthole mirror, tideglass vase, woven rug.

208. `sv_decor_208_furniture_sheet_workshop.png`
Prompt: Create a workshop and crafter decor sheet: pegboard tool rack, mending corner with thread spools, sturdy worktable with vice, materials chest, blueprint shelf, sawdust bin, hanging lantern, project-board easel, sturdy stool, apron hook.

209. `sv_decor_209_furniture_sheet_botanical.png`
Prompt: Create a botanical decor sheet: greenhouse shelves, seed cabinet, hanging herbs, terrarium, plant workbench, pressed flower frame, watering globe, botanical rug.

210. `sv_decor_210_wall_floor_patterns.png`
Prompt: Create a pattern sheet for walls and floors: whitewashed wood, sea tile, warm plaster, quarry stone, reed mat, floral wallpaper, woven festival mat, shell mosaic.

211. `sv_prop_211_mail_and_letters.png`
Prompt: Create a prop sheet for mail system visuals: mailbox, envelopes, wax seals, package crate, recipe card, festival invitation, weather bulletin, relationship letter, no readable text.

212. `sv_prop_212_notice_board.png`
Prompt: Create a town notice board prop with layered papers, pins, small icons, lost-and-found basket, quest slips, festival ribbon, and weathered wood. Avoid readable text.

213. `sv_prop_213_ribbons_and_quilts.png`
Prompt: Create a community-celebration prop sheet for Ballast Bay's local-history and county-fair-style awards: hand-stitched first-prize ribbons, a folded prize quilt, a produce display tray with the heaviest ember squash, a pressed-flower exhibit, a local-history plaque, a small woven garland, and a cozy harvest pennant. No readable text.

214. `sv_prop_214_books_archive.png`
Prompt: Create a library/archive prop sheet: old ledgers, map tubes, rulebook, weather almanac, seed archive box, magnifying glass, bookmark ribbons, storm-stained pages.

215. `sv_prop_215_fishing_gear.png`
Prompt: Create a fishing gear prop sheet: rods, lures, bait tins, crab pots, tackle box, fish basket, waterproof boots, net, reef-safe snorkel gear.

### O. Tilesets and Production Reference Sheets

216. `sv_tiles_216_farm_tileset_reference.png`
Prompt: Create a farm tileset reference sheet with soil states, watered soil, tilled soil, grass edges, path edges, crop shadows, irrigation channel edges, and fence corners.

217. `sv_tiles_217_town_tileset_reference.png`
Prompt: Create a town tileset reference sheet with cobblestone, shop fronts, stairs, railings, planters, signs without text, window variants, roof edges, and market canopy parts.

218. `sv_tiles_218_beach_tileset_reference.png`
Prompt: Create a beach tileset reference sheet with sand, wet sand, foam edge, tide pool, shells, sea oats, picnic blanket and fire-ring tiles, driftwood, rocks, and turtle nest marker.

219. `sv_tiles_219_marsh_tileset_reference.png`
Prompt: Create a marsh tileset reference sheet with boardwalk planks, reeds, mud, shallow water, lily pads, fog overlay samples, herb patches, and broken bridge parts.

220. `sv_tiles_220_quarry_tileset_reference.png`
Prompt: Create a quarry tileset reference sheet with rock floors, ore nodes, breakable stones, rail tracks, ladders, crystal clusters, cave walls, puddles, and safety rope posts.

221. `sv_tiles_221_reef_tileset_reference.png`
Prompt: Create a reef tileset reference sheet with coral, shallow water, low-tide stones, kelp beds, shell clusters, nursery frames, tide gates, and underwater light patterns.

222. `sv_tiles_222_snow_tileset_reference.png`
Prompt: Create a winter tileset reference sheet with snow ground, packed path, lantern walkway tiles, frosted fence, snow crop plots, pine shadows, footprints, and warm light spill.

223. `sv_anim_223_vfx_sheet.png`
Prompt: Create a visual effects sheet for small game animations: watering splash, harvest sparkle, tool impact puff, lantern light burst, fish bite ripple, gift heart, quest ping, level-up glow.

224. `sv_anim_224_weather_overlay_sheet.png`
Prompt: Create a weather overlay reference sheet: light rain, heavy rain, sea fog, wind streaks, heat shimmer, snow, storm flash, lantern mist, and low-tide sparkle.

225. `sv_anim_225_emote_bubble_sheet.png`
Prompt: Create an emote bubble sheet for NPCs and animals: happy, sad, surprised, hungry, sleepy, gift, quest, festival, weather, music, idea, warning. Simple icon clarity, no text.

### P. Marketing and Reference Covers

226. `sv_cover_226_game_cover_art.png`
Prompt: Create original cover art for the game: player centered with farm tools, a lantern, and a foraging basket, Ballast Bay behind, NPCs and animals around, lighthouse, reef, marsh, quarry hints, warm adventurous composition. Include no text and no rendered title.

227. `sv_cover_227_mobile_store_mock.png`
Prompt: Create a mobile app store screenshot-style mockup of the game's gameplay, showing farm, town, festival night, relationships, and exploration in a clean collage. No real store branding, minimal placeholder UI only, no rendered title.

228. `sv_cover_228_steam_capsule_style.png`
Prompt: Create a wide promotional capsule-style image for the game with harbor, farm, lighthouse, village common, and ensemble cast. Leave clear empty space for a title to be added later in production, no generated text.

229. `sv_cover_229_presskit_character_lineup.png`
Prompt: Create a character lineup presskit image with player, 12 romance candidates, and several animals, arranged by height and personality, clean neutral background, no text.

230. `sv_cover_230_world_poster_no_text.png`
Prompt: Create a no-text world poster for the game showing the entire adventure: farm foreground, town middle ground, village common, beach, lighthouse, marsh, quarry, ridge, outer islets, and festival lanterns.

---

## Batch Use Notes

Suggested production order:

1. Generate prompts 001-010 first to lock style.
2. Generate 011-030 to establish map and environment logic.
3. Generate 061-104 to lock character proportions and fashion.
4. Generate 105-135 for animals, crops, and flora.
5. Generate 136-170 for gameplay tools, community spaces, and shared-work scenes.
6. Generate 171-185 for UI.
7. Generate 186-230 for narrative, festivals, tilesets, and promotional references.

For consistency, keep the same master style brief across the entire run. If an early image defines a strong look you like, use it as a visual reference for later ChatGPT Image Creator prompts.

If any inherited or auto-generated prompt drifts back toward sports, courts, nets, balls, tournaments, leagues, scores, or trophies, treat it as a defect and substitute community-life equivalents per `art-production/CURRENT_ART_DIRECTION.md`:
- court → village common, garden, creekside clearing, or community yard
- sport gear → farm, forestry, river, trail, craft, music, or festival props
- sport pose → work, traversal, wildlife care, craft, or social action pose
- team synergy → neighbor collaboration or shared work
- tournament/championship → county fair, harvest gathering, river day, or community celebration
- score/league UI → calendar, task, weather, relationship, skill, or restoration UI
- sports banners/trophies → quilts, ribbons, craft exhibits, produce displays, local-history objects
