// ============================================================================
// Cosmic Knockout - Core Game Engine
// ============================================================================

import {
  GameState,
  MatchConfig,
  PlayerData,
  PlayerState,
  StageData,
  DebugOptions,
  GameEvent,
  GameEventType,
} from './types';
import { InputManager } from './InputManager';
import { PhysicsEngine } from '../physics/PhysicsEngine';
import { getStage } from '../physics/Stage';
import { CombatSystem } from '../combat/CombatSystem';
import { Fighter, getCharacter } from '../combat/Fighter';
import { Renderer } from '../rendering/Renderer';
import { ParticleSystem } from '../particles/ParticleSystem';
import { AIController } from '../ai/AIController';

// --- Constants ---

const TICK_RATE = 60;
const TICK_MS = 1000 / TICK_RATE; // 16.67ms

// ============================================================================
// GameEngine
// ============================================================================

export class GameEngine {
  // --- State ---
  private gameState: GameState = GameState.Menu;
  private previousState: GameState = GameState.Menu; // for pause/unpause
  private frame: number = 0;
  private matchTimer: number = 0; // frames remaining (0 = infinite)
  private matchConfig: MatchConfig | null = null;

  // --- Systems ---
  private inputManager: InputManager;
  private physicsEngine: PhysicsEngine;
  private combatSystem: CombatSystem;
  private particleSystem: ParticleSystem;
  private renderer: Renderer | null = null;

  // --- Entities ---
  private players: PlayerData[] = [];
  private fighters: Fighter[] = [];
  private aiControllers: Map<number, AIController> = new Map();
  private stage: StageData | null = null;

  // --- Loop ---
  private running: boolean = false;
  private animFrameId: number = 0;
  private lastTime: number = 0;
  private accumulator: number = 0;

  // --- Callbacks ---
  private onMatchEnd: ((results: MatchResults) => void) | null = null;
  private onStateChange: ((state: GameState) => void) | null = null;
  private onEvent: ((event: GameEvent) => void) | null = null;

  constructor() {
    this.inputManager = new InputManager();
    this.physicsEngine = new PhysicsEngine();
    this.combatSystem = new CombatSystem();
    this.particleSystem = new ParticleSystem();
  }

  // =========================================================================
  // Initialization
  // =========================================================================

  /** Initialize the engine with a canvas element */
  init(canvas: HTMLCanvasElement): void {
    this.inputManager.init();

    // Renderer will be created when a match starts and we have a stage
    // For now, create with a default stage for menu rendering
    const defaultStage = getStage('battlefield');
    this.renderer = new Renderer(canvas, defaultStage, this.particleSystem);
    this.renderer.resizeCanvas();

    // Handle window resize
    window.addEventListener('resize', () => {
      this.renderer?.resizeCanvas();
    });

    // Pause on Escape
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (this.gameState === GameState.Fighting) {
          this.pause();
        } else if (this.gameState === GameState.Paused) {
          this.resume();
        }
      }
    });
  }

  /** Clean up resources */
  destroy(): void {
    this.stop();
    this.inputManager.destroy();
  }

  // =========================================================================
  // Match Setup
  // =========================================================================

  /** Start a match with the given configuration */
  startMatch(config: MatchConfig): void {
    this.matchConfig = config;
    this.frame = 0;
    this.matchTimer = config.timer > 0 ? config.timer * TICK_RATE : 0;

    // Load stage
    this.stage = getStage(config.stageId);
    this.physicsEngine.setStage(this.stage);

    if (this.renderer) {
      this.renderer.setStage(this.stage);
    }

    // Reset systems
    this.particleSystem.reset();
    this.combatSystem.reset();
    this.inputManager.reset();
    this.players = [];
    this.fighters = [];
    this.aiControllers.clear();

    // Create players
    for (let i = 0; i < config.players.length; i++) {
      const pc = config.players[i];
      const fighterData = getCharacter(pc.characterId);
      const spawnPoint = this.stage.spawnPoints[i % this.stage.spawnPoints.length];

      const playerData = Fighter.createPlayerData(
        pc.id,
        pc.characterId,
        spawnPoint,
        config.stocks,
      );
      this.players.push(playerData);

      const fighter = new Fighter(playerData, fighterData);
      this.fighters.push(fighter);

      // Register input
      this.inputManager.registerPlayer(pc.id, pc.controlScheme, pc.gamepadIndex);

      // AI
      if (pc.isAI) {
        this.aiControllers.set(pc.id, new AIController(pc.id, pc.aiLevel));
      }
    }

    // Set references
    this.physicsEngine.setPlayers(this.players);
    this.combatSystem.setPlayers(this.players);
    if (this.renderer) {
      this.renderer.setPlayers(this.players);
    }

    // Reset ledges
    for (const ledge of this.stage.ledges) {
      ledge.occupied = false;
      ledge.occupiedBy = -1;
    }

    this.setState(GameState.Fighting);
    this.start();
  }

  // =========================================================================
  // Game Loop
  // =========================================================================

  /** Start the game loop */
  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.accumulator = 0;
    this.loop();
  }

  /** Stop the game loop */
  stop(): void {
    this.running = false;
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = 0;
    }
  }

  /** Pause the match */
  pause(): void {
    if (this.gameState !== GameState.Fighting) return;
    this.previousState = this.gameState;
    this.setState(GameState.Paused);
  }

  /** Resume the match */
  resume(): void {
    if (this.gameState !== GameState.Paused) return;
    this.setState(this.previousState);
    this.lastTime = performance.now();
    this.accumulator = 0;
  }

  private loop = (): void => {
    if (!this.running) return;
    this.animFrameId = requestAnimationFrame(this.loop);

    const now = performance.now();
    let delta = now - this.lastTime;
    this.lastTime = now;

    // Clamp delta to prevent spiral of death
    if (delta > 100) delta = 100;

    this.accumulator += delta;

    // Fixed timestep updates
    while (this.accumulator >= TICK_MS) {
      if (this.gameState === GameState.Fighting) {
        this.fixedUpdate();
      }
      this.accumulator -= TICK_MS;
    }

    // Render (every animation frame)
    this.renderer?.render();
  };

  // =========================================================================
  // Fixed Update (one game frame / tick)
  // =========================================================================

  private fixedUpdate(): void {
    this.frame++;

    // --- System update order ---
    // 1. Input
    this.updateInput();
    // 2. AI
    this.updateAI();
    // 3. Fighters (state machines, move execution)
    this.updateFighters();
    // 4. Physics
    this.physicsEngine.update(1);
    // 5. Combat
    this.combatSystem.update(1);
    // 6. Process combat events
    this.processEvents();
    // 7. Particles
    this.particleSystem.update();
    // 8. Match timer
    this.updateMatchTimer();
    // 9. Win condition check
    this.checkWinCondition();
  }

  private updateInput(): void {
    this.inputManager.update(this.frame);
  }

  private updateAI(): void {
    for (const [playerId, ai] of this.aiControllers) {
      const self = this.players.find((p) => p.id === playerId);
      if (!self) continue;

      const aiInput = ai.generateInput(self, this.players, this.stage!);
      this.inputManager.setInput(playerId, aiInput);
    }
  }

  private updateFighters(): void {
    for (const fighter of this.fighters) {
      const input = this.inputManager.getInput(fighter.playerData.id);
      fighter.update(input, this.physicsEngine, this.combatSystem, this.frame);
    }
  }

  private processEvents(): void {
    const events = this.combatSystem.getEvents();
    for (const event of events) {
      this.onEvent?.(event);

      switch (event.type) {
        case GameEventType.Hit: {
          const data = event.data as { position: { x: number; y: number }; damage: number; knockback: number };
          this.particleSystem.emitHitSparks(data.position.x, data.position.y, data.damage);

          // Screen shake proportional to knockback
          if (data.knockback > 5) {
            this.renderer?.screenShake(Math.min(data.knockback * 0.5, 15));
          }

          // Freeze frames on big hits
          if (data.knockback > 12) {
            this.renderer?.triggerFreeze(Math.floor(data.knockback * 0.3));
          }
          break;
        }

        case GameEventType.ShieldBreak: {
          const data = event.data as { position: { x: number; y: number } };
          this.particleSystem.emitShieldBreak(data.position.x, data.position.y);
          this.renderer?.screenShake(10);
          break;
        }

        case GameEventType.KO: {
          const data = event.data as { position: { x: number; y: number }; playerId: number };
          const player = this.players.find((p) => p.id === data.playerId);
          const color = player ? this.getPlayerColor(player) : '#ffffff';
          this.particleSystem.emitKOExplosion(data.position.x, data.position.y, color);
          this.renderer?.screenShake(20);
          break;
        }
      }
    }

    // Check for KOs from blast zones (handled by physics setting Dead state)
    for (const player of this.players) {
      if (player.state === PlayerState.Dead && player.stateFrame === 0) {
        // Fresh KO
        const lastHitter = this.players.find((p) => p.id === player.lastHitBy);
        if (lastHitter && lastHitter.id !== player.id) {
          lastHitter.score++;
        }

        this.onEvent?.({
          type: GameEventType.KO,
          frame: this.frame,
          data: {
            playerId: player.id,
            position: { ...player.position },
            killedBy: player.lastHitBy,
          },
        });

        // Emit KO particles
        const color = this.getPlayerColor(player);
        this.particleSystem.emitKOExplosion(
          player.position.x,
          player.position.y,
          color,
        );
        this.renderer?.screenShake(15);
      }
    }
  }

  private updateMatchTimer(): void {
    if (this.matchTimer > 0) {
      this.matchTimer--;
      this.renderer?.setMatchTimer(this.matchTimer);

      if (this.matchTimer <= 0) {
        this.endMatch();
      }
    }
  }

  private checkWinCondition(): void {
    if (!this.matchConfig) return;

    // Stock mode: check if only one player has stocks
    if (this.matchConfig.stocks > 0) {
      const alivePlayers = this.players.filter((p) => p.stocks > 0);
      if (alivePlayers.length <= 1) {
        this.endMatch();
      }
    }
  }

  private endMatch(): void {
    this.setState(GameState.Results);

    // Calculate results
    const results: MatchResults = {
      players: this.players.map((p) => ({
        id: p.id,
        characterId: p.characterId,
        stocks: p.stocks,
        damage: p.damage,
        score: p.score,
      })),
      winner: this.determineWinner(),
      totalFrames: this.frame,
    };

    this.onMatchEnd?.(results);
  }

  private determineWinner(): number {
    // Stock mode: most stocks wins. Tie-break: lowest damage
    let bestPlayer = this.players[0];
    for (const player of this.players) {
      if (player.stocks > bestPlayer.stocks) {
        bestPlayer = player;
      } else if (player.stocks === bestPlayer.stocks && player.damage < bestPlayer.damage) {
        bestPlayer = player;
      }
    }
    return bestPlayer.id;
  }

  // =========================================================================
  // State Management
  // =========================================================================

  private setState(state: GameState): void {
    this.gameState = state;
    this.onStateChange?.(state);
  }

  getState(): GameState {
    return this.gameState;
  }

  getFrame(): number {
    return this.frame;
  }

  getPlayers(): PlayerData[] {
    return this.players;
  }

  getStage(): StageData | null {
    return this.stage;
  }

  // =========================================================================
  // Configuration / Callbacks
  // =========================================================================

  setOnMatchEnd(callback: (results: MatchResults) => void): void {
    this.onMatchEnd = callback;
  }

  setOnStateChange(callback: (state: GameState) => void): void {
    this.onStateChange = callback;
  }

  setOnEvent(callback: (event: GameEvent) => void): void {
    this.onEvent = callback;
  }

  setDebugOptions(options: Partial<DebugOptions>): void {
    this.renderer?.setDebugOptions(options);
  }

  getInputManager(): InputManager {
    return this.inputManager;
  }

  getRenderer(): Renderer | null {
    return this.renderer;
  }

  // =========================================================================
  // Utilities
  // =========================================================================

  private getPlayerColor(player: PlayerData): string {
    const data = getCharacter(player.characterId);
    return data.color;
  }
}

// ============================================================================
// Match Results
// ============================================================================

export interface MatchResults {
  players: {
    id: number;
    characterId: string;
    stocks: number;
    damage: number;
    score: number;
  }[];
  winner: number;
  totalFrames: number;
}
