// ============================================================================
// Temu Smash Bros - Canvas Renderer
// ============================================================================

import {
  PlayerData,
  PlayerState,
  CameraState,
  StageData,
  DebugOptions,
  Vector2D,
} from '../core/types';
import { StageRenderer } from '../physics/Stage';
import { ParticleSystem } from '../particles/ParticleSystem';
import { renderCharacter } from './CharacterRenderer';

// --- Constants ---

const CAMERA_SMOOTH = 0.08;
const CAMERA_ZOOM_SMOOTH = 0.05;
const MIN_ZOOM = 0.4;
const MAX_ZOOM = 1.2;
const CAMERA_PADDING = 100;
const SCREEN_SHAKE_DECAY = 0.85;
const HIT_FREEZE_FRAMES = 0; // handled by hitlag in playerdata

// ============================================================================
// Renderer
// ============================================================================

export class Renderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private camera: CameraState;
  private stageRenderer: StageRenderer;
  private particleSystem: ParticleSystem;
  private players: PlayerData[] = [];
  private stage!: StageData;
  private matchTimer: number = 0;
  private freezeFrames: number = 0;
  private debugOptions: DebugOptions = {
    showHitboxes: false,
    showHurtboxes: false,
    showECB: false,
    showInputs: false,
    showFrameData: false,
    showCameraInfo: false,
    slowMotion: 1,
  };

  constructor(
    canvas: HTMLCanvasElement,
    stage: StageData,
    particleSystem: ParticleSystem,
  ) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.stage = stage;
    this.stageRenderer = new StageRenderer(stage);
    this.particleSystem = particleSystem;

    this.camera = {
      x: stage.cameraCenter.x,
      y: stage.cameraCenter.y,
      zoom: 1,
      targetX: stage.cameraCenter.x,
      targetY: stage.cameraCenter.y,
      targetZoom: 1,
      shakeIntensity: 0,
      shakeDecay: SCREEN_SHAKE_DECAY,
      shakeOffsetX: 0,
      shakeOffsetY: 0,
    };
  }

  setPlayers(players: PlayerData[]): void {
    this.players = players;
  }

  setStage(stage: StageData): void {
    this.stage = stage;
    this.stageRenderer.setStage(stage);
  }

  setMatchTimer(timer: number): void {
    this.matchTimer = timer;
  }

  setDebugOptions(options: Partial<DebugOptions>): void {
    Object.assign(this.debugOptions, options);
  }

  /** Trigger screen shake */
  screenShake(intensity: number): void {
    this.camera.shakeIntensity = Math.max(this.camera.shakeIntensity, intensity);
  }

  /** Trigger freeze frames */
  triggerFreeze(frames: number): void {
    this.freezeFrames = Math.max(this.freezeFrames, frames);
  }

  /** Full render pass */
  render(): void {
    if (this.freezeFrames > 0) {
      this.freezeFrames--;
      // During freeze, we still render but don't update camera
      this.drawFrame();
      return;
    }

    this.updateCamera();
    this.stageRenderer.update();
    this.drawFrame();
  }

  private drawFrame(): void {
    const ctx = this.ctx;
    const { width, height } = this.canvas;

    // Clear
    ctx.clearRect(0, 0, width, height);

    const cam = this.camera;
    const cx = cam.x + cam.shakeOffsetX;
    const cy = cam.y + cam.shakeOffsetY;

    // Stage background and platforms
    this.stageRenderer.render(ctx, cx, cy, cam.zoom);

    // Particles (behind fighters)
    this.particleSystem.render(ctx, cx, cy, cam.zoom);

    // Fighters
    for (const player of this.players) {
      if (player.state !== PlayerState.Dead) {
        this.renderFighter(ctx, player, cx, cy, cam.zoom);
      }
    }

    // Debug overlays
    if (this.debugOptions.showHitboxes || this.debugOptions.showHurtboxes || this.debugOptions.showECB) {
      this.renderDebug(ctx, cx, cy, cam.zoom);
    }

    // Blast zones debug
    if (this.debugOptions.showHitboxes) {
      this.stageRenderer.renderBlastZones(ctx, cx, cy, cam.zoom);
    }

    // HUD is rendered by React overlay (GameHUD component), not on canvas
  }

  // =========================================================================
  // Camera System
  // =========================================================================

  private updateCamera(): void {
    const cam = this.camera;
    const alivePlayers = this.players.filter(
      (p) => p.state !== PlayerState.Dead && p.state !== PlayerState.Respawning,
    );

    if (alivePlayers.length === 0) {
      cam.targetX = this.stage.cameraCenter.x;
      cam.targetY = this.stage.cameraCenter.y;
      cam.targetZoom = 1;
    } else {
      // Calculate bounding box of all alive players
      let minX = Infinity, maxX = -Infinity;
      let minY = Infinity, maxY = -Infinity;
      for (const p of alivePlayers) {
        minX = Math.min(minX, p.position.x);
        maxX = Math.max(maxX, p.position.x);
        minY = Math.min(minY, p.position.y);
        maxY = Math.max(maxY, p.position.y);
      }

      // Center camera on midpoint
      cam.targetX = (minX + maxX) / 2;
      cam.targetY = (minY + maxY) / 2 - 20; // slightly above center

      // Clamp camera target
      cam.targetX = clamp(cam.targetX, this.stage.cameraBoundsMin.x, this.stage.cameraBoundsMax.x);
      cam.targetY = clamp(cam.targetY, this.stage.cameraBoundsMin.y, this.stage.cameraBoundsMax.y);

      // Zoom out based on distance between players
      const spanX = maxX - minX + CAMERA_PADDING * 2;
      const spanY = maxY - minY + CAMERA_PADDING * 2;
      const zoomX = this.canvas.width / spanX;
      const zoomY = this.canvas.height / spanY;
      cam.targetZoom = clamp(Math.min(zoomX, zoomY), MIN_ZOOM, MAX_ZOOM);
    }

    // Smooth follow
    cam.x += (cam.targetX - cam.x) * CAMERA_SMOOTH;
    cam.y += (cam.targetY - cam.y) * CAMERA_SMOOTH;
    cam.zoom += (cam.targetZoom - cam.zoom) * CAMERA_ZOOM_SMOOTH;

    // Screen shake
    if (cam.shakeIntensity > 0.5) {
      cam.shakeOffsetX = (Math.random() - 0.5) * cam.shakeIntensity * 2;
      cam.shakeOffsetY = (Math.random() - 0.5) * cam.shakeIntensity * 2;
      cam.shakeIntensity *= cam.shakeDecay;
    } else {
      cam.shakeIntensity = 0;
      cam.shakeOffsetX = 0;
      cam.shakeOffsetY = 0;
    }
  }

  // =========================================================================
  // Fighter Rendering
  // =========================================================================

  private renderFighter(
    ctx: CanvasRenderingContext2D,
    player: PlayerData,
    camX: number,
    camY: number,
    zoom: number,
  ): void {
    const { width, height } = this.canvas;
    const sx = width / 2 + (player.position.x - camX) * zoom;
    const sy = height / 2 + (player.position.y - camY) * zoom;

    if (sx < -100 || sx > width + 100 || sy < -100 || sy > height + 100) return;

    const isInvincible = player.invincibleFrames > 0;

    renderCharacter(
      ctx,
      player.characterId,
      sx,
      sy,
      player.facing,
      player.state,
      player.stateFrame,
      player.damage,
      zoom,
      isInvincible,
    );

    // Shield overlay (drawn separately since it's above the character)
    if (player.state === PlayerState.Shielding) {
      ctx.save();
      ctx.translate(sx, sy);
      this.renderShield(ctx, player, zoom);
      ctx.restore();
    }

    // Player indicator above head
    const indicatorY = sy - 56 * zoom;
    this.renderPlayerIndicator(ctx, player, sx, indicatorY, zoom);
  }

  private renderShield(ctx: CanvasRenderingContext2D, player: PlayerData, zoom: number): void {
    const bodyH = 48 * zoom;
    const shieldRadius = (20 + player.shieldHealth * 0.1) * zoom;
    const shieldAlpha = 0.3 + (player.shieldHealth / 100) * 0.3;

    ctx.save();
    ctx.globalAlpha = shieldAlpha;
    ctx.beginPath();
    ctx.arc(0, -bodyH / 2, shieldRadius, 0, Math.PI * 2);

    const grad = ctx.createRadialGradient(0, -bodyH / 2, 0, 0, -bodyH / 2, shieldRadius);
    grad.addColorStop(0, 'rgba(100, 200, 255, 0.1)');
    grad.addColorStop(0.7, 'rgba(100, 200, 255, 0.3)');
    grad.addColorStop(1, 'rgba(100, 200, 255, 0.6)');
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.strokeStyle = `rgba(150, 220, 255, ${shieldAlpha + 0.2})`;
    ctx.lineWidth = 2 * zoom;
    ctx.stroke();
    ctx.restore();
  }

  private renderPlayerIndicator(
    ctx: CanvasRenderingContext2D,
    player: PlayerData,
    screenX: number,
    screenY: number,
    zoom: number,
  ): void {
    const colors = ['#60a5fa', '#f97316', '#a855f7', '#22d3ee'];
    const color = colors[player.id % colors.length];

    // Triangle pointing down
    const size = 6 * zoom;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(screenX, screenY + size);
    ctx.lineTo(screenX - size, screenY - size);
    ctx.lineTo(screenX + size, screenY - size);
    ctx.closePath();
    ctx.fill();

    // Player number
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.floor(10 * zoom)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(`P${player.id}`, screenX, screenY - size - 2 * zoom);
  }

  // =========================================================================
  // HUD Rendering
  // =========================================================================

  private renderHUD(ctx: CanvasRenderingContext2D): void {
    const { width, height } = this.canvas;

    // Bottom HUD bar
    const hudHeight = 80;
    const hudY = height - hudHeight;

    // Semi-transparent background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, hudY, width, hudHeight);

    // Top line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, hudY);
    ctx.lineTo(width, hudY);
    ctx.stroke();

    // Player damage displays
    const playerCount = this.players.length;
    const sectionWidth = width / Math.max(playerCount, 1);

    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      const centerX = sectionWidth * i + sectionWidth / 2;

      // Color bar under percentage
      const colors = ['#60a5fa', '#f97316', '#a855f7', '#22d3ee'];
      const color = colors[p.id % colors.length];

      ctx.fillStyle = color;
      ctx.fillRect(centerX - 40, hudY + hudHeight - 4, 80, 4);

      // Damage percentage
      const damageColor = this.getDamageColor(p.damage);
      ctx.fillStyle = damageColor;
      ctx.font = 'bold 32px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.floor(p.damage)}%`, centerX, hudY + 42);

      // Stock icons
      const stockY = hudY + 58;
      for (let s = 0; s < p.stocks; s++) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(centerX - 15 + s * 14, stockY, 5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Player label
      ctx.fillStyle = '#94a3b8';
      ctx.font = '11px sans-serif';
      ctx.fillText(`P${p.id + 1}`, centerX, hudY + 16);
    }

    // Timer
    if (this.matchTimer > 0) {
      const minutes = Math.floor(this.matchTimer / 3600);
      const seconds = Math.floor((this.matchTimer % 3600) / 60);
      const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 24px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(timeStr, width / 2, 36);
    }
  }

  private getDamageColor(damage: number): string {
    if (damage < 50) return '#ffffff';
    if (damage < 100) return '#ffdd57';
    if (damage < 150) return '#ff8c00';
    return '#ff3333';
  }

  // =========================================================================
  // Debug Rendering
  // =========================================================================

  private renderDebug(
    ctx: CanvasRenderingContext2D,
    camX: number,
    camY: number,
    zoom: number,
  ): void {
    const { width, height } = this.canvas;

    for (const player of this.players) {
      if (player.state === PlayerState.Dead) continue;

      // Hurtboxes (blue)
      if (this.debugOptions.showHurtboxes) {
        for (const hb of player.hurtboxes) {
          const hx = width / 2 + (player.position.x + hb.position.x * player.facing - hb.size.x / 2 - camX) * zoom;
          const hy = height / 2 + (player.position.y + hb.position.y - hb.size.y / 2 - camY) * zoom;
          const hw = hb.size.x * zoom;
          const hh = hb.size.y * zoom;

          ctx.strokeStyle = hb.intangible ? 'rgba(0, 255, 0, 0.5)' : 'rgba(0, 100, 255, 0.5)';
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 2]);
          ctx.strokeRect(hx, hy, hw, hh);
          ctx.setLineDash([]);

          ctx.fillStyle = hb.intangible ? 'rgba(0, 255, 0, 0.1)' : 'rgba(0, 100, 255, 0.1)';
          ctx.fillRect(hx, hy, hw, hh);
        }
      }

      // Hitboxes (red)
      if (this.debugOptions.showHitboxes) {
        for (const hb of player.activeHitboxes) {
          if (!hb.active) continue;
          const hx = width / 2 + (player.position.x + hb.position.x * player.facing - hb.size.x / 2 - camX) * zoom;
          const hy = height / 2 + (player.position.y + hb.position.y - hb.size.y / 2 - camY) * zoom;
          const hw = hb.size.x * zoom;
          const hh = hb.size.y * zoom;

          ctx.fillStyle = 'rgba(255, 50, 50, 0.3)';
          ctx.fillRect(hx, hy, hw, hh);
          ctx.strokeStyle = 'rgba(255, 50, 50, 0.8)';
          ctx.lineWidth = 2;
          ctx.strokeRect(hx, hy, hw, hh);
        }
      }

      // ECB (yellow)
      if (this.debugOptions.showECB) {
        const ecb = player.ecb;
        const ex = width / 2 + (ecb.x - camX) * zoom;
        const ey = height / 2 + (ecb.y - camY) * zoom;
        const ew = ecb.width * zoom;
        const eh = ecb.height * zoom;

        ctx.strokeStyle = 'rgba(255, 255, 0, 0.5)';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]);
        ctx.strokeRect(ex, ey, ew, eh);
        ctx.setLineDash([]);
      }

      // Frame data
      if (this.debugOptions.showFrameData) {
        const sx = width / 2 + (player.position.x - camX) * zoom;
        const sy = height / 2 + (player.position.y - camY) * zoom;

        ctx.fillStyle = '#ffffff';
        ctx.font = '10px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`State: ${player.state}`, sx + 20, sy - 60);
        ctx.fillText(`Frame: ${player.stateFrame}`, sx + 20, sy - 48);
        ctx.fillText(`Vel: ${player.velocity.x.toFixed(1)}, ${player.velocity.y.toFixed(1)}`, sx + 20, sy - 36);
        ctx.fillText(`Move: ${player.currentMove ?? 'none'} f${player.moveFrame}`, sx + 20, sy - 24);
        ctx.fillText(`Grounded: ${player.isGrounded}`, sx + 20, sy - 12);
      }
    }

    // Camera info
    if (this.debugOptions.showCameraInfo) {
      ctx.fillStyle = '#ffffff';
      ctx.font = '10px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`Cam: ${camX.toFixed(0)}, ${camY.toFixed(0)} z${zoom.toFixed(2)}`, 10, 14);
      ctx.fillText(`Particles: ${this.particleSystem.getActiveCount()}`, 10, 26);
    }
  }

  // =========================================================================
  // Utilities
  // =========================================================================

  /** Resize the canvas to fill its container */
  resizeCanvas(): void {
    const parent = this.canvas.parentElement;
    if (parent) {
      this.canvas.width = parent.clientWidth;
      this.canvas.height = parent.clientHeight;
    }
  }

  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  getCamera(): CameraState {
    return this.camera;
  }
}

// ============================================================================
// Helpers
// ============================================================================

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
