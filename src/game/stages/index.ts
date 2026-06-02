// ============================================================================
// Cosmic Knockout - Stage Definitions
// ============================================================================

import type { Vector2D } from '../core/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Platform {
  x: number;
  y: number;
  width: number;
  isPassthrough: boolean;
}

export interface BlastZone {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface SpawnPoint {
  x: number;
  y: number;
}

export interface StageTheme {
  bgGradientTop: string;
  bgGradientBottom: string;
  platformColor: string;
  platformGlow: string;
  accentColor: string;
  particles?: {
    color: string;
    count: number;
    speed: number;
    direction: 'up' | 'down' | 'random';
  };
}

export interface StageHazard {
  type: string;
  /** Interval in seconds between hazard activations */
  interval?: number;
  /** Duration in seconds the hazard stays active */
  duration?: number;
  /** Damage dealt on contact (percentage) */
  damage?: number;
  /** Knockback base applied on contact */
  knockbackBase?: number;
  /** Knockback angle in degrees */
  knockbackAngle?: number;
  /** Seconds of telegraph before hazard activates */
  telegraphTime?: number;
  /** Movement path for moving hazards */
  movePath?: { startX: number; endX: number; y: number; speed: number };
}

export interface StageData {
  id: string;
  name: string;
  description: string;
  platforms: Platform[];
  blastZone: BlastZone;
  spawnPoints: SpawnPoint[];
  theme: StageTheme;
  cameraCenter: Vector2D;
  cameraZoom: number;
  hazards?: StageHazard[];
  /** Renders the stage background with parallax and ambient effects. */
  renderBackground: (
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    frame: number,
  ) => void;
}

// ---------------------------------------------------------------------------
// Helper: draw a linear vertical gradient filling the entire canvas
// ---------------------------------------------------------------------------

function fillGradient(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  topColor: string,
  bottomColor: string,
): void {
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, topColor);
  grad.addColorStop(1, bottomColor);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

// ============================================================================
// 1. SKY COLOSSEUM
// ============================================================================

const sky_colosseum: StageData = {
  id: 'sky_colosseum',
  name: 'Sky Colosseum',
  description: 'A grand arena floating above the clouds',

  platforms: [
    // Main platform
    { x: 350, y: 550, width: 500, isPassthrough: false },
    // Left floating platform
    { x: 250, y: 380, width: 120, isPassthrough: true },
    // Right floating platform
    { x: 830, y: 380, width: 120, isPassthrough: true },
    // Top center platform
    { x: 490, y: 250, width: 220, isPassthrough: true },
  ],

  blastZone: { left: -300, right: 1500, top: -400, bottom: 1000 },

  spawnPoints: [
    { x: 450, y: 500 },
    { x: 600, y: 500 },
    { x: 525, y: 500 },
    { x: 750, y: 500 },
  ],

  theme: {
    bgGradientTop: '#87CEEB',
    bgGradientBottom: '#E0F0FF',
    platformColor: '#FFFFFF',
    platformGlow: '#FFD700',
    accentColor: '#FFD700',
    particles: { color: '#FFFFFF', count: 40, speed: 0.3, direction: 'random' },
  },

  cameraCenter: { x: 600, y: 400 },
  cameraZoom: 1.0,

  renderBackground(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    frame: number,
  ): void {
    // Sky gradient
    fillGradient(ctx, canvas, this.theme.bgGradientTop, this.theme.bgGradientBottom);

    // Parallax clouds – three layers drifting at different speeds
    ctx.save();
    ctx.globalAlpha = 0.35;
    const cloudLayers = [
      { y: canvas.height * 0.20, speed: 0.15, size: 90, count: 5 },
      { y: canvas.height * 0.40, speed: 0.25, size: 70, count: 6 },
      { y: canvas.height * 0.65, speed: 0.40, size: 55, count: 7 },
    ];

    for (const layer of cloudLayers) {
      ctx.fillStyle = '#FFFFFF';
      for (let i = 0; i < layer.count; i++) {
        const baseX = (i / layer.count) * (canvas.width + layer.size * 4);
        const x = ((baseX + frame * layer.speed) % (canvas.width + layer.size * 4)) - layer.size * 2;
        const y = layer.y + Math.sin(frame * 0.005 + i) * 8;
        ctx.beginPath();
        ctx.ellipse(x, y, layer.size, layer.size * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(x - layer.size * 0.5, y + 5, layer.size * 0.6, layer.size * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(x + layer.size * 0.5, y + 5, layer.size * 0.55, layer.size * 0.28, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();

    // Floating golden sparkle particles
    ctx.save();
    const sparkleCount = this.theme.particles?.count ?? 40;
    for (let i = 0; i < sparkleCount; i++) {
      const seed = i * 137.508;
      const px = (seed * 7.31) % canvas.width;
      const py = ((seed * 3.57) + frame * 0.2) % canvas.height;
      const flicker = 0.4 + 0.6 * Math.abs(Math.sin(frame * 0.03 + seed));
      ctx.globalAlpha = flicker * 0.6;
      ctx.fillStyle = this.theme.particles?.color ?? '#FFFFFF';
      ctx.beginPath();
      ctx.arc(px, py, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  },
};

// ============================================================================
// 2. VOLCANIC FORGE
// ============================================================================

const volcanic_forge: StageData = {
  id: 'volcanic_forge',
  name: 'Volcanic Forge',
  description: 'The heart of an active volcano, where the ground itself fights back',

  platforms: [
    // Main platform (wider, rockier)
    { x: 300, y: 550, width: 600, isPassthrough: false },
    // Left side platform
    { x: 200, y: 400, width: 130, isPassthrough: true },
    // Right side platform
    { x: 870, y: 400, width: 130, isPassthrough: true },
  ],

  blastZone: { left: -300, right: 1500, top: -400, bottom: 1000 },

  spawnPoints: [
    { x: 450, y: 500 },
    { x: 600, y: 500 },
    { x: 525, y: 500 },
    { x: 750, y: 500 },
  ],

  theme: {
    bgGradientTop: '#1A0000',
    bgGradientBottom: '#8B2500',
    platformColor: '#3D2B1F',
    platformGlow: '#FF4500',
    accentColor: '#FF6600',
    particles: { color: '#FF4500', count: 30, speed: 0.6, direction: 'up' },
  },

  cameraCenter: { x: 600, y: 400 },
  cameraZoom: 1.0,

  hazards: [
    {
      type: 'rising_lava',
      interval: 20,
      duration: 5,
      damage: 15,
      knockbackBase: 80,
      knockbackAngle: 90,
      telegraphTime: 3,
    },
  ],

  renderBackground(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    frame: number,
  ): void {
    // Dark volcanic gradient
    fillGradient(ctx, canvas, this.theme.bgGradientTop, this.theme.bgGradientBottom);

    // Distant lava river glow at the bottom
    ctx.save();
    const lavaY = canvas.height * 0.85;
    const lavaGrad = ctx.createLinearGradient(0, lavaY - 30, 0, canvas.height);
    lavaGrad.addColorStop(0, 'rgba(255, 69, 0, 0)');
    lavaGrad.addColorStop(0.3, 'rgba(255, 69, 0, 0.25)');
    lavaGrad.addColorStop(1, 'rgba(255, 140, 0, 0.5)');
    ctx.fillStyle = lavaGrad;
    ctx.fillRect(0, lavaY - 30, canvas.width, canvas.height - lavaY + 30);

    // Pulsing lava glow
    const pulse = 0.7 + 0.3 * Math.sin(frame * 0.02);
    ctx.globalAlpha = pulse * 0.3;
    ctx.fillStyle = '#FF4500';
    ctx.fillRect(0, canvas.height * 0.9, canvas.width, canvas.height * 0.1);
    ctx.restore();

    // Volcanic rock silhouettes in the background
    ctx.save();
    ctx.fillStyle = '#0D0000';
    ctx.globalAlpha = 0.4;
    // Left rock formation
    ctx.beginPath();
    ctx.moveTo(0, canvas.height * 0.5);
    ctx.lineTo(80, canvas.height * 0.2);
    ctx.lineTo(140, canvas.height * 0.35);
    ctx.lineTo(200, canvas.height * 0.15);
    ctx.lineTo(260, canvas.height * 0.45);
    ctx.lineTo(300, canvas.height * 0.55);
    ctx.lineTo(0, canvas.height * 0.55);
    ctx.closePath();
    ctx.fill();
    // Right rock formation
    ctx.beginPath();
    ctx.moveTo(canvas.width, canvas.height * 0.5);
    ctx.lineTo(canvas.width - 70, canvas.height * 0.18);
    ctx.lineTo(canvas.width - 150, canvas.height * 0.32);
    ctx.lineTo(canvas.width - 230, canvas.height * 0.12);
    ctx.lineTo(canvas.width - 280, canvas.height * 0.40);
    ctx.lineTo(canvas.width - 320, canvas.height * 0.55);
    ctx.lineTo(canvas.width, canvas.height * 0.55);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Rising ember particles
    ctx.save();
    const emberCount = this.theme.particles?.count ?? 30;
    for (let i = 0; i < emberCount; i++) {
      const seed = i * 197.321;
      const px = (seed * 5.17) % canvas.width;
      const speed = 0.3 + ((seed * 0.13) % 0.6);
      const py = canvas.height - ((seed * 2.83 + frame * speed) % canvas.height);
      const drift = Math.sin(frame * 0.015 + seed) * 12;
      const flicker = 0.5 + 0.5 * Math.abs(Math.sin(frame * 0.05 + seed));
      ctx.globalAlpha = flicker * 0.7;
      const emberSize = 1 + (seed % 2.5);
      ctx.fillStyle = i % 3 === 0 ? '#FFD700' : this.theme.particles?.color ?? '#FF4500';
      ctx.beginPath();
      ctx.arc(px + drift, py, emberSize, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Lava hazard telegraph: rumbling particles near the bottom when lava is
    // about to rise. The game loop should set `(window as any).__lavaTimer`
    // so we can read it, but we also do a self-contained cycle here based on
    // frame count for a standalone visual preview.
    const cycleFrames = 20 * 60; // 20-second cycle at 60 fps
    const currentCycle = frame % cycleFrames;
    const telegraphStart = cycleFrames - 3 * 60; // 3 seconds before activation
    if (currentCycle >= telegraphStart) {
      ctx.save();
      const intensity = (currentCycle - telegraphStart) / (3 * 60);
      ctx.globalAlpha = intensity * 0.5;
      for (let i = 0; i < 20; i++) {
        const rx = Math.random() * canvas.width;
        const ry = canvas.height - 20 + Math.random() * 20;
        ctx.fillStyle = '#FF6600';
        ctx.beginPath();
        ctx.arc(rx, ry, 2 + Math.random() * 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  },
};

// ============================================================================
// 3. CRYSTAL CAVERNS
// ============================================================================

const crystal_caverns: StageData = {
  id: 'crystal_caverns',
  name: 'Crystal Caverns',
  description: 'Ancient caves lined with living crystals',

  platforms: [
    // Main platform
    { x: 400, y: 550, width: 400, isPassthrough: false },
    // Left moving platform (data position is the initial center)
    { x: 150, y: 350, width: 130, isPassthrough: true },
    // Right moving platform
    { x: 700, y: 350, width: 130, isPassthrough: true },
  ],

  blastZone: { left: -150, right: 1350, top: -400, bottom: 1000 },

  spawnPoints: [
    { x: 500, y: 500 },
    { x: 650, y: 500 },
    { x: 575, y: 500 },
    { x: 700, y: 500 },
  ],

  theme: {
    bgGradientTop: '#0D0221',
    bgGradientBottom: '#1A0533',
    platformColor: '#6A0DAD',
    platformGlow: '#E0B0FF',
    accentColor: '#DA70D6',
    particles: { color: '#E0B0FF', count: 50, speed: 0.15, direction: 'random' },
  },

  cameraCenter: { x: 600, y: 400 },
  cameraZoom: 1.0,

  hazards: [
    {
      type: 'moving_platform',
      movePath: { startX: 150, endX: 450, y: 350, speed: 1.0 },
    },
    {
      type: 'moving_platform',
      movePath: { startX: 700, endX: 1000, y: 350, speed: 1.0 },
    },
  ],

  renderBackground(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    frame: number,
  ): void {
    // Deep cave gradient
    fillGradient(ctx, canvas, this.theme.bgGradientTop, this.theme.bgGradientBottom);

    // Cave wall silhouettes (stalactites from top, stalagmites from bottom)
    ctx.save();
    ctx.fillStyle = '#080012';
    ctx.globalAlpha = 0.5;

    // Top stalactites
    const stalactiteCount = 12;
    for (let i = 0; i < stalactiteCount; i++) {
      const bx = (i / stalactiteCount) * canvas.width + 20;
      const bw = 15 + (i * 31) % 25;
      const bh = 40 + (i * 47) % 80;
      ctx.beginPath();
      ctx.moveTo(bx - bw / 2, 0);
      ctx.lineTo(bx + bw / 2, 0);
      ctx.lineTo(bx + 2, bh);
      ctx.lineTo(bx - 2, bh);
      ctx.closePath();
      ctx.fill();
    }

    // Bottom stalagmites
    for (let i = 0; i < stalactiteCount; i++) {
      const bx = (i / stalactiteCount) * canvas.width + 50;
      const bw = 12 + (i * 23) % 20;
      const bh = 30 + (i * 37) % 60;
      ctx.beginPath();
      ctx.moveTo(bx - bw / 2, canvas.height);
      ctx.lineTo(bx + bw / 2, canvas.height);
      ctx.lineTo(bx + 2, canvas.height - bh);
      ctx.lineTo(bx - 2, canvas.height - bh);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // Crystal shimmer lights embedded in the cave walls
    ctx.save();
    const crystalPositions = [
      { x: 50, y: 120 }, { x: 180, y: 80 }, { x: 350, y: 60 },
      { x: 550, y: 90 }, { x: 750, y: 50 }, { x: 900, y: 110 },
      { x: 1050, y: 70 }, { x: 1150, y: 130 },
      { x: 80, y: canvas.height - 50 }, { x: 300, y: canvas.height - 70 },
      { x: 600, y: canvas.height - 40 }, { x: 900, y: canvas.height - 60 },
      { x: 1100, y: canvas.height - 45 },
    ];

    for (let i = 0; i < crystalPositions.length; i++) {
      const cp = crystalPositions[i];
      const shimmer = 0.3 + 0.7 * Math.abs(Math.sin(frame * 0.02 + i * 1.7));
      const hue = (frame * 0.5 + i * 30) % 360;
      ctx.globalAlpha = shimmer * 0.6;

      // Glow
      const glowGrad = ctx.createRadialGradient(cp.x, cp.y, 0, cp.x, cp.y, 25);
      glowGrad.addColorStop(0, `hsla(${hue}, 80%, 75%, 0.8)`);
      glowGrad.addColorStop(1, `hsla(${hue}, 80%, 75%, 0)`);
      ctx.fillStyle = glowGrad;
      ctx.fillRect(cp.x - 25, cp.y - 25, 50, 50);

      // Crystal core
      ctx.globalAlpha = shimmer * 0.9;
      ctx.fillStyle = `hsl(${hue}, 80%, 75%)`;
      ctx.beginPath();
      ctx.arc(cp.x, cp.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Prismatic floating motes
    ctx.save();
    const moteCount = this.theme.particles?.count ?? 50;
    for (let i = 0; i < moteCount; i++) {
      const seed = i * 173.913;
      const baseX = (seed * 6.41) % canvas.width;
      const baseY = (seed * 3.89) % canvas.height;
      const driftX = Math.sin(frame * 0.008 + seed) * 20;
      const driftY = Math.cos(frame * 0.006 + seed * 0.7) * 15;
      const hue = (frame * 0.3 + i * 25) % 360;
      const flicker = 0.3 + 0.7 * Math.abs(Math.sin(frame * 0.025 + seed));
      ctx.globalAlpha = flicker * 0.45;
      ctx.fillStyle = `hsl(${hue}, 70%, 70%)`;
      ctx.beginPath();
      ctx.arc(baseX + driftX, baseY + driftY, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  },
};

// ============================================================================
// 4. NEON DISTRICT
// ============================================================================

const neon_district: StageData = {
  id: 'neon_district',
  name: 'Neon District',
  description: 'The electric heart of a city that never sleeps',

  platforms: [
    // Main platform (slightly left of center)
    { x: 275, y: 550, width: 450, isPassthrough: false },
    // Right elevated platform (solid building)
    { x: 800, y: 450, width: 200, isPassthrough: false },
    // Small passthrough platform
    { x: 350, y: 320, width: 100, isPassthrough: true },
  ],

  blastZone: { left: -300, right: 1500, top: -400, bottom: 1000 },

  spawnPoints: [
    { x: 400, y: 500 },
    { x: 550, y: 500 },
    { x: 475, y: 500 },
    { x: 650, y: 500 },
  ],

  theme: {
    bgGradientTop: '#0A0A2E',
    bgGradientBottom: '#1A0A3E',
    platformColor: '#1E1E3E',
    platformGlow: '#FF1493',
    accentColor: '#00FFFF',
    particles: { color: '#FF1493', count: 35, speed: 0.4, direction: 'down' },
  },

  cameraCenter: { x: 600, y: 400 },
  cameraZoom: 1.0,

  renderBackground(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    frame: number,
  ): void {
    // Dark cityscape gradient
    fillGradient(ctx, canvas, this.theme.bgGradientTop, this.theme.bgGradientBottom);

    // Distant city skyline silhouettes (parallax layers)
    ctx.save();

    // Far buildings (slowest parallax)
    ctx.fillStyle = '#0E0E28';
    ctx.globalAlpha = 0.7;
    const farOffset = (frame * 0.05) % canvas.width;
    const farBuildings = [
      { x: 0, w: 80, h: 250 }, { x: 100, w: 60, h: 300 },
      { x: 180, w: 90, h: 200 }, { x: 300, w: 70, h: 350 },
      { x: 400, w: 100, h: 280 }, { x: 530, w: 55, h: 320 },
      { x: 610, w: 85, h: 230 }, { x: 720, w: 65, h: 370 },
      { x: 810, w: 95, h: 260 }, { x: 930, w: 75, h: 340 },
      { x: 1030, w: 80, h: 290 }, { x: 1130, w: 60, h: 310 },
    ];
    for (const b of farBuildings) {
      const bx = ((b.x - farOffset) % (canvas.width + 200)) + 100;
      ctx.fillRect(bx, canvas.height * 0.75 - b.h, b.w, b.h + canvas.height * 0.25);
    }

    // Near buildings (faster parallax)
    ctx.fillStyle = '#12123A';
    ctx.globalAlpha = 0.8;
    const nearOffset = (frame * 0.1) % canvas.width;
    const nearBuildings = [
      { x: 50, w: 100, h: 180 }, { x: 200, w: 80, h: 220 },
      { x: 330, w: 120, h: 160 }, { x: 500, w: 90, h: 250 },
      { x: 640, w: 110, h: 190 }, { x: 800, w: 70, h: 240 },
      { x: 920, w: 100, h: 170 }, { x: 1060, w: 85, h: 230 },
    ];
    for (const b of nearBuildings) {
      const bx = ((b.x - nearOffset) % (canvas.width + 200)) + 100;
      ctx.fillRect(bx, canvas.height * 0.80 - b.h, b.w, b.h + canvas.height * 0.2);
    }
    ctx.restore();

    // Neon sign accents on far buildings
    ctx.save();
    const neonColors = ['#FF1493', '#00FFFF', '#FF6EC7', '#39FF14', '#FFD700'];
    for (let i = 0; i < 8; i++) {
      const seed = i * 251.137;
      const nx = (seed * 4.71) % canvas.width;
      const ny = canvas.height * 0.35 + (seed * 1.23) % (canvas.height * 0.35);
      const nw = 20 + (seed % 40);
      const nh = 5 + (seed % 8);
      const flicker = Math.sin(frame * 0.04 + seed) > -0.1 ? 1 : 0.2;
      const color = neonColors[i % neonColors.length];

      ctx.globalAlpha = flicker * 0.7;

      // Glow behind sign
      ctx.shadowColor = color;
      ctx.shadowBlur = 15;
      ctx.fillStyle = color;
      ctx.fillRect(nx, ny, nw, nh);

      // Secondary line
      if (i % 2 === 0) {
        ctx.fillRect(nx + 5, ny + nh + 3, nw - 10, nh * 0.6);
      }
    }
    ctx.shadowBlur = 0;
    ctx.restore();

    // Rain / neon particle drizzle
    ctx.save();
    const rainCount = this.theme.particles?.count ?? 35;
    for (let i = 0; i < rainCount; i++) {
      const seed = i * 113.247;
      const px = (seed * 8.31) % canvas.width;
      const speed = 1.5 + (seed % 2.0);
      const py = (seed * 4.17 + frame * speed) % canvas.height;
      const len = 8 + (seed % 12);
      ctx.globalAlpha = 0.3 + 0.2 * Math.abs(Math.sin(seed));
      ctx.strokeStyle = i % 4 === 0 ? '#FF1493' : i % 4 === 1 ? '#00FFFF' : 'rgba(200, 200, 255, 0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px - 1, py + len);
      ctx.stroke();
    }
    ctx.restore();

    // Ground-level neon reflection
    ctx.save();
    const reflGrad = ctx.createLinearGradient(0, canvas.height * 0.85, 0, canvas.height);
    reflGrad.addColorStop(0, 'rgba(255, 20, 147, 0)');
    reflGrad.addColorStop(0.5, 'rgba(255, 20, 147, 0.06)');
    reflGrad.addColorStop(1, 'rgba(0, 255, 255, 0.08)');
    ctx.fillStyle = reflGrad;
    ctx.fillRect(0, canvas.height * 0.85, canvas.width, canvas.height * 0.15);
    ctx.restore();
  },
};

// ============================================================================
// Exports
// ============================================================================

export const STAGES: Record<string, StageData> = {
  sky_colosseum,
  volcanic_forge,
  crystal_caverns,
  neon_district,
};

export const STAGE_LIST: string[] = [
  'sky_colosseum',
  'volcanic_forge',
  'crystal_caverns',
  'neon_district',
];

export type { Vector2D };
