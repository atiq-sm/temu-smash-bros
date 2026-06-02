// ============================================================================
// Cosmic Knockout - Combat System
// ============================================================================

import {
  PlayerData,
  PlayerState,
  Hitbox,
  Hurtbox,
  HitboxType,
  MoveId,
  Vector2D,
  GameSystem,
  GameEventType,
  GameEvent,
} from '../core/types';
import { rectsOverlap } from '../physics/PhysicsEngine';

// --- Constants ---

const SHIELD_DEPLETION_RATE = 0.15;       // per frame while held
const SHIELD_REGEN_RATE = 0.08;           // per frame while not held
const SHIELD_BREAK_STUN_FRAMES = 240;     // 4 seconds at 60fps
const SHIELD_STUN_BASE = 4;               // base frames of shield stun on hit
const SHIELD_DAMAGE_MULTIPLIER = 1.19;    // shield takes extra damage
const STALE_QUEUE_SIZE = 9;
const STALE_NEGATION_PER_ENTRY = 0.09;    // 9% reduction per queue entry
const MIN_STALE_MULTIPLIER = 0.45;        // floor for stale move negation
const GRAB_DURATION_BASE = 90;            // base grab duration frames
const GRAB_MASH_REDUCTION = 1;            // frames reduced per mash input

// ============================================================================
// CombatSystem
// ============================================================================

export class CombatSystem implements GameSystem {
  private players: PlayerData[] = [];
  private events: GameEvent[] = [];
  private currentFrame: number = 0;

  setPlayers(players: PlayerData[]): void {
    this.players = players;
  }

  update(_deltaFrame: number): void {
    this.currentFrame++;
    this.events = [];

    this.processHitboxCollisions();
    this.updateShields();
    this.updateGrabs();
    this.updateHitstun();
  }

  reset(): void {
    this.events = [];
    this.currentFrame = 0;
  }

  /** Get events emitted this frame */
  getEvents(): GameEvent[] {
    return this.events;
  }

  // =========================================================================
  // Hitbox/Hurtbox Collision
  // =========================================================================

  private processHitboxCollisions(): void {
    // Collect all active hitboxes
    const allHitboxes: { player: PlayerData; hitbox: Hitbox }[] = [];
    for (const player of this.players) {
      if (player.hitlag > 0) continue;
      for (const hb of player.activeHitboxes) {
        if (hb.active) {
          allHitboxes.push({ player, hitbox: hb });
        }
      }
    }

    // Check hitbox vs hurtbox
    for (const attacker of allHitboxes) {
      for (const defender of this.players) {
        if (attacker.player.id === defender.id) continue;
        if (defender.state === PlayerState.Dead || defender.state === PlayerState.Respawning) continue;
        if (defender.invincibleFrames > 0) continue;
        if (attacker.hitbox.hitPlayers.includes(defender.id)) continue;

        // Check against all hurtboxes
        for (const hurtbox of defender.hurtboxes) {
          if (hurtbox.intangible || hurtbox.invincible) continue;

          if (this.hitboxOverlapsHurtbox(attacker.hitbox, attacker.player, hurtbox, defender)) {
            // Mark as hit so we don't hit again with same move
            attacker.hitbox.hitPlayers.push(defender.id);

            if (attacker.hitbox.type === HitboxType.Grab) {
              this.processGrab(attacker.player, defender);
            } else if (defender.state === PlayerState.Shielding) {
              this.processShieldHit(attacker.player, attacker.hitbox, defender);
            } else {
              this.processHit(attacker.player, attacker.hitbox, defender);
            }
            break; // only hit once per hurtbox set
          }
        }
      }
    }

    // Check hitbox vs hitbox (clashing)
    for (let i = 0; i < allHitboxes.length; i++) {
      for (let j = i + 1; j < allHitboxes.length; j++) {
        const a = allHitboxes[i];
        const b = allHitboxes[j];
        if (a.player.id === b.player.id) continue;

        if (this.hitboxesOverlap(a.hitbox, a.player, b.hitbox, b.player)) {
          this.processClash(a, b);
        }
      }
    }
  }

  private hitboxOverlapsHurtbox(
    hitbox: Hitbox,
    attacker: PlayerData,
    hurtbox: Hurtbox,
    defender: PlayerData,
  ): boolean {
    // Convert hitbox to world coords
    const hbRect = {
      x: attacker.position.x + hitbox.position.x * attacker.facing - hitbox.size.x / 2,
      y: attacker.position.y + hitbox.position.y - hitbox.size.y / 2,
      width: hitbox.size.x,
      height: hitbox.size.y,
    };

    // Convert hurtbox to world coords
    const hrRect = {
      x: defender.position.x + hurtbox.position.x * defender.facing - hurtbox.size.x / 2,
      y: defender.position.y + hurtbox.position.y - hurtbox.size.y / 2,
      width: hurtbox.size.x,
      height: hurtbox.size.y,
    };

    return rectsOverlap(hbRect, hrRect);
  }

  private hitboxesOverlap(
    hbA: Hitbox,
    playerA: PlayerData,
    hbB: Hitbox,
    playerB: PlayerData,
  ): boolean {
    const rectA = {
      x: playerA.position.x + hbA.position.x * playerA.facing - hbA.size.x / 2,
      y: playerA.position.y + hbA.position.y - hbA.size.y / 2,
      width: hbA.size.x,
      height: hbA.size.y,
    };
    const rectB = {
      x: playerB.position.x + hbB.position.x * playerB.facing - hbB.size.x / 2,
      y: playerB.position.y + hbB.position.y - hbB.size.y / 2,
      width: hbB.size.x,
      height: hbB.size.y,
    };
    return rectsOverlap(rectA, rectB);
  }

  // =========================================================================
  // Damage & Knockback
  // =========================================================================

  private processHit(attacker: PlayerData, hitbox: Hitbox, defender: PlayerData): void {
    // Calculate stale move negation
    const staleMult = this.getStaleMoveMultiplier(attacker, attacker.currentMove);

    // Apply damage
    const damage = hitbox.damage * staleMult;
    defender.damage += damage;
    defender.damage = Math.min(defender.damage, 999);

    // Calculate knockback using the Smash Bros formula
    const knockback = this.calculateKnockback(
      defender.damage,
      damage,
      this.getWeight(defender),
      hitbox.knockbackGrowth,
      hitbox.knockbackBase,
    );

    // Determine knockback angle (in radians)
    let angleRad = (hitbox.angle * Math.PI) / 180;
    // Flip angle horizontally if attacker is facing left
    if (attacker.facing === -1) {
      angleRad = Math.PI - angleRad;
    }

    // Apply knockback
    defender.knockbackVelocity = {
      x: Math.cos(angleRad) * knockback,
      y: -Math.sin(angleRad) * knockback, // negative because y-axis is inverted
    };

    // Calculate hitstun
    const hitstun = Math.floor(knockback * 0.4);
    defender.hitstunFrames = hitstun;

    // Determine state: tumble if knockback is high enough
    if (knockback > 8) {
      defender.state = PlayerState.Tumble;
    } else {
      defender.state = PlayerState.Hitstun;
    }
    defender.stateFrame = 0;
    defender.isGrounded = false;
    defender.currentPlatformIndex = -1;

    // Hitlag (freeze frames): both attacker and defender
    const hitlag = Math.floor(damage / 3) + 3;
    attacker.hitlag = hitlag;
    defender.hitlag = hitlag;

    // Track who hit this player
    defender.lastHitBy = attacker.id;
    defender.comboCount++;

    // Add to stale queue
    if (attacker.currentMove) {
      this.addToStaleQueue(attacker, attacker.currentMove);
    }

    // Emit event
    this.events.push({
      type: GameEventType.Hit,
      frame: this.currentFrame,
      data: {
        attackerId: attacker.id,
        defenderId: defender.id,
        damage,
        knockback,
        position: { ...defender.position },
        hitboxType: hitbox.type,
      },
    });
  }

  /**
   * Knockback formula (Smash Bros style):
   * KB = ((((p/10 + p*d/20) * (200/(w+100)) * 1.4) + 18) * kbg + bkb)
   * where p = defender percentage, d = move damage, w = defender weight
   */
  calculateKnockback(
    percentage: number,
    damage: number,
    weight: number,
    knockbackGrowth: number,
    baseKnockback: number,
  ): number {
    const p = percentage;
    const d = damage;
    const w = weight;
    const ratio = (200 / (w + 100)) * 1.4;
    const scaling = ((p / 10) + (p * d / 20)) * ratio + 18;
    return scaling * (knockbackGrowth / 100) + baseKnockback;
  }

  // =========================================================================
  // Shield
  // =========================================================================

  private processShieldHit(attacker: PlayerData, hitbox: Hitbox, defender: PlayerData): void {
    const shieldDamage = hitbox.damage * SHIELD_DAMAGE_MULTIPLIER;
    defender.shieldHealth -= shieldDamage;

    // Shield stun
    const shieldStun = SHIELD_STUN_BASE + Math.floor(hitbox.damage / 2);
    defender.shieldStun = shieldStun;

    // Attacker gets some hitlag
    attacker.hitlag = Math.floor(hitbox.damage / 4) + 2;

    // Shield pushback
    const pushback = hitbox.damage * 0.15;
    defender.velocity.x = (attacker.facing === 1 ? 1 : -1) * pushback;

    // Check shield break
    if (defender.shieldHealth <= 0) {
      this.processShieldBreak(defender);
    }

    this.events.push({
      type: GameEventType.Shield,
      frame: this.currentFrame,
      data: {
        attackerId: attacker.id,
        defenderId: defender.id,
        damage: shieldDamage,
        shieldHealth: defender.shieldHealth,
      },
    });
  }

  private processShieldBreak(player: PlayerData): void {
    player.state = PlayerState.ShieldBroken;
    player.stateFrame = 0;
    player.shieldHealth = 0;
    player.hitstunFrames = SHIELD_BREAK_STUN_FRAMES;
    player.velocity = { x: 0, y: -12 }; // pop up
    player.isGrounded = false;
    player.currentPlatformIndex = -1;

    this.events.push({
      type: GameEventType.ShieldBreak,
      frame: this.currentFrame,
      data: { playerId: player.id, position: { ...player.position } },
    });
  }

  private updateShields(): void {
    for (const player of this.players) {
      if (player.state === PlayerState.Shielding) {
        player.shieldHealth -= SHIELD_DEPLETION_RATE;
        if (player.shieldHealth <= 0) {
          this.processShieldBreak(player);
        }
      } else if (player.state !== PlayerState.ShieldBroken) {
        // Regenerate shield
        const max = 100; // default max
        if (player.shieldHealth < max) {
          player.shieldHealth = Math.min(max, player.shieldHealth + SHIELD_REGEN_RATE);
        }
      }

      // Decrement shield stun
      if (player.shieldStun > 0) {
        player.shieldStun--;
      }
    }
  }

  // =========================================================================
  // Grabs
  // =========================================================================

  private processGrab(attacker: PlayerData, defender: PlayerData): void {
    // Can only grab certain states
    const grabbableStates: PlayerState[] = [
      PlayerState.Shielding, PlayerState.Idle,
      PlayerState.Walking, PlayerState.Running,
      PlayerState.Crouching,
    ];
    if (grabbableStates.includes(defender.state)) {
      // Cannot grab airborne players
      if (!defender.isGrounded) return;

      attacker.state = PlayerState.Grabbing;
      attacker.stateFrame = 0;
      attacker.grabTarget = defender.id;
      attacker.grabTimer = GRAB_DURATION_BASE - Math.floor(defender.damage);
      attacker.grabTimer = Math.max(30, attacker.grabTimer); // minimum hold

      defender.state = PlayerState.Grabbed;
      defender.stateFrame = 0;
      defender.grabbedBy = attacker.id;

      // Position defender in front of attacker
      defender.position.x = attacker.position.x + attacker.facing * 20;
      defender.velocity = { x: 0, y: 0 };

      this.events.push({
        type: GameEventType.Grab,
        frame: this.currentFrame,
        data: { attackerId: attacker.id, defenderId: defender.id },
      });
    }
  }

  private updateGrabs(): void {
    for (const player of this.players) {
      if (player.state === PlayerState.Grabbing && player.grabTarget >= 0) {
        player.grabTimer--;

        // Keep grabbed player in position
        const target = this.players.find(p => p.id === player.grabTarget);
        if (target && target.state === PlayerState.Grabbed) {
          target.position.x = player.position.x + player.facing * 20;
          target.position.y = player.position.y;
        }

        if (player.grabTimer <= 0) {
          this.releaseGrab(player);
        }
      }
    }
  }

  /** Execute a throw */
  executeThrow(
    thrower: PlayerData,
    moveId: MoveId,
    damage: number,
    angle: number,
    baseKnockback: number,
    knockbackGrowth: number,
  ): void {
    const target = this.players.find(p => p.id === thrower.grabTarget);
    if (!target) return;

    // Apply damage
    target.damage += damage;
    target.damage = Math.min(target.damage, 999);

    // Calculate and apply knockback
    const knockback = this.calculateKnockback(
      target.damage,
      damage,
      this.getWeight(target),
      knockbackGrowth,
      baseKnockback,
    );

    let angleRad = (angle * Math.PI) / 180;
    if (thrower.facing === -1) {
      angleRad = Math.PI - angleRad;
    }

    target.knockbackVelocity = {
      x: Math.cos(angleRad) * knockback,
      y: -Math.sin(angleRad) * knockback,
    };

    const hitstun = Math.floor(knockback * 0.4);
    target.hitstunFrames = hitstun;
    target.state = knockback > 8 ? PlayerState.Tumble : PlayerState.Hitstun;
    target.stateFrame = 0;
    target.isGrounded = false;
    target.currentPlatformIndex = -1;
    target.grabbedBy = -1;
    target.lastHitBy = thrower.id;

    thrower.state = PlayerState.Throwing;
    thrower.stateFrame = 0;
    thrower.grabTarget = -1;

    this.addToStaleQueue(thrower, moveId);

    this.events.push({
      type: GameEventType.Throw,
      frame: this.currentFrame,
      data: {
        throwerId: thrower.id,
        targetId: target.id,
        moveId,
        knockback,
      },
    });
  }

  /** Release grab without throwing */
  releaseGrab(player: PlayerData): void {
    const target = this.players.find(p => p.id === player.grabTarget);
    if (target && target.state === PlayerState.Grabbed) {
      target.state = PlayerState.Idle;
      target.stateFrame = 0;
      target.grabbedBy = -1;
    }
    player.grabTarget = -1;
    player.state = PlayerState.Idle;
    player.stateFrame = 0;
  }

  /** Grabbed player mashes to escape (call each frame they press a button) */
  mashGrab(player: PlayerData): void {
    const grabber = this.players.find(p => p.id === player.grabbedBy);
    if (grabber && grabber.state === PlayerState.Grabbing) {
      grabber.grabTimer -= GRAB_MASH_REDUCTION;
    }
  }

  // =========================================================================
  // Hitstun
  // =========================================================================

  private updateHitstun(): void {
    for (const player of this.players) {
      if (player.hitstunFrames > 0) {
        player.hitstunFrames--;
        if (player.hitstunFrames <= 0) {
          if (player.state === PlayerState.Hitstun) {
            player.state = player.isGrounded ? PlayerState.Idle : PlayerState.Falling;
            player.stateFrame = 0;
            player.comboCount = 0;
          }
          // Tumble doesn't automatically end - player must act out of it
        }
      }

      // Invincibility countdown
      if (player.invincibleFrames > 0) {
        player.invincibleFrames--;
      }
      if (player.intangibleFrames > 0) {
        player.intangibleFrames--;
      }

      // Tech window countdown
      if (player.techWindow > 0) {
        player.techWindow--;
      }
    }
  }

  // =========================================================================
  // Clash System
  // =========================================================================

  private processClash(
    a: { player: PlayerData; hitbox: Hitbox },
    b: { player: PlayerData; hitbox: Hitbox },
  ): void {
    // Higher priority wins; if equal, both clank
    if (a.hitbox.priority > b.hitbox.priority) {
      // A wins, B gets cancelled
      b.hitbox.active = false;
    } else if (b.hitbox.priority > a.hitbox.priority) {
      a.hitbox.active = false;
    } else {
      // Equal priority: both get cancelled (clank)
      a.hitbox.active = false;
      b.hitbox.active = false;
      // Small recoil for both
      a.player.hitlag = 5;
      b.player.hitlag = 5;
    }
  }

  // =========================================================================
  // Stale Move Negation
  // =========================================================================

  private addToStaleQueue(player: PlayerData, move: MoveId): void {
    player.staleQueue.push(move);
    if (player.staleQueue.length > STALE_QUEUE_SIZE) {
      player.staleQueue.shift();
    }
  }

  private getStaleMoveMultiplier(player: PlayerData, move: MoveId | null): number {
    if (!move) return 1;
    let staleCount = 0;
    for (const queuedMove of player.staleQueue) {
      if (queuedMove === move) staleCount++;
    }
    const multiplier = 1 - staleCount * STALE_NEGATION_PER_ENTRY;
    return Math.max(MIN_STALE_MULTIPLIER, multiplier);
  }

  // =========================================================================
  // Utilities
  // =========================================================================

  private getWeight(player: PlayerData): number {
    // Default weight; in practice, this is looked up from FighterData
    return (player as PlayerDataWithWeight).weight ?? 100;
  }
}

interface PlayerDataWithWeight extends PlayerData {
  weight?: number;
}
