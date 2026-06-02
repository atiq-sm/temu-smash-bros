// ============================================================================
// Temu Smash Bros - Core Type Definitions
// ============================================================================

// --- Primitives ---

export interface Vector2D {
  x: number;
  y: number;
}

export interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

// --- Game State ---

export enum GameState {
  Menu = 'menu',
  Online = 'online',
  CharacterSelect = 'character_select',
  StageSelect = 'stage_select',
  Fighting = 'fighting',
  Results = 'results',
  Paused = 'paused',
}

// --- Player / Fighter State ---

export enum PlayerState {
  Idle = 'idle',
  Walking = 'walking',
  Running = 'running',
  RunBrake = 'run_brake',
  Jumping = 'jumping',
  Falling = 'falling',
  Attacking = 'attacking',
  Shielding = 'shielding',
  Dodging = 'dodging',
  Hitstun = 'hitstun',
  Tumble = 'tumble',
  Helpless = 'helpless',
  Grabbing = 'grabbing',
  Grabbed = 'grabbed',
  Throwing = 'throwing',
  LedgeHang = 'ledge_hang',
  LedgeGetUp = 'ledge_getup',
  LedgeAttack = 'ledge_attack',
  LedgeRoll = 'ledge_roll',
  LedgeJump = 'ledge_jump',
  Dead = 'dead',
  Respawning = 'respawning',
  Teching = 'teching',
  TechRoll = 'tech_roll',
  ShieldBroken = 'shield_broken',
  Landing = 'landing',
  Crouching = 'crouching',
  FastFalling = 'fast_falling',
}

// --- Facing Direction ---

export enum Facing {
  Left = -1,
  Right = 1,
}

// --- Hitbox Types ---

export enum HitboxType {
  Normal = 'normal',
  Sweetspot = 'sweetspot',
  Sourspot = 'sourspot',
  Electric = 'electric',
  Fire = 'fire',
  Projectile = 'projectile',
  Grab = 'grab',
  Wind = 'wind',
}

export interface Hitbox {
  id: string;
  ownerId: number;
  position: Vector2D;  // relative to fighter
  size: Vector2D;      // width, height of hitbox ellipse/rect
  damage: number;
  knockbackBase: number;
  knockbackGrowth: number;
  angle: number;        // in degrees, 0 = horizontal away, 90 = up
  type: HitboxType;
  priority: number;     // higher priority wins clashes
  active: boolean;
  hitPlayers: number[]; // track which players this hitbox already hit (per move)
}

export interface Hurtbox {
  position: Vector2D;   // relative to fighter
  size: Vector2D;
  intangible: boolean;
  invincible: boolean;
}

// --- Input ---

export interface InputState {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  attack: boolean;
  special: boolean;
  shield: boolean;
  grab: boolean;
  jump: boolean;
  cStickX: number;  // -1 to 1
  cStickY: number;  // -1 to 1
}

export interface BufferedInput {
  input: InputState;
  frame: number;
}

export interface InputSnapshot {
  current: InputState;
  previous: InputState;
  /** Inputs that transitioned from false to true this frame */
  pressed: InputState;
  /** How many frames a directional input has been held */
  holdFrames: {
    left: number;
    right: number;
    up: number;
    down: number;
  };
}

// --- Fighter Data (Character Template) ---

export interface FighterData {
  id: string;
  name: string;
  weight: number;            // 80-120 typical range
  walkSpeed: number;         // units per frame
  runSpeed: number;
  initialDashSpeed: number;
  jumpForce: number;         // initial vertical velocity on jump
  shortHopForce: number;
  doubleJumpForce: number;
  airSpeed: number;          // max horizontal air speed
  airAcceleration: number;
  fallSpeed: number;         // max fall speed (gravity terminal velocity)
  fastFallSpeed: number;
  gravity: number;           // per-character gravity multiplier
  shieldHealthMax: number;
  width: number;             // approximate body width for rendering
  height: number;            // approximate body height for rendering
  color: string;             // primary color for geometric rendering
  accentColor: string;       // secondary color
  moves: MoveSet;
}

// --- Moves ---

export enum MoveId {
  Jab = 'jab',
  DashAttack = 'dash_attack',
  FTilt = 'ftilt',
  UTilt = 'utilt',
  DTilt = 'dtilt',
  FSmash = 'fsmash',
  USmash = 'usmash',
  DSmash = 'dsmash',
  NAir = 'nair',
  FAir = 'fair',
  BAir = 'bair',
  UAir = 'uair',
  DAir = 'dair',
  NeutralSpecial = 'neutral_special',
  SideSpecial = 'side_special',
  UpSpecial = 'up_special',
  DownSpecial = 'down_special',
  GrabPummel = 'grab_pummel',
  FThrow = 'fthrow',
  BThrow = 'bthrow',
  UThrow = 'uthrow',
  DThrow = 'dthrow',
  LedgeAttack = 'ledge_attack',
  GetUpAttack = 'getup_attack',
}

export interface MoveData {
  id: MoveId;
  startupFrames: number;     // frames before hitbox is active
  activeFrames: number;      // frames hitbox is active
  endlagFrames: number;      // frames of recovery after active frames end
  totalFrames: number;       // startup + active + endlag
  hitboxes: HitboxTemplate[];
  landingLag?: number;       // if aerial, lag on landing during move
  autoCancel?: { before: number; after: number }; // frames where landing has no lag
  isAerial: boolean;
  canBeReversed?: boolean;
}

export interface HitboxTemplate {
  relativeX: number;
  relativeY: number;
  width: number;
  height: number;
  damage: number;
  knockbackBase: number;
  knockbackGrowth: number;
  angle: number;
  type: HitboxType;
  priority: number;
}

export type MoveSet = Record<MoveId, MoveData>;

// --- Match Config ---

export interface MatchConfig {
  stocks: number;           // 0 = time mode only
  timer: number;            // seconds, 0 = infinite
  stageId: string;
  players: MatchPlayerConfig[];
}

export interface MatchPlayerConfig {
  id: number;
  characterId: string;
  isAI: boolean;
  aiLevel: number;          // 1-9
  team?: number;
  controlScheme: 'keyboard1' | 'keyboard2' | 'gamepad';
  gamepadIndex?: number;
}

// --- Player Data (Runtime State) ---

export interface PlayerData {
  id: number;
  characterId: string;
  damage: number;           // percentage (0-999)
  stocks: number;
  position: Vector2D;
  velocity: Vector2D;
  facing: Facing;
  state: PlayerState;
  stateFrame: number;       // how many frames in current state
  currentMove: MoveId | null;
  moveFrame: number;        // frame within current move
  isGrounded: boolean;
  jumpsUsed: number;        // 0 = on ground, 1 = jumped, 2 = double jumped
  maxJumps: number;         // usually 2 (1 jump + 1 double jump)
  shieldHealth: number;
  shieldStun: number;       // frames of shield stun remaining
  hitstunFrames: number;
  invincibleFrames: number;
  intangibleFrames: number;
  canFastFall: boolean;
  isFastFalling: boolean;
  hasAirdodge: boolean;
  currentPlatformIndex: number; // index of platform standing on, -1 if airborne
  platformDropFrames: number;   // frames of platform drop-through
  knockbackVelocity: Vector2D;
  diVector: Vector2D;
  techWindow: number;       // frames remaining to tech
  comboCount: number;
  lastHitBy: number;        // player id who last hit this player
  hitlag: number;           // freeze frames remaining
  activeHitboxes: Hitbox[];
  hurtboxes: Hurtbox[];
  staleQueue: MoveId[];     // last 9 moves that landed, for stale move negation
  respawnTimer: number;
  respawnInvincibility: number;
  grabTarget: number;       // id of player being grabbed, -1 if none
  grabbedBy: number;        // id of player grabbing this player, -1 if none
  grabTimer: number;        // frames remaining in grab
  ecb: Rectangle;           // environment collision box
  score: number;            // KO score (for timed matches)
}

// --- Stage Types ---

export interface Platform {
  x: number;
  y: number;
  width: number;
  isPassthrough: boolean;
  color?: string;
  glowColor?: string;
}

export interface LedgePoint {
  x: number;
  y: number;
  side: 'left' | 'right';
  occupied: boolean;
  occupiedBy: number;       // player id
}

export interface StageData {
  id: string;
  name: string;
  platforms: Platform[];
  blastZones: {
    left: number;
    right: number;
    top: number;
    bottom: number;
  };
  spawnPoints: Vector2D[];
  cameraCenter: Vector2D;
  cameraBoundsMin: Vector2D;
  cameraBoundsMax: Vector2D;
  ledges: LedgePoint[];
  backgroundColor: string;
  backgroundGradient?: string[];
}

// --- Camera ---

export interface CameraState {
  x: number;
  y: number;
  zoom: number;
  targetX: number;
  targetY: number;
  targetZoom: number;
  shakeIntensity: number;
  shakeDecay: number;
  shakeOffsetX: number;
  shakeOffsetY: number;
}

// --- Particles ---

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  sizeDecay: number;
  color: string;
  alpha: number;
  alphaDecay: number;
  gravity: number;
  rotation: number;
  rotationSpeed: number;
  active: boolean;
}

export interface ParticleEmitterConfig {
  x: number;
  y: number;
  count: number;
  velocityRange: { minX: number; maxX: number; minY: number; maxY: number };
  lifetimeRange: { min: number; max: number };
  sizeRange: { min: number; max: number };
  sizeDecay: number;
  colors: string[];
  alphaDecay: number;
  gravity: number;
  rotationSpeedRange: { min: number; max: number };
}

// --- Events ---

export enum GameEventType {
  Hit = 'hit',
  KO = 'ko',
  Shield = 'shield',
  ShieldBreak = 'shield_break',
  Grab = 'grab',
  Throw = 'throw',
  Tech = 'tech',
  LedgeGrab = 'ledge_grab',
  MatchStart = 'match_start',
  MatchEnd = 'match_end',
}

export interface GameEvent {
  type: GameEventType;
  frame: number;
  data: Record<string, unknown>;
}

// --- System Interface ---

export interface GameSystem {
  update(deltaFrame: number): void;
  reset(): void;
}

// --- Debug ---

export interface DebugOptions {
  showHitboxes: boolean;
  showHurtboxes: boolean;
  showECB: boolean;
  showInputs: boolean;
  showFrameData: boolean;
  showCameraInfo: boolean;
  slowMotion: number;       // 1 = normal, 0.5 = half speed, etc.
}
