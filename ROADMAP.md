# Cosmic Knockout - Development Roadmap

## Overview

This document outlines the phased development plan for Cosmic Knockout. Each phase builds on the previous, with clear deliverables and milestones.

---

## Phase 1: Core Engine (In Progress)

**Status:** In Progress

**Goal:** Build the foundational game engine that all other systems depend on.

**Deliverables:**
- Game loop running at fixed 60Hz tick rate with variable render rate
- 2D physics engine: gravity, velocity, acceleration, collision detection (AABB and polygon), platform interactions (solid and pass-through)
- Input system: keyboard input polling, input buffering (6-frame buffer), rebindable controls, gamepad support via Gamepad API
- Rendering pipeline: HTML5 Canvas (with WebGL fallback plan), camera system, layer management, sprite/shape rendering
- Entity-Component system for managing game objects
- State management: game states (menu, character select, in-match, results), match state (stocks, damage, timer)
- Basic debug tools: hitbox visualization, frame data overlay, FPS counter, input display

**Milestones:**
- [ ] Game loop with consistent 60 FPS
- [ ] Physics: gravity, ground collision, platform drop-through
- [ ] Input: keyboard polling with buffering
- [ ] Rendering: canvas setup, basic shape rendering
- [ ] State machine: menu -> match -> results flow
- [ ] Debug overlay: FPS, input display, hitbox toggle

---

## Phase 2: Combat System

**Status:** Not Started

**Goal:** Implement the core combat mechanics that define the platform fighter genre.

**Deliverables:**
- Hitbox/hurtbox system with frame-accurate collision
- Damage and percentage tracking
- Knockback calculation: base knockback, knockback growth, angle, DI (Directional Influence)
- Hitstun, hitlag (freeze frames on hit), and shield stun
- Shield mechanics: activation, health, decay, perfect shield (parry), shield break
- Dodge mechanics: spot dodge, roll, air dodge (directional and neutral), dodge staling
- Grab system: grab, pummel, four directional throws
- Edge/ledge mechanics: ledge grab, ledge options, ledge invincibility, ledge trumping, two-frame vulnerability
- Stale move queue (last 9 moves tracked, damage reduction)
- Rage mechanic (increased knockback at high percent)
- KO detection (blast zones), stock loss, respawn with invincibility
- Combo counter and hit validation (true combo vs. escapable)

**Milestones:**
- [ ] Hitbox/hurtbox collision working with frame data
- [ ] Percentage and knockback system functional
- [ ] Shields, dodges, and grabs implemented
- [ ] Ledge mechanics complete
- [ ] KO and respawn system working
- [ ] Staling and rage mechanics in place

---

## Phase 3: Character Roster

**Status:** Not Started

**Goal:** Implement all 6 playable characters with complete movesets and unique attributes.

**Deliverables:**
- Character attribute system (weight, speed, fall speed, air speed, jump height)
- Per-character frame data for all moves
- Character 1: Blaze (fire bruiser) - full moveset, animations, hitbox data
- Character 2: Zephyr (wind speedster) - full moveset, animations, hitbox data
- Character 3: Granite (earth tank) - full moveset, animations, hitbox data
- Character 4: Volt (electric glass cannon) - full moveset, animations, hitbox data
- Character 5: Tide (water grappler) - full moveset, animations, hitbox data
- Character 6: Nova (cosmic all-rounder) - full moveset, animations, hitbox data
- Alternate color palettes (4 per character)
- Character-specific mechanics (command grabs, counters, traps, buffs, etc.)

**Milestones:**
- [ ] Character attribute framework and base class complete
- [ ] Nova implemented (starter character, tests all standard mechanics)
- [ ] Blaze implemented
- [ ] Zephyr implemented
- [ ] Granite implemented
- [ ] Volt implemented
- [ ] Tide implemented
- [ ] All alternate palettes created

---

## Phase 4: Stages

**Status:** Not Started

**Goal:** Build all 4 stages with layouts, visuals, and hazards.

**Deliverables:**
- Stage framework: platform layout system, blast zone definitions, camera boundaries
- Sky Colosseum: layout, background, wind gust hazard
- Volcanic Forge: layout, background, lava geyser hazard
- Crystal Caverns: layout, background, crystal resonance hazard
- Neon District: layout, background, neon sign hazard, moving platform
- Hazard toggle system (on/off per match)
- Training stage (flat, gridlined, no hazards)
- Stage select screen with previews

**Milestones:**
- [ ] Stage framework and platform system complete
- [ ] Sky Colosseum playable
- [ ] Volcanic Forge playable
- [ ] Crystal Caverns playable
- [ ] Neon District playable
- [ ] Training stage playable
- [ ] All hazards functional and toggleable

---

## Phase 5: Game Modes and UI

**Status:** Not Started

**Goal:** Implement all game modes and the complete UI/UX flow.

**Deliverables:**
- Stock Battle mode
- Timed Battle mode
- Team Battle mode (team assignment, team attack toggle, shared stocks option)
- Free-for-All mode
- Training Mode (CPU behavior settings, frame data overlay, hitbox visualization, record/playback, combo counter, speed control)
- Main menu screen
- Character select screen (player cursors, portraits, preview, color palettes, random option)
- Stage select screen (carousel, hazard toggle, random option)
- In-match HUD (percentage, stocks, timer)
- Pause menu
- Results screen (rankings, stats, rematch option)
- Options menu (controls, audio, video, gameplay)
- Match rule configuration UI

**Milestones:**
- [ ] Stock and Timed modes functional
- [ ] Team and FFA modes functional
- [ ] Training mode with all features
- [ ] Full UI flow: menu -> select -> match -> results
- [ ] Options and controls rebinding working
- [ ] HUD polished and responsive

---

## Phase 6: Multiplayer

**Status:** Not Started

**Goal:** Enable online play with room-based matches and ranked matchmaking.

**Deliverables:**
- WebSocket server infrastructure
- Authoritative server game simulation
- Client-side prediction and input reconciliation
- Rollback netcode implementation
- Room system: create room, join by code, lobby UI, host controls
- Spectator mode
- Ranked matchmaking: ELO system, queue, rank display
- Casual matchmaking
- Ping display and connection quality indicator
- Disconnect handling (forfeit after 10s, reconnection within 10s)
- Anti-cheat: server-authoritative validation of all game state

**Milestones:**
- [ ] WebSocket server running and accepting connections
- [ ] Two players can play a match online
- [ ] Client prediction and rollback working
- [ ] Room creation and join-by-code functional
- [ ] Spectator mode working
- [ ] Ranked matchmaking queue operational
- [ ] Disconnect handling and reconnection tested

---

## Phase 7: Audio and Effects

**Status:** Not Started

**Goal:** Add the full audio experience and visual effects polish.

**Deliverables:**
- Music tracks: main menu, character select, 4 stage themes, results screen
- Dynamic music layers (intensity scaling with match state)
- Sound effects: hits (scaled by damage), shields, parry, grabs, throws, jumps, landing, KO blast
- Element-specific sound effects for all 6 characters' special moves
- Announcer voice lines: character names, "GO!", "GAME!", stock callouts, "LAST STOCK!"
- Particle effects system: hit sparks, element particles, KO comet trails, blast zone explosions
- Shield visual effects: hexagonal barrier, ripple on hit, crack on low health, shatter on break
- Screen shake (proportional to knockback, configurable)
- KO cinematic: screen flash, zoom, slow-motion on final hit
- Percentage color transitions (white -> yellow -> orange -> red)
- Rage visual effect (pulsing neon outline at high percent)

**Milestones:**
- [ ] All music tracks composed and integrated
- [ ] Dynamic music layering working
- [ ] All combat SFX implemented
- [ ] Announcer lines recorded and triggered correctly
- [ ] Particle effects system complete
- [ ] KO cinematic and screen effects polished
- [ ] All visual feedback (percentage color, rage glow) working

---

## Phase 8: Polish and Balance

**Status:** Not Started

**Goal:** Final tuning, optimization, and preparation for release.

**Deliverables:**
- Character balance pass: adjust frame data, damage values, knockback across all 6 characters
- Matchup testing: ensure no hard-counter matchups exceed 60-40
- Performance optimization: stable 60 FPS across Chrome, Firefox, Edge, Safari
- Memory profiling and leak detection
- Load time optimization (asset loading, code splitting)
- Accessibility: colorblind mode, screen reader support for menus, remappable controls verification
- Browser compatibility testing
- Gamepad compatibility testing (common controllers)
- Bug fixing from all previous phases
- Community feedback integration (if applicable from early testing)
- Analytics integration: match data, win rates, popular characters
- Landing page and onboarding flow
- Final QA pass

**Milestones:**
- [ ] Balance spreadsheet finalized and implemented
- [ ] Performance benchmarks met (60 FPS target on mid-range hardware)
- [ ] All critical and major bugs resolved
- [ ] Browser and gamepad compatibility verified
- [ ] Accessibility features implemented
- [ ] Landing page live
- [ ] Release candidate build approved

---

## Timeline Estimates

| Phase | Estimated Duration | Dependencies |
|-------|-------------------|--------------|
| Phase 1: Core Engine | 4-6 weeks | None |
| Phase 2: Combat System | 4-6 weeks | Phase 1 |
| Phase 3: Character Roster | 6-8 weeks | Phase 2 |
| Phase 4: Stages | 3-4 weeks | Phase 1 |
| Phase 5: Game Modes and UI | 4-5 weeks | Phases 2, 3, 4 |
| Phase 6: Multiplayer | 5-7 weeks | Phases 1, 2 |
| Phase 7: Audio and Effects | 3-4 weeks | Phases 3, 4, 5 |
| Phase 8: Polish and Balance | 4-6 weeks | All previous |

Note: Phases 4 and 6 can be developed in parallel with Phase 3 where dependencies allow.
