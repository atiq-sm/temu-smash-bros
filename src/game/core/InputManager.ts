// ============================================================================
// Temu Smash Bros - Input Manager
// ============================================================================

import {
  InputState,
  InputSnapshot,
  BufferedInput,
} from './types';

/** Default empty input state */
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

function cloneInput(input: InputState): InputState {
  return { ...input };
}

// --- Keyboard Mappings ---

interface KeyMapping {
  left: string;
  right: string;
  up: string;
  down: string;
  attack: string;
  special: string;
  shield: string;
  grab: string;
  jump: string;
  cStickLeft: string;
  cStickRight: string;
  cStickUp: string;
  cStickDown: string;
}

const KEYBOARD1_MAP: KeyMapping = {
  left: 'a',
  right: 'd',
  up: 'w',
  down: 's',
  attack: 'f',
  special: 'g',
  shield: 'h',
  grab: 'r',
  jump: 'w',
  cStickLeft: 'j',
  cStickRight: 'l',
  cStickUp: 'i',
  cStickDown: 'k',
};

const KEYBOARD2_MAP: KeyMapping = {
  left: 'ArrowLeft',
  right: 'ArrowRight',
  up: 'ArrowUp',
  down: 'ArrowDown',
  attack: '.',
  special: '/',
  shield: 'Shift',
  grab: ',',
  jump: 'ArrowUp',
  cStickLeft: 'Delete',
  cStickRight: 'PageDown',
  cStickUp: 'Home',
  cStickDown: 'End',
};

// --- Constants ---

const INPUT_BUFFER_SIZE = 6;        // frames of input buffering
const SMASH_INPUT_WINDOW = 3;       // frames for smash input detection
const TAP_THRESHOLD = 4;            // frames held threshold for tap vs hold

// ============================================================================
// InputManager
// ============================================================================

export class InputManager {
  private keyStates: Map<string, boolean> = new Map();
  private playerInputs: Map<number, InputSnapshot> = new Map();
  private inputBuffers: Map<number, BufferedInput[]> = new Map();
  private smashTimers: Map<number, { left: number; right: number; up: number; down: number }> = new Map();
  private controlSchemes: Map<number, 'keyboard1' | 'keyboard2' | 'gamepad'> = new Map();
  private gamepadIndices: Map<number, number> = new Map();
  private currentFrame: number = 0;
  private boundKeyDown: (e: KeyboardEvent) => void;
  private boundKeyUp: (e: KeyboardEvent) => void;

  constructor() {
    this.boundKeyDown = this.onKeyDown.bind(this);
    this.boundKeyUp = this.onKeyUp.bind(this);
  }

  /** Attach keyboard listeners to the window */
  init(): void {
    window.addEventListener('keydown', this.boundKeyDown);
    window.addEventListener('keyup', this.boundKeyUp);
  }

  /** Remove keyboard listeners */
  destroy(): void {
    window.removeEventListener('keydown', this.boundKeyDown);
    window.removeEventListener('keyup', this.boundKeyUp);
  }

  /** Register a player with a control scheme */
  registerPlayer(
    playerId: number,
    scheme: 'keyboard1' | 'keyboard2' | 'gamepad',
    gamepadIndex?: number,
  ): void {
    this.controlSchemes.set(playerId, scheme);
    if (scheme === 'gamepad' && gamepadIndex !== undefined) {
      this.gamepadIndices.set(playerId, gamepadIndex);
    }
    this.playerInputs.set(playerId, {
      current: emptyInput(),
      previous: emptyInput(),
      pressed: emptyInput(),
      holdFrames: { left: 0, right: 0, up: 0, down: 0 },
    });
    this.inputBuffers.set(playerId, []);
    this.smashTimers.set(playerId, { left: 0, right: 0, up: 0, down: 0 });
  }

  /** Call once per game frame to poll and process inputs */
  update(frame: number): void {
    this.currentFrame = frame;

    for (const [playerId, scheme] of this.controlSchemes) {
      const snapshot = this.playerInputs.get(playerId)!;
      const previousInput = cloneInput(snapshot.current);

      let rawInput: InputState;
      if (scheme === 'keyboard1') {
        rawInput = this.readKeyboard(KEYBOARD1_MAP);
      } else if (scheme === 'keyboard2') {
        rawInput = this.readKeyboard(KEYBOARD2_MAP);
      } else {
        rawInput = this.readGamepad(this.gamepadIndices.get(playerId) ?? 0);
      }

      // Build pressed (rising edge) for each boolean
      const pressed = emptyInput();
      (Object.keys(pressed) as (keyof InputState)[]).forEach((key) => {
        if (key === 'cStickX' || key === 'cStickY') return;
        (pressed as unknown as Record<string, boolean>)[key] =
          !!rawInput[key] && !previousInput[key];
      });

      // Hold frame tracking
      const hold = snapshot.holdFrames;
      hold.left = rawInput.left ? hold.left + 1 : 0;
      hold.right = rawInput.right ? hold.right + 1 : 0;
      hold.up = rawInput.up ? hold.up + 1 : 0;
      hold.down = rawInput.down ? hold.down + 1 : 0;

      // Smash input timers (count down)
      const smash = this.smashTimers.get(playerId)!;
      if (pressed.left) smash.left = SMASH_INPUT_WINDOW;
      else smash.left = Math.max(0, smash.left - 1);
      if (pressed.right) smash.right = SMASH_INPUT_WINDOW;
      else smash.right = Math.max(0, smash.right - 1);
      if (pressed.up) smash.up = SMASH_INPUT_WINDOW;
      else smash.up = Math.max(0, smash.up - 1);
      if (pressed.down) smash.down = SMASH_INPUT_WINDOW;
      else smash.down = Math.max(0, smash.down - 1);

      snapshot.previous = previousInput;
      snapshot.current = rawInput;
      snapshot.pressed = pressed;

      // Push to buffer
      this.pushBuffer(playerId, rawInput);
    }
  }

  /** Get the current input snapshot for a player */
  getInput(playerId: number): InputSnapshot {
    return this.playerInputs.get(playerId) ?? {
      current: emptyInput(),
      previous: emptyInput(),
      pressed: emptyInput(),
      holdFrames: { left: 0, right: 0, up: 0, down: 0 },
    };
  }

  /** Check if an action was pressed within the buffer window */
  isBuffered(playerId: number, action: keyof InputState): boolean {
    const buffer = this.inputBuffers.get(playerId);
    if (!buffer) return false;
    const cutoff = this.currentFrame - INPUT_BUFFER_SIZE;
    for (let i = buffer.length - 1; i >= 0; i--) {
      if (buffer[i].frame < cutoff) break;
      if (buffer[i].input[action]) return true;
    }
    return false;
  }

  /** Consume a buffered input (removes it from buffer) */
  consumeBuffer(playerId: number, action: keyof InputState): boolean {
    const buffer = this.inputBuffers.get(playerId);
    if (!buffer) return false;
    const cutoff = this.currentFrame - INPUT_BUFFER_SIZE;
    for (let i = buffer.length - 1; i >= 0; i--) {
      if (buffer[i].frame < cutoff) break;
      if (buffer[i].input[action]) {
        buffer.splice(i, 1);
        return true;
      }
    }
    return false;
  }

  /** Returns true if the player just performed a smash input (fast directional + attack) */
  isSmashInput(playerId: number, direction: 'left' | 'right' | 'up' | 'down'): boolean {
    const smash = this.smashTimers.get(playerId);
    const snapshot = this.playerInputs.get(playerId);
    if (!smash || !snapshot) return false;
    return smash[direction] > 0 && snapshot.pressed.attack;
  }

  /** Returns true if directional input is a tap (held for less than threshold) */
  isTap(playerId: number, direction: 'left' | 'right' | 'up' | 'down'): boolean {
    const snapshot = this.playerInputs.get(playerId);
    if (!snapshot) return false;
    return snapshot.holdFrames[direction] > 0 && snapshot.holdFrames[direction] <= TAP_THRESHOLD;
  }

  /** Returns true if directional input is a hold (held for more than threshold) */
  isHold(playerId: number, direction: 'left' | 'right' | 'up' | 'down'): boolean {
    const snapshot = this.playerInputs.get(playerId);
    if (!snapshot) return false;
    return snapshot.holdFrames[direction] > TAP_THRESHOLD;
  }

  /** Get the horizontal input magnitude (-1 to 1) */
  getHorizontalAxis(playerId: number): number {
    const snap = this.playerInputs.get(playerId);
    if (!snap) return 0;
    let axis = 0;
    if (snap.current.left) axis -= 1;
    if (snap.current.right) axis += 1;
    return axis;
  }

  /** Get the vertical input magnitude (-1 to 1, negative = up) */
  getVerticalAxis(playerId: number): number {
    const snap = this.playerInputs.get(playerId);
    if (!snap) return 0;
    let axis = 0;
    if (snap.current.up) axis -= 1;
    if (snap.current.down) axis += 1;
    return axis;
  }

  /** Provide an override input snapshot (used by AI) */
  setInput(playerId: number, input: InputState): void {
    const snapshot = this.playerInputs.get(playerId);
    if (!snapshot) return;

    const previousInput = cloneInput(snapshot.current);

    const pressed = emptyInput();
    (Object.keys(pressed) as (keyof InputState)[]).forEach((key) => {
      if (key === 'cStickX' || key === 'cStickY') return;
      (pressed as unknown as Record<string, boolean>)[key] =
        !!input[key] && !previousInput[key];
    });

    const hold = snapshot.holdFrames;
    hold.left = input.left ? hold.left + 1 : 0;
    hold.right = input.right ? hold.right + 1 : 0;
    hold.up = input.up ? hold.up + 1 : 0;
    hold.down = input.down ? hold.down + 1 : 0;

    snapshot.previous = previousInput;
    snapshot.current = input;
    snapshot.pressed = pressed;

    this.pushBuffer(playerId, input);
  }

  reset(): void {
    this.keyStates.clear();
    for (const [playerId] of this.controlSchemes) {
      this.playerInputs.set(playerId, {
        current: emptyInput(),
        previous: emptyInput(),
        pressed: emptyInput(),
        holdFrames: { left: 0, right: 0, up: 0, down: 0 },
      });
      this.inputBuffers.set(playerId, []);
      this.smashTimers.set(playerId, { left: 0, right: 0, up: 0, down: 0 });
    }
  }

  // --- Private ---

  private onKeyDown(e: KeyboardEvent): void {
    this.keyStates.set(e.key, true);
    // Prevent default for game keys to avoid scrolling etc.
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
      e.preventDefault();
    }
  }

  private onKeyUp(e: KeyboardEvent): void {
    this.keyStates.set(e.key, false);
  }

  private isKeyDown(key: string): boolean {
    return this.keyStates.get(key) ?? false;
  }

  private readKeyboard(map: KeyMapping): InputState {
    return {
      left: this.isKeyDown(map.left),
      right: this.isKeyDown(map.right),
      up: this.isKeyDown(map.up),
      down: this.isKeyDown(map.down),
      attack: this.isKeyDown(map.attack),
      special: this.isKeyDown(map.special),
      shield: this.isKeyDown(map.shield),
      grab: this.isKeyDown(map.grab),
      jump: this.isKeyDown(map.jump),
      cStickX:
        (this.isKeyDown(map.cStickRight) ? 1 : 0) -
        (this.isKeyDown(map.cStickLeft) ? 1 : 0),
      cStickY:
        (this.isKeyDown(map.cStickDown) ? 1 : 0) -
        (this.isKeyDown(map.cStickUp) ? 1 : 0),
    };
  }

  private readGamepad(index: number): InputState {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = gamepads[index];
    if (!gp) return emptyInput();

    const DEADZONE = 0.2;
    const lx = Math.abs(gp.axes[0]) > DEADZONE ? gp.axes[0] : 0;
    const ly = Math.abs(gp.axes[1]) > DEADZONE ? gp.axes[1] : 0;
    const rx = gp.axes.length > 2 ? (Math.abs(gp.axes[2]) > DEADZONE ? gp.axes[2] : 0) : 0;
    const ry = gp.axes.length > 3 ? (Math.abs(gp.axes[3]) > DEADZONE ? gp.axes[3] : 0) : 0;

    return {
      left: lx < -0.5,
      right: lx > 0.5,
      up: ly < -0.5,
      down: ly > 0.5,
      attack: gp.buttons[0]?.pressed ?? false,     // A / Cross
      special: gp.buttons[2]?.pressed ?? false,     // X / Square
      shield: (gp.buttons[6]?.pressed ?? false) || (gp.buttons[7]?.pressed ?? false), // Triggers
      grab: gp.buttons[5]?.pressed ?? false,        // RB
      jump: (gp.buttons[1]?.pressed ?? false) || (gp.buttons[3]?.pressed ?? false), // B/Y or Circle/Triangle
      cStickX: rx,
      cStickY: ry,
    };
  }

  private pushBuffer(playerId: number, input: InputState): void {
    const buffer = this.inputBuffers.get(playerId);
    if (!buffer) return;
    buffer.push({ input: cloneInput(input), frame: this.currentFrame });
    // Trim old entries
    const cutoff = this.currentFrame - INPUT_BUFFER_SIZE * 2;
    while (buffer.length > 0 && buffer[0].frame < cutoff) {
      buffer.shift();
    }
  }
}
