// ============================================================================
// Cosmic Knockout - SVG-Path-Based Character Renderer
// ============================================================================
// Pure Canvas 2D renderer using Path2D and bezier curves for detailed,
// unique character silhouettes. Each of the 6 fighters has a completely
// distinct body shape, drawn with canvas path commands.
// Art style: "Neon Geometric" -- glowing outlines, gradient fills, particle FX.
// ============================================================================

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CharacterColors {
  primary: string;
  secondary: string;
  accent: string;
  glow: string;
}

/** Draw signature shared by every character draw function. */
type CharacterDrawFn = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  facing: number,
  state: string,
  stateFrame: number,
  damage: number,
  colors: CharacterColors,
) => void;

// ---------------------------------------------------------------------------
// Default color palettes per character
// ---------------------------------------------------------------------------

export const CHARACTER_PALETTES: Record<string, CharacterColors> = {
  blaze: { primary: '#ff4400', secondary: '#ff8800', accent: '#ffcc00', glow: '#ff6600' },
  zephyr: { primary: '#00ccff', secondary: '#88eeff', accent: '#ffffff', glow: '#00eeff' },
  granite: { primary: '#aa7744', secondary: '#cc9966', accent: '#ffddaa', glow: '#ddaa66' },
  volt: { primary: '#ffee00', secondary: '#88ccff', accent: '#ffffff', glow: '#ffff44' },
  tide: { primary: '#0055cc', secondary: '#0088ff', accent: '#66ddff', glow: '#0077ff' },
  nova: { primary: '#aa22ff', secondary: '#dd66ff', accent: '#ffaaff', glow: '#cc44ff' },
};

// ---------------------------------------------------------------------------
// AnimPose -- body-part offsets/rotations for animation
// ---------------------------------------------------------------------------

interface AnimPose {
  bodyOffsetY: number;
  headRotation: number;
  headOffsetY: number;
  leftArmRotation: number;
  rightArmRotation: number;
  leftLegRotation: number;
  rightLegRotation: number;
  lean: number;
  squash: number;
  opacity: number;
  flashWhite: boolean;
}

// ---------------------------------------------------------------------------
// Math / color helpers
// ---------------------------------------------------------------------------

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

function rgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

function pseudoRandom(seed: number): number {
  let s = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  s = s - Math.floor(s);
  return s;
}

// ---------------------------------------------------------------------------
// Pose computation -- animation states
// ---------------------------------------------------------------------------

function getBasePose(): AnimPose {
  return {
    bodyOffsetY: 0,
    headRotation: 0,
    headOffsetY: 0,
    leftArmRotation: 0.15,
    rightArmRotation: -0.15,
    leftLegRotation: 0,
    rightLegRotation: 0,
    lean: 0,
    squash: 1,
    opacity: 1,
    flashWhite: false,
  };
}

function computePose(state: string, frame: number): AnimPose {
  const p = getBasePose();
  const t = frame;

  switch (state) {
    case 'idle': {
      const breath = Math.sin(t * 0.06);
      p.bodyOffsetY = breath * 1.5;
      p.headOffsetY = breath * 0.5;
      p.leftArmRotation = 0.15 + Math.sin(t * 0.04) * 0.06;
      p.rightArmRotation = -0.15 - Math.sin(t * 0.04) * 0.06;
      break;
    }
    case 'walking': {
      const cycle = t * 0.15;
      p.lean = 5 * DEG;
      p.bodyOffsetY = Math.sin(cycle * 2) * 1.2;
      p.leftArmRotation = Math.sin(cycle) * 0.3;
      p.rightArmRotation = -Math.sin(cycle) * 0.3;
      p.leftLegRotation = Math.sin(cycle) * 0.35;
      p.rightLegRotation = -Math.sin(cycle) * 0.35;
      break;
    }
    case 'running': {
      const cycle = t * 0.25;
      p.lean = 12 * DEG;
      p.squash = 1.05;
      p.bodyOffsetY = Math.sin(cycle * 2) * 2;
      p.leftArmRotation = Math.sin(cycle) * 0.55;
      p.rightArmRotation = -Math.sin(cycle) * 0.55;
      p.leftLegRotation = Math.sin(cycle) * 0.5;
      p.rightLegRotation = -Math.sin(cycle) * 0.5;
      break;
    }
    case 'run_brake': {
      p.lean = -10 * DEG;
      p.squash = 0.92;
      p.leftArmRotation = 0.4;
      p.rightArmRotation = -0.4;
      break;
    }
    case 'jumping': {
      p.bodyOffsetY = -2;
      p.squash = 0.9;
      p.leftArmRotation = -0.5;
      p.rightArmRotation = 0.5;
      p.leftLegRotation = 0.4;
      p.rightLegRotation = -0.15;
      p.headOffsetY = -1;
      break;
    }
    case 'falling':
    case 'fast_falling': {
      p.squash = state === 'fast_falling' ? 1.15 : 1.05;
      p.bodyOffsetY = 1;
      p.leftArmRotation = -0.3;
      p.rightArmRotation = 0.3;
      p.leftLegRotation = -0.15;
      p.rightLegRotation = 0.15;
      break;
    }
    case 'attacking': {
      const phase = clamp(t / 12, 0, 1);
      const swing = phase < 0.35 ? phase / 0.35 : 1 - (phase - 0.35) / 0.65;
      p.lean = swing * 15 * DEG;
      p.rightArmRotation = -0.3 + swing * 1.6;
      p.leftArmRotation = -swing * 0.25;
      p.flashWhite = phase > 0.15 && phase < 0.5;
      p.bodyOffsetY = -swing * 2;
      break;
    }
    case 'shielding': {
      p.squash = 0.88;
      p.bodyOffsetY = 3;
      p.leftArmRotation = 0.6;
      p.rightArmRotation = -0.6;
      p.headOffsetY = 1;
      break;
    }
    case 'hitstun':
    case 'tumble': {
      p.lean = -18 * DEG;
      p.bodyOffsetY = Math.sin(t * 0.5) * 3;
      p.flashWhite = t % 4 < 2;
      p.leftArmRotation = 0.7;
      p.rightArmRotation = -0.8;
      p.headRotation = Math.sin(t * 0.3) * 0.15;
      break;
    }
    case 'dodging': {
      p.opacity = 0.3 + Math.sin(t * 0.6) * 0.12;
      p.bodyOffsetY = Math.sin(t * 0.3) * 2;
      p.squash = 0.95;
      break;
    }
    case 'grabbing': {
      p.lean = 10 * DEG;
      p.rightArmRotation = 0.9;
      p.leftArmRotation = 0.7;
      break;
    }
    case 'grabbed': {
      p.lean = -6 * DEG;
      p.squash = 0.9;
      p.flashWhite = t % 6 < 3;
      break;
    }
    case 'throwing': {
      const throwPhase = clamp(t / 10, 0, 1);
      p.lean = throwPhase < 0.5 ? -12 * DEG : 20 * DEG;
      p.rightArmRotation = throwPhase < 0.5 ? -0.5 : 1.4;
      break;
    }
    case 'ledge_hang': {
      p.bodyOffsetY = 6;
      p.rightArmRotation = -1.3;
      p.leftLegRotation = 0.1;
      p.rightLegRotation = -0.1;
      break;
    }
    case 'crouching': {
      p.squash = 0.75;
      p.bodyOffsetY = 6;
      p.leftArmRotation = 0.3;
      p.rightArmRotation = -0.3;
      break;
    }
    case 'landing': {
      const landT = clamp(t / 6, 0, 1);
      p.squash = 0.78 + landT * 0.22;
      p.bodyOffsetY = (1 - landT) * 5;
      break;
    }
    case 'helpless': {
      p.lean = -6 * DEG;
      p.opacity = 0.6 + Math.sin(t * 0.15) * 0.12;
      p.leftArmRotation = 0.3;
      p.rightArmRotation = -0.4;
      break;
    }
    case 'shield_broken': {
      p.lean = -10 * DEG;
      p.squash = 0.85;
      p.bodyOffsetY = 4;
      p.flashWhite = t % 8 < 4;
      p.headRotation = Math.sin(t * 0.3) * 0.12;
      break;
    }
    case 'respawning': {
      const respT = clamp(t / 30, 0, 1);
      p.opacity = respT * 0.8 + 0.2;
      p.bodyOffsetY = (1 - respT) * -12;
      break;
    }
    case 'dead': {
      p.opacity = 0;
      break;
    }
    case 'teching':
    case 'tech_roll': {
      const techT = clamp(t / 10, 0, 1);
      p.lean = techT * 0.5;
      p.opacity = 0.5 + techT * 0.5;
      break;
    }
    default:
      break;
  }

  return p;
}

// ---------------------------------------------------------------------------
// Rendering Utilities
// ---------------------------------------------------------------------------

export function drawGlow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
  intensity: number,
): void {
  const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
  grad.addColorStop(0, rgba(color, 0.55 * intensity));
  grad.addColorStop(0.35, rgba(color, 0.22 * intensity));
  grad.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, TAU);
  ctx.fill();
}

export function drawNeonOutline(
  ctx: CanvasRenderingContext2D,
  pathFn: (c: CanvasRenderingContext2D) => void,
  color: string,
  thickness: number,
): void {
  const layers = 3;
  for (let i = layers; i >= 0; i--) {
    ctx.save();
    const spread = thickness + i * thickness * 0.7;
    const alpha = i === 0 ? 1.0 : 0.12 / i;
    ctx.lineWidth = spread;
    ctx.strokeStyle = rgba(color, alpha);
    ctx.shadowColor = color;
    ctx.shadowBlur = i * 3;
    ctx.beginPath();
    pathFn(ctx);
    ctx.stroke();
    ctx.restore();
  }
  ctx.save();
  ctx.lineWidth = thickness * 0.4;
  ctx.strokeStyle = rgba('#ffffff', 0.5);
  ctx.beginPath();
  pathFn(ctx);
  ctx.stroke();
  ctx.restore();
}

export function drawDamageEffect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  damage: number,
  _colors: CharacterColors,
): void {
  const severity = clamp(damage / 200, 0, 1);
  if (severity < 0.05) return;

  ctx.save();
  ctx.globalAlpha = severity * 0.25;
  ctx.fillStyle = '#ff2200';
  ctx.fillRect(x - width / 2, y - height, width, height);
  ctx.restore();

  const crackCount = Math.floor(severity * 7) + 1;
  ctx.save();
  ctx.strokeStyle = rgba('#ff4400', 0.35 + severity * 0.5);
  ctx.lineWidth = 0.8 + severity;
  ctx.shadowColor = '#ff6600';
  ctx.shadowBlur = 3 * severity;
  for (let i = 0; i < crackCount; i++) {
    const sx = x + (pseudoRandom(i * 7 + 1) - 0.5) * width * 0.8;
    const sy = y - height * (0.2 + pseudoRandom(i * 13 + 3) * 0.6);
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    const segs = 2 + Math.floor(severity * 3);
    let cx2 = sx;
    let cy2 = sy;
    for (let s = 0; s < segs; s++) {
      cx2 += (pseudoRandom(i * 31 + s * 11) - 0.5) * width * 0.2;
      cy2 += (pseudoRandom(i * 17 + s * 23) - 0.3) * height * 0.12;
      ctx.lineTo(cx2, cy2);
    }
    ctx.stroke();
  }
  ctx.restore();

  if (severity > 0.5) {
    const pulse = Math.sin(Date.now() * 0.008) * 0.15 + 0.85;
    drawGlow(ctx, x, y - height * 0.5, width * 0.5 * pulse, '#ff3300', (severity - 0.5) * 1.4);
  }
}

export function drawShield(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  health: number,
): void {
  const effectiveRadius = radius * (0.5 + health * 0.5);
  let r: number, g: number, b: number;
  if (health > 0.5) {
    const t2 = (health - 0.5) * 2;
    r = Math.round(lerp(255, 0, t2));
    g = Math.round(lerp(255, 230, t2));
    b = Math.round(lerp(0, 255, t2));
  } else {
    const t2 = health * 2;
    r = 255;
    g = Math.round(lerp(50, 255, t2));
    b = 0;
  }
  const col = `rgb(${r},${g},${b})`;
  drawGlow(ctx, x, y, effectiveRadius * 1.3, col, 0.3 + health * 0.3);
  ctx.save();
  const grad = ctx.createRadialGradient(
    x - effectiveRadius * 0.2, y - effectiveRadius * 0.2,
    effectiveRadius * 0.1, x, y, effectiveRadius,
  );
  grad.addColorStop(0, `rgba(${r},${g},${b},0.22)`);
  grad.addColorStop(0.7, `rgba(${r},${g},${b},0.1)`);
  grad.addColorStop(1, `rgba(${r},${g},${b},0.03)`);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, effectiveRadius, 0, TAU);
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = `rgba(${r},${g},${b},0.65)`;
  ctx.shadowColor = col;
  ctx.shadowBlur = 8;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x - effectiveRadius * 0.25, y - effectiveRadius * 0.25, effectiveRadius * 0.15, 0, TAU);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Filled shape helpers
// ---------------------------------------------------------------------------

function fillPolygon(
  ctx: CanvasRenderingContext2D,
  points: [number, number][],
  fill: string | CanvasGradient,
  strokeColor?: string,
  strokeWidth?: number,
): void {
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i][0], points[i][1]);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (strokeColor && strokeWidth) {
    ctx.lineWidth = strokeWidth;
    ctx.strokeStyle = strokeColor;
    ctx.stroke();
  }
}

function fillRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: string | CanvasGradient,
): void {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

// ---------------------------------------------------------------------------
// Character proportion specs
// ---------------------------------------------------------------------------

interface CharacterSpec {
  // Game-unit dimensions (before zoom)
  width: number;
  height: number;
  headSize: number;       // radius
  torsoWidth: number;
  torsoHeight: number;
  armLength: number;
  armWidth: number;
  legLength: number;
  legWidth: number;
  shoulderWidth: number;  // lateral offset from center for arm pivots
}

const SPECS: Record<string, CharacterSpec> = {
  blaze: {
    width: 32, height: 50,
    headSize: 6.5, torsoWidth: 14, torsoHeight: 16,
    armLength: 14, armWidth: 3.8,
    legLength: 14, legWidth: 3.5,
    shoulderWidth: 7.5,
  },
  zephyr: {
    width: 24, height: 46,
    headSize: 5.5, torsoWidth: 9, torsoHeight: 17,
    armLength: 13, armWidth: 2.2,
    legLength: 16, legWidth: 2.5,
    shoulderWidth: 5,
  },
  granite: {
    width: 38, height: 52,
    headSize: 7, torsoWidth: 18, torsoHeight: 18,
    armLength: 15, armWidth: 5,
    legLength: 12, legWidth: 5,
    shoulderWidth: 10,
  },
  volt: {
    width: 26, height: 48,
    headSize: 5.5, torsoWidth: 11, torsoHeight: 16,
    armLength: 13, armWidth: 2.5,
    legLength: 14, legWidth: 2.8,
    shoulderWidth: 6,
  },
  tide: {
    width: 30, height: 48,
    headSize: 7, torsoWidth: 14, torsoHeight: 15,
    armLength: 16, armWidth: 4,
    legLength: 13, legWidth: 3.5,
    shoulderWidth: 7.5,
  },
  nova: {
    width: 28, height: 48,
    headSize: 6, torsoWidth: 12, torsoHeight: 15,
    armLength: 14, armWidth: 3,
    legLength: 14, legWidth: 3,
    shoulderWidth: 6.5,
  },
};

// ===================================================================
// Helper: draw a single limb segment
// ===================================================================

function drawLimb(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  width: number,
  length: number,
  angle: number,
  color: string,
  glowColor: string,
  z: number,
): void {
  ctx.save();
  ctx.translate(ox, oy);
  ctx.rotate(angle);
  ctx.shadowColor = glowColor;
  ctx.shadowBlur = 4 * z;
  const grad = ctx.createLinearGradient(0, 0, 0, length);
  grad.addColorStop(0, color);
  grad.addColorStop(1, rgba(color, 0.65));
  fillRoundedRect(ctx, -width / 2, 0, width, length, width * 0.35, grad);
  ctx.strokeStyle = rgba(glowColor, 0.35);
  ctx.lineWidth = 0.6 * z;
  ctx.beginPath();
  ctx.moveTo(-width / 2, 1);
  ctx.lineTo(-width / 2, length - 1);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.restore();
}

// ===================================================================
// BLAZE -- Fire Bruiser
// ===================================================================

function drawBlaze(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  facing: number, state: string, stateFrame: number,
  damage: number, colors: CharacterColors,
): void {
  const sp = SPECS.blaze;
  const z = w / sp.width; // zoom factor
  const pose = computePose(state, stateFrame);

  ctx.save();
  ctx.globalAlpha = pose.opacity;
  ctx.translate(x, y + pose.bodyOffsetY * z);
  ctx.scale(facing, 1);

  const torsoW = sp.torsoWidth * z;
  const torsoH = sp.torsoHeight * z * pose.squash;
  const legLen = sp.legLength * z;
  const legW = sp.legWidth * z;
  const armLen = sp.armLength * z;
  const armW = sp.armWidth * z;
  const headR = sp.headSize * z;
  const shoulderOff = sp.shoulderWidth * z;

  // Vertical layout: feet at y=0, legs go up, then torso, then head
  const legTop = -legLen;
  const torsoBot = legTop;
  const torsoTop = torsoBot - torsoH;
  const headCY = torsoTop - headR * 0.6;

  // --- Fire particles from head / shoulders ---
  ctx.save();
  for (let i = 0; i < 7; i++) {
    const seed = i * 73 + stateFrame * 3;
    const px = (pseudoRandom(seed) - 0.5) * torsoW * 1.4;
    const baseY = headCY - headR;
    const life = (pseudoRandom(seed + 3) + stateFrame * 0.04) % 1;
    const py = baseY - life * h * 0.18;
    const sz = (1.5 + pseudoRandom(seed + 2) * 3) * z;
    const alpha = (1 - life) * 0.65;
    ctx.fillStyle = rgba(life < 0.5 ? colors.accent : colors.secondary, alpha);
    ctx.shadowColor = colors.glow;
    ctx.shadowBlur = 6 * z;
    ctx.beginPath();
    // Flame teardrop shape
    ctx.moveTo(px, py - sz);
    ctx.quadraticCurveTo(px + sz * 0.7, py, px, py + sz * 0.4);
    ctx.quadraticCurveTo(px - sz * 0.7, py, px, py - sz);
    ctx.fill();
  }
  ctx.restore();

  // --- Legs (angular boots) ---
  ctx.save();
  // Left leg
  ctx.save();
  ctx.translate(-torsoW * 0.25, torsoBot);
  ctx.rotate(pose.leftLegRotation);
  const bootH = legLen * 0.25;
  // Angular leg shape
  ctx.beginPath();
  ctx.moveTo(-legW * 0.5, 0);
  ctx.lineTo(legW * 0.5, 0);
  ctx.lineTo(legW * 0.6, legLen - bootH);
  ctx.lineTo(legW * 0.9, legLen - bootH * 0.3);
  ctx.lineTo(legW * 0.9, legLen);
  ctx.lineTo(-legW * 0.7, legLen);
  ctx.lineTo(-legW * 0.6, legLen - bootH);
  ctx.lineTo(-legW * 0.5, 0);
  ctx.closePath();
  ctx.fillStyle = colors.primary;
  ctx.shadowColor = colors.glow;
  ctx.shadowBlur = 3 * z;
  ctx.fill();
  ctx.strokeStyle = rgba(colors.accent, 0.3);
  ctx.lineWidth = 0.8 * z;
  ctx.stroke();
  ctx.restore();
  // Right leg
  ctx.save();
  ctx.translate(torsoW * 0.25, torsoBot);
  ctx.rotate(pose.rightLegRotation);
  ctx.beginPath();
  ctx.moveTo(-legW * 0.5, 0);
  ctx.lineTo(legW * 0.5, 0);
  ctx.lineTo(legW * 0.6, legLen - bootH);
  ctx.lineTo(legW * 0.9, legLen - bootH * 0.3);
  ctx.lineTo(legW * 0.9, legLen);
  ctx.lineTo(-legW * 0.7, legLen);
  ctx.lineTo(-legW * 0.6, legLen - bootH);
  ctx.lineTo(-legW * 0.5, 0);
  ctx.closePath();
  ctx.fillStyle = colors.primary;
  ctx.shadowColor = colors.glow;
  ctx.shadowBlur = 3 * z;
  ctx.fill();
  ctx.strokeStyle = rgba(colors.accent, 0.3);
  ctx.lineWidth = 0.8 * z;
  ctx.stroke();
  ctx.restore();
  ctx.restore();

  // --- Body lean wrapper ---
  ctx.save();
  ctx.rotate(pose.lean);

  // --- Torso (wide trapezoid, V-shaped) ---
  const topW = torsoW * 0.6;
  const botW = torsoW * 0.38;
  const bodyGrad = ctx.createLinearGradient(0, torsoTop, 0, torsoBot);
  bodyGrad.addColorStop(0, colors.primary);
  bodyGrad.addColorStop(0.4, colors.secondary);
  bodyGrad.addColorStop(1, colors.primary);
  ctx.shadowColor = colors.glow;
  ctx.shadowBlur = 8 * z;

  ctx.beginPath();
  ctx.moveTo(-topW, torsoTop);
  ctx.lineTo(topW, torsoTop);
  // Shoulder pad notches
  ctx.lineTo(topW + torsoW * 0.08, torsoTop + torsoH * 0.12);
  ctx.lineTo(topW * 0.9, torsoTop + torsoH * 0.2);
  ctx.lineTo(botW, torsoBot);
  ctx.lineTo(-botW, torsoBot);
  ctx.lineTo(-topW * 0.9, torsoTop + torsoH * 0.2);
  ctx.lineTo(-topW - torsoW * 0.08, torsoTop + torsoH * 0.12);
  ctx.closePath();
  ctx.fillStyle = bodyGrad;
  ctx.fill();

  drawNeonOutline(ctx, (c) => {
    c.moveTo(-topW, torsoTop);
    c.lineTo(topW, torsoTop);
    c.lineTo(topW + torsoW * 0.08, torsoTop + torsoH * 0.12);
    c.lineTo(topW * 0.9, torsoTop + torsoH * 0.2);
    c.lineTo(botW, torsoBot);
    c.lineTo(-botW, torsoBot);
    c.lineTo(-topW * 0.9, torsoTop + torsoH * 0.2);
    c.lineTo(-topW - torsoW * 0.08, torsoTop + torsoH * 0.12);
    c.closePath();
  }, colors.glow, 1.2 * z);

  // Center seam line
  ctx.strokeStyle = rgba(colors.accent, 0.12);
  ctx.lineWidth = 0.5 * z;
  ctx.beginPath();
  ctx.moveTo(0, torsoTop + torsoH * 0.15);
  ctx.lineTo(0, torsoBot - torsoH * 0.1);
  ctx.stroke();

  // --- Arms (thick, angular with pointed fists) ---
  const shoulderY = torsoTop + torsoH * 0.12;

  // Right arm (front)
  ctx.save();
  ctx.translate(shoulderOff, shoulderY);
  ctx.rotate(pose.rightArmRotation);
  // Angular arm shape
  ctx.beginPath();
  ctx.moveTo(-armW * 0.5, 0);
  ctx.lineTo(armW * 0.5, 0);
  ctx.lineTo(armW * 0.55, armLen * 0.6);
  ctx.lineTo(armW * 0.7, armLen * 0.85);  // wrist flare
  ctx.lineTo(armW * 0.2, armLen);           // fist point
  ctx.lineTo(-armW * 0.4, armLen * 0.92);
  ctx.lineTo(-armW * 0.5, armLen * 0.6);
  ctx.closePath();
  const armGrad = ctx.createLinearGradient(0, 0, 0, armLen);
  armGrad.addColorStop(0, colors.secondary);
  armGrad.addColorStop(1, colors.primary);
  ctx.fillStyle = armGrad;
  ctx.shadowColor = colors.glow;
  ctx.shadowBlur = 4 * z;
  ctx.fill();
  ctx.strokeStyle = rgba(colors.accent, 0.3);
  ctx.lineWidth = 0.7 * z;
  ctx.stroke();
  ctx.restore();

  // Left arm (back)
  ctx.save();
  ctx.translate(-shoulderOff, shoulderY);
  ctx.rotate(pose.leftArmRotation);
  ctx.beginPath();
  ctx.moveTo(-armW * 0.5, 0);
  ctx.lineTo(armW * 0.5, 0);
  ctx.lineTo(armW * 0.5, armLen * 0.6);
  ctx.lineTo(armW * 0.3, armLen * 0.9);
  ctx.lineTo(-armW * 0.3, armLen);
  ctx.lineTo(-armW * 0.6, armLen * 0.85);
  ctx.lineTo(-armW * 0.55, armLen * 0.6);
  ctx.closePath();
  ctx.fillStyle = armGrad;
  ctx.shadowColor = colors.glow;
  ctx.shadowBlur = 4 * z;
  ctx.fill();
  ctx.strokeStyle = rgba(colors.accent, 0.25);
  ctx.lineWidth = 0.7 * z;
  ctx.stroke();
  ctx.restore();

  // --- Head (pentagon with flame spikes) ---
  ctx.save();
  ctx.translate(0, headCY + pose.headOffsetY * z);
  ctx.rotate(pose.headRotation);
  ctx.shadowColor = colors.glow;
  ctx.shadowBlur = 10 * z;

  const headGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, headR * 1.1);
  headGrad.addColorStop(0, colors.secondary);
  headGrad.addColorStop(0.7, colors.primary);
  headGrad.addColorStop(1, rgba(colors.primary, 0.8));

  // Pentagon jawline
  ctx.beginPath();
  ctx.moveTo(0, -headR * 0.7);
  ctx.lineTo(headR * 0.85, -headR * 0.25);
  ctx.lineTo(headR * 0.65, headR * 0.6);
  ctx.lineTo(0, headR * 0.8);           // chin point
  ctx.lineTo(-headR * 0.65, headR * 0.6);
  ctx.lineTo(-headR * 0.85, -headR * 0.25);
  ctx.closePath();
  ctx.fillStyle = headGrad;
  ctx.fill();

  // Flame spikes on top
  const spikeColors = [colors.accent, colors.secondary, colors.accent];
  const spikeX = [-headR * 0.4, 0, headR * 0.4];
  const spikeH = [headR * 0.9, headR * 1.2, headR * 0.85];
  for (let i = 0; i < 3; i++) {
    const flicker = Math.sin(stateFrame * 0.15 + i * 2.1) * headR * 0.1;
    ctx.beginPath();
    ctx.moveTo(spikeX[i] - headR * 0.18, -headR * 0.6);
    ctx.quadraticCurveTo(spikeX[i], -headR * 0.6 - spikeH[i] - flicker,
                         spikeX[i] + headR * 0.18, -headR * 0.6);
    ctx.fillStyle = rgba(spikeColors[i], 0.7);
    ctx.shadowColor = colors.accent;
    ctx.shadowBlur = 6 * z;
    ctx.fill();
  }

  // Eyes
  ctx.fillStyle = colors.accent;
  ctx.shadowColor = colors.accent;
  ctx.shadowBlur = 5 * z;
  ctx.beginPath();
  ctx.arc(-headR * 0.3, -headR * 0.05, headR * 0.11, 0, TAU);
  ctx.arc(headR * 0.3, -headR * 0.05, headR * 0.11, 0, TAU);
  ctx.fill();

  drawNeonOutline(ctx, (c) => {
    c.moveTo(0, -headR * 0.7);
    c.lineTo(headR * 0.85, -headR * 0.25);
    c.lineTo(headR * 0.65, headR * 0.6);
    c.lineTo(0, headR * 0.8);
    c.lineTo(-headR * 0.65, headR * 0.6);
    c.lineTo(-headR * 0.85, -headR * 0.25);
    c.closePath();
  }, colors.glow, 1.0 * z);

  ctx.restore(); // head

  // Attack flash
  if (pose.flashWhite) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = rgba('#ffffff', 0.2);
    ctx.fillRect(-w * 0.4, torsoTop - headR * 2, w * 0.8, -torsoTop + headR * 2);
    ctx.globalCompositeOperation = 'source-over';
  }

  // Attack arm trail
  if (state === 'attacking') {
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.translate(shoulderOff, shoulderY);
    ctx.rotate(pose.rightArmRotation);
    const trailGrad = ctx.createLinearGradient(0, 0, 0, armLen);
    trailGrad.addColorStop(0, rgba(colors.accent, 0.6));
    trailGrad.addColorStop(1, rgba(colors.accent, 0));
    ctx.fillStyle = trailGrad;
    ctx.fillRect(-armW, 0, armW * 2, armLen);
    ctx.restore();
  }

  ctx.restore(); // body lean

  // Aura glow
  const auraI = state === 'attacking' ? 0.6 : 0.22;
  drawGlow(ctx, 0, (torsoTop + torsoBot) / 2, w * 0.45, colors.glow, auraI);

  ctx.restore(); // main transform

  drawDamageEffect(ctx, x, y, w, h, damage, colors);
  if (state === 'shielding') {
    drawShield(ctx, x, y - h * 0.45, w * 0.5, 1.0);
  }
}

// ===================================================================
// ZEPHYR -- Wind Speedster
// ===================================================================

function drawZephyr(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  facing: number, state: string, stateFrame: number,
  damage: number, colors: CharacterColors,
): void {
  const sp = SPECS.zephyr;
  const z = w / sp.width;
  const pose = computePose(state, stateFrame);

  ctx.save();
  ctx.globalAlpha = pose.opacity;
  ctx.translate(x, y + pose.bodyOffsetY * z);
  ctx.scale(facing, 1);

  const torsoW = sp.torsoWidth * z;
  const torsoH = sp.torsoHeight * z * pose.squash;
  const legLen = sp.legLength * z;
  const legW = sp.legWidth * z;
  const armLen = sp.armLength * z;
  const armW = sp.armWidth * z;
  const headR = sp.headSize * z;
  const shoulderOff = sp.shoulderWidth * z;

  const legTop = -legLen;
  const torsoBot = legTop;
  const torsoTop = torsoBot - torsoH;
  const headCY = torsoTop - headR * 0.5;

  // --- Speed trails behind body ---
  if (state === 'running' || state === 'walking') {
    ctx.save();
    const trailCount = state === 'running' ? 8 : 5;
    for (let i = 0; i < trailCount; i++) {
      const trailX = -torsoW * 0.6 - i * 5 * z;
      const trailY = (torsoTop + torsoBot) / 2 + (pseudoRandom(i * 41 + stateFrame * 2) - 0.5) * h * 0.3;
      const alpha = (1 - i / trailCount) * 0.35;
      ctx.strokeStyle = rgba(colors.accent, alpha);
      ctx.lineWidth = (1 + pseudoRandom(i * 17) * 0.8) * z;
      ctx.beginPath();
      ctx.moveTo(trailX, trailY);
      ctx.lineTo(trailX - 10 * z, trailY + (pseudoRandom(i * 19) - 0.5) * 3 * z);
      ctx.stroke();
    }
    ctx.restore();
  }

  // --- Legs (long, bladed feet) ---
  ctx.save();
  // Left leg
  ctx.save();
  ctx.translate(-torsoW * 0.22, torsoBot);
  ctx.rotate(pose.leftLegRotation);
  ctx.beginPath();
  ctx.moveTo(-legW * 0.5, 0);
  ctx.lineTo(legW * 0.5, 0);
  ctx.lineTo(legW * 0.3, legLen * 0.7);
  ctx.lineTo(legW * 1.2, legLen);           // blade tip forward
  ctx.lineTo(-legW * 0.3, legLen * 0.95);
  ctx.lineTo(-legW * 0.4, legLen * 0.7);
  ctx.closePath();
  ctx.fillStyle = colors.primary;
  ctx.shadowColor = colors.glow;
  ctx.shadowBlur = 3 * z;
  ctx.fill();
  ctx.strokeStyle = rgba(colors.accent, 0.35);
  ctx.lineWidth = 0.6 * z;
  ctx.stroke();
  ctx.restore();
  // Right leg
  ctx.save();
  ctx.translate(torsoW * 0.22, torsoBot);
  ctx.rotate(pose.rightLegRotation);
  ctx.beginPath();
  ctx.moveTo(-legW * 0.5, 0);
  ctx.lineTo(legW * 0.5, 0);
  ctx.lineTo(legW * 0.3, legLen * 0.7);
  ctx.lineTo(legW * 1.2, legLen);
  ctx.lineTo(-legW * 0.3, legLen * 0.95);
  ctx.lineTo(-legW * 0.4, legLen * 0.7);
  ctx.closePath();
  ctx.fillStyle = colors.primary;
  ctx.shadowColor = colors.glow;
  ctx.shadowBlur = 3 * z;
  ctx.fill();
  ctx.strokeStyle = rgba(colors.accent, 0.35);
  ctx.lineWidth = 0.6 * z;
  ctx.stroke();
  ctx.restore();
  ctx.restore();

  // --- Body lean ---
  ctx.save();
  ctx.rotate(pose.lean);

  // --- Torso (narrow elongated diamond) ---
  const bodyGrad = ctx.createLinearGradient(0, torsoTop, 0, torsoBot);
  bodyGrad.addColorStop(0, colors.secondary);
  bodyGrad.addColorStop(0.5, colors.primary);
  bodyGrad.addColorStop(1, colors.secondary);

  ctx.shadowColor = colors.glow;
  ctx.shadowBlur = 8 * z;

  // Elongated diamond with aerodynamic curves
  ctx.beginPath();
  ctx.moveTo(0, torsoTop);
  ctx.bezierCurveTo(torsoW * 0.55, torsoTop + torsoH * 0.2,
                     torsoW * 0.5, torsoTop + torsoH * 0.5,
                     torsoW * 0.25, torsoBot);
  ctx.lineTo(-torsoW * 0.25, torsoBot);
  ctx.bezierCurveTo(-torsoW * 0.5, torsoTop + torsoH * 0.5,
                     -torsoW * 0.55, torsoTop + torsoH * 0.2,
                     0, torsoTop);
  ctx.closePath();
  ctx.fillStyle = bodyGrad;
  ctx.fill();

  drawNeonOutline(ctx, (c) => {
    c.moveTo(0, torsoTop);
    c.bezierCurveTo(torsoW * 0.55, torsoTop + torsoH * 0.2,
                     torsoW * 0.5, torsoTop + torsoH * 0.5,
                     torsoW * 0.25, torsoBot);
    c.lineTo(-torsoW * 0.25, torsoBot);
    c.bezierCurveTo(-torsoW * 0.5, torsoTop + torsoH * 0.5,
                     -torsoW * 0.55, torsoTop + torsoH * 0.2,
                     0, torsoTop);
    c.closePath();
  }, colors.glow, 0.9 * z);

  // --- Arms (thin, swept-back, pointed fingertips) ---
  const shoulderY = torsoTop + torsoH * 0.18;

  // Right arm
  ctx.save();
  ctx.translate(shoulderOff, shoulderY);
  ctx.rotate(pose.rightArmRotation + 0.3);
  ctx.beginPath();
  ctx.moveTo(-armW * 0.4, 0);
  ctx.lineTo(armW * 0.4, 0);
  ctx.lineTo(armW * 0.2, armLen * 0.8);
  ctx.lineTo(0, armLen + armW);  // pointed tip
  ctx.lineTo(-armW * 0.3, armLen * 0.8);
  ctx.closePath();
  ctx.fillStyle = colors.secondary;
  ctx.shadowColor = colors.glow;
  ctx.shadowBlur = 3 * z;
  ctx.fill();
  ctx.restore();

  // Left arm
  ctx.save();
  ctx.translate(-shoulderOff, shoulderY);
  ctx.rotate(pose.leftArmRotation - 0.3);
  ctx.beginPath();
  ctx.moveTo(-armW * 0.4, 0);
  ctx.lineTo(armW * 0.4, 0);
  ctx.lineTo(armW * 0.2, armLen * 0.8);
  ctx.lineTo(0, armLen + armW);
  ctx.lineTo(-armW * 0.3, armLen * 0.8);
  ctx.closePath();
  ctx.fillStyle = colors.secondary;
  ctx.shadowColor = colors.glow;
  ctx.shadowBlur = 3 * z;
  ctx.fill();
  ctx.restore();

  // --- Head (sleek teardrop helmet) ---
  ctx.save();
  ctx.translate(0, headCY + pose.headOffsetY * z);
  ctx.rotate(pose.headRotation);
  ctx.shadowColor = colors.glow;
  ctx.shadowBlur = 8 * z;

  const headGrad = ctx.createRadialGradient(-headR * 0.2, 0, 0, 0, 0, headR * 1.2);
  headGrad.addColorStop(0, colors.accent);
  headGrad.addColorStop(0.4, colors.secondary);
  headGrad.addColorStop(1, colors.primary);

  // Teardrop pointing backward (left in facing-right)
  ctx.beginPath();
  ctx.moveTo(headR * 0.3, -headR * 0.65);
  ctx.bezierCurveTo(headR * 0.9, -headR * 0.5,
                     headR * 0.9, headR * 0.5,
                     headR * 0.3, headR * 0.6);
  ctx.quadraticCurveTo(0, headR * 0.55,
                        -headR * 0.4, headR * 0.35);
  ctx.lineTo(-headR * 1.2, 0);             // swept-back tail
  ctx.lineTo(-headR * 0.4, -headR * 0.35);
  ctx.quadraticCurveTo(0, -headR * 0.55,
                        headR * 0.3, -headR * 0.65);
  ctx.closePath();
  ctx.fillStyle = headGrad;
  ctx.fill();

  // Visor line
  ctx.strokeStyle = rgba(colors.accent, 0.8);
  ctx.lineWidth = 1.5 * z;
  ctx.shadowColor = colors.accent;
  ctx.shadowBlur = 6 * z;
  ctx.beginPath();
  ctx.moveTo(-headR * 0.2, -headR * 0.05);
  ctx.lineTo(headR * 0.7, -headR * 0.05);
  ctx.stroke();

  drawNeonOutline(ctx, (c) => {
    c.moveTo(headR * 0.3, -headR * 0.65);
    c.bezierCurveTo(headR * 0.9, -headR * 0.5,
                     headR * 0.9, headR * 0.5,
                     headR * 0.3, headR * 0.6);
    c.quadraticCurveTo(0, headR * 0.55,
                        -headR * 0.4, headR * 0.35);
    c.lineTo(-headR * 1.2, 0);
    c.lineTo(-headR * 0.4, -headR * 0.35);
    c.quadraticCurveTo(0, -headR * 0.55,
                        headR * 0.3, -headR * 0.65);
    c.closePath();
  }, colors.glow, 0.8 * z);

  ctx.restore(); // head

  // Wind swirl particles
  ctx.save();
  for (let i = 0; i < 4; i++) {
    const seed = i * 53 + stateFrame;
    const angle = (stateFrame * 0.08 + i * TAU / 4) % TAU;
    const dist = torsoW * 0.8 + pseudoRandom(seed) * torsoW * 0.4;
    const px = Math.cos(angle) * dist;
    const py = (torsoTop + torsoBot) / 2 + Math.sin(angle) * dist * 0.5;
    ctx.strokeStyle = rgba(colors.accent, 0.25 + Math.sin(stateFrame * 0.1 + i) * 0.15);
    ctx.lineWidth = 0.8 * z;
    ctx.beginPath();
    ctx.arc(px, py, 2 * z, angle, angle + Math.PI);
    ctx.stroke();
  }
  ctx.restore();

  if (pose.flashWhite) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = rgba('#ffffff', 0.18);
    ctx.fillRect(-w * 0.3, torsoTop - headR * 2, w * 0.6, h);
    ctx.globalCompositeOperation = 'source-over';
  }

  ctx.restore(); // body lean

  if (state === 'running') {
    drawGlow(ctx, -torsoW * 0.5, (torsoTop + torsoBot) / 2, w * 0.35, colors.accent, 0.3);
  }
  drawGlow(ctx, 0, (torsoTop + torsoBot) / 2, w * 0.4, colors.glow, 0.18);

  ctx.restore();

  drawDamageEffect(ctx, x, y, w, h, damage, colors);
  if (state === 'shielding') {
    drawShield(ctx, x, y - h * 0.45, w * 0.45, 1.0);
  }
}

// ===================================================================
// GRANITE -- Earth Tank
// ===================================================================

function drawGranite(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  facing: number, state: string, stateFrame: number,
  damage: number, colors: CharacterColors,
): void {
  const sp = SPECS.granite;
  const z = w / sp.width;
  const pose = computePose(state, stateFrame);

  ctx.save();
  ctx.globalAlpha = pose.opacity;
  ctx.translate(x, y + pose.bodyOffsetY * z);
  ctx.scale(facing, 1);

  const torsoW = sp.torsoWidth * z;
  const torsoH = sp.torsoHeight * z * pose.squash;
  const legLen = sp.legLength * z;
  const legW = sp.legWidth * z;
  const armLen = sp.armLength * z;
  const armW = sp.armWidth * z;
  const headR = sp.headSize * z;
  const shoulderOff = sp.shoulderWidth * z;

  const legTop = -legLen;
  const torsoBot = legTop;
  const torsoTop = torsoBot - torsoH;
  const headCY = torsoTop - headR * 0.5;

  // --- Orbiting rock chunks ---
  ctx.save();
  for (let i = 0; i < 5; i++) {
    const angle = (stateFrame * 0.02 + i * TAU / 5) % TAU;
    const orbitR = w * 0.42 + pseudoRandom(i * 53) * 5 * z;
    const px = Math.cos(angle) * orbitR;
    const py = (torsoTop + torsoBot) / 2 + Math.sin(angle) * orbitR * 0.3;
    const sz = (2 + pseudoRandom(i * 37) * 2.5) * z;
    ctx.fillStyle = rgba(colors.secondary, 0.55);
    ctx.shadowColor = colors.glow;
    ctx.shadowBlur = 3 * z;
    ctx.beginPath();
    ctx.moveTo(px - sz, py);
    ctx.lineTo(px - sz * 0.3, py - sz);
    ctx.lineTo(px + sz * 0.7, py - sz * 0.5);
    ctx.lineTo(px + sz, py + sz * 0.3);
    ctx.lineTo(px, py + sz);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // --- Legs (short thick pillars, wide stance) ---
  ctx.save();
  // Left leg
  ctx.save();
  ctx.translate(-torsoW * 0.35, torsoBot);
  ctx.rotate(pose.leftLegRotation);
  fillRoundedRect(ctx, -legW * 0.6, 0, legW * 1.2, legLen, legW * 0.25, colors.primary);
  ctx.strokeStyle = rgba(colors.accent, 0.2);
  ctx.lineWidth = 0.7 * z;
  // Crack texture on leg
  ctx.beginPath();
  ctx.moveTo(-legW * 0.2, legLen * 0.3);
  ctx.lineTo(legW * 0.1, legLen * 0.6);
  ctx.stroke();
  ctx.restore();
  // Right leg
  ctx.save();
  ctx.translate(torsoW * 0.35, torsoBot);
  ctx.rotate(pose.rightLegRotation);
  fillRoundedRect(ctx, -legW * 0.6, 0, legW * 1.2, legLen, legW * 0.25, colors.primary);
  ctx.strokeStyle = rgba(colors.accent, 0.2);
  ctx.lineWidth = 0.7 * z;
  ctx.beginPath();
  ctx.moveTo(legW * 0.15, legLen * 0.25);
  ctx.lineTo(-legW * 0.1, legLen * 0.55);
  ctx.stroke();
  ctx.restore();
  ctx.restore();

  // --- Body lean ---
  ctx.save();
  ctx.rotate(pose.lean);

  // --- Torso (wide hexagonal fortress) ---
  const bodyCY = (torsoTop + torsoBot) / 2;
  const halfH = torsoH / 2;
  const bodyGrad = ctx.createLinearGradient(0, torsoTop, 0, torsoBot);
  bodyGrad.addColorStop(0, colors.secondary);
  bodyGrad.addColorStop(0.3, colors.primary);
  bodyGrad.addColorStop(0.7, colors.primary);
  bodyGrad.addColorStop(1, rgba(colors.primary, 0.85));

  ctx.shadowColor = colors.glow;
  ctx.shadowBlur = 10 * z;

  // Hexagonal body
  fillPolygon(ctx, [
    [-torsoW * 0.4, torsoTop],
    [torsoW * 0.4, torsoTop],
    [torsoW * 0.55, bodyCY],
    [torsoW * 0.4, torsoBot],
    [-torsoW * 0.4, torsoBot],
    [-torsoW * 0.55, bodyCY],
  ], bodyGrad);

  drawNeonOutline(ctx, (c) => {
    c.moveTo(-torsoW * 0.4, torsoTop);
    c.lineTo(torsoW * 0.4, torsoTop);
    c.lineTo(torsoW * 0.55, bodyCY);
    c.lineTo(torsoW * 0.4, torsoBot);
    c.lineTo(-torsoW * 0.4, torsoBot);
    c.lineTo(-torsoW * 0.55, bodyCY);
    c.closePath();
  }, colors.glow, 1.5 * z);

  // Crack texture lines
  ctx.strokeStyle = rgba(colors.accent, 0.14);
  ctx.lineWidth = 0.8 * z;
  for (let i = 0; i < 5; i++) {
    const ly = torsoTop + halfH * 0.4 * i;
    ctx.beginPath();
    ctx.moveTo(-torsoW * 0.3 + pseudoRandom(i * 71) * 4 * z, ly);
    ctx.lineTo(torsoW * 0.25 - pseudoRandom(i * 91) * 4 * z, ly + pseudoRandom(i * 17) * 3 * z);
    ctx.stroke();
  }

  // --- Arms (huge with boulder fists) ---
  const shoulderY = torsoTop + torsoH * 0.2;

  // Right arm + boulder fist
  ctx.save();
  ctx.translate(shoulderOff, shoulderY);
  ctx.rotate(pose.rightArmRotation + 0.15);
  // Thick arm
  ctx.beginPath();
  ctx.moveTo(-armW * 0.5, 0);
  ctx.lineTo(armW * 0.5, 0);
  ctx.lineTo(armW * 0.55, armLen * 0.7);
  ctx.lineTo(-armW * 0.55, armLen * 0.7);
  ctx.closePath();
  const graniteArmGrad = ctx.createLinearGradient(0, 0, 0, armLen);
  graniteArmGrad.addColorStop(0, colors.secondary);
  graniteArmGrad.addColorStop(1, colors.primary);
  ctx.fillStyle = graniteArmGrad;
  ctx.shadowColor = colors.glow;
  ctx.shadowBlur = 4 * z;
  ctx.fill();
  // Boulder fist
  const fistR = armW * 1.1;
  const fistY = armLen * 0.7 + fistR * 0.5;
  const fistGrad = ctx.createRadialGradient(0, fistY, 0, 0, fistY, fistR);
  fistGrad.addColorStop(0, colors.accent);
  fistGrad.addColorStop(0.6, colors.secondary);
  fistGrad.addColorStop(1, colors.primary);
  ctx.beginPath();
  ctx.arc(0, fistY, fistR, 0, TAU);
  ctx.fillStyle = fistGrad;
  ctx.fill();
  // Crack on fist
  ctx.strokeStyle = rgba(colors.accent, 0.3);
  ctx.lineWidth = 0.6 * z;
  ctx.beginPath();
  ctx.moveTo(-fistR * 0.4, fistY - fistR * 0.2);
  ctx.lineTo(fistR * 0.3, fistY + fistR * 0.3);
  ctx.stroke();
  ctx.restore();

  // Left arm + boulder fist
  ctx.save();
  ctx.translate(-shoulderOff, shoulderY);
  ctx.rotate(pose.leftArmRotation - 0.15);
  ctx.beginPath();
  ctx.moveTo(-armW * 0.5, 0);
  ctx.lineTo(armW * 0.5, 0);
  ctx.lineTo(armW * 0.55, armLen * 0.7);
  ctx.lineTo(-armW * 0.55, armLen * 0.7);
  ctx.closePath();
  ctx.fillStyle = graniteArmGrad;
  ctx.shadowColor = colors.glow;
  ctx.shadowBlur = 4 * z;
  ctx.fill();
  const fistY2 = armLen * 0.7 + fistR * 0.5;
  ctx.beginPath();
  ctx.arc(0, fistY2, fistR, 0, TAU);
  ctx.fillStyle = fistGrad;
  ctx.fill();
  ctx.restore();

  // --- Head (square golem head) ---
  ctx.save();
  ctx.translate(0, headCY + pose.headOffsetY * z);
  ctx.rotate(pose.headRotation);
  ctx.shadowColor = colors.glow;
  ctx.shadowBlur = 8 * z;

  const headW = headR * 1.2;
  const headH2 = headR * 1.0;
  const headGradG = ctx.createLinearGradient(0, -headH2, 0, headH2);
  headGradG.addColorStop(0, colors.secondary);
  headGradG.addColorStop(1, colors.primary);

  fillRoundedRect(ctx, -headW, -headH2, headW * 2, headH2 * 2, 2 * z, headGradG);

  drawNeonOutline(ctx, (c) => {
    c.rect(-headW, -headH2, headW * 2, headH2 * 2);
  }, colors.glow, 1.2 * z);

  // Deep-set rectangular eyes
  ctx.fillStyle = colors.accent;
  ctx.shadowColor = colors.accent;
  ctx.shadowBlur = 3 * z;
  ctx.fillRect(-headW * 0.6, -headH2 * 0.25, headW * 0.4, headH2 * 0.2);
  ctx.fillRect(headW * 0.2, -headH2 * 0.25, headW * 0.4, headH2 * 0.2);

  ctx.restore(); // head

  // Damage chunks
  if (damage > 60) {
    const chipCount = Math.floor(clamp(damage / 50, 1, 5));
    ctx.save();
    for (let i = 0; i < chipCount; i++) {
      const cx2 = (pseudoRandom(i * 43 + 7) - 0.5) * torsoW * 1.2;
      const cy2 = torsoTop + pseudoRandom(i * 67 + 3) * torsoH;
      const cs = (2 + pseudoRandom(i * 89) * 3) * z;
      ctx.fillStyle = rgba(colors.primary, 0.3);
      ctx.beginPath();
      ctx.moveTo(cx2, cy2);
      ctx.lineTo(cx2 + cs, cy2 - cs * 0.5);
      ctx.lineTo(cx2 + cs * 0.3, cy2 + cs);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  if (pose.flashWhite) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = rgba('#ffffff', 0.18);
    ctx.fillRect(-w * 0.45, torsoTop - headR * 2, w * 0.9, h);
    ctx.globalCompositeOperation = 'source-over';
  }

  ctx.restore(); // body lean

  drawGlow(ctx, 0, (torsoTop + torsoBot) / 2, w * 0.5, colors.glow, 0.18);

  ctx.restore();

  drawDamageEffect(ctx, x, y, w, h, damage, colors);
  if (state === 'shielding') {
    drawShield(ctx, x, y - h * 0.4, w * 0.55, 1.0);
  }
}

// ===================================================================
// VOLT -- Electric Glass Cannon
// ===================================================================

function drawVolt(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  facing: number, state: string, stateFrame: number,
  damage: number, colors: CharacterColors,
): void {
  const sp = SPECS.volt;
  const z = w / sp.width;
  const pose = computePose(state, stateFrame);

  ctx.save();
  ctx.globalAlpha = pose.opacity;
  ctx.translate(x, y + pose.bodyOffsetY * z);
  ctx.scale(facing, 1);

  const torsoW = sp.torsoWidth * z;
  const torsoH = sp.torsoHeight * z * pose.squash;
  const legLen = sp.legLength * z;
  const legW = sp.legWidth * z;
  const armLen = sp.armLength * z;
  const armW = sp.armWidth * z;
  const headR = sp.headSize * z;
  const shoulderOff = sp.shoulderWidth * z;

  const legTop = -legLen;
  const torsoBot = legTop;
  const torsoTop = torsoBot - torsoH;
  const headCY = torsoTop - headR * 0.6;

  // --- Electric arcs between body parts ---
  ctx.save();
  ctx.strokeStyle = rgba(colors.accent, 0.65);
  ctx.lineWidth = 1.2 * z;
  ctx.shadowColor = colors.glow;
  ctx.shadowBlur = 6 * z;
  for (let i = 0; i < 5; i++) {
    if (pseudoRandom(stateFrame * 11 + i * 47) > 0.55) continue;
    const sx = (pseudoRandom(stateFrame * 3 + i * 23) - 0.5) * torsoW * 1.2;
    const sy = torsoTop + pseudoRandom(stateFrame * 7 + i * 31) * torsoH;
    const ex = (pseudoRandom(stateFrame * 5 + i * 37) - 0.5) * torsoW * 1.2;
    const ey = torsoTop + pseudoRandom(stateFrame * 9 + i * 41) * torsoH;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    const midX = (sx + ex) / 2 + (pseudoRandom(stateFrame * 13 + i * 53) - 0.5) * 8 * z;
    const midY = (sy + ey) / 2 + (pseudoRandom(stateFrame * 17 + i * 59) - 0.5) * 8 * z;
    ctx.lineTo(midX, midY);
    ctx.lineTo(ex, ey);
    ctx.stroke();
  }
  ctx.restore();

  // Glitch effect at high damage
  if (damage > 70) {
    const gi = clamp((damage - 70) / 130, 0, 1);
    if (pseudoRandom(stateFrame * 37) < gi * 0.35) {
      ctx.save();
      const sliceY = torsoTop + pseudoRandom(stateFrame * 43) * torsoH;
      const sliceH2 = (2 + pseudoRandom(stateFrame * 47) * 5) * z;
      const offset = (pseudoRandom(stateFrame * 51) - 0.5) * 6 * gi * z;
      ctx.translate(offset, 0);
      ctx.fillStyle = rgba(colors.glow, 0.12);
      ctx.fillRect(-w * 0.35, sliceY, w * 0.7, sliceH2);
      ctx.restore();
    }
  }

  // --- Legs (thin angular, asymmetric) ---
  ctx.save();
  // Left leg (shorter, different angle)
  ctx.save();
  ctx.translate(-torsoW * 0.22, torsoBot);
  ctx.rotate(pose.leftLegRotation - 0.08);
  fillPolygon(ctx, [
    [-legW, 0],
    [legW, 0],
    [legW * 0.4, legLen * 0.5],
    [-legW * 1.3, legLen * 0.92],
    [-legW * 0.5, legLen * 0.5],
  ], colors.primary, colors.glow, 0.7 * z);
  ctx.restore();
  // Right leg (longer, different shape)
  ctx.save();
  ctx.translate(torsoW * 0.18, torsoBot);
  ctx.rotate(pose.rightLegRotation + 0.05);
  fillPolygon(ctx, [
    [-legW * 0.4, 0],
    [legW * 1.1, 0],
    [legW * 0.7, legLen],
    [-legW * 0.9, legLen * 0.7],
  ], colors.primary, colors.glow, 0.7 * z);
  ctx.restore();
  ctx.restore();

  // --- Body lean ---
  ctx.save();
  ctx.rotate(pose.lean);

  // --- Torso (zigzag lightning bolt edges) ---
  const zigW = torsoW * 0.5;
  const bh = torsoH;
  const bodyGrad = ctx.createLinearGradient(0, torsoTop, 0, torsoBot);
  bodyGrad.addColorStop(0, colors.primary);
  bodyGrad.addColorStop(0.5, colors.secondary);
  bodyGrad.addColorStop(1, colors.primary);

  ctx.shadowColor = colors.glow;
  ctx.shadowBlur = 12 * z;

  const zigPoints: [number, number][] = [
    [-zigW * 0.3, torsoTop],
    [zigW * 0.5, torsoTop],
    [zigW * 0.2, torsoTop + bh * 0.25],
    [zigW * 0.6, torsoTop + bh * 0.3],
    [zigW * 0.1, torsoTop + bh * 0.55],
    [zigW * 0.45, torsoBot],
    [-zigW * 0.2, torsoBot],
    [-zigW * 0.5, torsoTop + bh * 0.6],
    [-zigW * 0.15, torsoTop + bh * 0.35],
    [-zigW * 0.55, torsoTop + bh * 0.15],
  ];
  fillPolygon(ctx, zigPoints, bodyGrad);

  drawNeonOutline(ctx, (c) => {
    c.moveTo(zigPoints[0][0], zigPoints[0][1]);
    for (let i = 1; i < zigPoints.length; i++) {
      c.lineTo(zigPoints[i][0], zigPoints[i][1]);
    }
    c.closePath();
  }, colors.glow, 1.2 * z);

  // --- Arms (jagged, pointed ends) ---
  const shoulderY = torsoTop + bh * 0.15;

  // Right arm (longer, jagged)
  ctx.save();
  ctx.translate(zigW * 0.4, shoulderY);
  ctx.rotate(pose.rightArmRotation + 0.35);
  fillPolygon(ctx, [
    [-armW, 0],
    [armW, 0],
    [armW * 1.4, armLen * 0.4],
    [armW * 0.2, armLen * 0.65],
    [armW * 1.8, armLen],     // jagged point
    [-armW * 0.4, armLen * 0.8],
  ], colors.secondary, colors.glow, 0.7 * z);
  ctx.restore();

  // Left arm (shorter)
  ctx.save();
  ctx.translate(-zigW * 0.4, shoulderY);
  ctx.rotate(pose.leftArmRotation - 0.35);
  fillPolygon(ctx, [
    [-armW, 0],
    [armW, 0],
    [armW * 0.4, armLen * 0.5],
    [-armW * 1.4, armLen * 0.85],
    [-armW * 0.3, armLen * 0.55],
  ], colors.secondary, colors.glow, 0.7 * z);
  ctx.restore();

  // --- Head (sharp triangle with antenna spikes) ---
  ctx.save();
  ctx.translate(0, headCY + pose.headOffsetY * z);
  ctx.rotate(pose.headRotation);
  ctx.shadowColor = colors.glow;
  ctx.shadowBlur = 10 * z;

  const headGradV = ctx.createRadialGradient(0, 0, 0, 0, 0, headR);
  headGradV.addColorStop(0, colors.accent);
  headGradV.addColorStop(0.6, colors.secondary);
  headGradV.addColorStop(1, colors.primary);

  // Triangular head
  fillPolygon(ctx, [
    [0, -headR * 0.8],
    [headR * 0.75, headR * 0.45],
    [-headR * 0.75, headR * 0.45],
  ], headGradV);

  // Antenna spikes
  ctx.strokeStyle = colors.accent;
  ctx.lineWidth = 1.5 * z;
  ctx.shadowColor = colors.accent;
  ctx.shadowBlur = 8 * z;
  ctx.beginPath();
  ctx.moveTo(-headR * 0.3, -headR * 0.5);
  ctx.lineTo(-headR * 0.65, -headR * 1.4);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(headR * 0.3, -headR * 0.5);
  ctx.lineTo(headR * 0.55, -headR * 1.3);
  ctx.stroke();

  // Antenna tip sparks
  const sparkAlpha = 0.5 + Math.sin(stateFrame * 0.3) * 0.4;
  drawGlow(ctx, -headR * 0.65, -headR * 1.4, 3 * z, colors.accent, sparkAlpha);
  drawGlow(ctx, headR * 0.55, -headR * 1.3, 3 * z, colors.accent, sparkAlpha);

  // Single eye slit
  ctx.fillStyle = colors.accent;
  ctx.shadowBlur = 6 * z;
  ctx.beginPath();
  ctx.ellipse(0, headR * 0.0, headR * 0.35, headR * 0.08, 0, 0, TAU);
  ctx.fill();

  drawNeonOutline(ctx, (c) => {
    c.moveTo(0, -headR * 0.8);
    c.lineTo(headR * 0.75, headR * 0.45);
    c.lineTo(-headR * 0.75, headR * 0.45);
    c.closePath();
  }, colors.glow, 1.0 * z);

  ctx.restore(); // head

  if (pose.flashWhite) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = rgba('#ffffff', 0.25);
    ctx.fillRect(-w * 0.35, torsoTop - headR * 2, w * 0.7, h);
    ctx.globalCompositeOperation = 'source-over';
  }

  ctx.restore(); // body lean

  // Constant sparking aura
  const sparkI = state === 'attacking' ? 0.55 : 0.25;
  drawGlow(ctx, 0, (torsoTop + torsoBot) / 2, w * 0.45, colors.glow, sparkI + Math.sin(stateFrame * 0.4) * 0.08);

  ctx.restore();

  drawDamageEffect(ctx, x, y, w, h, damage, colors);
  if (state === 'shielding') {
    drawShield(ctx, x, y - h * 0.45, w * 0.48, 1.0);
  }
}

// ===================================================================
// TIDE -- Water Grappler
// ===================================================================

function drawTide(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  facing: number, state: string, stateFrame: number,
  damage: number, colors: CharacterColors,
): void {
  const sp = SPECS.tide;
  const z = w / sp.width;
  const pose = computePose(state, stateFrame);

  ctx.save();
  ctx.globalAlpha = pose.opacity;
  ctx.translate(x, y + pose.bodyOffsetY * z);
  ctx.scale(facing, 1);

  const torsoW = sp.torsoWidth * z;
  const torsoH = sp.torsoHeight * z * pose.squash;
  const legLen = sp.legLength * z;
  const legW = sp.legWidth * z;
  const armLen = sp.armLength * z;
  const armW = sp.armWidth * z;
  const headR = sp.headSize * z;
  const shoulderOff = sp.shoulderWidth * z;

  const legTop = -legLen;
  const torsoBot = legTop;
  const torsoTop = torsoBot - torsoH;
  const headCY = torsoTop - headR * 0.5;

  // --- Water droplet particles ---
  ctx.save();
  for (let i = 0; i < 6; i++) {
    const seed = i * 67 + stateFrame;
    const life = ((stateFrame * 0.03 + pseudoRandom(seed)) % 1);
    const dx = (pseudoRandom(seed + 1) - 0.5) * torsoW * 1.3;
    const dy = torsoBot + life * legLen * 0.8;
    const sz = (1.2 + pseudoRandom(seed + 2) * 2) * z;
    const alpha = (1 - life) * 0.45;
    ctx.fillStyle = rgba(colors.accent, alpha);
    ctx.shadowColor = colors.glow;
    ctx.shadowBlur = 3 * z;
    ctx.beginPath();
    ctx.moveTo(dx, dy - sz);
    ctx.quadraticCurveTo(dx + sz, dy, dx, dy + sz * 1.3);
    ctx.quadraticCurveTo(dx - sz, dy, dx, dy - sz);
    ctx.fill();
  }
  ctx.restore();

  // Translucency at high damage
  if (damage > 80) {
    const turb = clamp((damage - 80) / 120, 0, 1);
    ctx.globalAlpha *= (1 - turb * 0.3);
  }

  // --- Legs (rounded sturdy with flowing edges) ---
  ctx.save();
  // Left leg
  ctx.save();
  ctx.translate(-torsoW * 0.25, torsoBot);
  ctx.rotate(pose.leftLegRotation);
  ctx.beginPath();
  ctx.moveTo(-legW * 0.5, 0);
  ctx.quadraticCurveTo(-legW * 0.7, legLen * 0.5, -legW * 0.5, legLen);
  ctx.quadraticCurveTo(0, legLen + legW * 0.3, legW * 0.5, legLen);
  ctx.quadraticCurveTo(legW * 0.7, legLen * 0.5, legW * 0.5, 0);
  ctx.closePath();
  ctx.fillStyle = colors.primary;
  ctx.shadowColor = colors.glow;
  ctx.shadowBlur = 3 * z;
  ctx.fill();
  ctx.restore();
  // Right leg
  ctx.save();
  ctx.translate(torsoW * 0.25, torsoBot);
  ctx.rotate(pose.rightLegRotation);
  ctx.beginPath();
  ctx.moveTo(-legW * 0.5, 0);
  ctx.quadraticCurveTo(-legW * 0.7, legLen * 0.5, -legW * 0.5, legLen);
  ctx.quadraticCurveTo(0, legLen + legW * 0.3, legW * 0.5, legLen);
  ctx.quadraticCurveTo(legW * 0.7, legLen * 0.5, legW * 0.5, 0);
  ctx.closePath();
  ctx.fillStyle = colors.primary;
  ctx.shadowColor = colors.glow;
  ctx.shadowBlur = 3 * z;
  ctx.fill();
  ctx.restore();
  ctx.restore();

  // --- Body lean ---
  ctx.save();
  ctx.rotate(pose.lean);

  // --- Torso (oval with sine-wave contour) ---
  const bodyCY = (torsoTop + torsoBot) / 2;
  const bodyRx = torsoW * 0.5;
  const bodyRy = torsoH * 0.5;
  const bodyGrad = ctx.createRadialGradient(0, bodyCY, 0, 0, bodyCY, bodyRx * 1.1);
  bodyGrad.addColorStop(0, colors.secondary);
  bodyGrad.addColorStop(0.55, colors.primary);
  bodyGrad.addColorStop(1, rgba(colors.primary, 0.8));

  ctx.shadowColor = colors.glow;
  ctx.shadowBlur = 10 * z;

  // Wavy oval body
  const segs = 28;
  ctx.beginPath();
  for (let i = 0; i <= segs; i++) {
    const angle = (i / segs) * TAU;
    const wave = Math.sin(angle * 4 + stateFrame * 0.08) * 1.8 * z;
    const px = Math.cos(angle) * (bodyRx + wave);
    const py = bodyCY + Math.sin(angle) * (bodyRy + wave * 0.4);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = bodyGrad;
  ctx.fill();

  drawNeonOutline(ctx, (c) => {
    for (let i = 0; i <= segs; i++) {
      const angle = (i / segs) * TAU;
      const wave = Math.sin(angle * 4 + stateFrame * 0.08) * 1.8 * z;
      const px = Math.cos(angle) * (bodyRx + wave);
      const py = bodyCY + Math.sin(angle) * (bodyRy + wave * 0.4);
      if (i === 0) c.moveTo(px, py);
      else c.lineTo(px, py);
    }
    c.closePath();
  }, colors.glow, 1.2 * z);

  // Internal water ripples
  ctx.save();
  ctx.globalAlpha = 0.1;
  ctx.strokeStyle = colors.accent;
  ctx.lineWidth = 0.6 * z;
  for (let r = 1; r <= 3; r++) {
    const ripR = r * bodyRx * 0.2;
    const rPhase = stateFrame * 0.04 + r * 0.5;
    ctx.beginPath();
    ctx.arc(Math.sin(rPhase) * 2 * z, bodyCY + Math.cos(rPhase) * 1.5 * z, ripR, 0, TAU);
    ctx.stroke();
  }
  ctx.restore();

  // --- Arms (thick tentacle-like, bezier tapered) ---
  const shoulderY = bodyCY - bodyRy * 0.35;

  // Right arm
  ctx.save();
  ctx.translate(shoulderOff, shoulderY);
  ctx.rotate(pose.rightArmRotation + 0.15);
  const waveOff = Math.sin(stateFrame * 0.1) * 2 * z;
  ctx.beginPath();
  ctx.moveTo(-armW * 0.6, 0);
  ctx.bezierCurveTo(-armW * 0.9, armLen * 0.35 + waveOff,
                     -armW * 0.4, armLen * 0.7 - waveOff,
                     -armW * 0.15, armLen);
  ctx.quadraticCurveTo(0, armLen + 2 * z, armW * 0.15, armLen);
  ctx.bezierCurveTo(armW * 0.4, armLen * 0.7 - waveOff,
                     armW * 0.9, armLen * 0.35 + waveOff,
                     armW * 0.6, 0);
  ctx.closePath();
  ctx.fillStyle = colors.secondary;
  ctx.shadowColor = colors.glow;
  ctx.shadowBlur = 5 * z;
  ctx.fill();
  ctx.restore();

  // Left arm
  ctx.save();
  ctx.translate(-shoulderOff, shoulderY);
  ctx.rotate(pose.leftArmRotation - 0.15);
  const waveOff2 = Math.sin(stateFrame * 0.1 + 1.5) * 2 * z;
  ctx.beginPath();
  ctx.moveTo(-armW * 0.6, 0);
  ctx.bezierCurveTo(-armW * 0.9, armLen * 0.35 + waveOff2,
                     -armW * 0.4, armLen * 0.7 - waveOff2,
                     -armW * 0.15, armLen);
  ctx.quadraticCurveTo(0, armLen + 2 * z, armW * 0.15, armLen);
  ctx.bezierCurveTo(armW * 0.4, armLen * 0.7 - waveOff2,
                     armW * 0.9, armLen * 0.35 + waveOff2,
                     armW * 0.6, 0);
  ctx.closePath();
  ctx.fillStyle = colors.secondary;
  ctx.shadowColor = colors.glow;
  ctx.shadowBlur = 5 * z;
  ctx.fill();
  ctx.restore();

  // --- Head (jellyfish: circle with flowing tendrils) ---
  ctx.save();
  ctx.translate(0, headCY + pose.headOffsetY * z);
  ctx.rotate(pose.headRotation);
  ctx.shadowColor = colors.glow;
  ctx.shadowBlur = 10 * z;

  const headGradT = ctx.createRadialGradient(0, 0, 0, 0, 0, headR);
  headGradT.addColorStop(0, colors.accent);
  headGradT.addColorStop(0.5, colors.secondary);
  headGradT.addColorStop(1, colors.primary);

  // Head dome (top half circle)
  ctx.beginPath();
  ctx.arc(0, 0, headR, Math.PI, 0);
  ctx.quadraticCurveTo(headR * 0.5, headR * 0.3, 0, headR * 0.4);
  ctx.quadraticCurveTo(-headR * 0.5, headR * 0.3, -headR, 0);
  ctx.closePath();
  ctx.fillStyle = headGradT;
  ctx.fill();

  // Flowing tendrils hanging down
  ctx.strokeStyle = rgba(colors.secondary, 0.55);
  ctx.lineWidth = 2 * z;
  ctx.shadowColor = colors.glow;
  ctx.shadowBlur = 4 * z;
  const tendrils = 4;
  for (let i = 0; i < tendrils; i++) {
    const baseX = (i - (tendrils - 1) / 2) * headR * 0.45;
    const tendrilLen = headR * (1.0 + pseudoRandom(i * 31) * 0.5);
    const wv = Math.sin(stateFrame * 0.1 + i * 1.2) * 3 * z;
    ctx.beginPath();
    ctx.moveTo(baseX, headR * 0.3);
    ctx.quadraticCurveTo(baseX + wv, headR * 0.3 + tendrilLen * 0.5,
                          baseX + wv * 0.7, headR * 0.3 + tendrilLen);
    ctx.stroke();
  }

  // Eyes
  ctx.fillStyle = colors.accent;
  ctx.shadowColor = colors.accent;
  ctx.shadowBlur = 6 * z;
  ctx.beginPath();
  ctx.arc(-headR * 0.35, -headR * 0.15, headR * 0.14, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(headR * 0.35, -headR * 0.15, headR * 0.14, 0, TAU);
  ctx.fill();

  drawNeonOutline(ctx, (c) => {
    c.arc(0, 0, headR, Math.PI, 0);
    c.quadraticCurveTo(headR * 0.5, headR * 0.3, 0, headR * 0.4);
    c.quadraticCurveTo(-headR * 0.5, headR * 0.3, -headR, 0);
    c.closePath();
  }, colors.glow, 1.0 * z);

  ctx.restore(); // head

  if (pose.flashWhite) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = rgba('#ffffff', 0.18);
    ctx.fillRect(-w * 0.4, torsoTop - headR * 2, w * 0.8, h);
    ctx.globalCompositeOperation = 'source-over';
  }

  ctx.restore(); // body lean

  drawGlow(ctx, 0, bodyCY, w * 0.5, colors.glow, 0.22 + Math.sin(stateFrame * 0.06) * 0.06);

  ctx.restore();

  drawDamageEffect(ctx, x, y, w, h, damage, colors);
  if (state === 'shielding') {
    drawShield(ctx, x, y - h * 0.4, w * 0.5, 1.0);
  }
}

// ===================================================================
// NOVA -- Cosmic All-Rounder
// ===================================================================

function drawNova(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  facing: number, state: string, stateFrame: number,
  damage: number, colors: CharacterColors,
): void {
  const sp = SPECS.nova;
  const z = w / sp.width;
  const pose = computePose(state, stateFrame);

  ctx.save();
  ctx.globalAlpha = pose.opacity;
  ctx.translate(x, y + pose.bodyOffsetY * z);
  ctx.scale(facing, 1);

  const torsoW = sp.torsoWidth * z;
  const torsoH = sp.torsoHeight * z * pose.squash;
  const legLen = sp.legLength * z;
  const legW = sp.legWidth * z;
  const armLen = sp.armLength * z;
  const armW = sp.armWidth * z;
  const headR = sp.headSize * z;
  const shoulderOff = sp.shoulderWidth * z;

  const legTop = -legLen;
  const torsoBot = legTop;
  const torsoTop = torsoBot - torsoH;
  const headCY = torsoTop - headR * 0.55;
  const bodyCY = (torsoTop + torsoBot) / 2;

  // --- Orbiting star particles ---
  ctx.save();
  for (let i = 0; i < 5; i++) {
    const orbitAngle = stateFrame * 0.03 * (1 + i * 0.15) + i * TAU / 5;
    const orbitR = w * 0.4 + pseudoRandom(i * 29) * 6 * z;
    const starX = Math.cos(orbitAngle) * orbitR;
    const starY = bodyCY + Math.sin(orbitAngle) * orbitR * 0.35;
    const sz = (1 + pseudoRandom(i * 61) * 1.5) * z;
    const twinkle = 0.35 + Math.sin(stateFrame * 0.15 + i * 2) * 0.35;
    ctx.fillStyle = rgba(colors.accent, twinkle);
    ctx.shadowColor = colors.accent;
    ctx.shadowBlur = 3 * z;
    // 4-pointed star
    ctx.beginPath();
    for (let p = 0; p < 8; p++) {
      const a = (p / 8) * TAU;
      const r = p % 2 === 0 ? sz : sz * 0.35;
      const px = starX + Math.cos(a) * r;
      const py = starY + Math.sin(a) * r;
      if (p === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }

  // Shooting star
  if (stateFrame % 60 < 8) {
    const shootT = (stateFrame % 60) / 8;
    const sx = -w * 0.4 + shootT * w * 0.8;
    const sy = torsoTop - headR * 2 + shootT * h * 0.2;
    ctx.strokeStyle = rgba(colors.accent, 1 - shootT);
    ctx.lineWidth = 1.2 * z;
    ctx.shadowColor = colors.accent;
    ctx.shadowBlur = 4 * z;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx - 8 * z, sy + 3 * z);
    ctx.stroke();
  }
  ctx.restore();

  // High damage: pulsing
  if (damage > 80) {
    const pulse = Math.sin(stateFrame * 0.15) * 0.25;
    ctx.globalAlpha *= (0.75 + pulse);
  }

  // --- Legs (medium with comet trails when moving) ---
  ctx.save();
  // Left leg
  ctx.save();
  ctx.translate(-torsoW * 0.22, torsoBot);
  ctx.rotate(pose.leftLegRotation);
  drawLimb(ctx, 0, 0, legW, legLen, 0, colors.primary, colors.glow, z);
  ctx.restore();
  // Right leg
  ctx.save();
  ctx.translate(torsoW * 0.22, torsoBot);
  ctx.rotate(pose.rightLegRotation);
  drawLimb(ctx, 0, 0, legW, legLen, 0, colors.primary, colors.glow, z);
  ctx.restore();
  ctx.restore();

  // Comet trails on legs when moving
  if (state === 'running' || state === 'walking') {
    ctx.save();
    for (let i = 0; i < 3; i++) {
      const trailAlpha = (3 - i) / 3 * 0.15;
      ctx.fillStyle = rgba(colors.glow, trailAlpha);
      ctx.beginPath();
      ctx.arc(-torsoW * 0.22 - i * 2 * z, torsoBot + legLen * 0.3 + i * z,
              legW * 0.3, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  // --- Body lean ---
  ctx.save();
  ctx.rotate(pose.lean);

  // --- Orbital ring (behind body) ---
  ctx.save();
  ctx.strokeStyle = rgba(colors.accent, 0.3);
  ctx.lineWidth = 1.5 * z;
  ctx.shadowColor = colors.glow;
  ctx.shadowBlur = 5 * z;
  ctx.beginPath();
  ctx.ellipse(0, bodyCY, torsoW * 0.65, torsoW * 0.18, 0.3, 0, TAU);
  ctx.stroke();
  // Ring particle
  const ringAngle = stateFrame * 0.04;
  const rpx = Math.cos(ringAngle) * torsoW * 0.65;
  const rpy = bodyCY + Math.sin(ringAngle) * torsoW * 0.18;
  ctx.fillStyle = colors.accent;
  ctx.shadowBlur = 6 * z;
  ctx.beginPath();
  ctx.arc(rpx, rpy, 1.8 * z, 0, TAU);
  ctx.fill();
  ctx.restore();

  // --- Torso (balanced oval with subtle star edge) ---
  const bodyR = torsoW * 0.45;
  const bodyGrad = ctx.createRadialGradient(0, bodyCY, 0, 0, bodyCY, bodyR * 1.1);
  bodyGrad.addColorStop(0, colors.accent);
  bodyGrad.addColorStop(0.25, colors.secondary);
  bodyGrad.addColorStop(0.65, colors.primary);
  bodyGrad.addColorStop(1, rgba(colors.primary, 0.75));

  ctx.shadowColor = colors.glow;
  ctx.shadowBlur = 12 * z;

  // Star-edged oval
  const starPts = 8;
  ctx.beginPath();
  for (let i = 0; i <= starPts * 2; i++) {
    const angle = (i / (starPts * 2)) * TAU - Math.PI / 2;
    const rx = i % 2 === 0 ? bodyR : bodyR * 0.85;
    const ry = i % 2 === 0 ? torsoH * 0.5 : torsoH * 0.43;
    const px = Math.cos(angle) * rx;
    const py = bodyCY + Math.sin(angle) * ry;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = bodyGrad;
  ctx.fill();

  drawNeonOutline(ctx, (c) => {
    for (let i = 0; i <= starPts * 2; i++) {
      const angle = (i / (starPts * 2)) * TAU - Math.PI / 2;
      const rx = i % 2 === 0 ? bodyR : bodyR * 0.85;
      const ry = i % 2 === 0 ? torsoH * 0.5 : torsoH * 0.43;
      const px = Math.cos(angle) * rx;
      const py = bodyCY + Math.sin(angle) * ry;
      if (i === 0) c.moveTo(px, py);
      else c.lineTo(px, py);
    }
    c.closePath();
  }, colors.glow, 1.2 * z);

  // --- Arms (medium, starburst hands) ---
  const shoulderY = bodyCY - torsoH * 0.25;

  // Right arm
  ctx.save();
  ctx.translate(shoulderOff, shoulderY);
  ctx.rotate(pose.rightArmRotation + 0.2);
  drawLimb(ctx, 0, 0, armW, armLen, 0, colors.secondary, colors.glow, z);
  // Starburst at hand
  const handY = armLen + armW * 0.3;
  const burstR = armW * 1.0;
  ctx.fillStyle = rgba(colors.accent, 0.5 + Math.sin(stateFrame * 0.12) * 0.3);
  ctx.shadowColor = colors.accent;
  ctx.shadowBlur = 5 * z;
  ctx.beginPath();
  for (let p = 0; p < 8; p++) {
    const a = (p / 8) * TAU;
    const r = p % 2 === 0 ? burstR : burstR * 0.4;
    if (p === 0) ctx.moveTo(Math.cos(a) * r, handY + Math.sin(a) * r);
    else ctx.lineTo(Math.cos(a) * r, handY + Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Left arm
  ctx.save();
  ctx.translate(-shoulderOff, shoulderY);
  ctx.rotate(pose.leftArmRotation - 0.2);
  drawLimb(ctx, 0, 0, armW, armLen, 0, colors.secondary, colors.glow, z);
  // Starburst
  ctx.fillStyle = rgba(colors.accent, 0.4 + Math.sin(stateFrame * 0.12 + 1) * 0.25);
  ctx.shadowColor = colors.accent;
  ctx.shadowBlur = 5 * z;
  ctx.beginPath();
  for (let p = 0; p < 8; p++) {
    const a = (p / 8) * TAU;
    const r = p % 2 === 0 ? burstR : burstR * 0.4;
    if (p === 0) ctx.moveTo(Math.cos(a) * r, handY + Math.sin(a) * r);
    else ctx.lineTo(Math.cos(a) * r, handY + Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // --- Head (circle with corona halo) ---
  ctx.save();
  ctx.translate(0, headCY + pose.headOffsetY * z);
  ctx.rotate(pose.headRotation);
  ctx.shadowColor = colors.glow;
  ctx.shadowBlur = 12 * z;

  // Corona / halo ring
  ctx.save();
  ctx.strokeStyle = rgba(colors.accent, 0.35 + Math.sin(stateFrame * 0.08) * 0.15);
  ctx.lineWidth = 1.5 * z;
  ctx.shadowBlur = 8 * z;
  ctx.beginPath();
  ctx.ellipse(0, -headR * 0.6, headR * 1.15, headR * 0.22, 0, 0, TAU);
  ctx.stroke();
  ctx.restore();

  // Head sphere
  const headGradN = ctx.createRadialGradient(
    -headR * 0.2, -headR * 0.15, 0, 0, 0, headR,
  );
  headGradN.addColorStop(0, '#ffffff');
  headGradN.addColorStop(0.25, colors.accent);
  headGradN.addColorStop(0.6, colors.secondary);
  headGradN.addColorStop(1, colors.primary);

  ctx.beginPath();
  ctx.arc(0, 0, headR, 0, TAU);
  ctx.fillStyle = headGradN;
  ctx.fill();

  drawNeonOutline(ctx, (c) => {
    c.arc(0, 0, headR, 0, TAU);
  }, colors.glow, 1.0 * z);

  // Star-shaped eyes
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = colors.accent;
  ctx.shadowBlur = 6 * z;
  for (const ex of [-headR * 0.32, headR * 0.32]) {
    const ey = -headR * 0.08;
    const eSize = headR * 0.13;
    ctx.beginPath();
    ctx.moveTo(ex, ey - eSize);
    ctx.lineTo(ex + eSize * 0.3, ey);
    ctx.lineTo(ex, ey + eSize);
    ctx.lineTo(ex - eSize * 0.3, ey);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore(); // head

  if (pose.flashWhite) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = rgba('#ffffff', 0.2);
    ctx.fillRect(-w * 0.35, torsoTop - headR * 2, w * 0.7, h);
    ctx.globalCompositeOperation = 'source-over';
  }

  ctx.restore(); // body lean

  // Cosmic glow with twinkle
  const glowPulse = 0.22 + Math.sin(stateFrame * 0.05) * 0.06;
  drawGlow(ctx, 0, bodyCY, w * 0.48, colors.glow, glowPulse);

  ctx.restore();

  drawDamageEffect(ctx, x, y, w, h, damage, colors);
  if (state === 'shielding') {
    drawShield(ctx, x, y - h * 0.45, w * 0.48, 1.0);
  }
}

// ---------------------------------------------------------------------------
// Character registry
// ---------------------------------------------------------------------------

const CHARACTER_DRAW_FUNCTIONS: Record<string, CharacterDrawFn> = {
  blaze: drawBlaze,
  zephyr: drawZephyr,
  granite: drawGranite,
  volt: drawVolt,
  tide: drawTide,
  nova: drawNova,
};

// ---------------------------------------------------------------------------
// Main export: renderCharacter
// ---------------------------------------------------------------------------

/**
 * Renders the specified character with full SVG-path-based neon art style.
 *
 * This is the primary entry point. It supports two call signatures:
 *  - The original (width/height as separate params + optional colors)
 *  - The new simplified (zoom + isInvincible)
 *
 * @param ctx          - Canvas 2D rendering context
 * @param characterId  - One of: blaze, zephyr, granite, volt, tide, nova
 * @param x            - Screen x position (bottom-center of character)
 * @param y            - Screen y position (feet / ground level)
 * @param facing       - 1 for right, -1 for left
 * @param state        - Current state string (e.g. 'idle', 'running', 'attacking')
 * @param stateFrame   - How many frames the character has been in this state
 * @param damage       - Current damage percentage (0-999)
 * @param zoom         - Camera zoom factor (multiplied into all sizes)
 * @param isInvincible - If true, character flashes with alternating alpha
 */
export function renderCharacter(
  ctx: CanvasRenderingContext2D,
  characterId: string,
  x: number,
  y: number,
  facing: number,
  state: string,
  stateFrame: number,
  damage: number,
  zoom: number,
  isInvincible?: boolean,
): void;

/**
 * Legacy overload: renderCharacter with explicit width/height and optional colors.
 */
export function renderCharacter(
  ctx: CanvasRenderingContext2D,
  characterId: string,
  x: number,
  y: number,
  width: number,
  height: number,
  facing: number,
  state: string,
  stateFrame: number,
  damage: number,
  colors?: CharacterColors,
): void;

export function renderCharacter(
  ctx: CanvasRenderingContext2D,
  characterId: string,
  x: number,
  y: number,
  ...rest: unknown[]
): void {
  let width: number;
  let height: number;
  let facing: number;
  let state: string;
  let stateFrame: number;
  let damage: number;
  let colors: CharacterColors | undefined;
  let isInvincible = false;

  // Detect which overload is being used:
  // New signature: (facing, state, stateFrame, damage, zoom, isInvincible?)
  //   rest[0] = facing (1 or -1), rest[1] = state (string)
  // Legacy signature: (width, height, facing, state, stateFrame, damage, colors?)
  //   rest[0] = width (number > 1), rest[1] = height (number > 1)
  if (typeof rest[1] === 'string') {
    // New signature
    facing = rest[0] as number;
    state = rest[1] as string;
    stateFrame = rest[2] as number;
    damage = rest[3] as number;
    const zoom = rest[4] as number;
    isInvincible = (rest[5] as boolean) ?? false;
    const spec = SPECS[characterId];
    if (spec) {
      width = spec.width * zoom;
      height = spec.height * zoom;
    } else {
      width = 28 * zoom;
      height = 48 * zoom;
    }
    colors = CHARACTER_PALETTES[characterId];
  } else {
    // Legacy signature
    width = rest[0] as number;
    height = rest[1] as number;
    facing = rest[2] as number;
    state = rest[3] as string;
    stateFrame = rest[4] as number;
    damage = rest[5] as number;
    colors = rest[6] as CharacterColors | undefined;
  }

  const drawFn = CHARACTER_DRAW_FUNCTIONS[characterId];
  if (!drawFn) {
    ctx.save();
    ctx.fillStyle = '#ff00ff';
    ctx.shadowColor = '#ff00ff';
    ctx.shadowBlur = 10;
    ctx.fillRect(x - width / 2, y - height, width, height);
    ctx.restore();
    return;
  }

  const palette = colors ?? CHARACTER_PALETTES[characterId] ?? {
    primary: '#888888',
    secondary: '#aaaaaa',
    accent: '#ffffff',
    glow: '#cccccc',
  };

  // Invincibility flash
  if (isInvincible && Math.floor(stateFrame / 3) % 2 === 0) {
    ctx.save();
    ctx.globalAlpha = 0.45;
    drawFn(ctx, x, y, width, height, facing, state, stateFrame, damage, palette);
    ctx.restore();
  } else {
    drawFn(ctx, x, y, width, height, facing, state, stateFrame, damage, palette);
  }
}

// Re-export utility types and functions for external use
export {
  type CharacterDrawFn,
  drawGlow as glowEffect,
  drawNeonOutline as neonOutlineEffect,
};
