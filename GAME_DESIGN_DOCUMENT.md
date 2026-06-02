# Temu Smash Bros - Game Design Document

## Table of Contents

1. [Game Overview](#game-overview)
2. [Core Mechanics](#core-mechanics)
3. [Characters](#characters)
4. [Stages](#stages)
5. [Game Modes](#game-modes)
6. [Visual Style](#visual-style)
7. [Audio Design](#audio-design)
8. [UI/UX Flow](#uiux-flow)
9. [Multiplayer](#multiplayer)

---

## Game Overview

### Identity

**Title:** Temu Smash Bros
**Genre:** Platform Fighter
**Platform:** Browser-based (Desktop primary, tablet secondary)
**Tech Stack:** Next.js, HTML5 Canvas / WebGL, WebSocket
**Players:** 1-4 (local and online)
**Target Audience:** Fans of platform fighters looking for an accessible, visually striking browser experience

### Elevator Pitch

Temu Smash Bros is a neon-drenched, browser-based platform fighter where six elemental warriors clash across surreal geometric arenas. Built on Next.js, it brings the depth of classic platform fighters to the browser with a distinctive art style, tight controls, and seamless online multiplayer.

### Design Pillars

- **Accessible Depth:** Easy to pick up, rewarding to master. Simple inputs with deep mechanical interactions.
- **Visual Spectacle:** Every hit, every KO, every special move is a burst of neon geometry and particle effects.
- **Browser-Native:** No downloads, no installs. Share a link, start fighting.
- **Competitive Integrity:** Balanced roster, consistent physics, low-latency netcode.

---

## Core Mechanics

### Percentage Damage System

- Each fighter starts at 0% damage.
- Attacks deal damage that increases the opponent's percentage.
- Higher percentage means greater knockback received from hits.
- There is no maximum percentage cap, but practical KO thresholds exist per character (typically 80-180% depending on weight and the attack used).
- Percentage carries between stocks but resets on KO.

### Knockback

- Knockback is calculated from: base knockback + (knockback growth * opponent's damage percentage).
- Each attack has a defined knockback angle (e.g., 45 degrees upward, straight horizontal, spike downward).
- DI (Directional Influence): Players can hold a direction during hitstun to subtly alter their knockback trajectory, enabling survival at higher percents.
- Knockback decay: Knockback velocity decreases over time following a linear curve.

### Stocks

- Default stock count: 3 per player (configurable 1-5).
- A stock is lost when a character crosses the blast zone (the invisible boundary surrounding the stage).
- Upon losing a stock, the character respawns on a revival platform with brief invincibility (3 seconds or until the player acts).
- The last player with remaining stocks wins.

### Movement

- **Ground movement:** Walk, run (double-tap or hold), crouch, crawl (character-dependent).
- **Jumping:** Each character has a ground jump and one midair jump (double jump). Some characters have unique jump properties.
- **Air movement:** Full aerial drift control. Air speed and fall speed vary per character.
- **Fast fall:** Tap down at the peak of a jump or during descent to increase fall speed by 60%.
- **Platform drop-through:** Tap down while on a pass-through platform to drop through it.
- **Dash dancing:** Quickly alternating dash directions for spacing and mind games.
- **Wavedash (advanced):** Airdodge diagonally into the ground to slide with maintained momentum.

### Air Combat

- **Short hop:** Briefly tap jump for a lower, faster jump arc ideal for aerial approaches.
- **Full hop:** Hold jump for maximum height.
- **Aerial attacks:** Neutral air, forward air, back air, up air, down air. Each has distinct hitboxes, damage, and knockback properties.
- **Aerial drift:** Players maintain full horizontal control while airborne.
- **Landing lag:** Aerials have landing lag if the character lands during the attack animation. L-canceling (pressing shield just before landing) reduces landing lag by 50%.
- **Edge-canceled aerials:** Landing on the edge of a platform during an aerial cancels the landing lag entirely.

### Shields

- **Shield activation:** Hold the shield button to project an energy barrier around the character.
- **Shield health:** Shields have a health pool that depletes when absorbing attacks. Shields regenerate when not active.
- **Shield stun:** Blocking an attack causes brief stun proportional to the attack's damage.
- **Shield break:** If shield health reaches zero, the shield shatters and the character is stunned for 3 seconds (dizzy state), leaving them completely vulnerable.
- **Shield decay:** Shields slowly shrink while held, even without taking hits.
- **Perfect shield (parry):** Activating shield within a 4-frame window of an attack's impact reflects reduced knockback and grants frame advantage. Visual flash indicates success.
- **Shield poke:** As shields shrink, parts of the character become exposed and can be hit through the shield.

### Dodges

- **Spot dodge:** Press down while shielding. The character dodges in place with brief invincibility frames (frames 3-17 of a 26-frame animation).
- **Roll:** Press left/right while shielding. The character rolls in that direction with invincibility. Covers distance but has recovery frames.
- **Air dodge:** Press shield while airborne. The character gains brief invincibility. Directional air dodge sends the character in the held direction but causes special fall (helpless state). Neutral air dodge keeps position and allows continued action.
- **Dodge staling:** Consecutive dodges within a short window have reduced invincibility frames and increased end lag.

### Grabs and Throws

- **Grab:** Press the grab button to reach out and seize an opponent. Grabs bypass shields.
- **Grab range:** Varies per character. Some characters have tether grabs with extended range.
- **Pummel:** While holding a grabbed opponent, press the attack button to deal small ticks of damage.
- **Throws:** Four throw directions (forward, back, up, down). Each throw has unique knockback angle and damage. Throws can combo into attacks at certain percentages or KO at high percents.
- **Grab escape:** The grabbed player can mash buttons to escape faster. Higher damage percentage means longer grab hold time.
- **Dash grab:** Grabbing while running extends range slightly but adds recovery frames on whiff.

### Edge Mechanics

- **Ledge grab:** Characters can grab the stage ledge when near it during recovery. The character snaps to the ledge and hangs.
- **Ledge options:** From the ledge, a player can: normal get-up, roll onto stage, jump from ledge, attack from ledge, or drop from ledge.
- **Ledge invincibility:** First ledge grab grants invincibility for 30 frames. Subsequent grabs without touching the ground reduce invincibility.
- **Ledge trumping:** If a character grabs a ledge already occupied by another player, the original holder is bumped off with a small forced aerial.
- **Two-frame vulnerability:** There is a 2-frame window when grabbing the ledge where the character is vulnerable, enabling skilled edge-guard punishes.
- **Ledge magnetism:** Characters within a defined range of the ledge will snap to it, with the range varying by character and recovery move.

### Staling

- **Move staling:** Repeatedly using the same attack reduces its damage by up to 30%. Using different moves refreshes staled moves via a queue system (last 9 moves tracked).
- **Dodge staling:** Described above in the Dodges section.

### Rage Mechanic

- At higher damage percentages (80%+), a character's attacks deal 10-15% additional knockback, scaling linearly up to 150%.
- Visual indicator: Character's neon outline intensifies and pulses at high percentages.

---

## Characters

All characters share the same input scheme but differ in attributes (weight, speed, fall speed, air speed, jump height) and movesets.

### Weight Classes

| Class | Weight Range | Description |
|-------|-------------|-------------|
| Lightweight | 75-85 | Faster, KO'd earlier |
| Middleweight | 90-100 | Balanced |
| Heavyweight | 105-120 | Slower, survives longer |

---

### 1. Blaze (Fire Bruiser)

**Element:** Fire
**Weight:** 104 (Heavy-middleweight)
**Archetype:** Bruiser / Brawler
**Playstyle:** Aggressive, close-range powerhouse with strong kill moves and approach options. Rewards relentless pressure but punishable on whiff.

**Attributes:**
- Ground Speed: 7/10
- Air Speed: 5/10
- Fall Speed: 6/10
- Jump Height: 5/10
- Weight: 7/10

**Visual Design:** A humanoid figure built from angular, jagged geometric shapes suggesting flickering flames. Core body is deep crimson polygons with bright orange and yellow neon edges. Attacks leave trailing afterimages of fire particles. Idle animation has subtle flame flicker along outlines.

#### Moveset

**Ground Normals:**
- **Jab (Neutral A):** A three-hit combo. Quick left hook (3%), straight right (3%), finishing palm blast that releases a small fire burst (5%). 11% total. Fast startup (frame 3).
- **Forward Tilt:** A sweeping kick wreathed in flame. 10% damage. Good horizontal range. Slight forward knockback.
- **Up Tilt:** An arcing uppercut trailing fire. 9% damage. Anti-air coverage. Combos into aerials at low-mid percent.
- **Down Tilt:** A low sweeping leg kick with a fire trail. 8% damage. Can trip opponents at low percent, combos into dash attack or grab.
- **Dash Attack:** A lunging shoulder charge engulfed in flame. 12% damage. Strong approach tool but punishable on shield.

**Smash Attacks:**
- **Forward Smash:** Rears back and delivers a devastating fire-infused straight punch. 16-22% (charged). High kill power. Slow startup (frame 18) but massive knockback.
- **Up Smash:** An explosive uppercut creating a pillar of flame above. 15-20% (charged). Excellent KO move, hits slightly behind as well.
- **Down Smash:** Stomps the ground, causing fire eruptions on both sides. 14-18% (charged). Good ledge coverage, hits on both sides simultaneously.

**Aerial Attacks:**
- **Neutral Air (Nair):** Surrounds body with a spinning ring of fire. 11% (clean), 7% (late). Long-lasting hitbox, great combo tool.
- **Forward Air (Fair):** An overhead flame axe-kick. 13% damage. Meteor smash if sweetspotted at the heel. Good kill move offstage.
- **Back Air (Bair):** A backward flame-wreathed kick. 14% damage. Blaze's strongest aerial KO move. Fast startup.
- **Up Air (Uair):** An upward flip kick with a fire arc. 10% damage. Excellent juggle tool, combos into itself at low percent.
- **Down Air (Dair):** A downward double stomp releasing fire below. 15% damage (sweetspot meteor), 10% (sourspot). High risk, high reward spike.

**Special Moves:**
- **Neutral Special - Inferno Burst:** Charges a fireball that grows in size. Tap for a small, fast projectile (6%). Full charge for a large, slow fireball that explodes on contact (18%) with a lingering hitbox. Can be stored and released later.
- **Side Special - Flame Rush:** Dashes forward engulfed in flame, passing through opponents. 12% damage. Covers good horizontal distance. Can be angled slightly up or down. In the air, maintains momentum.
- **Up Special - Fire Cyclone:** Spins rapidly upward in a tornado of flame, hitting multiple times (2% x 5 hits + 3% finisher = 13% total). Decent vertical recovery. Has a windbox that pushes nearby opponents.
- **Down Special - Heat Aura:** Briefly channels fire energy, creating a close-range aura (counter-like timing). If hit during the 6-frame active window, retaliates with an explosion dealing 1.3x the damage received. If not hit, gains a temporary 5-second damage boost (attacks deal 3% extra fire damage). 14-second cooldown.

**Grab / Throws:**
- **Grab:** Standard reach. Blaze seizes the opponent with a flaming grip.
- **Pummel:** Headbutt with flame burst. 1.5% per pummel.
- **Forward Throw:** Hurls opponent forward with a flame push. 9%. Sets up edge-guard situations.
- **Back Throw:** Spins and launches opponent behind. 11%. KO throw at high percent near ledge.
- **Up Throw:** Tosses opponent upward with a fire explosion. 8%. Combos into up air at low-mid percent.
- **Down Throw:** Slams opponent to the ground with a fire burst. 7%. Combos into forward air or neutral air.

**Recovery:** Fire Cyclone (Up Special) provides moderate vertical distance. Flame Rush (Side Special) provides strong horizontal distance. Combined, Blaze has a serviceable but not exceptional recovery. Predictable trajectory is the main weakness.

---

### 2. Zephyr (Wind Speedster)

**Element:** Wind
**Weight:** 78 (Lightweight)
**Archetype:** Speedster / Hit-and-Run
**Playstyle:** Blazing fast with excellent combo game and edge-guarding. Thrives on speed and evasion but dies early and has weak kill power outside of precise reads.

**Attributes:**
- Ground Speed: 10/10
- Air Speed: 9/10
- Fall Speed: 4/10 (floaty)
- Jump Height: 8/10
- Weight: 3/10

**Visual Design:** A sleek, elongated humanoid made of sweeping curved triangles and crescent shapes suggesting wind currents. Pale cyan and white neon outlines with translucent green geometry. Movements leave wispy trail particles. Idle animation shows gentle swaying like a leaf in the breeze.

#### Moveset

**Ground Normals:**
- **Jab (Neutral A):** A rapid flurry of wind-enhanced slaps. Rapid jab (1% per hit, up to 8 hits) into a finisher gust (3%). 11% total if all connect. Frame 2 startup.
- **Forward Tilt:** A quick wind-blade kick. 7% damage. Very fast, good for poking. Low knockback.
- **Up Tilt:** A graceful upward wind sweep with the arm. 6% damage. Combos into itself at low percent, then into aerials.
- **Down Tilt:** A quick ankle-level wind slash. 5% damage. Sends at a low angle, excellent combo starter.
- **Dash Attack:** A spinning wind drill. 9% damage (clean), 6% (late). Fast and covers distance but low knockback.

**Smash Attacks:**
- **Forward Smash:** Conjures a horizontal wind blade and slashes forward. 13-17% (charged). Zephyr's best grounded kill move but still below average kill power.
- **Up Smash:** Creates a vertical wind funnel. Hits multiple times (2% x 3 + 6% finisher = 12-16% charged). Catches landings well.
- **Down Smash:** Spins low creating wind blades on both sides. 10-14% (charged). Fast startup (frame 8), good for catching rolls.

**Aerial Attacks:**
- **Neutral Air (Nair):** A spinning multi-hit wind aura. 2% x 4 hits + 2% finisher = 10%. Excellent combo extender and landing tool.
- **Forward Air (Fair):** A quick forward wind slash. 8% damage. Fast (frame 5), combos into itself. Zephyr's bread-and-butter aerial.
- **Back Air (Bair):** A backward crescent wind kick. 11% damage. Zephyr's strongest aerial. Good for wall-of-pain edge-guarding.
- **Up Air (Uair):** An upward wind burst. 7% damage. Fast juggle tool, combos into itself repeatedly.
- **Down Air (Dair):** A downward wind stomp. 9% damage. Bounces Zephyr upward on hit (stall-then-fall). Meteor smash on sweetspot.

**Special Moves:**
- **Neutral Special - Gale Shot:** Fires a small wind projectile that pushes opponents (3% damage, strong pushback). Can be charged for a larger gust (7% damage, extreme pushback). Useful for gimping recoveries and controlling space.
- **Side Special - Slipstream:** Zephyr dashes at extreme speed in a chosen direction. On contact with an opponent, passes through them dealing 8% and leaving them in hitstun. No contact means Zephyr ends in brief recovery lag. Can be used in the air. Functions as a combo extender or escape option.
- **Up Special - Updraft:** Summons a powerful wind column beneath, launching Zephyr high into the air. Excellent vertical recovery. The wind column also pushes opponents downward (windbox, no damage). Can act out of it with aerials.
- **Down Special - Tailwind:** Activates a 6-second speed buff (ground speed and air speed increased by 25%). During Tailwind, Zephyr's attacks deal 2% less damage but have reduced startup and end lag. 18-second cooldown.

**Grab / Throws:**
- **Grab:** Slightly below-average range. Quick animation.
- **Pummel:** Wind squeeze. 1% per pummel. Very fast pummel.
- **Forward Throw:** Launches opponent forward on a gust of wind. 7%. Sends at a low angle for edge-guard setups.
- **Back Throw:** Wind reversal toss. 8%. Positional throw.
- **Up Throw:** Wind launch upward. 6%. Combos into up air chains at low-mid percent.
- **Down Throw:** Slams down with wind pressure. 5%. Combos into forward air or dash attack. Zephyr's primary combo throw.

**Recovery:** Updraft (Up Special) gives excellent vertical recovery. Slipstream (Side Special) gives strong horizontal recovery. Combined with Zephyr's high air speed and floaty fall speed, recovery is among the best in the roster.

---

### 3. Granite (Earth Tank)

**Element:** Earth
**Weight:** 118 (Super Heavyweight)
**Archetype:** Tank / Grappler hybrid
**Playstyle:** Slow but devastatingly powerful. Excellent at holding space, punishing mistakes, and surviving to extreme percentages. Struggles against fast characters who can avoid commitment.

**Attributes:**
- Ground Speed: 3/10
- Air Speed: 2/10
- Fall Speed: 9/10 (fast faller)
- Jump Height: 3/10
- Weight: 10/10

**Visual Design:** A massive, stocky humanoid constructed from thick hexagonal and rectangular stone blocks. Deep brown and gray geometry with amber and gold neon veins running through cracks. Attacks cause the ground to crack with glowing fissure effects. Idle animation shows subtle geological shifting of body panels.

#### Moveset

**Ground Normals:**
- **Jab (Neutral A):** A heavy two-hit combo. Stone fist jab (4%) into a backhand slam (6%). 10% total. Slow startup (frame 7) but high damage.
- **Forward Tilt:** A stone-reinforced palm strike. 12% damage. Excellent range and damage for a tilt. Moderate knockback.
- **Up Tilt:** A rising stone pillar erupts from Granite's shoulders. 11% damage. Massive vertical hitbox, punishes aerial approaches.
- **Down Tilt:** A ground-shaking stomp. 9% damage. Causes a small tremor hitbox in front. Can bury opponents at high percent.
- **Dash Attack:** A lumbering shoulder tackle. 14% damage. Extremely powerful but very slow to start and recover.

**Smash Attacks:**
- **Forward Smash:** Summons a massive stone fist that extends from Granite's arm and slams forward. 20-28% (charged). One of the strongest forward smashes in the game. Frame 24 startup.
- **Up Smash:** Erupts stone pillars around the body. 18-25% (charged). Enormous hitbox, devastating damage. Very slow.
- **Down Smash:** Creates a seismic shockwave on both sides. 16-22% (charged). Hits grounded opponents, can bury at high percent.

**Aerial Attacks:**
- **Neutral Air (Nair):** Curls into a rotating stone ball. 12% damage. Large hitbox, slow startup. Granite's safest aerial.
- **Forward Air (Fair):** A heavy overhead stone hammer fist. 15% damage. Very slow (frame 14) but extreme knockback. Devastating meteor smash if sweetspotted.
- **Back Air (Bair):** A backward stone mule kick. 14% damage. Granite's fastest aerial (frame 9). Good KO move.
- **Up Air (Uair):** An upward headbutt with stone spikes. 13% damage. Powerful juggle finisher.
- **Down Air (Dair):** A devastating ground pound. Granite plummets downward with massive force. 18% damage. Powerful meteor smash. Extreme landing lag if it misses. Very high risk, very high reward.

**Special Moves:**
- **Neutral Special - Boulder Toss:** Rips a boulder from the ground and hurls it. Small tap version: 10% damage, medium speed. Charged version: 22% damage, large boulder, slow but breaks shields. Boulders arc and bounce once on the ground. Can be reflected.
- **Side Special - Tectonic Charge:** Granite charges forward like a freight train. Absorbs up to 15% damage during the charge without flinching (super armor). Deals 16% and high knockback on impact. Can be angled to grab the ledge at the end. Very punishable on shield.
- **Up Special - Fault Line Launch:** Granite summons a stone pillar beneath that launches upward. Modest vertical gain but the pillar persists for 3 seconds as a temporary obstacle on stage. Can be used creatively for stage control.
- **Down Special - Stone Skin:** Hardens body for 4 seconds. During Stone Skin, Granite takes 40% less damage and knockback but cannot jump or use specials. Can only walk slowly and use ground normals. 20-second cooldown.

**Grab / Throws:**
- **Grab:** Surprisingly long range for a non-tether grab. Slow startup.
- **Pummel:** Crushing squeeze. 2% per pummel. Slow but high damage.
- **Forward Throw:** Winds up and catapults the opponent forward. 12%. Strong KO throw near the ledge at high percent.
- **Back Throw:** Picks up opponent and slams them behind. 13%. Granite's strongest throw. KO throw.
- **Up Throw:** Tosses opponent straight up with tremendous force. 10%. Can KO off the top at extreme percents.
- **Down Throw:** Body slams the opponent into the ground. 8%. Buries the opponent briefly. Follow up with a smash attack for massive damage.

**Recovery:** Fault Line Launch (Up Special) provides limited vertical recovery. Tectonic Charge (Side Special) provides moderate horizontal distance. Granite's recovery is poor overall, making off-stage play very risky. The high weight compensates by allowing survival to extreme percentages on-stage.

---

### 4. Volt (Electric Glass Cannon)

**Element:** Electric
**Weight:** 82 (Lightweight)
**Archetype:** Glass Cannon / Zoner
**Playstyle:** Extreme damage output and excellent projectile game. Can KO very early with precise play. Dies early and has a mediocre recovery, demanding careful positioning and strong neutral play.

**Attributes:**
- Ground Speed: 8/10
- Air Speed: 7/10
- Fall Speed: 7/10
- Jump Height: 7/10
- Weight: 3/10

**Visual Design:** A sharp, angular humanoid made of zigzag bolt-shaped geometry. Electric blue and vivid purple core with bright white and yellow neon outlines that constantly crackle with tiny lightning arcs. Attacks produce bright flash effects and screen-shake. Idle animation has small electric sparks jumping between body segments.

#### Moveset

**Ground Normals:**
- **Jab (Neutral A):** A quick electric jab into a taser-like rapid multi-hit (1% x 6) into a finishing electric burst (4%). 10% total. Frame 3 startup.
- **Forward Tilt:** A crackling electric palm thrust. 9% damage. Causes brief electric stun effect (extra 2 frames of hitstun beyond normal).
- **Up Tilt:** An upward electric arc. 8% damage. Fast anti-air with disjointed hitbox (the electricity extends beyond the hand).
- **Down Tilt:** A low electric slide kick. 7% damage. Sends at a semi-spike angle. Great combo starter.
- **Dash Attack:** An electric lunge punch. 11% damage. Fast but high end lag.

**Smash Attacks:**
- **Forward Smash:** Channels and releases a concentrated lightning bolt forward. 18-24% (charged). Exceptional range (functions almost like a mid-range projectile). Frame 16 startup.
- **Up Smash:** Summons a lightning strike above. 16-22% (charged). Tall, thin hitbox. Devastating damage if it connects.
- **Down Smash:** Creates an electric field on the ground on both sides. 14-19% (charged). Multi-hit (pulls opponents in, then launches). Good roll punish.

**Aerial Attacks:**
- **Neutral Air (Nair):** An electric discharge around the body. 10% (clean), 6% (late). Quick startup, good all-purpose aerial.
- **Forward Air (Fair):** A forward electric claw swipe. 12% damage. Causes electric stun effect. Good combo aerial.
- **Back Air (Bair):** A backward lightning kick. 13% damage. Fast and strong. Volt's aerial KO move.
- **Up Air (Uair):** An upward electric discharge. 9% damage. Multi-hit (3% x 3). Good for extending juggles.
- **Down Air (Dair):** A downward lightning bolt stomp. 14% damage. Meteor smash with electric spike visual. Fast startup for a dair.

**Special Moves:**
- **Neutral Special - Thunderbolt:** Fires a fast, straight lightning projectile. Tap for a quick bolt (5%, fast, low end lag). Hold for a charged beam (14%, pierces through opponents, high end lag). The charged version has a 1-second charge time but can be canceled into shield.
- **Side Special - Lightning Dash:** Volt transforms into a lightning bolt and teleports horizontally. Deals 10% to anyone in the path. Extremely fast. Very short end lag. Excellent approach and escape tool. In the air, causes helpless fall after use.
- **Up Special - Tesla Coil:** Volt launches upward with an electric tether-like move. Moderate vertical distance. If it contacts an opponent, electrocutes them (8%) and bounces Volt higher (extending recovery). If it contacts the ledge, snaps to it immediately.
- **Down Special - Static Field:** Places an electric trap on the ground (or in the air as a floating orb). The trap lasts 8 seconds or until triggered. When an opponent enters the trap, they take 6% damage and are briefly stunned (10 frames). Only one trap can exist at a time. Placing a new one removes the old one.

**Grab / Throws:**
- **Grab:** Average range. Fast startup.
- **Pummel:** Electric shock. 1.3% per pummel. Fast.
- **Forward Throw:** Electrocutes and launches forward. 8%. Sets up edge-guard scenarios.
- **Back Throw:** Electric discharge behind. 9%. Decent KO throw at ledge.
- **Up Throw:** Zaps opponent upward with a lightning bolt. 7%. Combos into thunder bolt at low percent.
- **Down Throw:** Slams opponent down with electric force. 6%. Combos into forward air or lightning dash at low-mid percent.

**Recovery:** Tesla Coil (Up Special) provides moderate vertical recovery that improves if it connects with an opponent. Lightning Dash (Side Special) provides strong horizontal recovery but causes helpless fall. Recovery is functional but linear and predictable, making Volt easy to edge-guard.

---

### 5. Tide (Water Grappler)

**Element:** Water
**Weight:** 108 (Heavyweight)
**Archetype:** Grappler / Command-grab specialist
**Playstyle:** Controls space with water projectiles and threatens with powerful command grabs. Excels at reading opponents and punishing with devastating throw combos. Slow approach makes neutral challenging.

**Attributes:**
- Ground Speed: 4/10
- Air Speed: 5/10
- Fall Speed: 6/10
- Jump Height: 5/10
- Weight: 8/10

**Visual Design:** A broad, flowing humanoid made of undulating wave-shaped polygons and circular water droplet geometry. Deep navy and teal body with luminous aquamarine and seafoam neon edges. Attacks produce splashing water particle effects and ripple distortions. Idle animation has a slow, rhythmic sway like ocean waves.

#### Moveset

**Ground Normals:**
- **Jab (Neutral A):** A quick water-whip snap followed by a palm push creating a small splash. Two hits: 4% + 5% = 9% total. Frame 5 startup.
- **Forward Tilt:** A reaching water tendril strike. 10% damage. Excellent range due to water extension. Slow for a tilt.
- **Up Tilt:** A rising water geyser around the body. 9% damage. Good vertical coverage, scoops opponents upward.
- **Down Tilt:** A low water wave sweep. 7% damage. Slides opponents toward Tide (pull effect), enabling grab follow-ups.
- **Dash Attack:** A crashing wave body slam. 13% damage. Slow startup but has super armor on frames 8-14.

**Smash Attacks:**
- **Forward Smash:** Conjures a massive water fist that slams forward. 17-23% (charged). Strong horizontal knockback. Produces a lingering splash hitbox (3%) for an additional frame.
- **Up Smash:** A towering water spout erupts upward. 15-21% (charged). Multi-hit with a strong finisher. Great anti-air.
- **Down Smash:** Creates two crashing waves on both sides. 14-19% (charged). Wide coverage. Sends at a low angle ideal for edge-guard setups.

**Aerial Attacks:**
- **Neutral Air (Nair):** A swirling water shield around the body. 10% damage. Long-lasting hitbox (12 active frames). Safe landing option.
- **Forward Air (Fair):** A water tendril whip forward. 11% damage. Disjointed range. Good spacing tool in the air.
- **Back Air (Bair):** A backward water burst. 13% damage. Tide's strongest aerial. Good for wall-of-pain.
- **Up Air (Uair):** An upward water jet. 10% damage. Consistent juggle tool.
- **Down Air (Dair):** A downward water slam. 14% damage. Spike on sweetspot. Slow but devastating off-stage.

**Special Moves:**
- **Neutral Special - Tidal Shot:** Fires a water projectile that travels in a wave pattern (oscillating up and down). Tap for a small wave (5%, medium speed). Hold to charge a large tidal wave (12%, slow, pushes opponents far). The wave pattern makes it tricky to dodge. Can be absorbed but not reflected (it splashes).
- **Side Special - Undertow Grab (Command Grab):** Tide lunges forward with a water tendril. If it connects (grab, not a strike, so it beats shields), Tide pulls the opponent in and slams them. 14% damage and strong knockback. If it misses, Tide suffers heavy end lag. Range is moderate (roughly 1.5x normal grab range). Cannot be shielded but can be jumped or dodged.
- **Up Special - Whirlpool Rise:** Tide rises on a spiraling water column. Good vertical recovery. The whirlpool below acts as a windbox pulling nearby opponents downward. Modest horizontal control during the rise.
- **Down Special - Water Armor:** Encases body in a water shell for 5 seconds. During Water Armor, Tide has super armor on all attacks (can absorb hits without flinching up to 20% per hit). However, Tide takes full damage and cannot grab or use command grab. 22-second cooldown.

**Grab / Throws:**
- **Grab:** Extended range (water tendril reach). Slower startup than average.
- **Pummel:** Crushing water pressure. 1.8% per pummel. Moderate speed.
- **Forward Throw:** Water cannon blast forward. 10%. Good knockback angle for edge-guarding.
- **Back Throw:** Whirlpool spin and hurl behind. 12%. Strong KO throw.
- **Up Throw:** Geyser launch upward. 9%. Can combo into up air at low percent.
- **Down Throw:** Water slam to the ground. 7%. Tide's combo throw. Chains into forward air, up air, or another grab at very low percents.

**Recovery:** Whirlpool Rise (Up Special) provides solid vertical recovery. Undertow Grab (Side Special) provides slight horizontal movement but is primarily an attack. Recovery is above average but lacks horizontal range. Tide's heavy weight helps survive on-stage to compensate.

---

### 6. Nova (Cosmic All-Rounder)

**Element:** Cosmic / Stellar energy
**Weight:** 95 (Middleweight)
**Archetype:** All-rounder / Fundamental
**Playstyle:** The most balanced character with tools for every situation. Excels at nothing specifically but has no exploitable weaknesses. Rewards strong fundamental play and adaptation. The recommended starter character.

**Attributes:**
- Ground Speed: 6/10
- Air Speed: 6/10
- Fall Speed: 5/10
- Jump Height: 6/10
- Weight: 5/10

**Visual Design:** A balanced, elegant humanoid composed of star-shaped polygons and orbital ring geometry. Deep indigo and violet body with brilliant magenta, gold, and white neon outlines. Attacks produce cosmic particle effects: small stars, orbital rings, and nebula-like color bursts. Idle animation has small stars orbiting around the character.

#### Moveset

**Ground Normals:**
- **Jab (Neutral A):** A three-hit combo: star-infused punch (3%), cosmic palm strike (3%), finishing energy burst (5%). 11% total. Frame 4 startup. Well-rounded speed and damage.
- **Forward Tilt:** A cosmic energy-enhanced roundhouse kick. 9% damage. Good range and speed. Reliable poke.
- **Up Tilt:** An upward arc of stellar energy. 8% damage. Broad coverage overhead. Combos into aerials.
- **Down Tilt:** A low cosmic sweep. 7% damage. Fast, sends at a useful angle for follow-ups.
- **Dash Attack:** A cosmic energy tackle. 11% damage. Moderate speed and knockback. Standard dash attack.

**Smash Attacks:**
- **Forward Smash:** Channels cosmic energy into a focused beam punch. 16-22% (charged). Reliable KO power, reasonable startup (frame 15).
- **Up Smash:** Creates a supernova explosion above. 14-20% (charged). Wide overhead hitbox. Solid anti-air and KO option.
- **Down Smash:** A dual cosmic energy burst on both sides. 13-18% (charged). Hits both sides, moderate knockback. Catches rolls.

**Aerial Attacks:**
- **Neutral Air (Nair):** A cosmic energy aura around the body. 10% (clean), 6% (late). Frame 6, long-lasting. Nova's go-to approach aerial.
- **Forward Air (Fair):** A forward cosmic slash. 11% damage. Good damage, range, and speed. Versatile aerial.
- **Back Air (Bair):** A backward cosmic kick. 12% damage. Fast and strong. KO aerial.
- **Up Air (Uair):** An upward cosmic flip kick. 9% damage. Good juggle tool, combos into itself.
- **Down Air (Dair):** A downward cosmic stomp. 13% damage. Meteor smash on sweetspot. Moderate risk.

**Special Moves:**
- **Neutral Special - Star Shot:** Fires a star-shaped projectile. Tap for a small, fast star (6%). Hold to charge a larger star that travels slower but deals more damage (15%) and has a gravitational pull (draws nearby opponents slightly toward it). Versatile projectile for both zoning and approach.
- **Side Special - Cosmic Dash:** Nova dashes forward surrounded by cosmic energy. On contact: 10% damage. The dash can be followed up with an input: press A for a finisher strike (6% extra, launches horizontally), press B for a cosmic flip (reposition, no damage but frame advantage), or press up for an upward launch kick (5% extra, launches vertically). The mix-up potential makes this move unpredictable.
- **Up Special - Gravity Well:** Nova warps upward through a miniature gravity distortion. Excellent recovery distance (both vertical and angled). Opponents near the path are pulled toward its trajectory and take 5% damage. Has brief intangibility at the start (frames 1-6).
- **Down Special - Orbit Shield:** Creates two orbiting star fragments that circle Nova for 10 seconds. Each fragment blocks one incoming projectile (destroyed on block) or deals 4% damage on contact with an opponent. Essentially a limited-use reflector and passive hitbox. 16-second cooldown (starts when fragments expire or are all destroyed).

**Grab / Throws:**
- **Grab:** Average range and speed. Nothing remarkable.
- **Pummel:** Cosmic energy squeeze. 1.3% per pummel. Average speed.
- **Forward Throw:** Cosmic energy blast forward. 9%. Decent knockback angle.
- **Back Throw:** Gravity reversal toss behind. 10%. Nova's strongest throw. Can KO near ledge at high percent.
- **Up Throw:** Launches upward with a stellar burst. 7%. Combos into aerials at low-mid percent.
- **Down Throw:** Cosmic slam downward. 6%. Nova's combo throw. Links into fair, nair, or dash attack.

**Recovery:** Gravity Well (Up Special) is an excellent recovery with great distance and the brief intangibility makes it hard to challenge. Cosmic Dash (Side Special) can be used for horizontal distance if needed. Nova has one of the better recoveries in the roster.

---

## Stages

All stages feature a main platform with varying layouts of pass-through platforms and unique stage hazards that can be toggled on or off for competitive play.

### 1. Sky Colosseum

**Theme:** A massive floating arena high above the clouds at sunset.
**Layout:** A large, flat main platform with two medium-height pass-through platforms symmetrically placed. A single smaller top platform centered above. Classic competitive layout.
**Visual:** Gradient sky from deep orange to purple. Clouds drift below the stage. The platform is a semi-transparent geometric structure with glowing white edges. Subtle lens flare from the setting sun.
**Hazard (toggleable):** Wind gusts periodically blow across the stage, subtly pushing all fighters in one direction for 3 seconds. Indicated by particle effects before activation.
**Blast zones:** Standard distance on all sides. Balanced stage.

### 2. Volcanic Forge

**Theme:** An industrial forge built inside an active volcano.
**Layout:** A medium-width main platform with a slight dip in the center (creating two slight hills). One pass-through platform on the left, one on the right, at different heights (asymmetric). A lava pit below the stage (acts as a lower blast zone but closer than normal).
**Visual:** Dark basalt rock platforms with bright red-orange lava glow from below. Molten metal rivers on the background walls. Sparks and ember particles constantly rising. Geometric anvil and forge structures in the background with neon orange outlines.
**Hazard (toggleable):** Lava geysers periodically erupt from the pit, creating temporary hitboxes above the lower blast zone. 8% damage and upward knockback. Eruption points are telegraphed by glowing spots 2 seconds before activation.
**Blast zones:** Lower blast zone is closer due to lava pit. Side and top are standard.

### 3. Crystal Caverns

**Theme:** A vast underground cavern filled with luminescent crystals.
**Layout:** A medium main platform with three pass-through platforms: one low-left, one mid-center, and one high-right, creating a staircase-like arrangement. A wall/pillar on the right side of the main stage creates a semi-enclosed space (walk-off on the right side, blast zone on the left).
**Visual:** Deep blue-black cave background with brilliant crystal formations in cyan, magenta, and green. The platforms are crystal shelves with sharp geometric angles and neon edges. Bioluminescent particle effects float gently. Crystal reflections create subtle rainbow prism effects.
**Hazard (toggleable):** Crystal resonance. When enough damage is dealt in a short period (cumulative 50% across all players within 10 seconds), the crystals resonate and release a shockwave across the entire stage. Deals 5% to all grounded players and causes moderate knockback. Signaled by crystals vibrating and glowing brighter.
**Blast zones:** Right side is a walk-off (no blast zone, fighters can walk to the edge). Left, top, and bottom are standard blast zones. The asymmetry creates unique gameplay dynamics.

### 4. Neon District

**Theme:** A futuristic cyberpunk city rooftop at night.
**Layout:** Two main platforms separated by a gap (split stage). Each side has one pass-through platform above it. The gap is jumpable but creates a natural divide in the stage. A moving platform slowly travels back and forth across the gap.
**Visual:** Neon-lit skyscrapers in the background with holographic advertisements and flying vehicles. Rain particles with neon reflections. The stage platforms are rooftop structures with vibrant pink, blue, and green neon trim. Puddles on the platforms reflect character outlines.
**Hazard (toggleable):** Neon signs occasionally malfunction and emit electric bursts in fixed locations on the stage. 6% damage and brief stun. Malfunctioning signs flicker for 3 seconds before discharge. Additionally, the moving platform temporarily speeds up or stops randomly.
**Blast zones:** Standard on all sides but the gap between platforms means recovering low is more challenging.

---

## Game Modes

### Stock Battle

The standard competitive mode. Each player has a set number of stocks (lives). When all stocks are lost, that player is eliminated. Last player standing wins.
- **Stock count:** 1-5 (default 3)
- **Time limit:** Optional (default 7 minutes, 0 for infinite)
- **Players:** 2-4

### Timed Battle

Players compete for the highest score within a time limit. KO-ing an opponent grants +1 point. Being KO'd deducts -1 point. Self-destructs deduct -1 point.
- **Time:** 1-10 minutes (default 3 minutes)
- **Players:** 2-4
- **Tiebreaker:** Sudden death with 1 stock at 300% damage

### Team Battle

Players are divided into teams (2v2 or 2v1v1 in 4-player). Team attack can be toggled on or off. Teams share a stock pool or individual stocks (configurable).
- **Team sizes:** 2v2, 1v1v1v1, 2v1v1, 3v1
- **Mode:** Stock or Timed
- **Team attack:** On/Off (default Off)
- **Stock sharing:** Enabled/Disabled

### Free-for-All

A chaotic mode for 3-4 players. All standard rules apply but diplomacy and chaos reign. Can be played as Stock or Timed.
- **Players:** 3-4
- **Mode:** Stock or Timed

### Training Mode

A comprehensive practice environment for learning characters and mechanics.
- **CPU opponent:** Adjustable behavior (stand, walk, jump, attack, shield, DI settings)
- **CPU level:** 1-9
- **Damage display:** Frame data overlay, hitbox/hurtbox visualization, knockback trajectory lines
- **Reset position:** Instant reset to starting positions
- **Speed control:** Frame-by-frame advance, half speed, normal speed
- **Record and playback:** Record CPU actions and play them back for practicing punishes
- **Combo counter:** Tracks true combos with frame gap display
- **Stage selection:** Any stage, also includes flat training stage with grid lines

### Online Multiplayer

Full online play supporting all game modes.
- **Ranked:** 1v1 Stock (3 stocks, 7 minutes, no hazards). ELO-based matchmaking.
- **Casual:** Any mode, any rules. Room-based matchmaking.
- **Private rooms:** Create or join by room code. Full rule customization.
- **Spectator mode:** Watch ongoing matches.
- See [Multiplayer](#multiplayer) section for technical details.

---

## Visual Style

### Art Direction: Neon Geometric

The visual identity of Temu Smash Bros is built on the "Neon Geometric" aesthetic: characters and environments are composed entirely of geometric shapes (triangles, hexagons, rectangles, circles, crescents) with bold neon outlines and subtle gradient fills.

### Character Rendering

- Characters are constructed from layered 2D geometric shapes, creating a stylized, almost abstract silhouette that is still clearly readable.
- Each character has a dominant color palette tied to their element (reds/oranges for Blaze, cyans/whites for Zephyr, etc.).
- Neon outlines glow with a subtle bloom effect. Outline thickness increases during attacks for visual emphasis.
- Hit effects produce element-specific particle bursts (fire sparks, wind wisps, stone chunks, electric arcs, water droplets, cosmic stars).
- At high damage percentages, the character's neon outlines pulse faster and shift toward white/red, visually indicating danger.

### Stage Rendering

- Stages use gradient backgrounds with parallax scrolling layers for depth.
- Platforms have clean geometric shapes with bright neon edge highlights.
- Background elements are slightly desaturated to maintain focus on the foreground action.
- Environmental particles (embers, rain, floating crystals, etc.) add atmosphere without cluttering gameplay visibility.

### Effects and Feedback

- **Hit sparks:** Bright, element-colored geometric bursts on impact. Size scales with damage dealt.
- **Shield effects:** Translucent hexagonal barrier with ripple effect on hit. Cracks appear as shield health diminishes.
- **KO effects:** Screen flash, dramatic zoom on the final hit, victim trails a comet-like streak as they fly toward the blast zone. Blast zone explosion with a star-burst particle effect.
- **Percentage display:** Clean, bold numbers below each character's HUD icon. Color shifts from white (0%) to yellow (50%) to orange (100%) to red (150%+).
- **Screen shake:** Proportional to knockback on strong hits. Can be reduced in settings.

### Performance Targets

- 60 FPS stable on modern browsers (Chrome, Firefox, Edge, Safari).
- Game logic runs on a fixed 60Hz tick rate independent of render frame rate.
- Particle effects scale down on lower-end hardware.
- Resolution scales from 720p to 1080p based on window size.

---

## Audio Design

### Music

**Style:** Electronic / synthwave with dynamic intensity layers.

- **Main Menu:** Ambient synth pad with a slow, atmospheric melody. Conveys the cosmic theme.
- **Character Select:** Upbeat electronic track with a building energy. Tempo increases slightly as more players lock in.
- **In-Match (per stage):**
  - Sky Colosseum: Soaring synth anthem with driving drums. Epic, uplifting.
  - Volcanic Forge: Heavy, industrial electronic with distorted bass. Aggressive, intense.
  - Crystal Caverns: Ethereal, ambient electronic with crystalline chime melodies. Mysterious, beautiful.
  - Neon District: Fast-paced cyberpunk synthwave with neon-retro vibes. Energetic, urban.
- **Results Screen:** Victorious fanfare with character-specific melodic motifs.
- **Dynamic layers:** Music intensity increases when players are at high percentages or during the final stock. Additional percussion and synth layers fade in.

### Sound Effects

All combat sounds are synthesized to match the geometric/electronic aesthetic. No realistic foley.

- **Hits:** Bright, punchy synth impacts. Pitch and volume scale with damage. Light hits are short, clean blips. Heavy hits are deep, resonant booms with reverb.
- **Shield:** A clean "ding" on successful block. A shattering glass-like synth sound on shield break.
- **Parry:** A sharp, satisfying "ting" with a brief pitch rise. Distinct and rewarding.
- **Grabs:** A magnetic "zap" sound on connect. Throws have a whooshing synth sweep.
- **KO blast:** A deep, explosive synth boom with reverb tail. Screen flash accompanies.
- **Jumps:** Light, airy synth chirp. Double jump has a slightly different tone.
- **Landing:** Soft synth thud proportional to fall speed.
- **Element-specific:** Each character's special moves have element-themed sounds (fire crackle synth, wind whoosh, stone rumble, electric zap, water splash, cosmic chime).
- **Crowd/Ambiance:** Subtle electronic ambient pads that respond to match intensity. Not a literal crowd but a synthesized energy that grows with the action.

### Announcer

A synthesized, slightly robotic voice with cosmic reverb.
- Character names on selection
- "GO!" at match start
- "GAME!" at match end
- Stock loss callouts ("2 stocks remaining")
- "LAST STOCK!" when a player reaches their final life

---

## UI/UX Flow

### Main Menu

```
COSMIC KNOCKOUTS
[Logo with orbiting star animation]

> Battle
> Online
> Training
> Options
> Credits
```

- Clean, centered layout with neon-outlined buttons.
- Background features a slowly rotating cosmic scene with geometric star formations.
- Button hover effects: neon glow intensifies, subtle pulse animation.

### Battle Mode Select

```
SELECT MODE
> Stock Battle
> Timed Battle
> Team Battle
> Free-for-All
[Back]
```

### Character Select Screen

- Grid layout showing all 6 character portraits (geometric art style icons).
- Each player has a cursor (P1-P4, color-coded).
- Selecting a character shows a larger preview with the character's name, element, and weight class.
- Players can choose alternate color palettes (4 per character).
- A "Random" option selects a random character.
- Timer: 60 seconds to select (configurable in options).
- Confirm selection to lock in. All players must lock in to proceed.

### Stage Select Screen

- Horizontal carousel of stage previews with name and description.
- Toggle for hazards on/off.
- Random stage option.
- Timer: 30 seconds.

### In-Match HUD

```
[P1 Icon] [P1 %]                              [P2 Icon] [P2 %]
[Stocks: o o o]                                [Stocks: o o o]

                    [Timer: 7:00]

[P3 Icon] [P3 %]                              [P4 Icon] [P4 %]
[Stocks: o o o]                                [Stocks: o o o]
```

- Minimal, non-intrusive HUD.
- Percentage numbers are large and color-coded (white -> yellow -> orange -> red).
- Stock icons are small geometric shapes matching the character's element.
- Timer centered at top (if applicable).
- Pause menu accessible with Start/Escape.

### Pause Menu

```
PAUSED
> Resume
> Move List
> Options
> Quit to Menu
```

### Results Screen

```
GAME!

[Winner Character Pose]
[Winner Name] WINS!

Player Rankings:
1st: [Character] - [KOs] KOs
2nd: [Character] - [KOs] KOs
3rd: [Character] - [KOs] KOs
4th: [Character] - [KOs] KOs

[Detailed Stats]
> Rematch
> Character Select
> Main Menu
```

- Victory animation for the winning character.
- Detailed stats expandable: damage dealt, damage received, self-destructs, highest combo, time alive.

### Options Menu

```
OPTIONS
> Controls (rebindable keyboard + gamepad)
> Audio (Master, Music, SFX, Announcer volumes)
> Video (Resolution scale, Particles, Screen shake)
> Gameplay (Default stocks, time, hazards, team attack)
[Back]
```

---

## Multiplayer

### Architecture

- **Protocol:** WebSocket (ws:// for development, wss:// for production)
- **Server:** Authoritative game server running the same physics and game logic as the client. Clients send inputs; server simulates and broadcasts state.
- **Tick rate:** 60Hz server simulation. State updates sent to clients at 30Hz (every other tick) to balance bandwidth and responsiveness.
- **Client-side prediction:** Clients predict local player movement and attacks immediately. Server state reconciles on each update. Rollback corrects mispredictions.

### Room System

- **Room creation:** Any player can create a room. The creator becomes the host (controls settings, starts the match).
- **Room code:** A 6-character alphanumeric code (e.g., "KO4X9R") generated on room creation. Players join by entering this code.
- **Room capacity:** 2-4 players + up to 4 spectators.
- **Room settings:** The host configures game mode, stock count, time limit, stage hazards, and team assignments.
- **Ready check:** All players must ready up before the host can start the match.

### Connection Flow

1. Player opens the game in a browser.
2. Player selects "Online" from the main menu.
3. Options: "Create Room" or "Join Room."
4. **Create Room:** Server generates a room code. Host sees a lobby with the code displayed prominently for sharing.
5. **Join Room:** Player enters a room code. If valid and not full, they join the lobby.
6. In the lobby, players see each other's names, selected characters, and ready status.
7. Host configures settings and starts the match when all players are ready.
8. Character select and stage select proceed as normal.
9. Match runs with server authority.
10. After the match, players return to the lobby for rematch or leave.

### Ranked Matchmaking

- **Format:** 1v1 Stock (3 stocks, 7 minutes, stage rotation, no hazards).
- **Rating system:** ELO-based with K-factor adjustments for new players.
- **Matchmaking:** Players queue and are matched with opponents of similar rating. Expands search range over time.
- **Seasons:** Monthly seasons with rank resets (soft reset, not full).
- **Ranks:** Bronze, Silver, Gold, Platinum, Diamond, Cosmic (top 100).

### Latency Handling

- **Input delay:** Minimum 2 frames of input delay to buffer network variance.
- **Rollback netcode:** When a remote player's input arrives late, the game rolls back to the last confirmed state and resimulates forward with the correct inputs. This keeps the game feeling responsive for the local player.
- **Ping display:** Shown in the corner during online matches.
- **Disconnect handling:** If a player disconnects for more than 10 seconds, they forfeit. Brief disconnects (under 10 seconds) pause the match with a "Reconnecting..." message.

---

## Appendix

### Input Mapping (Default)

| Action | Keyboard (P1) | Gamepad |
|--------|---------------|---------|
| Move Left | A | Left Stick / D-Pad Left |
| Move Right | D | Left Stick / D-Pad Right |
| Crouch | S | Left Stick / D-Pad Down |
| Jump | W / Space | X / Y (face buttons) |
| Attack | J | A (face button) |
| Special | K | B (face button) |
| Shield | L | L / R (shoulder) |
| Grab | ; | LB / RB (bumper) |
| Taunt | T | D-Pad Up |

All inputs are fully rebindable.

### Character Balance Philosophy

- Every character should have a viable path to victory at all levels of play.
- No character should be strictly dominant; every character has exploitable weaknesses.
- Lightweight characters compensate for early KOs with mobility and combo potential.
- Heavyweight characters compensate for poor mobility with survivability and kill power.
- Balance patches will be informed by win rate data, tournament results, and community feedback.
- Target competitive win rates: 45-55% across all matchups.
