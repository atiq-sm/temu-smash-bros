// ============================================================================
// Temu Smash Bros - AI Controller
// ============================================================================

import {
  InputState,
  PlayerData,
  PlayerState,
  StageData,
  Facing,
  Vector2D,
} from '../core/types';

// --- AI Constants ---

const REACTION_FRAMES_BY_LEVEL: Record<number, number> = {
  1: 30,  // 0.5 seconds
  2: 25,
  3: 20,
  4: 16,
  5: 12,
  6: 9,
  7: 6,
  8: 4,
  9: 2,   // near-perfect reactions
};

const ATTACK_PROBABILITY_BY_LEVEL: Record<number, number> = {
  1: 0.02,
  2: 0.04,
  3: 0.06,
  4: 0.08,
  5: 0.12,
  6: 0.16,
  7: 0.22,
  8: 0.30,
  9: 0.40,
};

const SHIELD_PROBABILITY_BY_LEVEL: Record<number, number> = {
  1: 0.01,
  2: 0.02,
  3: 0.04,
  4: 0.06,
  5: 0.10,
  6: 0.14,
  7: 0.18,
  8: 0.24,
  9: 0.32,
};

// ============================================================================
// AIBehavior enum
// ============================================================================

enum AIBehavior {
  Approach = 'approach',
  Attack = 'attack',
  Recover = 'recover',
  Defend = 'defend',
  Retreat = 'retreat',
  EdgeGuard = 'edge_guard',
  Idle = 'idle',
}

// ============================================================================
// AIController
// ============================================================================

export class AIController {
  private playerId: number;
  private level: number; // 1-9
  private behavior: AIBehavior = AIBehavior.Idle;
  private behaviorTimer: number = 0;
  private reactionTimer: number = 0;
  private lastKnownTargetPos: Vector2D = { x: 0, y: 0 };
  private targetId: number = -1;
  private actionCooldown: number = 0;
  private comboAttempt: boolean = false;
  private recoveryAttempted: boolean = false;

  constructor(playerId: number, level: number) {
    this.playerId = playerId;
    this.level = Math.max(1, Math.min(9, level));
  }

  /** Generate input for this frame */
  generateInput(
    self: PlayerData,
    opponents: PlayerData[],
    stage: StageData,
  ): InputState {
    const input = emptyInput();

    // Dead or respawning: no input
    if (self.state === PlayerState.Dead || self.state === PlayerState.Respawning) {
      return input;
    }

    // Handle hitlag - no new inputs
    if (self.hitlag > 0) return input;

    // Update reaction timer
    if (this.reactionTimer > 0) {
      this.reactionTimer--;
      return input;
    }

    // Find closest alive opponent
    const target = this.findTarget(self, opponents);
    if (!target) return input;
    this.targetId = target.id;
    this.lastKnownTargetPos = { ...target.position };

    // Decide behavior
    this.decideBehavior(self, target, stage);

    // Cooldown
    if (this.actionCooldown > 0) {
      this.actionCooldown--;
    }

    // Execute behavior
    switch (this.behavior) {
      case AIBehavior.Approach:
        this.executeApproach(input, self, target);
        break;
      case AIBehavior.Attack:
        this.executeAttack(input, self, target);
        break;
      case AIBehavior.Recover:
        this.executeRecover(input, self, stage);
        break;
      case AIBehavior.Defend:
        this.executeDefend(input, self, target);
        break;
      case AIBehavior.Retreat:
        this.executeRetreat(input, self, target, stage);
        break;
      case AIBehavior.EdgeGuard:
        this.executeEdgeGuard(input, self, target, stage);
        break;
      case AIBehavior.Idle:
        break;
    }

    // DI when in hitstun/tumble (all levels attempt, higher levels are more optimal)
    if (self.state === PlayerState.Hitstun || self.state === PlayerState.Tumble) {
      this.applyDI(input, self);
    }

    // Tech attempts (higher levels more consistent)
    if (self.state === PlayerState.Tumble && this.shouldTech()) {
      input.shield = true;
    }

    // Mash out of grabs
    if (self.state === PlayerState.Grabbed) {
      this.mashOut(input);
    }

    return input;
  }

  // =========================================================================
  // Behavior Decision
  // =========================================================================

  private decideBehavior(self: PlayerData, target: PlayerData, stage: StageData): void {
    this.behaviorTimer--;

    if (this.behaviorTimer > 0 && this.behavior !== AIBehavior.Idle) {
      return; // continue current behavior
    }

    const dx = target.position.x - self.position.x;
    const dy = target.position.y - self.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Priority 1: Recovery (if off-stage)
    if (!self.isGrounded && self.position.y > stage.platforms[0].y + 30) {
      const onStage = self.position.x > stage.platforms[0].x &&
                       self.position.x < stage.platforms[0].x + stage.platforms[0].width;
      if (!onStage || self.position.y > stage.blastZones.bottom - 80) {
        this.behavior = AIBehavior.Recover;
        this.behaviorTimer = 10;
        return;
      }
    }

    // Priority 2: Edge guard (opponent off-stage and we're on-stage)
    if (self.isGrounded && !target.isGrounded && this.level >= 5) {
      const targetOnStage = target.position.x > stage.platforms[0].x &&
                             target.position.x < stage.platforms[0].x + stage.platforms[0].width;
      if (!targetOnStage && target.position.y > stage.platforms[0].y) {
        this.behavior = AIBehavior.EdgeGuard;
        this.behaviorTimer = 20;
        return;
      }
    }

    // Priority 3: Defend if being attacked
    if (target.state === PlayerState.Attacking && dist < 80) {
      if (Math.random() < SHIELD_PROBABILITY_BY_LEVEL[this.level]) {
        this.behavior = AIBehavior.Defend;
        this.behaviorTimer = 15;
        this.reactionTimer = Math.floor(REACTION_FRAMES_BY_LEVEL[this.level] * 0.5);
        return;
      }
    }

    // Priority 4: Retreat at high damage
    if (self.damage > 120 && dist < 60 && this.level >= 4) {
      this.behavior = AIBehavior.Retreat;
      this.behaviorTimer = 30;
      return;
    }

    // Priority 5: Attack if close enough
    if (dist < 100) {
      this.behavior = AIBehavior.Attack;
      this.behaviorTimer = 10 + Math.floor(Math.random() * 15);
      return;
    }

    // Default: Approach
    this.behavior = AIBehavior.Approach;
    this.behaviorTimer = 15 + Math.floor(Math.random() * 20);
  }

  // =========================================================================
  // Behavior Execution
  // =========================================================================

  private executeApproach(input: InputState, self: PlayerData, target: PlayerData): void {
    const dx = target.position.x - self.position.x;
    const dy = target.position.y - self.position.y;
    const absDx = Math.abs(dx);

    // Move toward target
    if (dx > 15) {
      input.right = true;
    } else if (dx < -15) {
      input.left = true;
    }

    // Jump if target is above or to get over obstacles
    if (dy < -50 && self.isGrounded) {
      input.jump = true;
    }

    // Short hop approach (higher levels)
    if (absDx < 150 && absDx > 60 && self.isGrounded && this.level >= 6 && Math.random() < 0.15) {
      input.jump = true;
    }

    // Dash approach (higher levels)
    if (absDx > 80 && self.isGrounded && this.level >= 3) {
      // Already pressing direction = running
    }

    // Transition to attack when close
    if (absDx < 60 && this.actionCooldown <= 0) {
      input.attack = true;
      this.actionCooldown = 10 + Math.floor(Math.random() * 10);
    }
  }

  private executeAttack(input: InputState, self: PlayerData, target: PlayerData): void {
    const dx = target.position.x - self.position.x;
    const dy = target.position.y - self.position.y;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    if (this.actionCooldown > 0) return;

    const attackChance = ATTACK_PROBABILITY_BY_LEVEL[this.level];

    // Face the target
    if (dx > 0) input.right = true;
    else if (dx < 0) input.left = true;

    if (!self.isGrounded) {
      // Aerial attacks
      if (Math.random() < attackChance) {
        if (dy > 20) {
          // Target below -> dair
          input.down = true;
          input.attack = true;
        } else if (dy < -20) {
          // Target above -> uair
          input.up = true;
          input.attack = true;
        } else if (absDx < 40) {
          // Close -> nair
          input.attack = true;
        } else {
          // Forward air
          input.attack = true;
        }
        this.actionCooldown = 8;
      }
    } else {
      // Grounded attacks
      if (Math.random() < attackChance) {
        if (target.damage > 80 && absDx < 50 && this.level >= 5) {
          // Go for smash attack at kill percent
          const smashDir = Math.random();
          if (dy < -30) {
            input.up = true;
            input.attack = true;
          } else if (smashDir < 0.6) {
            // Forward smash
            if (dx > 0) input.right = true;
            else input.left = true;
            input.attack = true;
          } else {
            input.up = true;
            input.attack = true;
          }
          this.actionCooldown = 20;
        } else if (absDx < 30) {
          // Jab at close range
          input.attack = true;
          this.actionCooldown = 6;
        } else if (absDx < 60) {
          // Tilt attack
          input.attack = true;
          if (dx > 0) input.right = true;
          else input.left = true;
          this.actionCooldown = 10;
        } else if (absDx < 100 && Math.random() < 0.3) {
          // Dash attack
          input.attack = true;
          this.actionCooldown = 15;
        } else if (absDy > 30 && absDx < 40) {
          // Up tilt for above targets
          input.up = true;
          input.attack = true;
          this.actionCooldown = 10;
        } else {
          // Specials occasionally
          if (Math.random() < 0.2) {
            input.special = true;
            if (absDx > 60) {
              if (dx > 0) input.right = true;
              else input.left = true;
            }
            this.actionCooldown = 15;
          }
        }
      }
    }

    // Grab occasionally (higher levels)
    if (absDx < 30 && self.isGrounded && this.level >= 4 && Math.random() < 0.05) {
      input.grab = true;
      this.actionCooldown = 15;
    }
  }

  private executeRecover(input: InputState, self: PlayerData, stage: StageData): void {
    // Determine direction to stage center
    const stageCenter = stage.platforms[0].x + stage.platforms[0].width / 2;
    const dx = stageCenter - self.position.x;
    const stageTop = stage.platforms[0].y;

    // Horizontal recovery (drift toward stage)
    if (dx > 10) {
      input.right = true;
    } else if (dx < -10) {
      input.left = true;
    }

    // Double jump if available
    if (self.jumpsUsed < self.maxJumps && self.velocity.y > 0) {
      input.jump = true;
    }

    // Up special if below stage and no jumps left
    if (
      self.position.y > stageTop + 20 &&
      self.jumpsUsed >= self.maxJumps &&
      !this.recoveryAttempted
    ) {
      input.up = true;
      input.special = true;
      this.recoveryAttempted = true;
    }

    // Reset recovery flag when grounded
    if (self.isGrounded) {
      this.recoveryAttempted = false;
    }
  }

  private executeDefend(input: InputState, self: PlayerData, target: PlayerData): void {
    const dx = target.position.x - self.position.x;

    if (self.isGrounded) {
      // Shield
      input.shield = true;

      // Roll away at higher levels
      if (this.level >= 6 && Math.random() < 0.1) {
        input.shield = true;
        if (dx > 0) input.left = true;
        else input.right = true;
      }

      // Spot dodge at highest levels
      if (this.level >= 8 && Math.random() < 0.08) {
        input.shield = true;
        input.down = true;
      }
    } else {
      // Air dodge
      if (this.level >= 5 && self.hasAirdodge) {
        input.shield = true;
      }
    }
  }

  private executeRetreat(
    input: InputState,
    self: PlayerData,
    target: PlayerData,
    stage: StageData,
  ): void {
    const dx = target.position.x - self.position.x;
    const stageCenter = stage.platforms[0].x + stage.platforms[0].width / 2;
    const distToCenter = Math.abs(self.position.x - stageCenter);

    // Move away from target but don't go off stage
    if (distToCenter < 80) {
      if (dx > 0) input.left = true;
      else input.right = true;
    } else {
      // Getting close to edge, move toward center instead
      if (self.position.x > stageCenter) input.left = true;
      else input.right = true;
    }

    // Jump to escape pressure
    if (self.isGrounded && Math.random() < 0.1) {
      input.jump = true;
    }
  }

  private executeEdgeGuard(
    input: InputState,
    self: PlayerData,
    target: PlayerData,
    stage: StageData,
  ): void {
    const dx = target.position.x - self.position.x;
    const stageEdge = dx > 0
      ? stage.platforms[0].x + stage.platforms[0].width
      : stage.platforms[0].x;

    // Position near the ledge
    const edgeDist = Math.abs(self.position.x - stageEdge);
    if (edgeDist > 20) {
      if (self.position.x > stageEdge) input.left = true;
      else input.right = true;
    }

    // Attack if target is close enough
    const dist = Math.sqrt((target.position.x - self.position.x) ** 2 + (target.position.y - self.position.y) ** 2);
    if (dist < 80 && Math.random() < ATTACK_PROBABILITY_BY_LEVEL[this.level]) {
      if (target.position.y > self.position.y) {
        // Target below -> dair or dtilt
        input.down = true;
        input.attack = true;
      } else {
        input.attack = true;
      }
      this.actionCooldown = 12;
    }
  }

  // =========================================================================
  // DI, Tech, and Mash
  // =========================================================================

  private applyDI(input: InputState, self: PlayerData): void {
    // DI perpendicular to knockback for survival
    const kbAngle = Math.atan2(self.knockbackVelocity.y, self.knockbackVelocity.x);
    const optimalDIAngle = kbAngle + Math.PI / 2; // perpendicular

    // Higher levels DI more optimally
    const diAccuracy = 0.3 + (this.level / 9) * 0.7;
    const noise = (Math.random() - 0.5) * (1 - diAccuracy) * Math.PI;
    const finalAngle = optimalDIAngle + noise;

    if (Math.cos(finalAngle) > 0.3) input.right = true;
    else if (Math.cos(finalAngle) < -0.3) input.left = true;
    if (Math.sin(finalAngle) > 0.3) input.down = true;
    else if (Math.sin(finalAngle) < -0.3) input.up = true;
  }

  private shouldTech(): boolean {
    // Higher levels tech more consistently
    const techChance = 0.1 + (this.level / 9) * 0.8;
    return Math.random() < techChance;
  }

  private mashOut(input: InputState): void {
    // Rapidly alternate inputs to escape
    const frame = performance.now();
    if (Math.floor(frame / 50) % 2 === 0) {
      input.left = true;
      input.attack = true;
    } else {
      input.right = true;
      input.jump = true;
    }
  }

  // =========================================================================
  // Utility
  // =========================================================================

  private findTarget(self: PlayerData, opponents: PlayerData[]): PlayerData | null {
    let closest: PlayerData | null = null;
    let closestDist = Infinity;

    for (const opp of opponents) {
      if (opp.id === self.id) continue;
      if (opp.state === PlayerState.Dead) continue;

      const dx = opp.position.x - self.position.x;
      const dy = opp.position.y - self.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < closestDist) {
        closestDist = dist;
        closest = opp;
      }
    }

    return closest;
  }
}

// ============================================================================
// Helpers
// ============================================================================

function emptyInput(): InputState {
  return {
    left: false,
    right: false,
    up: false,
    down: false,
    attack: false,
    special: false,
    shield: false,
    grab: false,
    jump: false,
    cStickX: 0,
    cStickY: 0,
  };
}
