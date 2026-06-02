// ============================================================================
// Cosmic Knockouts - Stage Definitions & Renderer
// ============================================================================

import { StageData, Platform, LedgePoint, Vector2D } from '../core/types';

// ============================================================================
// Built-in Stages
// ============================================================================

export function createBattlefield(): StageData {
  const mainPlatform: Platform = {
    x: -120,
    y: 0,
    width: 240,
    isPassthrough: false,
    color: '#334155',
    glowColor: '#60a5fa',
  };

  const leftPlat: Platform = {
    x: -100,
    y: -80,
    width: 60,
    isPassthrough: true,
    color: '#475569',
    glowColor: '#818cf8',
  };

  const topPlat: Platform = {
    x: -40,
    y: -150,
    width: 80,
    isPassthrough: true,
    color: '#475569',
    glowColor: '#818cf8',
  };

  const rightPlat: Platform = {
    x: 40,
    y: -80,
    width: 60,
    isPassthrough: true,
    color: '#475569',
    glowColor: '#818cf8',
  };

  const ledges: LedgePoint[] = [
    { x: -120, y: 0, side: 'left', occupied: false, occupiedBy: -1 },
    { x: 120, y: 0, side: 'right', occupied: false, occupiedBy: -1 },
  ];

  return {
    id: 'battlefield',
    name: 'Cosmic Arena',
    platforms: [mainPlatform, leftPlat, topPlat, rightPlat],
    blastZones: {
      left: -350,
      right: 350,
      top: -300,
      bottom: 250,
    },
    spawnPoints: [
      { x: -60, y: -40 },
      { x: 60, y: -40 },
      { x: -30, y: -120 },
      { x: 30, y: -120 },
    ],
    cameraCenter: { x: 0, y: -50 },
    cameraBoundsMin: { x: -250, y: -250 },
    cameraBoundsMax: { x: 250, y: 100 },
    ledges,
    backgroundColor: '#0f0b1e',
    backgroundGradient: ['#0f0b1e', '#1a1145', '#2d1b69', '#1a1145', '#0f0b1e'],
  };
}

export function createFinalDestination(): StageData {
  const mainPlatform: Platform = {
    x: -140,
    y: 0,
    width: 280,
    isPassthrough: false,
    color: '#1e293b',
    glowColor: '#f472b6',
  };

  const ledges: LedgePoint[] = [
    { x: -140, y: 0, side: 'left', occupied: false, occupiedBy: -1 },
    { x: 140, y: 0, side: 'right', occupied: false, occupiedBy: -1 },
  ];

  return {
    id: 'final_destination',
    name: 'Void Platform',
    platforms: [mainPlatform],
    blastZones: {
      left: -350,
      right: 350,
      top: -300,
      bottom: 250,
    },
    spawnPoints: [
      { x: -60, y: -40 },
      { x: 60, y: -40 },
      { x: -30, y: -40 },
      { x: 30, y: -40 },
    ],
    cameraCenter: { x: 0, y: -50 },
    cameraBoundsMin: { x: -250, y: -200 },
    cameraBoundsMax: { x: 250, y: 100 },
    ledges,
    backgroundColor: '#0a0a1a',
    backgroundGradient: ['#0a0a1a', '#1a0a2e', '#0a0a1a'],
  };
}

export function createSmallBattlefield(): StageData {
  const mainPlatform: Platform = {
    x: -100,
    y: 0,
    width: 200,
    isPassthrough: false,
    color: '#334155',
    glowColor: '#34d399',
  };

  const topPlat: Platform = {
    x: -40,
    y: -80,
    width: 80,
    isPassthrough: true,
    color: '#475569',
    glowColor: '#6ee7b7',
  };

  const ledges: LedgePoint[] = [
    { x: -100, y: 0, side: 'left', occupied: false, occupiedBy: -1 },
    { x: 100, y: 0, side: 'right', occupied: false, occupiedBy: -1 },
  ];

  return {
    id: 'small_battlefield',
    name: 'Nebula Ring',
    platforms: [mainPlatform, topPlat],
    blastZones: {
      left: -320,
      right: 320,
      top: -280,
      bottom: 230,
    },
    spawnPoints: [
      { x: -50, y: -40 },
      { x: 50, y: -40 },
      { x: -25, y: -40 },
      { x: 25, y: -40 },
    ],
    cameraCenter: { x: 0, y: -40 },
    cameraBoundsMin: { x: -220, y: -200 },
    cameraBoundsMax: { x: 220, y: 80 },
    ledges,
    backgroundColor: '#071a0f',
    backgroundGradient: ['#071a0f', '#0a2e1a', '#071a0f'],
  };
}

function createNeonDistrict(): StageData {
  const mainPlatform: Platform = {
    x: -110,
    y: 0,
    width: 220,
    isPassthrough: false,
    color: '#1e1040',
    glowColor: '#ff00aa',
  };

  const buildingPlat: Platform = {
    x: 50,
    y: -50,
    width: 80,
    isPassthrough: false,
    color: '#2a1550',
    glowColor: '#ff44cc',
  };

  const floatingPlat: Platform = {
    x: -80,
    y: -100,
    width: 50,
    isPassthrough: true,
    color: '#331660',
    glowColor: '#ff66dd',
  };

  const ledges: LedgePoint[] = [
    { x: -110, y: 0, side: 'left', occupied: false, occupiedBy: -1 },
    { x: 110, y: 0, side: 'right', occupied: false, occupiedBy: -1 },
  ];

  return {
    id: 'neon_district',
    name: 'Neon District',
    platforms: [mainPlatform, buildingPlat, floatingPlat],
    blastZones: {
      left: -340,
      right: 340,
      top: -290,
      bottom: 240,
    },
    spawnPoints: [
      { x: -50, y: -40 },
      { x: 50, y: -40 },
      { x: -25, y: -40 },
      { x: 25, y: -40 },
    ],
    cameraCenter: { x: 0, y: -40 },
    cameraBoundsMin: { x: -240, y: -210 },
    cameraBoundsMax: { x: 240, y: 90 },
    ledges,
    backgroundColor: '#0a0520',
    backgroundGradient: ['#0a0520', '#1a0a40', '#2a1060', '#1a0a40', '#0a0520'],
  };
}

/** Map of all stages by id */
export const STAGES: Record<string, () => StageData> = {
  battlefield: createBattlefield,
  final_destination: createFinalDestination,
  small_battlefield: createSmallBattlefield,
  neon_district: createNeonDistrict,
  // Aliases for themed names used in UI
  sky_colosseum: createBattlefield,
  volcanic_forge: createFinalDestination,
  crystal_caverns: createSmallBattlefield,
};

export function getStage(id: string): StageData {
  const factory = STAGES[id];
  if (!factory) {
    return createBattlefield(); // default
  }
  return factory();
}

// ============================================================================
// Stage Renderer
// ============================================================================

export class StageRenderer {
  private stage: StageData;
  private starField: { x: number; y: number; size: number; brightness: number }[] = [];
  private animFrame: number = 0;

  constructor(stage: StageData) {
    this.stage = stage;
    this.generateStarField();
  }

  setStage(stage: StageData): void {
    this.stage = stage;
    this.generateStarField();
  }

  private generateStarField(): void {
    this.starField = [];
    for (let i = 0; i < 120; i++) {
      this.starField.push({
        x: (Math.random() - 0.5) * 900,
        y: (Math.random() - 0.5) * 700,
        size: Math.random() * 2 + 0.5,
        brightness: Math.random() * 0.6 + 0.4,
      });
    }
  }

  update(): void {
    this.animFrame++;
  }

  /** Render the full stage background and platforms */
  render(
    ctx: CanvasRenderingContext2D,
    cameraX: number,
    cameraY: number,
    zoom: number,
  ): void {
    this.renderBackground(ctx, cameraX, cameraY, zoom);
    this.renderPlatforms(ctx, cameraX, cameraY, zoom);
  }

  private renderBackground(
    ctx: CanvasRenderingContext2D,
    cameraX: number,
    cameraY: number,
    zoom: number,
  ): void {
    const { width, height } = ctx.canvas;

    // Base gradient
    if (this.stage.backgroundGradient && this.stage.backgroundGradient.length >= 2) {
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      const colors = this.stage.backgroundGradient;
      for (let i = 0; i < colors.length; i++) {
        grad.addColorStop(i / (colors.length - 1), colors[i]);
      }
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = this.stage.backgroundColor;
    }
    ctx.fillRect(0, 0, width, height);

    // Star field (parallax - moves slower than camera)
    const parallax = 0.3;
    ctx.save();
    for (const star of this.starField) {
      const sx = width / 2 + (star.x - cameraX * parallax) * zoom;
      const sy = height / 2 + (star.y - cameraY * parallax) * zoom;
      const twinkle = Math.sin(this.animFrame * 0.02 + star.x * 0.1) * 0.3 + 0.7;
      const alpha = star.brightness * twinkle;
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.beginPath();
      ctx.arc(sx, sy, star.size * zoom, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private renderPlatforms(
    ctx: CanvasRenderingContext2D,
    cameraX: number,
    cameraY: number,
    zoom: number,
  ): void {
    const { width, height } = ctx.canvas;

    for (const plat of this.stage.platforms) {
      const px = width / 2 + (plat.x - cameraX) * zoom;
      const py = height / 2 + (plat.y - cameraY) * zoom;
      const pw = plat.width * zoom;
      const platformThickness = plat.isPassthrough ? 4 * zoom : 16 * zoom;

      // Glow effect
      if (plat.glowColor) {
        ctx.save();
        ctx.shadowColor = plat.glowColor;
        ctx.shadowBlur = 12 * zoom;
        ctx.fillStyle = plat.glowColor;
        ctx.globalAlpha = 0.15 + Math.sin(this.animFrame * 0.03) * 0.05;
        ctx.fillRect(px - 4 * zoom, py - 2 * zoom, pw + 8 * zoom, platformThickness + 4 * zoom);
        ctx.restore();
      }

      // Platform surface
      ctx.fillStyle = plat.color ?? '#475569';
      ctx.fillRect(px, py, pw, platformThickness);

      // Top edge highlight
      const edgeGrad = ctx.createLinearGradient(px, py, px, py + 3 * zoom);
      edgeGrad.addColorStop(0, plat.glowColor ?? '#60a5fa');
      edgeGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = edgeGrad;
      ctx.fillRect(px, py, pw, 3 * zoom);

      // Passthrough indicator (dashed appearance)
      if (plat.isPassthrough) {
        ctx.strokeStyle = plat.glowColor ?? '#818cf8';
        ctx.lineWidth = 1 * zoom;
        ctx.setLineDash([6 * zoom, 4 * zoom]);
        ctx.beginPath();
        ctx.moveTo(px, py + platformThickness);
        ctx.lineTo(px + pw, py + platformThickness);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }

  /** Debug: render blast zones */
  renderBlastZones(
    ctx: CanvasRenderingContext2D,
    cameraX: number,
    cameraY: number,
    zoom: number,
  ): void {
    const { width, height } = ctx.canvas;
    const bz = this.stage.blastZones;

    ctx.strokeStyle = 'rgba(255, 0, 0, 0.3)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 4]);

    const left = width / 2 + (bz.left - cameraX) * zoom;
    const right = width / 2 + (bz.right - cameraX) * zoom;
    const top = height / 2 + (bz.top - cameraY) * zoom;
    const bottom = height / 2 + (bz.bottom - cameraY) * zoom;

    ctx.strokeRect(left, top, right - left, bottom - top);
    ctx.setLineDash([]);
  }

  /** Check if a world position is inside the blast zone boundaries (i.e. KO'd) */
  isOutOfBounds(pos: Vector2D): boolean {
    const bz = this.stage.blastZones;
    return pos.x < bz.left || pos.x > bz.right || pos.y < bz.top || pos.y > bz.bottom;
  }
}
