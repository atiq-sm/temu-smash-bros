// ============================================================================
// Cosmic Knockouts - Particle System
// ============================================================================

import { Particle, ParticleEmitterConfig } from '../core/types';

const MAX_PARTICLES = 500;

export class ParticleSystem {
  private pool: Particle[] = [];
  private activeCount: number = 0;

  constructor() {
    // Pre-allocate particle pool
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.pool.push(this.createDeadParticle());
    }
  }

  private createDeadParticle(): Particle {
    return {
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      life: 0,
      maxLife: 0,
      size: 0,
      sizeDecay: 0,
      color: '#ffffff',
      alpha: 0,
      alphaDecay: 0,
      gravity: 0,
      rotation: 0,
      rotationSpeed: 0,
      active: false,
    };
  }

  private getParticle(): Particle | null {
    for (let i = 0; i < this.pool.length; i++) {
      if (!this.pool[i].active) {
        return this.pool[i];
      }
    }
    return null; // pool exhausted
  }

  /** Emit particles from a configuration */
  emit(config: ParticleEmitterConfig): void {
    for (let i = 0; i < config.count; i++) {
      const p = this.getParticle();
      if (!p) return; // pool full

      p.x = config.x;
      p.y = config.y;
      p.vx = lerp(config.velocityRange.minX, config.velocityRange.maxX, Math.random());
      p.vy = lerp(config.velocityRange.minY, config.velocityRange.maxY, Math.random());
      p.life = lerp(config.lifetimeRange.min, config.lifetimeRange.max, Math.random());
      p.maxLife = p.life;
      p.size = lerp(config.sizeRange.min, config.sizeRange.max, Math.random());
      p.sizeDecay = config.sizeDecay;
      p.color = config.colors[Math.floor(Math.random() * config.colors.length)];
      p.alpha = 1;
      p.alphaDecay = config.alphaDecay;
      p.gravity = config.gravity;
      p.rotation = Math.random() * Math.PI * 2;
      p.rotationSpeed = lerp(config.rotationSpeedRange.min, config.rotationSpeedRange.max, Math.random());
      p.active = true;
      this.activeCount++;
    }
  }

  /** Update all active particles */
  update(): void {
    this.activeCount = 0;
    for (let i = 0; i < this.pool.length; i++) {
      const p = this.pool[i];
      if (!p.active) continue;

      p.life--;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }

      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.size = Math.max(0, p.size - p.sizeDecay);
      p.alpha = Math.max(0, p.alpha - p.alphaDecay);
      p.rotation += p.rotationSpeed;

      if (p.alpha <= 0 || p.size <= 0) {
        p.active = false;
        continue;
      }

      this.activeCount++;
    }
  }

  /** Render all active particles */
  render(
    ctx: CanvasRenderingContext2D,
    cameraX: number,
    cameraY: number,
    zoom: number,
  ): void {
    const { width, height } = ctx.canvas;
    const halfW = width / 2;
    const halfH = height / 2;

    ctx.save();
    for (let i = 0; i < this.pool.length; i++) {
      const p = this.pool[i];
      if (!p.active) continue;

      const sx = halfW + (p.x - cameraX) * zoom;
      const sy = halfH + (p.y - cameraY) * zoom;
      const sz = p.size * zoom;

      // Skip off-screen particles
      if (sx < -sz || sx > width + sz || sy < -sz || sy > height + sz) continue;

      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;

      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(p.rotation);
      ctx.fillRect(-sz / 2, -sz / 2, sz, sz);
      ctx.restore();
    }
    ctx.restore();
  }

  /** Clear all particles */
  reset(): void {
    for (const p of this.pool) {
      p.active = false;
    }
    this.activeCount = 0;
  }

  getActiveCount(): number {
    return this.activeCount;
  }

  // =========================================================================
  // Pre-built Effects
  // =========================================================================

  /** Hit sparks - burst of bright particles at contact */
  emitHitSparks(x: number, y: number, damage: number): void {
    const intensity = Math.min(damage / 10, 3);
    this.emit({
      x,
      y,
      count: Math.floor(8 + intensity * 6),
      velocityRange: {
        minX: -4 * intensity,
        maxX: 4 * intensity,
        minY: -5 * intensity,
        maxY: 2 * intensity,
      },
      lifetimeRange: { min: 8, max: 18 },
      sizeRange: { min: 2, max: 5 + intensity },
      sizeDecay: 0.15,
      colors: ['#ffffff', '#ffdd57', '#ff6b6b', '#ffa94d'],
      alphaDecay: 0.04,
      gravity: 0.1,
      rotationSpeedRange: { min: -0.2, max: 0.2 },
    });
  }

  /** Landing dust - small puff when touching down */
  emitLandingDust(x: number, y: number): void {
    this.emit({
      x,
      y,
      count: 6,
      velocityRange: { minX: -2, maxX: 2, minY: -1.5, maxY: 0 },
      lifetimeRange: { min: 10, max: 20 },
      sizeRange: { min: 2, max: 4 },
      sizeDecay: 0.1,
      colors: ['#94a3b8', '#cbd5e1', '#e2e8f0'],
      alphaDecay: 0.05,
      gravity: 0,
      rotationSpeedRange: { min: 0, max: 0 },
    });
  }

  /** Dash smoke - trail when running */
  emitDashSmoke(x: number, y: number, facingRight: boolean): void {
    const dir = facingRight ? -1 : 1;
    this.emit({
      x,
      y,
      count: 3,
      velocityRange: { minX: dir * 1, maxX: dir * 3, minY: -1, maxY: 0 },
      lifetimeRange: { min: 6, max: 12 },
      sizeRange: { min: 2, max: 3 },
      sizeDecay: 0.1,
      colors: ['#64748b', '#94a3b8'],
      alphaDecay: 0.06,
      gravity: -0.02,
      rotationSpeedRange: { min: 0, max: 0 },
    });
  }

  /** Shield break - dramatic burst */
  emitShieldBreak(x: number, y: number): void {
    this.emit({
      x,
      y,
      count: 30,
      velocityRange: { minX: -8, maxX: 8, minY: -10, maxY: 4 },
      lifetimeRange: { min: 20, max: 40 },
      sizeRange: { min: 3, max: 8 },
      sizeDecay: 0.1,
      colors: ['#60a5fa', '#818cf8', '#a78bfa', '#c4b5fd', '#ffffff'],
      alphaDecay: 0.02,
      gravity: 0.15,
      rotationSpeedRange: { min: -0.3, max: 0.3 },
    });
  }

  /** KO explosion - big dramatic burst for kills */
  emitKOExplosion(x: number, y: number, color: string): void {
    // Main burst
    this.emit({
      x,
      y,
      count: 40,
      velocityRange: { minX: -10, maxX: 10, minY: -12, maxY: 6 },
      lifetimeRange: { min: 25, max: 50 },
      sizeRange: { min: 3, max: 10 },
      sizeDecay: 0.08,
      colors: [color, '#ffffff', '#ffdd57', '#ff6b6b'],
      alphaDecay: 0.015,
      gravity: 0.08,
      rotationSpeedRange: { min: -0.4, max: 0.4 },
    });

    // Ring burst (moves outward in a ring)
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
      const speed = 6;
      this.emit({
        x,
        y,
        count: 1,
        velocityRange: {
          minX: Math.cos(angle) * speed,
          maxX: Math.cos(angle) * speed,
          minY: Math.sin(angle) * speed,
          maxY: Math.sin(angle) * speed,
        },
        lifetimeRange: { min: 15, max: 25 },
        sizeRange: { min: 4, max: 6 },
        sizeDecay: 0.12,
        colors: ['#ffffff', color],
        alphaDecay: 0.03,
        gravity: 0,
        rotationSpeedRange: { min: 0, max: 0.1 },
      });
    }
  }

  /** Jump puff */
  emitJumpPuff(x: number, y: number): void {
    this.emit({
      x,
      y,
      count: 5,
      velocityRange: { minX: -1.5, maxX: 1.5, minY: 0, maxY: 1.5 },
      lifetimeRange: { min: 8, max: 14 },
      sizeRange: { min: 2, max: 3 },
      sizeDecay: 0.1,
      colors: ['#e2e8f0', '#cbd5e1'],
      alphaDecay: 0.06,
      gravity: 0,
      rotationSpeedRange: { min: 0, max: 0 },
    });
  }

  /** Double jump sparkle */
  emitDoubleJumpSparkle(x: number, y: number, color: string): void {
    this.emit({
      x,
      y,
      count: 12,
      velocityRange: { minX: -3, maxX: 3, minY: -1, maxY: 3 },
      lifetimeRange: { min: 12, max: 22 },
      sizeRange: { min: 2, max: 5 },
      sizeDecay: 0.12,
      colors: [color, '#ffffff'],
      alphaDecay: 0.04,
      gravity: 0.05,
      rotationSpeedRange: { min: -0.15, max: 0.15 },
    });
  }
}

// Utility
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
