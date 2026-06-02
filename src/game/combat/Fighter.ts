// ============================================================================
// Cosmic Knockout - Fighter Class
// ============================================================================

import {
  PlayerData,
  PlayerState,
  FighterData,
  MoveData,
  MoveId,
  MoveSet,
  Hitbox,
  HitboxType,
  Hurtbox,
  InputSnapshot,
  Facing,
  Vector2D,
} from '../core/types';
import { PhysicsEngine } from '../physics/PhysicsEngine';
import { CombatSystem } from './CombatSystem';

// --- Constants ---

const LANDING_LAG_FRAMES = 4;
const AERIAL_LANDING_LAG_DEFAULT = 8;
const DODGE_FRAMES = 18;
const DODGE_INTANGIBLE_START = 3;
const DODGE_INTANGIBLE_END = 14;
const AIR_DODGE_FRAMES = 24;
const SPOT_DODGE_FRAMES = 20;
const ROLL_FRAMES = 28;
const ROLL_DISTANCE = 80;
const LEDGE_HANG_MAX_FRAMES = 300; // 5 seconds
const LEDGE_GETUP_FRAMES = 24;
const LEDGE_ATTACK_FRAMES = 32;
const LEDGE_ROLL_FRAMES = 30;
const LEDGE_JUMP_FRAMES = 8;
const TECH_WINDOW_FRAMES = 20;
const TECH_FRAMES = 20;
const TECH_ROLL_FRAMES = 28;
const RESPAWN_TIMER = 90;             // 1.5 seconds
const RESPAWN_INVINCIBILITY = 120;    // 2 seconds
const SHIELD_BROKEN_FRAMES = 240;     // 4 seconds
const SHORT_HOP_THRESHOLD = 3;       // release jump within this many frames for short hop

// ============================================================================
// Fighter
// ============================================================================

export class Fighter {
  readonly playerData: PlayerData;
  readonly fighterData: FighterData;

  private jumpPressFrame: number = -100;
  private jumpReleased: boolean = true;

  constructor(playerData: PlayerData, fighterData: FighterData) {
    this.playerData = playerData;
    this.fighterData = fighterData;
    this.initHurtboxes();
  }

  // =========================================================================
  // State Machine Update
  // =========================================================================

  update(
    input: InputSnapshot,
    physics: PhysicsEngine,
    combat: CombatSystem,
    frame: number,
  ): void {
    const p = this.playerData;
    p.stateFrame++;

    // Decrement timers
    if (p.respawnTimer > 0) {
      p.respawnTimer--;
      if (p.respawnTimer <= 0 && p.state === PlayerState.Respawning) {
        p.state = PlayerState.Falling;
        p.stateFrame = 0;
        p.respawnInvincibility = RESPAWN_INVINCIBILITY;
        p.invincibleFrames = RESPAWN_INVINCIBILITY;
      }
      return;
    }

    // Handle respawn invincibility decrement
    if (p.respawnInvincibility > 0) {
      p.respawnInvincibility--;
    }

    // Update hurtboxes
    this.updateHurtboxes();

    // Handle state-specific logic
    switch (p.state) {
      case PlayerState.Idle:
        this.handleIdle(input, physics, frame);
        break;
      case PlayerState.Walking:
        this.handleWalking(input, physics, frame);
        break;
      case PlayerState.Running:
        this.handleRunning(input, physics, frame);
        break;
      case PlayerState.RunBrake:
        this.handleRunBrake(input, physics, frame);
        break;
      case PlayerState.Jumping:
      case PlayerState.Falling:
      case PlayerState.FastFalling:
        this.handleAirborne(input, physics, frame);
        break;
      case PlayerState.Attacking:
        this.handleAttacking(input, physics, combat, frame);
        break;
      case PlayerState.Shielding:
        this.handleShielding(input, physics, combat, frame);
        break;
      case PlayerState.Dodging:
        this.handleDodging(input, physics);
        break;
      case PlayerState.Hitstun:
        this.handleHitstun(input, physics);
        break;
      case PlayerState.Tumble:
        this.handleTumble(input, physics);
        break;
      case PlayerState.Helpless:
        this.handleHelpless(input, physics);
        break;
      case PlayerState.Landing:
        this.handleLanding(input, physics, frame);
        break;
      case PlayerState.Crouching:
        this.handleCrouching(input, physics, frame);
        break;
      case PlayerState.Grabbing:
        this.handleGrabbing(input, physics, combat);
        break;
      case PlayerState.Grabbed:
        this.handleGrabbed(input, combat);
        break;
      case PlayerState.Throwing:
        this.handleThrowing(input, physics);
        break;
      case PlayerState.LedgeHang:
        this.handleLedgeHang(input, physics, frame);
        break;
      case PlayerState.LedgeGetUp:
      case PlayerState.LedgeAttack:
      case PlayerState.LedgeRoll:
      case PlayerState.LedgeJump:
        this.handleLedgeAction(input, physics);
        break;
      case PlayerState.Teching:
      case PlayerState.TechRoll:
        this.handleTeching(input, physics);
        break;
      case PlayerState.ShieldBroken:
        this.handleShieldBroken(input, physics);
        break;
      case PlayerState.Dead:
        this.handleDead(physics);
        break;
      case PlayerState.Respawning:
        break; // handled by timer above
    }
  }

  // =========================================================================
  // State Handlers
  // =========================================================================

  private handleIdle(input: InputSnapshot, physics: PhysicsEngine, frame: number): void {
    const p = this.playerData;

    // Jump
    if (this.tryJump(input, physics, frame)) return;

    // Shield
    if (input.current.shield) {
      p.state = PlayerState.Shielding;
      p.stateFrame = 0;
      return;
    }

    // Attack inputs
    if (this.tryAttack(input, frame)) return;

    // Grab
    if (input.pressed.grab) {
      this.startMove(MoveId.Jab); // grab uses jab slot startup then transitions
      // Actually implement grab as an attack state
      return;
    }

    // Movement
    if (input.current.down) {
      p.state = PlayerState.Crouching;
      p.stateFrame = 0;
      return;
    }

    const hAxis = (input.current.right ? 1 : 0) - (input.current.left ? 1 : 0);
    if (hAxis !== 0) {
      p.facing = hAxis > 0 ? Facing.Right : Facing.Left;
      // Check for dash (tap input)
      if (input.pressed.left || input.pressed.right) {
        p.state = PlayerState.Running;
        p.stateFrame = 0;
        p.velocity.x = this.fighterData.initialDashSpeed * hAxis;
      } else {
        p.state = PlayerState.Walking;
        p.stateFrame = 0;
        physics.applyMovement(p, this.fighterData.walkSpeed, hAxis);
      }
    }
  }

  private handleWalking(input: InputSnapshot, physics: PhysicsEngine, frame: number): void {
    const p = this.playerData;

    if (this.tryJump(input, physics, frame)) return;
    if (input.current.shield) { p.state = PlayerState.Shielding; p.stateFrame = 0; return; }
    if (this.tryAttack(input, frame)) return;

    const hAxis = (input.current.right ? 1 : 0) - (input.current.left ? 1 : 0);
    if (hAxis === 0) {
      p.state = PlayerState.Idle;
      p.stateFrame = 0;
      return;
    }

    p.facing = hAxis > 0 ? Facing.Right : Facing.Left;
    physics.applyMovement(p, this.fighterData.walkSpeed, hAxis);

    if (input.current.down) {
      p.state = PlayerState.Crouching;
      p.stateFrame = 0;
    }
  }

  private handleRunning(input: InputSnapshot, physics: PhysicsEngine, frame: number): void {
    const p = this.playerData;

    if (this.tryJump(input, physics, frame)) return;
    if (input.current.shield) {
      // Shield out of run = roll
      const rollDir = p.facing;
      p.state = PlayerState.Dodging;
      p.stateFrame = 0;
      p.velocity.x = (ROLL_DISTANCE / ROLL_FRAMES) * rollDir;
      p.intangibleFrames = DODGE_INTANGIBLE_END - DODGE_INTANGIBLE_START;
      return;
    }

    // Dash attack
    if (input.pressed.attack) {
      this.startMove(MoveId.DashAttack);
      return;
    }

    if (this.tryAttack(input, frame)) return;

    const hAxis = (input.current.right ? 1 : 0) - (input.current.left ? 1 : 0);

    // Pivot / turnaround
    if (hAxis !== 0 && hAxis !== p.facing) {
      p.facing = hAxis > 0 ? Facing.Right : Facing.Left;
    }

    if (hAxis === 0) {
      p.state = PlayerState.RunBrake;
      p.stateFrame = 0;
      return;
    }

    physics.applyMovement(p, this.fighterData.runSpeed, hAxis);
  }

  private handleRunBrake(input: InputSnapshot, physics: PhysicsEngine, frame: number): void {
    const p = this.playerData;
    if (p.stateFrame > 8) {
      p.state = PlayerState.Idle;
      p.stateFrame = 0;
    }
    if (this.tryJump(input, physics, frame)) return;
    if (this.tryAttack(input, frame)) return;
  }

  private handleAirborne(input: InputSnapshot, physics: PhysicsEngine, frame: number): void {
    const p = this.playerData;

    // Double jump
    if (this.tryJump(input, physics, frame)) return;

    // Air dodge
    if (input.pressed.shield && p.hasAirdodge) {
      p.state = PlayerState.Dodging;
      p.stateFrame = 0;
      p.hasAirdodge = false;
      p.intangibleFrames = AIR_DODGE_FRAMES - 6;
      // Directional air dodge
      const hAxis = (input.current.right ? 1 : 0) - (input.current.left ? 1 : 0);
      const vAxis = (input.current.down ? 1 : 0) - (input.current.up ? 1 : 0);
      if (hAxis !== 0 || vAxis !== 0) {
        const mag = 8;
        const angle = Math.atan2(vAxis, hAxis);
        p.velocity.x = Math.cos(angle) * mag;
        p.velocity.y = Math.sin(angle) * mag;
      } else {
        p.velocity.x *= 0.5;
        p.velocity.y = 0;
      }
      return;
    }

    // Aerial attacks
    if (this.tryAerialAttack(input)) return;

    // Fast fall
    if (input.pressed.down && p.velocity.y > 0 && !p.isFastFalling) {
      physics.tryFastFall(p);
    }

    // Air drift
    const hAxis = (input.current.right ? 1 : 0) - (input.current.left ? 1 : 0);
    if (hAxis !== 0) {
      physics.applyMovement(p, this.fighterData.airSpeed, hAxis);
    }

    // Update state based on velocity
    if (p.velocity.y < 0) {
      if (p.state !== PlayerState.Jumping) {
        p.state = PlayerState.Jumping;
        p.stateFrame = 0;
      }
    } else {
      if (p.isFastFalling) {
        if (p.state !== PlayerState.FastFalling) {
          p.state = PlayerState.FastFalling;
          p.stateFrame = 0;
        }
      } else if (p.state !== PlayerState.Falling) {
        p.state = PlayerState.Falling;
        p.stateFrame = 0;
      }
    }
  }

  private handleAttacking(
    _input: InputSnapshot,
    _physics: PhysicsEngine,
    _combat: CombatSystem,
    _frame: number,
  ): void {
    const p = this.playerData;
    const move = this.getCurrentMoveData();
    if (!move) {
      p.state = p.isGrounded ? PlayerState.Idle : PlayerState.Falling;
      p.stateFrame = 0;
      p.currentMove = null;
      p.activeHitboxes = [];
      return;
    }

    p.moveFrame++;

    // Spawn hitboxes during active frames
    if (p.moveFrame >= move.startupFrames && p.moveFrame < move.startupFrames + move.activeFrames) {
      this.activateHitboxes(move);
    } else {
      // Deactivate hitboxes outside active frames
      p.activeHitboxes = [];
    }

    // Move completed
    if (p.moveFrame >= move.totalFrames) {
      p.currentMove = null;
      p.moveFrame = 0;
      p.activeHitboxes = [];

      if (move.isAerial) {
        p.state = p.isGrounded ? PlayerState.Idle : PlayerState.Falling;
      } else {
        p.state = p.isGrounded ? PlayerState.Idle : PlayerState.Helpless;
        // Up special -> helpless
        if (p.currentMove === MoveId.UpSpecial) {
          p.state = PlayerState.Helpless;
        }
      }
      p.stateFrame = 0;
    }
  }

  private handleShielding(
    input: InputSnapshot,
    physics: PhysicsEngine,
    combat: CombatSystem,
    frame: number,
  ): void {
    const p = this.playerData;

    // Shield stun: can't act
    if (p.shieldStun > 0) return;

    // Release shield
    if (!input.current.shield) {
      p.state = PlayerState.Idle;
      p.stateFrame = 0;
      return;
    }

    // Grab out of shield
    if (input.pressed.grab || input.pressed.attack) {
      // OOS (Out of Shield) options
      // Grab
      this.startMove(MoveId.Jab); // placeholder for grab
      return;
    }

    // Jump out of shield
    if (this.tryJump(input, physics, frame)) return;

    // Spot dodge
    if (input.pressed.down) {
      p.state = PlayerState.Dodging;
      p.stateFrame = 0;
      p.intangibleFrames = SPOT_DODGE_FRAMES - 6;
      p.velocity.x = 0;
      return;
    }

    // Roll
    if (input.pressed.left || input.pressed.right) {
      const dir = input.pressed.right ? 1 : -1;
      p.state = PlayerState.Dodging;
      p.stateFrame = 0;
      p.velocity.x = (ROLL_DISTANCE / ROLL_FRAMES) * dir;
      p.intangibleFrames = ROLL_FRAMES - 8;
      return;
    }
  }

  private handleDodging(_input: InputSnapshot, _physics: PhysicsEngine): void {
    const p = this.playerData;
    const duration = p.isGrounded ? DODGE_FRAMES : AIR_DODGE_FRAMES;

    if (p.stateFrame >= duration) {
      if (p.isGrounded) {
        p.state = PlayerState.Idle;
      } else {
        p.state = PlayerState.Helpless;
      }
      p.stateFrame = 0;
      p.velocity.x *= 0.3;
    }
  }

  private handleHitstun(input: InputSnapshot, physics: PhysicsEngine): void {
    const p = this.playerData;

    // DI (Directional Influence)
    const hAxis = (input.current.right ? 1 : 0) - (input.current.left ? 1 : 0);
    const vAxis = (input.current.down ? 1 : 0) - (input.current.up ? 1 : 0);
    if (hAxis !== 0 || vAxis !== 0) {
      physics.applyDI(p, hAxis, vAxis);
    }

    // Set tech window if shield is pressed
    if (input.pressed.shield) {
      p.techWindow = TECH_WINDOW_FRAMES;
    }

    // Hitstun ends naturally via CombatSystem
  }

  private handleTumble(input: InputSnapshot, physics: PhysicsEngine): void {
    const p = this.playerData;

    // DI
    const hAxis = (input.current.right ? 1 : 0) - (input.current.left ? 1 : 0);
    const vAxis = (input.current.down ? 1 : 0) - (input.current.up ? 1 : 0);
    if (hAxis !== 0 || vAxis !== 0) {
      physics.applyDI(p, hAxis, vAxis);
    }

    // Tech window
    if (input.pressed.shield) {
      p.techWindow = TECH_WINDOW_FRAMES;
    }

    // Can act out of tumble (if hitstun expired) with any input
    if (p.hitstunFrames <= 0) {
      if (input.pressed.attack || input.pressed.special || input.pressed.jump) {
        p.state = p.isGrounded ? PlayerState.Idle : PlayerState.Falling;
        p.stateFrame = 0;
        p.knockbackVelocity = { x: 0, y: 0 };
      }
      // Air drift
      if (hAxis !== 0) {
        physics.applyMovement(p, this.fighterData.airSpeed * 0.5, hAxis);
      }
    }
  }

  private handleHelpless(_input: InputSnapshot, _physics: PhysicsEngine): void {
    const p = this.playerData;
    // Can only drift and fast fall
    if (p.isGrounded) {
      p.state = PlayerState.Idle;
      p.stateFrame = 0;
    }
  }

  private handleLanding(_input: InputSnapshot, _physics: PhysicsEngine, _frame: number): void {
    const p = this.playerData;
    if (p.stateFrame >= LANDING_LAG_FRAMES) {
      p.state = PlayerState.Idle;
      p.stateFrame = 0;
    }
  }

  private handleCrouching(input: InputSnapshot, physics: PhysicsEngine, frame: number): void {
    const p = this.playerData;

    if (!input.current.down) {
      p.state = PlayerState.Idle;
      p.stateFrame = 0;
      return;
    }

    if (this.tryJump(input, physics, frame)) return;
    if (this.tryAttack(input, frame)) return;

    // Drop through platform
    if (input.pressed.down && p.isGrounded) {
      physics.tryDropThrough(p);
    }
  }

  private handleGrabbing(
    input: InputSnapshot,
    _physics: PhysicsEngine,
    combat: CombatSystem,
  ): void {
    const p = this.playerData;

    if (p.grabTarget < 0) {
      p.state = PlayerState.Idle;
      p.stateFrame = 0;
      return;
    }

    // Pummel
    if (input.pressed.attack) {
      // Apply small damage to grabbed player
      const target = p.grabTarget;
      // Handled at game engine level via combat system
    }

    // Throws
    if (input.pressed.up) {
      combat.executeThrow(p, MoveId.UThrow, 8, 90, 6, 70);
      return;
    }
    if (input.pressed.down) {
      combat.executeThrow(p, MoveId.DThrow, 7, 70, 4, 50);
      return;
    }
    if (input.current.right && p.facing === Facing.Right || input.current.left && p.facing === Facing.Left) {
      combat.executeThrow(p, MoveId.FThrow, 9, 45, 5, 60);
      return;
    }
    if (input.current.left && p.facing === Facing.Right || input.current.right && p.facing === Facing.Left) {
      combat.executeThrow(p, MoveId.BThrow, 10, 135, 7, 65);
      return;
    }
  }

  private handleGrabbed(input: InputSnapshot, combat: CombatSystem): void {
    // Mash to escape
    if (input.pressed.attack || input.pressed.special || input.pressed.jump || input.pressed.shield) {
      combat.mashGrab(this.playerData);
    }
    if (input.pressed.left || input.pressed.right || input.pressed.up || input.pressed.down) {
      combat.mashGrab(this.playerData);
    }
  }

  private handleThrowing(_input: InputSnapshot, _physics: PhysicsEngine): void {
    const p = this.playerData;
    if (p.stateFrame >= 16) {
      p.state = PlayerState.Idle;
      p.stateFrame = 0;
    }
  }

  private handleLedgeHang(input: InputSnapshot, physics: PhysicsEngine, frame: number): void {
    const p = this.playerData;

    if (p.stateFrame >= LEDGE_HANG_MAX_FRAMES) {
      // Fall off ledge
      physics.releaseLedge(p.id);
      p.state = PlayerState.Falling;
      p.stateFrame = 0;
      return;
    }

    // Ledge options
    if (input.pressed.attack) {
      physics.releaseLedge(p.id);
      p.state = PlayerState.LedgeAttack;
      p.stateFrame = 0;
      this.startMove(MoveId.LedgeAttack);
      p.invincibleFrames = 10;
      return;
    }

    if (input.pressed.shield || (input.current.right && p.facing === Facing.Left) || (input.current.left && p.facing === Facing.Right)) {
      physics.releaseLedge(p.id);
      p.state = PlayerState.LedgeRoll;
      p.stateFrame = 0;
      p.velocity.x = (ROLL_DISTANCE / LEDGE_ROLL_FRAMES) * p.facing;
      p.intangibleFrames = LEDGE_ROLL_FRAMES - 8;
      return;
    }

    if (input.pressed.jump) {
      physics.releaseLedge(p.id);
      p.state = PlayerState.LedgeJump;
      p.stateFrame = 0;
      physics.applyJump(p, this.fighterData.jumpForce);
      return;
    }

    // Normal getup
    if (input.pressed.up || (input.current.right && p.facing === Facing.Right) || (input.current.left && p.facing === Facing.Left)) {
      physics.releaseLedge(p.id);
      p.state = PlayerState.LedgeGetUp;
      p.stateFrame = 0;
      p.invincibleFrames = 6;
      // Move onto stage
      p.position.x += p.facing * 30;
      p.position.y -= 48;
      p.isGrounded = true;
      return;
    }

    // Drop from ledge
    if (input.pressed.down) {
      physics.releaseLedge(p.id);
      p.state = PlayerState.Falling;
      p.stateFrame = 0;
      return;
    }
  }

  private handleLedgeAction(_input: InputSnapshot, _physics: PhysicsEngine): void {
    const p = this.playerData;
    let duration: number;
    switch (p.state) {
      case PlayerState.LedgeGetUp: duration = LEDGE_GETUP_FRAMES; break;
      case PlayerState.LedgeAttack: duration = LEDGE_ATTACK_FRAMES; break;
      case PlayerState.LedgeRoll: duration = LEDGE_ROLL_FRAMES; break;
      case PlayerState.LedgeJump: duration = LEDGE_JUMP_FRAMES; break;
      default: duration = 20;
    }

    if (p.stateFrame >= duration) {
      p.state = p.isGrounded ? PlayerState.Idle : PlayerState.Falling;
      p.stateFrame = 0;
    }
  }

  private handleTeching(_input: InputSnapshot, _physics: PhysicsEngine): void {
    const p = this.playerData;
    const duration = p.state === PlayerState.TechRoll ? TECH_ROLL_FRAMES : TECH_FRAMES;
    if (p.stateFrame >= duration) {
      p.state = PlayerState.Idle;
      p.stateFrame = 0;
    }
  }

  private handleShieldBroken(_input: InputSnapshot, _physics: PhysicsEngine): void {
    const p = this.playerData;
    if (p.stateFrame >= SHIELD_BROKEN_FRAMES) {
      p.state = PlayerState.Idle;
      p.stateFrame = 0;
      p.shieldHealth = 30; // partial shield regen after break
    }
  }

  private handleDead(physics: PhysicsEngine): void {
    const p = this.playerData;
    if (p.stocks > 0) {
      p.state = PlayerState.Respawning;
      p.stateFrame = 0;
      p.respawnTimer = RESPAWN_TIMER;
      p.damage = 0;
      p.velocity = { x: 0, y: 0 };
      p.knockbackVelocity = { x: 0, y: 0 };
      p.activeHitboxes = [];
      p.isFastFalling = false;
      p.jumpsUsed = 0;
      p.shieldHealth = 100;
      p.comboCount = 0;
      p.grabTarget = -1;
      p.grabbedBy = -1;

      // Respawn position (above stage center)
      p.position = { x: 0, y: -180 };
      p.isGrounded = false;
      p.currentPlatformIndex = -1;

      // Release any ledge
      physics.releaseLedge(p.id);
    }
  }

  // =========================================================================
  // Move Execution
  // =========================================================================

  private tryJump(input: InputSnapshot, physics: PhysicsEngine, frame: number): boolean {
    const p = this.playerData;

    if (input.pressed.jump) {
      this.jumpPressFrame = frame;
      this.jumpReleased = false;
    }
    if (!input.current.jump) {
      // Check for short hop (released jump quickly)
      if (!this.jumpReleased && frame - this.jumpPressFrame <= SHORT_HOP_THRESHOLD) {
        this.jumpReleased = true;
        // Mark for short hop if still in jump startup
      }
      this.jumpReleased = true;
    }

    if (!input.pressed.jump) return false;

    if (p.isGrounded) {
      p.state = PlayerState.Jumping;
      p.stateFrame = 0;
      physics.applyJump(p, this.fighterData.jumpForce);
      p.jumpsUsed = 1;
      return true;
    } else if (p.jumpsUsed < p.maxJumps) {
      p.state = PlayerState.Jumping;
      p.stateFrame = 0;
      physics.applyJump(p, this.fighterData.doubleJumpForce);
      p.jumpsUsed++;
      return true;
    }

    return false;
  }

  private tryAttack(input: InputSnapshot, _frame: number): boolean {
    const p = this.playerData;
    if (!p.isGrounded) return false;

    // C-stick smash attacks
    if (Math.abs(input.current.cStickX) > 0.5) {
      if (input.current.cStickX > 0) {
        p.facing = Facing.Right;
        this.startMove(MoveId.FSmash);
      } else {
        p.facing = Facing.Left;
        this.startMove(MoveId.FSmash);
      }
      return true;
    }
    if (input.current.cStickY > 0.5) {
      this.startMove(MoveId.DSmash);
      return true;
    }
    if (input.current.cStickY < -0.5) {
      this.startMove(MoveId.USmash);
      return true;
    }

    // Smash attacks (direction + attack simultaneously)
    if (input.pressed.attack) {
      if (input.current.up) {
        this.startMove(MoveId.USmash);
        return true;
      }
      if (input.current.down) {
        this.startMove(MoveId.DSmash);
        return true;
      }
      const hAxis = (input.current.right ? 1 : 0) - (input.current.left ? 1 : 0);
      if (hAxis !== 0 && (input.pressed.left || input.pressed.right)) {
        p.facing = hAxis > 0 ? Facing.Right : Facing.Left;
        this.startMove(MoveId.FSmash);
        return true;
      }
    }

    // Tilt attacks
    if (input.pressed.attack) {
      if (input.current.up && !input.pressed.up) {
        this.startMove(MoveId.UTilt);
        return true;
      }
      if (input.current.down && !input.pressed.down) {
        this.startMove(MoveId.DTilt);
        return true;
      }
      const hAxis = (input.current.right ? 1 : 0) - (input.current.left ? 1 : 0);
      if (hAxis !== 0) {
        p.facing = hAxis > 0 ? Facing.Right : Facing.Left;
        this.startMove(MoveId.FTilt);
        return true;
      }
      // Jab (neutral attack)
      this.startMove(MoveId.Jab);
      return true;
    }

    // Special attacks
    if (input.pressed.special) {
      if (input.current.up) {
        this.startMove(MoveId.UpSpecial);
        return true;
      }
      if (input.current.down) {
        this.startMove(MoveId.DownSpecial);
        return true;
      }
      const hAxis = (input.current.right ? 1 : 0) - (input.current.left ? 1 : 0);
      if (hAxis !== 0) {
        p.facing = hAxis > 0 ? Facing.Right : Facing.Left;
        this.startMove(MoveId.SideSpecial);
        return true;
      }
      this.startMove(MoveId.NeutralSpecial);
      return true;
    }

    return false;
  }

  private tryAerialAttack(input: InputSnapshot): boolean {
    const p = this.playerData;

    // C-stick aerials
    if (Math.abs(input.current.cStickX) > 0.5) {
      if ((input.current.cStickX > 0 && p.facing === Facing.Right) ||
          (input.current.cStickX < 0 && p.facing === Facing.Left)) {
        this.startMove(MoveId.FAir);
      } else {
        this.startMove(MoveId.BAir);
      }
      return true;
    }
    if (input.current.cStickY < -0.5) {
      this.startMove(MoveId.UAir);
      return true;
    }
    if (input.current.cStickY > 0.5) {
      this.startMove(MoveId.DAir);
      return true;
    }

    if (input.pressed.attack) {
      if (input.current.up) {
        this.startMove(MoveId.UAir);
        return true;
      }
      if (input.current.down) {
        this.startMove(MoveId.DAir);
        return true;
      }
      const hAxis = (input.current.right ? 1 : 0) - (input.current.left ? 1 : 0);
      if (hAxis !== 0) {
        if ((hAxis > 0 && p.facing === Facing.Right) || (hAxis < 0 && p.facing === Facing.Left)) {
          this.startMove(MoveId.FAir);
        } else {
          this.startMove(MoveId.BAir);
        }
        return true;
      }
      this.startMove(MoveId.NAir);
      return true;
    }

    // Aerial specials
    if (input.pressed.special) {
      if (input.current.up) {
        this.startMove(MoveId.UpSpecial);
        return true;
      }
      if (input.current.down) {
        this.startMove(MoveId.DownSpecial);
        return true;
      }
      const hAxis = (input.current.right ? 1 : 0) - (input.current.left ? 1 : 0);
      if (hAxis !== 0) {
        p.facing = hAxis > 0 ? Facing.Right : Facing.Left;
        this.startMove(MoveId.SideSpecial);
        return true;
      }
      this.startMove(MoveId.NeutralSpecial);
      return true;
    }

    return false;
  }

  private startMove(moveId: MoveId): void {
    const p = this.playerData;
    p.state = PlayerState.Attacking;
    p.stateFrame = 0;
    p.currentMove = moveId;
    p.moveFrame = 0;
    p.activeHitboxes = [];
  }

  private activateHitboxes(move: MoveData): void {
    const p = this.playerData;
    p.activeHitboxes = move.hitboxes.map((template, index) => ({
      id: `${p.id}_${move.id}_${index}`,
      ownerId: p.id,
      position: { x: template.relativeX, y: template.relativeY },
      size: { x: template.width, y: template.height },
      damage: template.damage,
      knockbackBase: template.knockbackBase,
      knockbackGrowth: template.knockbackGrowth,
      angle: template.angle,
      type: template.type,
      priority: template.priority,
      active: true,
      hitPlayers: [],
    }));
  }

  private getCurrentMoveData(): MoveData | null {
    const p = this.playerData;
    if (!p.currentMove) return null;
    return this.fighterData.moves[p.currentMove] ?? null;
  }

  // =========================================================================
  // Hurtboxes
  // =========================================================================

  private initHurtboxes(): void {
    const fd = this.fighterData;
    this.playerData.hurtboxes = [
      {
        position: { x: 0, y: -fd.height / 2 },
        size: { x: fd.width, y: fd.height },
        intangible: false,
        invincible: false,
      },
    ];
  }

  private updateHurtboxes(): void {
    const p = this.playerData;
    const fd = this.fighterData;

    // Update intangibility/invincibility
    for (const hb of p.hurtboxes) {
      hb.intangible = p.intangibleFrames > 0;
      hb.invincible = p.invincibleFrames > 0;
    }

    // Adjust hurtbox for crouching
    if (p.state === PlayerState.Crouching) {
      p.hurtboxes[0].size.y = fd.height * 0.6;
      p.hurtboxes[0].position.y = -fd.height * 0.3;
    } else {
      p.hurtboxes[0].size.y = fd.height;
      p.hurtboxes[0].position.y = -fd.height / 2;
    }
  }

  // =========================================================================
  // Factory: Create Default PlayerData
  // =========================================================================

  static createPlayerData(
    id: number,
    characterId: string,
    spawnPoint: Vector2D,
    stocks: number,
  ): PlayerData {
    return {
      id,
      characterId,
      damage: 0,
      stocks,
      position: { ...spawnPoint },
      velocity: { x: 0, y: 0 },
      facing: id % 2 === 0 ? Facing.Right : Facing.Left,
      state: PlayerState.Idle,
      stateFrame: 0,
      currentMove: null,
      moveFrame: 0,
      isGrounded: false,
      jumpsUsed: 0,
      maxJumps: 2,
      shieldHealth: 100,
      shieldStun: 0,
      hitstunFrames: 0,
      invincibleFrames: RESPAWN_INVINCIBILITY,
      intangibleFrames: 0,
      canFastFall: false,
      isFastFalling: false,
      hasAirdodge: true,
      currentPlatformIndex: -1,
      platformDropFrames: 0,
      knockbackVelocity: { x: 0, y: 0 },
      diVector: { x: 0, y: 0 },
      techWindow: 0,
      comboCount: 0,
      lastHitBy: -1,
      hitlag: 0,
      activeHitboxes: [],
      hurtboxes: [],
      staleQueue: [],
      respawnTimer: 0,
      respawnInvincibility: RESPAWN_INVINCIBILITY,
      grabTarget: -1,
      grabbedBy: -1,
      grabTimer: 0,
      ecb: { x: spawnPoint.x - 12, y: spawnPoint.y - 48, width: 24, height: 48 },
      score: 0,
    };
  }
}

// ============================================================================
// Default Fighter Data (Character Templates)
// ============================================================================

function createDefaultMoveSet(): MoveSet {
  const mkMove = (
    id: MoveId,
    startup: number,
    active: number,
    endlag: number,
    damage: number,
    kbBase: number,
    kbGrowth: number,
    angle: number,
    isAerial: boolean = false,
    hitboxType: HitboxType = HitboxType.Normal,
    hbX: number = 20,
    hbY: number = -20,
    hbW: number = 28,
    hbH: number = 20,
  ): MoveData => ({
    id,
    startupFrames: startup,
    activeFrames: active,
    endlagFrames: endlag,
    totalFrames: startup + active + endlag,
    hitboxes: [
      {
        relativeX: hbX,
        relativeY: hbY,
        width: hbW,
        height: hbH,
        damage,
        knockbackBase: kbBase,
        knockbackGrowth: kbGrowth,
        angle,
        type: hitboxType,
        priority: damage,
      },
    ],
    landingLag: isAerial ? AERIAL_LANDING_LAG_DEFAULT : undefined,
    isAerial,
  });

  return {
    [MoveId.Jab]:            mkMove(MoveId.Jab,            3, 2, 8,  3, 2, 20, 60,  false, HitboxType.Normal, 18, -22, 22, 16),
    [MoveId.DashAttack]:     mkMove(MoveId.DashAttack,     6, 4, 14, 8, 5, 50, 45,  false, HitboxType.Normal, 22, -20, 30, 22),
    [MoveId.FTilt]:          mkMove(MoveId.FTilt,          5, 3, 12, 7, 3, 55, 40,  false, HitboxType.Normal, 24, -22, 28, 18),
    [MoveId.UTilt]:          mkMove(MoveId.UTilt,          4, 4, 14, 6, 3, 60, 85,  false, HitboxType.Normal, 8, -40, 24, 24),
    [MoveId.DTilt]:          mkMove(MoveId.DTilt,          4, 3, 10, 5, 2, 40, 70,  false, HitboxType.Normal, 22, -8, 26, 14),
    [MoveId.FSmash]:         mkMove(MoveId.FSmash,         12, 3, 22, 14, 6, 90, 40, false, HitboxType.Normal, 28, -22, 32, 24),
    [MoveId.USmash]:         mkMove(MoveId.USmash,         10, 4, 20, 13, 5, 85, 80, false, HitboxType.Normal, 6, -48, 28, 28),
    [MoveId.DSmash]:         mkMove(MoveId.DSmash,         8, 3, 20, 12, 5, 80, 30, false, HitboxType.Normal, 20, -6, 30, 16),
    [MoveId.NAir]:           mkMove(MoveId.NAir,           4, 6, 10, 7, 3, 40, 50,  true,  HitboxType.Normal, 0, -24, 30, 30),
    [MoveId.FAir]:           mkMove(MoveId.FAir,           6, 3, 14, 9, 4, 55, 45,  true,  HitboxType.Normal, 22, -22, 26, 20),
    [MoveId.BAir]:           mkMove(MoveId.BAir,           7, 3, 16, 10, 5, 60, 40, true,  HitboxType.Normal, -22, -22, 26, 20),
    [MoveId.UAir]:           mkMove(MoveId.UAir,           5, 4, 12, 8, 3, 50, 75,  true,  HitboxType.Normal, 4, -44, 24, 22),
    [MoveId.DAir]:           mkMove(MoveId.DAir,           10, 3, 18, 12, 4, 70, 270, true, HitboxType.Normal, 4, 0, 22, 22),
    [MoveId.NeutralSpecial]: mkMove(MoveId.NeutralSpecial, 14, 3, 20, 10, 5, 60, 50, false, HitboxType.Fire, 30, -22, 20, 20),
    [MoveId.SideSpecial]:    mkMove(MoveId.SideSpecial,    10, 5, 18, 11, 6, 65, 35, false, HitboxType.Normal, 26, -20, 28, 22),
    [MoveId.UpSpecial]:      mkMove(MoveId.UpSpecial,      6, 8, 24, 9, 4, 70, 80,  true,  HitboxType.Normal, 6, -36, 22, 30),
    [MoveId.DownSpecial]:    mkMove(MoveId.DownSpecial,    8, 4, 22, 10, 5, 55, 60, false, HitboxType.Normal, 12, -16, 26, 24),
    [MoveId.GrabPummel]:     mkMove(MoveId.GrabPummel,     3, 1, 10, 1, 0, 0, 0,   false, HitboxType.Normal, 16, -22, 16, 16),
    [MoveId.FThrow]:         mkMove(MoveId.FThrow,         6, 2, 16, 9, 5, 60, 45,  false, HitboxType.Normal, 20, -20, 20, 20),
    [MoveId.BThrow]:         mkMove(MoveId.BThrow,         8, 2, 18, 10, 7, 65, 135, false, HitboxType.Normal, -20, -20, 20, 20),
    [MoveId.UThrow]:         mkMove(MoveId.UThrow,         6, 2, 16, 8, 6, 70, 90,  false, HitboxType.Normal, 0, -30, 20, 20),
    [MoveId.DThrow]:         mkMove(MoveId.DThrow,         5, 2, 14, 7, 4, 50, 70,  false, HitboxType.Normal, 0, -10, 20, 20),
    [MoveId.LedgeAttack]:    mkMove(MoveId.LedgeAttack,    16, 4, 20, 8, 4, 50, 40, false, HitboxType.Normal, 22, -16, 30, 18),
    [MoveId.GetUpAttack]:    mkMove(MoveId.GetUpAttack,    14, 4, 18, 7, 4, 45, 45, false, HitboxType.Normal, 24, -16, 28, 18),
  };
}

// --- Helper: build a MoveData with empty hitboxes (spawned dynamically) ---

function m(
  id: MoveId,
  startup: number,
  active: number,
  endlag: number,
  damage: number,
  kbBase: number,
  kbGrowth: number,
  angle: number,
  isAerial: boolean = false,
): MoveData {
  return {
    id,
    startupFrames: startup,
    activeFrames: active,
    endlagFrames: endlag,
    totalFrames: startup + active + endlag,
    hitboxes: [],
    landingLag: isAerial ? AERIAL_LANDING_LAG_DEFAULT : undefined,
    isAerial,
  };
}

// --- Built-in Characters ---

// ---- BLAZE - "The Infernal Brawler" (fire bruiser) ----
// Heavy hitter: slow startup but high damage and knockback. Devastating forward smash. Weak aerial game.

function createBlazeMoveSet(): MoveSet {
  return {
    [MoveId.Jab]:            m(MoveId.Jab,            6, 3, 12,  5,  4,  30, 60),
    [MoveId.DashAttack]:     m(MoveId.DashAttack,    10, 4, 18, 12,  8,  60, 40),
    [MoveId.FTilt]:          m(MoveId.FTilt,           8, 3, 16, 10,  6,  65, 38),
    [MoveId.UTilt]:          m(MoveId.UTilt,           7, 4, 14,  9,  5,  60, 85),
    [MoveId.DTilt]:          m(MoveId.DTilt,           6, 3, 12,  8,  4,  50, 70),
    [MoveId.FSmash]:         m(MoveId.FSmash,         22, 3, 28, 22, 10,  90, 40),
    [MoveId.USmash]:         m(MoveId.USmash,         16, 4, 24, 18,  8,  85, 80),
    [MoveId.DSmash]:         m(MoveId.DSmash,         14, 3, 22, 16,  7,  80, 30),
    [MoveId.NAir]:           m(MoveId.NAir,            8, 4, 14,  7,  3,  35, 50, true),
    [MoveId.FAir]:           m(MoveId.FAir,           10, 3, 18,  9,  4,  45, 45, true),
    [MoveId.BAir]:           m(MoveId.BAir,           12, 3, 20, 10,  5,  50, 40, true),
    [MoveId.UAir]:           m(MoveId.UAir,            9, 3, 16,  8,  3,  40, 75, true),
    [MoveId.DAir]:           m(MoveId.DAir,           14, 3, 22, 14,  6,  65, 270, true),
    [MoveId.NeutralSpecial]: m(MoveId.NeutralSpecial, 18, 4, 24, 16,  8,  70, 45),
    [MoveId.SideSpecial]:    m(MoveId.SideSpecial,    14, 5, 22, 14,  9,  75, 35),
    [MoveId.UpSpecial]:      m(MoveId.UpSpecial,      10, 6, 28, 12,  6,  65, 80, true),
    [MoveId.DownSpecial]:    m(MoveId.DownSpecial,    12, 4, 24, 13,  7,  60, 55),
    [MoveId.GrabPummel]:     m(MoveId.GrabPummel,      4, 2, 14,  2,  0,   0,  0),
    [MoveId.FThrow]:         m(MoveId.FThrow,          8, 2, 18, 11,  7,  65, 45),
    [MoveId.BThrow]:         m(MoveId.BThrow,         10, 2, 20, 12,  8,  70, 135),
    [MoveId.UThrow]:         m(MoveId.UThrow,          8, 2, 18, 10,  7,  75, 90),
    [MoveId.DThrow]:         m(MoveId.DThrow,          6, 2, 16,  9,  5,  55, 70),
    [MoveId.LedgeAttack]:    m(MoveId.LedgeAttack,    18, 4, 22, 10,  5,  55, 40),
    [MoveId.GetUpAttack]:    m(MoveId.GetUpAttack,    16, 4, 20,  9,  5,  50, 45),
  };
}

export const BLAZE: FighterData = {
  id: 'blaze',
  name: 'Blaze',
  weight: 105,
  walkSpeed: 1.8,
  runSpeed: 3.5,
  initialDashSpeed: 4.5,
  jumpForce: 11.5,
  shortHopForce: 7,
  doubleJumpForce: 10.5,
  airSpeed: 2.8,
  airAcceleration: 0.5,
  fallSpeed: 7.8,
  fastFallSpeed: 12.5,
  gravity: 1.05,
  shieldHealthMax: 100,
  width: 32,
  height: 52,
  color: '#ff6622',
  accentColor: '#ff4400',
  moves: createBlazeMoveSet(),
};

// ---- ZEPHYR - "The Storm Dancer" (wind speedster) ----
// Fastest character: very fast startup but low damage and weak knockback. Great aerial combos. Struggles to kill.

function createZephyrMoveSet(): MoveSet {
  return {
    [MoveId.Jab]:            m(MoveId.Jab,            2, 2,  6,  2,  1,  15, 60),
    [MoveId.DashAttack]:     m(MoveId.DashAttack,     4, 3, 10,  5,  3,  35, 50),
    [MoveId.FTilt]:          m(MoveId.FTilt,           3, 3,  8,  4,  2,  30, 45),
    [MoveId.UTilt]:          m(MoveId.UTilt,           3, 4,  8,  4,  2,  35, 90),
    [MoveId.DTilt]:          m(MoveId.DTilt,           2, 3,  7,  3,  1,  25, 75),
    [MoveId.FSmash]:         m(MoveId.FSmash,          6, 3, 16, 10,  5,  60, 42),
    [MoveId.USmash]:         m(MoveId.USmash,          5, 4, 14,  9,  4,  55, 82),
    [MoveId.DSmash]:         m(MoveId.DSmash,          5, 3, 14,  8,  4,  50, 28),
    [MoveId.NAir]:           m(MoveId.NAir,            3, 6,  6,  5,  2,  25, 50, true),
    [MoveId.FAir]:           m(MoveId.FAir,            4, 3,  8,  6,  3,  35, 45, true),
    [MoveId.BAir]:           m(MoveId.BAir,            5, 3, 10,  7,  3,  40, 40, true),
    [MoveId.UAir]:           m(MoveId.UAir,            3, 4,  8,  5,  2,  30, 80, true),
    [MoveId.DAir]:           m(MoveId.DAir,            6, 3, 12,  7,  3,  45, 280, true),
    [MoveId.NeutralSpecial]: m(MoveId.NeutralSpecial,  6, 4, 12,  6,  3,  40, 55),
    [MoveId.SideSpecial]:    m(MoveId.SideSpecial,     4, 6, 10,  5,  2,  30, 30),
    [MoveId.UpSpecial]:      m(MoveId.UpSpecial,       3, 8, 18,  4,  2,  35, 85, true),
    [MoveId.DownSpecial]:    m(MoveId.DownSpecial,     5, 4, 14,  6,  3,  40, 60),
    [MoveId.GrabPummel]:     m(MoveId.GrabPummel,      2, 1,  8,  1,  0,   0,  0),
    [MoveId.FThrow]:         m(MoveId.FThrow,          4, 2, 12,  6,  3,  40, 45),
    [MoveId.BThrow]:         m(MoveId.BThrow,          5, 2, 14,  7,  4,  45, 135),
    [MoveId.UThrow]:         m(MoveId.UThrow,          4, 2, 12,  5,  3,  50, 90),
    [MoveId.DThrow]:         m(MoveId.DThrow,          3, 2, 10,  4,  2,  30, 70),
    [MoveId.LedgeAttack]:    m(MoveId.LedgeAttack,    12, 4, 16,  6,  3,  40, 40),
    [MoveId.GetUpAttack]:    m(MoveId.GetUpAttack,    10, 4, 14,  5,  3,  35, 45),
  };
}

export const ZEPHYR: FighterData = {
  id: 'zephyr',
  name: 'Zephyr',
  weight: 78,
  walkSpeed: 2.8,
  runSpeed: 5.0,
  initialDashSpeed: 6.0,
  jumpForce: 13.5,
  shortHopForce: 8.5,
  doubleJumpForce: 12.5,
  airSpeed: 4.0,
  airAcceleration: 0.8,
  fallSpeed: 6.5,
  fastFallSpeed: 10.5,
  gravity: 0.85,
  shieldHealthMax: 90,
  width: 24,
  height: 44,
  color: '#00f0ff',
  accentColor: '#00bbdd',
  moves: createZephyrMoveSet(),
};

// ---- GRANITE - "The Living Fortress" (earth tank) ----
// Heaviest and slowest: very slow startup but extreme damage and knockback.
// Forward smash is the strongest move in the game.

function createGraniteMoveSet(): MoveSet {
  return {
    [MoveId.Jab]:            m(MoveId.Jab,            8, 3, 14,  6,  5,  35, 55),
    [MoveId.DashAttack]:     m(MoveId.DashAttack,    12, 5, 22, 14, 10,  70, 42),
    [MoveId.FTilt]:          m(MoveId.FTilt,          10, 4, 18, 12,  8,  70, 36),
    [MoveId.UTilt]:          m(MoveId.UTilt,           9, 4, 16, 11,  7,  65, 88),
    [MoveId.DTilt]:          m(MoveId.DTilt,           8, 3, 14, 10,  6,  55, 72),
    [MoveId.FSmash]:         m(MoveId.FSmash,         26, 4, 32, 26, 12, 100, 38),
    [MoveId.USmash]:         m(MoveId.USmash,         20, 4, 28, 22, 10,  95, 82),
    [MoveId.DSmash]:         m(MoveId.DSmash,         18, 4, 26, 20,  9,  90, 25),
    [MoveId.NAir]:           m(MoveId.NAir,           10, 4, 16,  9,  4,  40, 50, true),
    [MoveId.FAir]:           m(MoveId.FAir,           12, 3, 20, 11,  5,  50, 42, true),
    [MoveId.BAir]:           m(MoveId.BAir,           14, 3, 22, 13,  6,  55, 38, true),
    [MoveId.UAir]:           m(MoveId.UAir,           11, 3, 18, 10,  4,  45, 78, true),
    [MoveId.DAir]:           m(MoveId.DAir,           16, 4, 26, 16,  8,  75, 270, true),
    [MoveId.NeutralSpecial]: m(MoveId.NeutralSpecial, 20, 5, 28, 18, 10,  80, 48),
    [MoveId.SideSpecial]:    m(MoveId.SideSpecial,    16, 6, 24, 16, 10,  80, 32),
    [MoveId.UpSpecial]:      m(MoveId.UpSpecial,      12, 6, 30, 14,  7,  70, 82, true),
    [MoveId.DownSpecial]:    m(MoveId.DownSpecial,    14, 5, 26, 15,  8,  65, 55),
    [MoveId.GrabPummel]:     m(MoveId.GrabPummel,      5, 2, 16,  3,  0,   0,  0),
    [MoveId.FThrow]:         m(MoveId.FThrow,         10, 2, 20, 12,  8,  70, 42),
    [MoveId.BThrow]:         m(MoveId.BThrow,         12, 2, 22, 14,  9,  75, 130),
    [MoveId.UThrow]:         m(MoveId.UThrow,         10, 2, 20, 11,  8,  80, 90),
    [MoveId.DThrow]:         m(MoveId.DThrow,          8, 2, 18, 10,  6,  55, 68),
    [MoveId.LedgeAttack]:    m(MoveId.LedgeAttack,    20, 5, 24, 12,  6,  60, 38),
    [MoveId.GetUpAttack]:    m(MoveId.GetUpAttack,    18, 5, 22, 11,  6,  55, 42),
  };
}

export const GRANITE: FighterData = {
  id: 'granite',
  name: 'Granite',
  weight: 120,
  walkSpeed: 1.4,
  runSpeed: 2.8,
  initialDashSpeed: 3.5,
  jumpForce: 10,
  shortHopForce: 6,
  doubleJumpForce: 9,
  airSpeed: 2.2,
  airAcceleration: 0.35,
  fallSpeed: 9.0,
  fastFallSpeed: 14,
  gravity: 1.2,
  shieldHealthMax: 115,
  width: 38,
  height: 56,
  color: '#cc8833',
  accentColor: '#996622',
  moves: createGraniteMoveSet(),
};

// ---- VOLT - "The Living Circuit" (electric glass cannon) ----
// Glass cannon: fast attacks with decent damage, very light so dies early. Has a spike (dair angle 270).

function createVoltMoveSet(): MoveSet {
  return {
    [MoveId.Jab]:            m(MoveId.Jab,            3, 2,  8,  4,  2,  22, 60),
    [MoveId.DashAttack]:     m(MoveId.DashAttack,     5, 4, 12,  9,  5,  50, 48),
    [MoveId.FTilt]:          m(MoveId.FTilt,           4, 3, 10,  8,  4,  55, 42),
    [MoveId.UTilt]:          m(MoveId.UTilt,           4, 4, 10,  7,  3,  55, 88),
    [MoveId.DTilt]:          m(MoveId.DTilt,           3, 3,  8,  6,  3,  45, 72),
    [MoveId.FSmash]:         m(MoveId.FSmash,          8, 3, 18, 16,  8,  85, 42),
    [MoveId.USmash]:         m(MoveId.USmash,          7, 4, 16, 14,  7,  80, 82),
    [MoveId.DSmash]:         m(MoveId.DSmash,          6, 3, 16, 13,  6,  75, 28),
    [MoveId.NAir]:           m(MoveId.NAir,            4, 5,  8,  8,  3,  35, 50, true),
    [MoveId.FAir]:           m(MoveId.FAir,            5, 3, 10, 10,  5,  55, 45, true),
    [MoveId.BAir]:           m(MoveId.BAir,            6, 3, 12, 11,  6,  60, 38, true),
    [MoveId.UAir]:           m(MoveId.UAir,            4, 4, 10,  9,  4,  50, 78, true),
    [MoveId.DAir]:           m(MoveId.DAir,            7, 3, 14, 12,  5,  65, 270, true),
    [MoveId.NeutralSpecial]: m(MoveId.NeutralSpecial,  8, 3, 16, 11,  6,  60, 50),
    [MoveId.SideSpecial]:    m(MoveId.SideSpecial,     6, 5, 14, 10,  5,  55, 35),
    [MoveId.UpSpecial]:      m(MoveId.UpSpecial,       4, 7, 20,  8,  4,  60, 82, true),
    [MoveId.DownSpecial]:    m(MoveId.DownSpecial,     6, 4, 16,  9,  5,  50, 58),
    [MoveId.GrabPummel]:     m(MoveId.GrabPummel,      3, 1, 10,  2,  0,   0,  0),
    [MoveId.FThrow]:         m(MoveId.FThrow,          5, 2, 14,  8,  5,  55, 45),
    [MoveId.BThrow]:         m(MoveId.BThrow,          6, 2, 16,  9,  6,  60, 135),
    [MoveId.UThrow]:         m(MoveId.UThrow,          5, 2, 14,  7,  5,  65, 90),
    [MoveId.DThrow]:         m(MoveId.DThrow,          4, 2, 12,  6,  3,  45, 72),
    [MoveId.LedgeAttack]:    m(MoveId.LedgeAttack,    14, 4, 18,  8,  4,  50, 40),
    [MoveId.GetUpAttack]:    m(MoveId.GetUpAttack,    12, 4, 16,  7,  4,  45, 45),
  };
}

export const VOLT: FighterData = {
  id: 'volt',
  name: 'Volt',
  weight: 82,
  walkSpeed: 2.5,
  runSpeed: 4.8,
  initialDashSpeed: 5.8,
  jumpForce: 12.5,
  shortHopForce: 8,
  doubleJumpForce: 11.5,
  airSpeed: 3.8,
  airAcceleration: 0.7,
  fallSpeed: 7.0,
  fastFallSpeed: 11.5,
  gravity: 0.9,
  shieldHealthMax: 90,
  width: 26,
  height: 46,
  color: '#ffee00',
  accentColor: '#ffaa00',
  moves: createVoltMoveSet(),
};

// ---- TIDE - "The Depth Caller" (water grappler) ----
// Grappler: powerful throws (especially back throw). Moderate speed, good edgeguarding.

function createTideMoveSet(): MoveSet {
  return {
    [MoveId.Jab]:            m(MoveId.Jab,            5, 3, 10,  4,  3,  25, 58),
    [MoveId.DashAttack]:     m(MoveId.DashAttack,     8, 4, 16, 10,  6,  55, 44),
    [MoveId.FTilt]:          m(MoveId.FTilt,           6, 3, 14,  8,  5,  55, 40),
    [MoveId.UTilt]:          m(MoveId.UTilt,           6, 4, 12,  7,  4,  55, 86),
    [MoveId.DTilt]:          m(MoveId.DTilt,           5, 3, 10,  6,  3,  45, 72),
    [MoveId.FSmash]:         m(MoveId.FSmash,         14, 3, 24, 16,  7,  82, 40),
    [MoveId.USmash]:         m(MoveId.USmash,         12, 4, 22, 14,  6,  78, 82),
    [MoveId.DSmash]:         m(MoveId.DSmash,         10, 4, 20, 13,  6,  75, 28),
    [MoveId.NAir]:           m(MoveId.NAir,            6, 5, 10,  7,  3,  38, 52, true),
    [MoveId.FAir]:           m(MoveId.FAir,            7, 3, 14,  9,  4,  50, 44, true),
    [MoveId.BAir]:           m(MoveId.BAir,            8, 3, 16, 10,  5,  55, 38, true),
    [MoveId.UAir]:           m(MoveId.UAir,            6, 4, 12,  8,  3,  45, 76, true),
    [MoveId.DAir]:           m(MoveId.DAir,           10, 4, 18, 11,  5,  60, 270, true),
    [MoveId.NeutralSpecial]: m(MoveId.NeutralSpecial, 12, 4, 20, 10,  5,  55, 50),
    [MoveId.SideSpecial]:    m(MoveId.SideSpecial,     8, 6, 16,  9,  4,  48, 38),
    [MoveId.UpSpecial]:      m(MoveId.UpSpecial,       7, 7, 24, 10,  5,  65, 82, true),
    [MoveId.DownSpecial]:    m(MoveId.DownSpecial,     9, 4, 20, 11,  6,  52, 55),
    [MoveId.GrabPummel]:     m(MoveId.GrabPummel,      3, 2, 10,  2,  0,   0,  0),
    [MoveId.FThrow]:         m(MoveId.FThrow,          7, 2, 16, 12,  7,  68, 42),
    [MoveId.BThrow]:         m(MoveId.BThrow,          8, 2, 18, 14,  8,  80, 30),
    [MoveId.UThrow]:         m(MoveId.UThrow,          7, 2, 16, 11,  7,  75, 90),
    [MoveId.DThrow]:         m(MoveId.DThrow,          5, 2, 14,  9,  5,  50, 68),
    [MoveId.LedgeAttack]:    m(MoveId.LedgeAttack,    16, 4, 20,  9,  5,  52, 40),
    [MoveId.GetUpAttack]:    m(MoveId.GetUpAttack,    14, 4, 18,  8,  4,  48, 45),
  };
}

export const TIDE: FighterData = {
  id: 'tide',
  name: 'Tide',
  weight: 98,
  walkSpeed: 2.0,
  runSpeed: 3.2,
  initialDashSpeed: 4.0,
  jumpForce: 11.8,
  shortHopForce: 7.2,
  doubleJumpForce: 10.8,
  airSpeed: 3.0,
  airAcceleration: 0.55,
  fallSpeed: 7.5,
  fastFallSpeed: 12,
  gravity: 1.0,
  shieldHealthMax: 100,
  width: 34,
  height: 52,
  color: '#0066ff',
  accentColor: '#0044cc',
  moves: createTideMoveSet(),
};

// ---- NOVA - "The Cosmic Wanderer" (all-rounder) ----
// Balanced: moderate everything. Good variety of kill moves. Jack of all trades.

function createNovaMoveSet(): MoveSet {
  return {
    [MoveId.Jab]:            m(MoveId.Jab,            4, 2,  9,  4,  3,  25, 60),
    [MoveId.DashAttack]:     m(MoveId.DashAttack,     7, 4, 14,  9,  6,  52, 46),
    [MoveId.FTilt]:          m(MoveId.FTilt,           5, 3, 12,  8,  4,  58, 42),
    [MoveId.UTilt]:          m(MoveId.UTilt,           5, 4, 12,  7,  4,  60, 88),
    [MoveId.DTilt]:          m(MoveId.DTilt,           4, 3, 10,  6,  3,  42, 72),
    [MoveId.FSmash]:         m(MoveId.FSmash,         12, 3, 22, 15,  7,  85, 40),
    [MoveId.USmash]:         m(MoveId.USmash,         10, 4, 20, 13,  6,  80, 82),
    [MoveId.DSmash]:         m(MoveId.DSmash,          9, 3, 18, 12,  6,  75, 30),
    [MoveId.NAir]:           m(MoveId.NAir,            5, 5, 10,  7,  3,  38, 50, true),
    [MoveId.FAir]:           m(MoveId.FAir,            6, 3, 12, 10,  5,  55, 45, true),
    [MoveId.BAir]:           m(MoveId.BAir,            7, 3, 14, 11,  5,  60, 40, true),
    [MoveId.UAir]:           m(MoveId.UAir,            5, 4, 12,  8,  4,  50, 78, true),
    [MoveId.DAir]:           m(MoveId.DAir,            9, 3, 16, 12,  5,  65, 270, true),
    [MoveId.NeutralSpecial]: m(MoveId.NeutralSpecial, 10, 4, 18, 10,  5,  58, 48),
    [MoveId.SideSpecial]:    m(MoveId.SideSpecial,     8, 5, 16, 11,  6,  62, 35),
    [MoveId.UpSpecial]:      m(MoveId.UpSpecial,       6, 7, 22, 10,  5,  68, 82, true),
    [MoveId.DownSpecial]:    m(MoveId.DownSpecial,     8, 4, 18, 10,  5,  55, 58),
    [MoveId.GrabPummel]:     m(MoveId.GrabPummel,      3, 1, 10,  2,  0,   0,  0),
    [MoveId.FThrow]:         m(MoveId.FThrow,          6, 2, 16,  9,  5,  60, 45),
    [MoveId.BThrow]:         m(MoveId.BThrow,          8, 2, 18, 10,  7,  65, 135),
    [MoveId.UThrow]:         m(MoveId.UThrow,          6, 2, 16,  8,  6,  70, 90),
    [MoveId.DThrow]:         m(MoveId.DThrow,          5, 2, 14,  7,  4,  48, 70),
    [MoveId.LedgeAttack]:    m(MoveId.LedgeAttack,    16, 4, 20,  8,  4,  50, 40),
    [MoveId.GetUpAttack]:    m(MoveId.GetUpAttack,    14, 4, 18,  7,  4,  45, 45),
  };
}

export const NOVA: FighterData = {
  id: 'nova',
  name: 'Nova',
  weight: 95,
  walkSpeed: 2.2,
  runSpeed: 4.0,
  initialDashSpeed: 5.0,
  jumpForce: 12,
  shortHopForce: 7.5,
  doubleJumpForce: 11,
  airSpeed: 3.5,
  airAcceleration: 0.6,
  fallSpeed: 7.5,
  fastFallSpeed: 12,
  gravity: 1.0,
  shieldHealthMax: 100,
  width: 28,
  height: 48,
  color: '#aa44ff',
  accentColor: '#8822dd',
  moves: createNovaMoveSet(),
};

// --- Character Registry ---

export const CHARACTERS: Record<string, FighterData> = {
  blaze: BLAZE,
  zephyr: ZEPHYR,
  granite: GRANITE,
  volt: VOLT,
  tide: TIDE,
  nova: NOVA,
};

export function getCharacter(id: string): FighterData {
  return CHARACTERS[id] ?? NOVA;
}
