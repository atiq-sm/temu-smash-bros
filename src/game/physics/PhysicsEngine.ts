// ============================================================================
// Temu Smash Bros - Physics Engine
// ============================================================================

import {
  Vector2D,
  Rectangle,
  PlayerData,
  PlayerState,
  StageData,
  Platform,
  Facing,
  GameSystem,
} from '../core/types';

// --- Physics Constants ---

const DEFAULT_GRAVITY = 0.58;
const GROUND_FRICTION = 0.85;        // velocity multiplier per frame on ground
const AIR_FRICTION = 0.99;           // very slight air drag
const FAST_FALL_MULTIPLIER = 1.6;    // fast fall speed = fallSpeed * this
const PLATFORM_DROP_FRAMES = 8;      // frames to ignore platform after drop-through
const LEDGE_GRAB_RANGE_X = 16;
const LEDGE_GRAB_RANGE_Y = 20;
const TECH_BOUNCE_SPEED = -3;        // vertical speed when teching off ground

// ============================================================================
// PhysicsEngine
// ============================================================================

export class PhysicsEngine implements GameSystem {
  private stage!: StageData;
  private players: PlayerData[] = [];

  setStage(stage: StageData): void {
    this.stage = stage;
  }

  setPlayers(players: PlayerData[]): void {
    this.players = players;
  }

  update(_deltaFrame: number): void {
    for (const player of this.players) {
      if (player.state === PlayerState.Dead || player.state === PlayerState.Respawning) {
        continue;
      }

      // Skip physics during hitlag
      if (player.hitlag > 0) {
        player.hitlag--;
        continue;
      }

      this.applyGravity(player);
      this.applyFriction(player);
      this.applyVelocity(player);
      this.updateECB(player);
      this.handlePlatformCollisions(player);
      this.handleBlastZones(player);
      this.handleLedgeDetection(player);
    }
  }

  reset(): void {
    // Reset is handled by setting new player/stage references
  }

  // =========================================================================
  // Gravity
  // =========================================================================

  private applyGravity(player: PlayerData): void {
    if (player.isGrounded) return;

    // Don't apply gravity during certain states
    if (
      player.state === PlayerState.LedgeHang ||
      player.state === PlayerState.Grabbing ||
      player.state === PlayerState.Grabbed
    ) {
      return;
    }

    const gravity = DEFAULT_GRAVITY;
    player.velocity.y += gravity;

    // Cap fall speed
    const maxFall = player.isFastFalling
      ? this.getFastFallSpeed(player)
      : this.getFallSpeed(player);

    if (player.velocity.y > maxFall) {
      player.velocity.y = maxFall;
    }
  }

  /** Check if player can fast-fall and initiate it */
  tryFastFall(player: PlayerData): boolean {
    if (
      !player.isGrounded &&
      player.velocity.y > 0 &&
      player.canFastFall &&
      !player.isFastFalling
    ) {
      player.isFastFalling = true;
      player.velocity.y = this.getFastFallSpeed(player);
      return true;
    }
    return false;
  }

  private getFallSpeed(player: PlayerData): number {
    // Base fall speed; could look up from character data
    // Using a default; the GameEngine will set this from FighterData
    return (player as PlayerDataWithFallSpeed).fallSpeed ?? 7.5;
  }

  private getFastFallSpeed(player: PlayerData): number {
    return (this.getFallSpeed(player) * FAST_FALL_MULTIPLIER);
  }

  // =========================================================================
  // Friction
  // =========================================================================

  private applyFriction(player: PlayerData): void {
    if (player.isGrounded) {
      // Ground friction
      if (
        player.state === PlayerState.Idle ||
        player.state === PlayerState.Landing ||
        player.state === PlayerState.RunBrake ||
        player.state === PlayerState.Crouching
      ) {
        player.velocity.x *= GROUND_FRICTION;
        if (Math.abs(player.velocity.x) < 0.1) {
          player.velocity.x = 0;
        }
      }
    } else {
      // Minimal air friction
      player.velocity.x *= AIR_FRICTION;
    }
  }

  // =========================================================================
  // Velocity Application
  // =========================================================================

  private applyVelocity(player: PlayerData): void {
    // Apply knockback velocity on top of regular velocity
    if (player.state === PlayerState.Hitstun || player.state === PlayerState.Tumble) {
      player.position.x += player.knockbackVelocity.x;
      player.position.y += player.knockbackVelocity.y;

      // Decay knockback
      player.knockbackVelocity.x *= 0.95;
      player.knockbackVelocity.y *= 0.95;
    } else {
      player.position.x += player.velocity.x;
      player.position.y += player.velocity.y;
    }
  }

  // =========================================================================
  // ECB (Environment Collision Box)
  // =========================================================================

  private updateECB(player: PlayerData): void {
    // ECB is centered on the player, represents their collision shape
    const w = 24;  // default ECB width
    const h = 48;  // default ECB height
    player.ecb = {
      x: player.position.x - w / 2,
      y: player.position.y - h,
      width: w,
      height: h,
    };
  }

  // =========================================================================
  // Platform Collisions
  // =========================================================================

  private handlePlatformCollisions(player: PlayerData): void {
    // Decrement platform drop timer
    if (player.platformDropFrames > 0) {
      player.platformDropFrames--;
    }

    let landedOnPlatform = false;
    const ecb = player.ecb;
    const feetY = ecb.y + ecb.height; // bottom of ECB
    const prevFeetY = feetY - player.velocity.y; // where feet were last frame

    for (let i = 0; i < this.stage.platforms.length; i++) {
      const plat = this.stage.platforms[i];
      const platTop = plat.y;
      const platLeft = plat.x;
      const platRight = plat.x + plat.width;

      // Check horizontal overlap
      const playerCenterX = player.position.x;
      const halfECBWidth = ecb.width / 2;
      if (playerCenterX + halfECBWidth < platLeft || playerCenterX - halfECBWidth > platRight) {
        continue;
      }

      if (plat.isPassthrough) {
        // Pass-through platforms: only collide from above
        if (player.platformDropFrames > 0) continue;
        if (player.velocity.y < 0) continue; // moving upward

        // Check if feet crossed the platform surface this frame
        if (prevFeetY <= platTop && feetY >= platTop) {
          this.landOnPlatform(player, plat, i, platTop);
          landedOnPlatform = true;
          break;
        }

        // If already grounded on this platform, stay grounded
        if (player.isGrounded && player.currentPlatformIndex === i) {
          player.position.y = platTop;
          player.velocity.y = 0;
          landedOnPlatform = true;
        }
      } else {
        // Solid platforms: collide from all sides
        const platBottom = platTop + 16; // solid platform thickness

        // Top collision (landing)
        if (prevFeetY <= platTop && feetY >= platTop && player.velocity.y >= 0) {
          this.landOnPlatform(player, plat, i, platTop);
          landedOnPlatform = true;
          break;
        }

        // Already standing on it
        if (player.isGrounded && player.currentPlatformIndex === i) {
          player.position.y = platTop;
          player.velocity.y = 0;
          landedOnPlatform = true;
        }

        // Bottom collision (head bonk)
        const headY = ecb.y;
        const prevHeadY = headY - player.velocity.y;
        if (prevHeadY >= platBottom && headY < platBottom && player.velocity.y < 0) {
          player.position.y = platBottom + ecb.height;
          player.velocity.y = 0;
        }

        // Side collisions (walls)
        if (feetY > platTop && ecb.y < platBottom) {
          // Left wall
          if (
            playerCenterX + halfECBWidth > platLeft &&
            playerCenterX < platLeft &&
            player.velocity.x > 0
          ) {
            player.position.x = platLeft - halfECBWidth;
            player.velocity.x = 0;
          }
          // Right wall
          if (
            playerCenterX - halfECBWidth < platRight &&
            playerCenterX > platRight &&
            player.velocity.x < 0
          ) {
            player.position.x = platRight + halfECBWidth;
            player.velocity.x = 0;
          }
        }
      }
    }

    // If was grounded but no longer on any platform, become airborne
    if (player.isGrounded && !landedOnPlatform) {
      // Check if still standing on current platform
      if (player.currentPlatformIndex >= 0) {
        const plat = this.stage.platforms[player.currentPlatformIndex];
        const platLeft = plat.x;
        const platRight = plat.x + plat.width;
        const halfW = ecb.width / 2;
        if (
          player.position.x + halfW < platLeft ||
          player.position.x - halfW > platRight
        ) {
          // Walked off edge
          this.becomeAirborne(player);
        } else {
          // Still on platform
          player.position.y = plat.y;
          player.velocity.y = 0;
        }
      } else {
        this.becomeAirborne(player);
      }
    }
  }

  private landOnPlatform(player: PlayerData, _plat: Platform, index: number, platTop: number): void {
    const wasAirborne = !player.isGrounded;

    player.position.y = platTop;
    player.velocity.y = 0;
    player.isGrounded = true;
    player.currentPlatformIndex = index;
    player.isFastFalling = false;
    player.canFastFall = false;
    player.jumpsUsed = 0;
    player.hasAirdodge = true;

    if (wasAirborne) {
      // Trigger landing state transition (handled by Fighter class)
      if (
        player.state === PlayerState.Jumping ||
        player.state === PlayerState.Falling ||
        player.state === PlayerState.FastFalling
      ) {
        player.state = PlayerState.Landing;
        player.stateFrame = 0;
      }

      // Tech check: if in tumble and tech window is active, tech
      if (
        player.state === PlayerState.Tumble &&
        player.techWindow > 0
      ) {
        player.state = PlayerState.Teching;
        player.stateFrame = 0;
        player.invincibleFrames = 20;
        player.velocity.x = 0;
        player.knockbackVelocity = { x: 0, y: 0 };
      } else if (player.state === PlayerState.Tumble) {
        // Bounce off ground (missed tech)
        player.velocity.y = TECH_BOUNCE_SPEED;
        player.isGrounded = false;
        player.currentPlatformIndex = -1;
      }
    }
  }

  private becomeAirborne(player: PlayerData): void {
    player.isGrounded = false;
    player.currentPlatformIndex = -1;
    player.canFastFall = true;

    if (player.state === PlayerState.Idle || player.state === PlayerState.Walking || player.state === PlayerState.Running) {
      player.state = PlayerState.Falling;
      player.stateFrame = 0;
      // Coyote time: keep one jump if walking off
      if (player.jumpsUsed === 0) {
        player.jumpsUsed = 1; // used up the "ground" jump
      }
    }
  }

  /** Drop through a pass-through platform */
  tryDropThrough(player: PlayerData): boolean {
    if (!player.isGrounded) return false;
    if (player.currentPlatformIndex < 0) return false;

    const plat = this.stage.platforms[player.currentPlatformIndex];
    if (!plat.isPassthrough) return false;

    player.platformDropFrames = PLATFORM_DROP_FRAMES;
    player.isGrounded = false;
    player.currentPlatformIndex = -1;
    player.canFastFall = true;
    player.state = PlayerState.Falling;
    player.stateFrame = 0;
    return true;
  }

  // =========================================================================
  // Blast Zones
  // =========================================================================

  private handleBlastZones(player: PlayerData): void {
    const bz = this.stage.blastZones;
    const pos = player.position;

    if (pos.x < bz.left || pos.x > bz.right || pos.y < bz.top || pos.y > bz.bottom) {
      // Player KO'd
      player.state = PlayerState.Dead;
      player.stateFrame = 0;
      player.stocks--;
      player.velocity = { x: 0, y: 0 };
      player.knockbackVelocity = { x: 0, y: 0 };
    }
  }

  // =========================================================================
  // Ledge Detection
  // =========================================================================

  private handleLedgeDetection(player: PlayerData): void {
    // Only grab ledge when airborne, falling, in helpless, or in tumble
    if (player.isGrounded) return;
    if (player.state === PlayerState.LedgeHang) return;
    if (player.velocity.y < 0) return; // must be falling

    // Must not be in certain states
    if (
      player.state === PlayerState.Dodging ||
      player.state === PlayerState.Dead ||
      player.state === PlayerState.Respawning
    ) {
      return;
    }

    for (const ledge of this.stage.ledges) {
      if (ledge.occupied) continue;

      // Must be facing the ledge
      if (ledge.side === 'left' && player.facing !== Facing.Right) continue;
      if (ledge.side === 'right' && player.facing !== Facing.Left) continue;

      const dx = Math.abs(player.position.x - ledge.x);
      const dy = player.position.y - ledge.y; // positive = below ledge

      if (dx < LEDGE_GRAB_RANGE_X && dy > 0 && dy < LEDGE_GRAB_RANGE_Y) {
        // Snap to ledge
        player.position.x = ledge.x + (ledge.side === 'left' ? LEDGE_GRAB_RANGE_X / 2 : -LEDGE_GRAB_RANGE_X / 2);
        player.position.y = ledge.y;
        player.velocity = { x: 0, y: 0 };
        player.knockbackVelocity = { x: 0, y: 0 };
        player.state = PlayerState.LedgeHang;
        player.stateFrame = 0;
        player.jumpsUsed = 0;
        player.hasAirdodge = true;
        player.isFastFalling = false;
        player.invincibleFrames = 12; // brief ledge invincibility

        ledge.occupied = true;
        ledge.occupiedBy = player.id;
        break;
      }
    }
  }

  /** Release a ledge (called when player leaves ledge) */
  releaseLedge(playerId: number): void {
    for (const ledge of this.stage.ledges) {
      if (ledge.occupiedBy === playerId) {
        ledge.occupied = false;
        ledge.occupiedBy = -1;
      }
    }
  }

  // =========================================================================
  // Movement Helpers (called by Fighter/GameEngine)
  // =========================================================================

  applyMovement(player: PlayerData, speed: number, direction: number): void {
    if (player.isGrounded) {
      player.velocity.x = speed * direction;
    } else {
      // Air drift: accelerate toward direction, capped at air speed
      const airAccel = 0.6;
      const airSpeedMax = speed * 0.8;
      player.velocity.x += airAccel * direction;
      if (Math.abs(player.velocity.x) > airSpeedMax) {
        player.velocity.x = airSpeedMax * Math.sign(player.velocity.x);
      }
    }
  }

  applyJump(player: PlayerData, force: number): void {
    player.velocity.y = -force;
    player.isGrounded = false;
    player.currentPlatformIndex = -1;
    player.canFastFall = true;
    player.isFastFalling = false;
  }

  /** Apply DI (Directional Influence) to knockback */
  applyDI(player: PlayerData, diX: number, diY: number): void {
    if (player.state !== PlayerState.Hitstun && player.state !== PlayerState.Tumble) return;

    const diStrength = 0.15; // max angle change ~15%
    const kbMag = Math.sqrt(
      player.knockbackVelocity.x ** 2 + player.knockbackVelocity.y ** 2,
    );
    if (kbMag < 1) return;

    // Perpendicular DI: rotate the knockback angle
    const angle = Math.atan2(player.knockbackVelocity.y, player.knockbackVelocity.x);
    const perpAngle = angle + Math.PI / 2;
    const diInput = diX * Math.cos(perpAngle) + diY * Math.sin(perpAngle);
    const newAngle = angle + diInput * diStrength;

    player.knockbackVelocity.x = Math.cos(newAngle) * kbMag;
    player.knockbackVelocity.y = Math.sin(newAngle) * kbMag;
  }

  // =========================================================================
  // Collision Queries
  // =========================================================================

  /** Check if a rectangle overlaps with any solid platform */
  rectOverlapsPlatform(rect: Rectangle): boolean {
    for (const plat of this.stage.platforms) {
      if (plat.isPassthrough) continue;
      const platRect: Rectangle = {
        x: plat.x,
        y: plat.y,
        width: plat.width,
        height: 16,
      };
      if (rectsOverlap(rect, platRect)) return true;
    }
    return false;
  }

  /** Get the ground Y at a given X position, or null if no ground */
  getGroundY(x: number): number | null {
    let bestY: number | null = null;
    for (const plat of this.stage.platforms) {
      if (x >= plat.x && x <= plat.x + plat.width) {
        if (bestY === null || plat.y < bestY) {
          bestY = plat.y;
        }
      }
    }
    return bestY;
  }
}

// ============================================================================
// Helpers
// ============================================================================

/** Extend PlayerData with physics properties set from fighter data */
interface PlayerDataWithFallSpeed extends PlayerData {
  fallSpeed?: number;
}

function rectsOverlap(a: Rectangle, b: Rectangle): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

export { rectsOverlap };
