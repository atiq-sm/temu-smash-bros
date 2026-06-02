// ============================================================================
// Temu Smash Bros - Audio Manager
// ============================================================================
// Fully procedural audio system using the Web Audio API.
// Every sound effect and music track is synthesized in real-time --
// no external audio files are loaded.
// ============================================================================

// --- Types ---

type SFXName =
  // Combat
  | 'hit_light' | 'hit_medium' | 'hit_heavy'
  | 'hit_electric' | 'hit_fire' | 'hit_water' | 'hit_earth' | 'hit_cosmic'
  // Movement
  | 'jump' | 'double_jump' | 'land' | 'dash'
  | 'shield_on' | 'shield_hit' | 'shield_break' | 'dodge'
  | 'grab' | 'throw'
  // KO / Match
  | 'ko_blast' | 'ko_star'
  | 'match_start' | 'match_end' | 'results_win'
  // UI
  | 'menu_move' | 'menu_select' | 'menu_back' | 'menu_error' | 'text_type';

type MusicTheme = 'menu_theme' | 'battle_theme' | 'results_theme';

type OscType = OscillatorType;

// --- ADSR Envelope Helper ---

interface ADSRParams {
  attack: number;   // seconds
  decay: number;    // seconds
  sustain: number;  // 0-1 gain level
  release: number;  // seconds
  peak?: number;    // peak gain (default 1)
}

// --- Music Theme Definition ---

interface ThemeDefinition {
  tempo: number;                        // BPM
  scale: number[];                      // semitone offsets from root
  rootNote: number;                     // MIDI note number for root
  chordProgression: number[][];         // array of chords, each chord is array of semitone offsets
  bassEnabled: boolean;
  padEnabled: boolean;
  rhythmEnabled: boolean;
  melodyEnabled: boolean;
  intensity: number;                    // 0-1
  swingAmount: number;                  // 0-1
}

// --- Constants ---

const MIDI_A4 = 69;
const FREQ_A4 = 440;

function midiToFreq(midi: number): number {
  return FREQ_A4 * Math.pow(2, (midi - MIDI_A4) / 12);
}

// Musical scales (semitone offsets from root)
const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];
const MINOR_SCALE = [0, 2, 3, 5, 7, 8, 10];
// Pentatonic minor available for future character-specific themes
// const PENTATONIC_MINOR = [0, 3, 5, 7, 10];

// Theme definitions
const THEMES: Record<MusicTheme, ThemeDefinition> = {
  menu_theme: {
    tempo: 85,
    scale: MAJOR_SCALE,
    rootNote: 60, // C4
    chordProgression: [
      [0, 4, 7],      // I   (C major)
      [5, 9, 12],     // IV  (F major)
      [7, 11, 14],    // V   (G major)
      [0, 4, 7],      // I   (C major)
      [9, 12, 16],    // vi  (A minor)
      [5, 9, 12],     // IV  (F major)
      [7, 11, 14],    // V   (G major)
      [0, 4, 7],      // I   (C major)
    ],
    bassEnabled: true,
    padEnabled: true,
    rhythmEnabled: false,
    melodyEnabled: true,
    intensity: 0.3,
    swingAmount: 0.1,
  },
  battle_theme: {
    tempo: 150,
    scale: MINOR_SCALE,
    rootNote: 57, // A3
    chordProgression: [
      [0, 3, 7],      // i   (A minor)
      [5, 8, 12],     // iv  (D minor)
      [7, 10, 14],    // v   (E minor)
      [3, 7, 10],     // III (C major)
      [0, 3, 7],      // i   (A minor)
      [8, 12, 15],    // VI  (F major)
      [7, 10, 14],    // v   (E minor)
      [0, 3, 7],      // i   (A minor)
    ],
    bassEnabled: true,
    padEnabled: true,
    rhythmEnabled: true,
    melodyEnabled: true,
    intensity: 0.8,
    swingAmount: 0,
  },
  results_theme: {
    tempo: 120,
    scale: MAJOR_SCALE,
    rootNote: 60, // C4
    chordProgression: [
      [0, 4, 7],      // I   (C major)
      [7, 11, 14],    // V   (G major)
      [9, 12, 16],    // vi  (A minor)
      [5, 9, 12],     // IV  (F major)
      [0, 4, 7],      // I
      [0, 4, 7],      // I
      [5, 9, 12],     // IV
      [7, 11, 14],    // V
    ],
    bassEnabled: true,
    padEnabled: true,
    rhythmEnabled: true,
    melodyEnabled: true,
    intensity: 0.6,
    swingAmount: 0.05,
  },
};

// ============================================================================
// AudioManager (Singleton)
// ============================================================================

export class AudioManager {
  private static instance: AudioManager | null = null;

  // --- Core Web Audio ---
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;

  // --- Volume State ---
  private masterVolume: number = 0.7;
  private sfxVolume: number = 0.8;
  private musicVolume: number = 0.5;
  private isMuted: boolean = false;
  private previousMasterVolume: number = 0.7;

  // --- Music State ---
  private currentTheme: MusicTheme | null = null;
  private musicSchedulerId: ReturnType<typeof setInterval> | null = null;
  private activeMusicNodes: (OscillatorNode | AudioBufferSourceNode)[] = [];
  private musicBeatIndex: number = 0;
  private musicNextBeatTime: number = 0;

  // --- Context Initialization ---
  private contextInitialized: boolean = false;
  private pendingInit: boolean = false;
  private initListenersBound: boolean = false;

  private constructor() {
    // Bind user-interaction listeners so we can create AudioContext on first
    // click/keypress (required by browser autoplay policies).
    this.bindInitListeners();
  }

  /** Get the singleton instance */
  static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  // ==========================================================================
  // Context Initialization
  // ==========================================================================

  private bindInitListeners(): void {
    if (this.initListenersBound) return;
    if (typeof window === 'undefined') return;
    this.initListenersBound = true;

    const initOnInteraction = (): void => {
      this.ensureContext();
      window.removeEventListener('click', initOnInteraction);
      window.removeEventListener('keydown', initOnInteraction);
      window.removeEventListener('touchstart', initOnInteraction);
    };

    window.addEventListener('click', initOnInteraction, { once: false });
    window.addEventListener('keydown', initOnInteraction, { once: false });
    window.addEventListener('touchstart', initOnInteraction, { once: false });
  }

  private ensureContext(): void {
    if (this.contextInitialized && this.ctx) {
      // Resume if suspended (e.g. after tab goes to background)
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      return;
    }
    if (this.pendingInit) return;
    this.pendingInit = true;

    try {
      this.ctx = new (window.AudioContext || (window as unknown as Record<string, typeof AudioContext>).webkitAudioContext)();

      // Master -> destination
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.isMuted ? 0 : this.masterVolume;
      this.masterGain.connect(this.ctx.destination);

      // SFX bus -> master
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.sfxVolume;
      this.sfxGain.connect(this.masterGain);

      // Music bus -> master
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this.musicVolume;
      this.musicGain.connect(this.masterGain);

      this.contextInitialized = true;
    } catch {
      // Web Audio not available -- degrade silently
      this.ctx = null;
    }
    this.pendingInit = false;
  }

  /** Resume AudioContext after a user gesture (call from a click/keypress handler). */
  resume(): void {
    this.ensureContext();
  }

  // ==========================================================================
  // Volume Controls
  // ==========================================================================

  setMasterVolume(v: number): void {
    this.masterVolume = Math.max(0, Math.min(1, v));
    if (this.masterGain && !this.isMuted) {
      this.masterGain.gain.setTargetAtTime(this.masterVolume, this.now(), 0.02);
    }
  }

  setSFXVolume(v: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, v));
    if (this.sfxGain) {
      this.sfxGain.gain.setTargetAtTime(this.sfxVolume, this.now(), 0.02);
    }
  }

  setMusicVolume(v: number): void {
    this.musicVolume = Math.max(0, Math.min(1, v));
    if (this.musicGain) {
      this.musicGain.gain.setTargetAtTime(this.musicVolume, this.now(), 0.02);
    }
  }

  toggleMute(): void {
    this.isMuted = !this.isMuted;
    if (this.masterGain) {
      if (this.isMuted) {
        this.previousMasterVolume = this.masterVolume;
        this.masterGain.gain.setTargetAtTime(0, this.now(), 0.02);
      } else {
        this.masterGain.gain.setTargetAtTime(this.previousMasterVolume, this.now(), 0.02);
      }
    }
  }

  getMasterVolume(): number { return this.masterVolume; }
  getSFXVolume(): number { return this.sfxVolume; }
  getMusicVolume(): number { return this.musicVolume; }
  getIsMuted(): boolean { return this.isMuted; }

  // ==========================================================================
  // SFX Playback
  // ==========================================================================

  /** Play a named sound effect at optional volume (0-1, relative to SFX bus). */
  playSFX(name: SFXName, volume: number = 1): void {
    this.ensureContext();
    if (!this.ctx || !this.sfxGain) return;

    const t = this.now();
    const vol = Math.max(0, Math.min(1, volume));

    switch (name) {
      // --- Combat ---
      case 'hit_light':     this.synthHitLight(t, vol); break;
      case 'hit_medium':    this.synthHitMedium(t, vol); break;
      case 'hit_heavy':     this.synthHitHeavy(t, vol); break;
      case 'hit_electric':  this.synthHitElectric(t, vol); break;
      case 'hit_fire':      this.synthHitFire(t, vol); break;
      case 'hit_water':     this.synthHitWater(t, vol); break;
      case 'hit_earth':     this.synthHitEarth(t, vol); break;
      case 'hit_cosmic':    this.synthHitCosmic(t, vol); break;

      // --- Movement ---
      case 'jump':          this.synthJump(t, vol); break;
      case 'double_jump':   this.synthDoubleJump(t, vol); break;
      case 'land':          this.synthLand(t, vol); break;
      case 'dash':          this.synthDash(t, vol); break;
      case 'shield_on':     this.synthShieldOn(t, vol); break;
      case 'shield_hit':    this.synthShieldHit(t, vol); break;
      case 'shield_break':  this.synthShieldBreak(t, vol); break;
      case 'dodge':         this.synthDodge(t, vol); break;
      case 'grab':          this.synthGrab(t, vol); break;
      case 'throw':         this.synthThrow(t, vol); break;

      // --- KO / Match ---
      case 'ko_blast':      this.synthKOBlast(t, vol); break;
      case 'ko_star':       this.synthKOStar(t, vol); break;
      case 'match_start':   this.synthMatchStart(t, vol); break;
      case 'match_end':     this.synthMatchEnd(t, vol); break;
      case 'results_win':   this.synthResultsWin(t, vol); break;

      // --- UI ---
      case 'menu_move':     this.synthMenuMove(t, vol); break;
      case 'menu_select':   this.synthMenuSelect(t, vol); break;
      case 'menu_back':     this.synthMenuBack(t, vol); break;
      case 'menu_error':    this.synthMenuError(t, vol); break;
      case 'text_type':     this.synthTextType(t, vol); break;
    }
  }

  // ==========================================================================
  // Music Playback
  // ==========================================================================

  /** Start playing a procedural music theme. Crossfades if already playing. */
  playMusic(theme: MusicTheme): void {
    this.ensureContext();
    if (!this.ctx || !this.musicGain) return;

    // If same theme already playing, do nothing
    if (this.currentTheme === theme && this.musicSchedulerId !== null) return;

    // Stop existing music with a short crossfade
    if (this.currentTheme !== null) {
      this.stopMusic(300);
    }

    this.currentTheme = theme;
    this.musicBeatIndex = 0;
    this.musicNextBeatTime = this.now() + 0.1; // slight delay for crossfade

    // Schedule beats ahead of time using a lookahead scheduler
    const scheduleAhead = 0.2; // seconds to schedule ahead
    const schedulerInterval = 50; // ms between scheduler ticks

    this.musicSchedulerId = setInterval(() => {
      if (!this.ctx || !this.currentTheme) {
        this.stopMusicInternal();
        return;
      }
      const themeDef = THEMES[this.currentTheme];
      const beatDuration = 60 / themeDef.tempo;

      while (this.musicNextBeatTime < this.now() + scheduleAhead) {
        this.scheduleMusicBeat(themeDef, this.musicNextBeatTime, this.musicBeatIndex);
        this.musicNextBeatTime += beatDuration;
        this.musicBeatIndex++;
      }
    }, schedulerInterval);
  }

  /** Stop music with optional fade-out duration in milliseconds. */
  stopMusic(fadeMs: number = 0): void {
    if (!this.ctx || !this.musicGain) {
      this.stopMusicInternal();
      return;
    }

    if (fadeMs > 0) {
      const fadeSec = fadeMs / 1000;
      this.musicGain.gain.setTargetAtTime(0, this.now(), fadeSec / 3);
      // Restore volume after fade, clean up nodes
      setTimeout(() => {
        this.stopMusicInternal();
        if (this.musicGain) {
          this.musicGain.gain.setTargetAtTime(this.musicVolume, this.now(), 0.02);
        }
      }, fadeMs);
    } else {
      this.stopMusicInternal();
    }
  }

  private stopMusicInternal(): void {
    if (this.musicSchedulerId !== null) {
      clearInterval(this.musicSchedulerId);
      this.musicSchedulerId = null;
    }
    // Stop and disconnect all active music oscillators
    for (const node of this.activeMusicNodes) {
      try { node.stop(); } catch { /* already stopped */ }
      try { node.disconnect(); } catch { /* already disconnected */ }
    }
    this.activeMusicNodes = [];
    this.currentTheme = null;
    this.musicBeatIndex = 0;
  }

  // ==========================================================================
  // Utility: Current Time
  // ==========================================================================

  private now(): number {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  // ==========================================================================
  // Audio Node Helpers
  // ==========================================================================

  /** Create an oscillator connected to a gain node with ADSR envelope, routed to target. */
  private createTone(
    freq: number,
    type: OscType,
    adsr: ADSRParams,
    startTime: number,
    target: AudioNode,
    detune: number = 0,
  ): { osc: OscillatorNode; gain: GainNode } {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);
    if (detune !== 0) osc.detune.setValueAtTime(detune, startTime);

    const gain = ctx.createGain();
    const peak = adsr.peak ?? 1;
    const { attack, decay, sustain, release } = adsr;

    // Start silent
    gain.gain.setValueAtTime(0, startTime);
    // Attack
    gain.gain.linearRampToValueAtTime(peak, startTime + attack);
    // Decay to sustain
    gain.gain.linearRampToValueAtTime(sustain * peak, startTime + attack + decay);
    // Release
    const releaseStart = startTime + attack + decay + 0.001;
    gain.gain.setValueAtTime(sustain * peak, releaseStart);
    gain.gain.exponentialRampToValueAtTime(0.001, releaseStart + release);

    osc.connect(gain);
    gain.connect(target);

    const totalDuration = attack + decay + release + 0.05;
    osc.start(startTime);
    osc.stop(startTime + totalDuration);

    return { osc, gain };
  }

  /** Create a noise burst using a buffer source. */
  private createNoiseBurst(
    duration: number,
    startTime: number,
    target: AudioNode,
    volume: number = 1,
    type: 'white' | 'pink' | 'brown' = 'white',
  ): { source: AudioBufferSourceNode; gain: GainNode } {
    const ctx = this.ctx!;
    const sampleRate = ctx.sampleRate;
    const length = Math.ceil(sampleRate * duration);
    const buffer = ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    if (type === 'white') {
      for (let i = 0; i < length; i++) {
        data[i] = Math.random() * 2 - 1;
      }
    } else if (type === 'pink') {
      // Pink noise approximation using Paul Kellet's method
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
        b6 = white * 0.115926;
      }
    } else {
      // Brown noise
      let last = 0;
      for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1;
        last = (last + 0.02 * white) / 1.02;
        data[i] = last * 3.5;
      }
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    source.connect(gain);
    gain.connect(target);
    source.start(startTime);
    source.stop(startTime + duration);

    return { source, gain };
  }

  /** Create a volume envelope gain node. */
  private createEnvelopeGain(
    volume: number,
    startTime: number,
    target: AudioNode,
  ): GainNode {
    const gain = this.ctx!.createGain();
    gain.gain.setValueAtTime(volume, startTime);
    gain.connect(target);
    return gain;
  }

  /** Create a biquad filter. */
  private createFilter(
    type: BiquadFilterType,
    frequency: number,
    q: number,
    startTime: number,
  ): BiquadFilterNode {
    const filter = this.ctx!.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(frequency, startTime);
    filter.Q.setValueAtTime(q, startTime);
    return filter;
  }

  /** Simple convolution-style reverb using feedback delay. */
  private createSimpleReverb(
    duration: number,
    decay: number,
    target: AudioNode,
  ): { input: GainNode; output: GainNode } {
    const ctx = this.ctx!;
    const input = ctx.createGain();
    const output = ctx.createGain();

    // Multiple delay lines for a richer reverb
    const delays = [0.029, 0.037, 0.041, 0.053];
    const gains = [0.4, 0.3, 0.25, 0.2];

    for (let i = 0; i < delays.length; i++) {
      const delay = ctx.createDelay(duration);
      delay.delayTime.value = delays[i] * duration;
      const fb = ctx.createGain();
      fb.gain.value = gains[i] * decay;

      input.connect(delay);
      delay.connect(fb);
      fb.connect(delay); // feedback loop
      delay.connect(output);
    }

    // Dry signal
    input.connect(output);
    output.connect(target);

    return { input, output };
  }

  // ==========================================================================
  // SFX Synthesis: Combat
  // ==========================================================================

  /** hit_light: Quick high-frequency burst */
  private synthHitLight(t: number, vol: number): void {
    const out = this.createEnvelopeGain(vol * 0.6, t, this.sfxGain!);

    // Primary sine burst
    this.createTone(1200, 'sine', {
      attack: 0.002, decay: 0.015, sustain: 0.2, release: 0.035, peak: 0.8,
    }, t, out);

    // Click transient
    this.createTone(3000, 'square', {
      attack: 0.001, decay: 0.005, sustain: 0, release: 0.01, peak: 0.3,
    }, t, out);

    // Short noise layer for texture
    const noiseFilter = this.createFilter('highpass', 4000, 1, t);
    noiseFilter.connect(out);
    this.createNoiseBurst(0.03, t, noiseFilter, 0.15);
  }

  /** hit_medium: Mid punch sound */
  private synthHitMedium(t: number, vol: number): void {
    const out = this.createEnvelopeGain(vol * 0.7, t, this.sfxGain!);

    // Body of the hit
    this.createTone(800, 'sine', {
      attack: 0.002, decay: 0.03, sustain: 0.15, release: 0.05, peak: 0.9,
    }, t, out);

    // Low sub layer
    this.createTone(200, 'sine', {
      attack: 0.003, decay: 0.04, sustain: 0.1, release: 0.04, peak: 0.5,
    }, t, out);

    // High transient
    this.createTone(2000, 'triangle', {
      attack: 0.001, decay: 0.01, sustain: 0, release: 0.02, peak: 0.4,
    }, t, out);

    // Noise crack
    const noiseFilter = this.createFilter('bandpass', 2500, 2, t);
    noiseFilter.connect(out);
    this.createNoiseBurst(0.06, t, noiseFilter, 0.3);
  }

  /** hit_heavy: Heavy bass impact */
  private synthHitHeavy(t: number, vol: number): void {
    const reverb = this.createSimpleReverb(0.6, 0.3, this.sfxGain!);
    const out = this.createEnvelopeGain(vol * 0.9, t, reverb.input);

    // Deep sub bass
    const { osc: subOsc } = this.createTone(100, 'sine', {
      attack: 0.005, decay: 0.06, sustain: 0.2, release: 0.1, peak: 1.0,
    }, t, out);
    subOsc.frequency.exponentialRampToValueAtTime(60, t + 0.15);

    // Mid body
    this.createTone(200, 'sine', {
      attack: 0.003, decay: 0.04, sustain: 0.15, release: 0.08, peak: 0.8,
    }, t, out);

    // Upper harmonic ring
    this.createTone(600, 'triangle', {
      attack: 0.002, decay: 0.03, sustain: 0.05, release: 0.06, peak: 0.35,
    }, t, out);

    // Impact transient
    this.createTone(1500, 'square', {
      attack: 0.001, decay: 0.005, sustain: 0, release: 0.015, peak: 0.3,
    }, t, out);

    // Crunchy noise layer
    const noiseFilter = this.createFilter('lowpass', 3000, 1.5, t);
    noiseFilter.connect(out);
    this.createNoiseBurst(0.12, t, noiseFilter, 0.4);

    // Sub rumble noise
    const subNoiseFilter = this.createFilter('lowpass', 300, 2, t);
    subNoiseFilter.connect(out);
    this.createNoiseBurst(0.15, t, subNoiseFilter, 0.25, 'brown');
  }

  /** hit_electric: Zappy crackle (Volt's attacks) */
  private synthHitElectric(t: number, vol: number): void {
    const out = this.createEnvelopeGain(vol * 0.65, t, this.sfxGain!);

    // High sine sweep (zap)
    const { osc: zapOsc } = this.createTone(4000, 'sawtooth', {
      attack: 0.001, decay: 0.02, sustain: 0.3, release: 0.08, peak: 0.5,
    }, t, out);
    zapOsc.frequency.exponentialRampToValueAtTime(800, t + 0.1);

    // Crackling -- rapid random-ish tone bursts
    for (let i = 0; i < 5; i++) {
      const offset = i * 0.015;
      const freq = 2000 + Math.random() * 4000;
      this.createTone(freq, 'square', {
        attack: 0.001, decay: 0.005, sustain: 0, release: 0.008, peak: 0.2 * (1 - i * 0.15),
      }, t + offset, out);
    }

    // Filtered white noise for the crackle texture
    const noiseFilter = this.createFilter('highpass', 5000, 3, t);
    noiseFilter.connect(out);
    this.createNoiseBurst(0.08, t, noiseFilter, 0.35);

    // Sub bass pop
    this.createTone(150, 'sine', {
      attack: 0.002, decay: 0.03, sustain: 0, release: 0.04, peak: 0.4,
    }, t, out);
  }

  /** hit_fire: Woosh + crackle (Blaze's attacks) */
  private synthHitFire(t: number, vol: number): void {
    const out = this.createEnvelopeGain(vol * 0.7, t, this.sfxGain!);

    // Woosh: filtered noise sweep
    const wooshFilter = this.createFilter('bandpass', 800, 1.5, t);
    wooshFilter.frequency.exponentialRampToValueAtTime(3000, t + 0.04);
    wooshFilter.frequency.exponentialRampToValueAtTime(600, t + 0.12);
    wooshFilter.connect(out);
    this.createNoiseBurst(0.15, t, wooshFilter, 0.5);

    // Crackle: high noise bursts
    const crackleFilter = this.createFilter('highpass', 3000, 2, t);
    crackleFilter.connect(out);
    for (let i = 0; i < 3; i++) {
      const offset = 0.02 + i * 0.025;
      this.createNoiseBurst(0.02, t + offset, crackleFilter, 0.2 * (1 - i * 0.25));
    }

    // Low rumble
    const rumbleFilter = this.createFilter('lowpass', 250, 1, t);
    rumbleFilter.connect(out);
    this.createNoiseBurst(0.12, t, rumbleFilter, 0.35, 'brown');

    // Tonal body
    this.createTone(350, 'sawtooth', {
      attack: 0.005, decay: 0.04, sustain: 0.1, release: 0.06, peak: 0.25,
    }, t, out);
  }

  /** hit_water: Splash (Tide's attacks) */
  private synthHitWater(t: number, vol: number): void {
    const out = this.createEnvelopeGain(vol * 0.6, t, this.sfxGain!);

    // Splash: bandpass-filtered noise with sweep
    const splashFilter = this.createFilter('bandpass', 2000, 0.8, t);
    splashFilter.frequency.exponentialRampToValueAtTime(800, t + 0.12);
    splashFilter.connect(out);
    this.createNoiseBurst(0.15, t, splashFilter, 0.5);

    // Bubble tones
    for (let i = 0; i < 3; i++) {
      const offset = i * 0.03;
      const freq = 600 + i * 200;
      const { osc } = this.createTone(freq, 'sine', {
        attack: 0.005, decay: 0.02, sustain: 0.1, release: 0.04, peak: 0.25,
      }, t + offset, out);
      // Slight vibrato for bubble effect
      const lfo = this.ctx!.createOscillator();
      lfo.frequency.value = 20 + i * 5;
      const lfoGain = this.ctx!.createGain();
      lfoGain.gain.value = 30;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      lfo.start(t + offset);
      lfo.stop(t + offset + 0.1);
    }

    // Drip tone
    const { osc: dripOsc } = this.createTone(1200, 'sine', {
      attack: 0.001, decay: 0.01, sustain: 0.05, release: 0.05, peak: 0.3,
    }, t, out);
    dripOsc.frequency.exponentialRampToValueAtTime(500, t + 0.06);
  }

  /** hit_earth: Rocky crunch (Granite's attacks) */
  private synthHitEarth(t: number, vol: number): void {
    const out = this.createEnvelopeGain(vol * 0.8, t, this.sfxGain!);

    // Low impact
    const { osc: impactOsc } = this.createTone(120, 'sine', {
      attack: 0.003, decay: 0.05, sustain: 0.15, release: 0.08, peak: 0.9,
    }, t, out);
    impactOsc.frequency.exponentialRampToValueAtTime(60, t + 0.12);

    // Sub bass
    this.createTone(60, 'sine', {
      attack: 0.005, decay: 0.06, sustain: 0.1, release: 0.1, peak: 0.6,
    }, t, out);

    // Crunch: multiple short noise bursts
    const crunchFilter = this.createFilter('bandpass', 1500, 2, t);
    crunchFilter.connect(out);
    for (let i = 0; i < 4; i++) {
      const offset = i * 0.012;
      this.createNoiseBurst(0.025, t + offset, crunchFilter, 0.35 * (1 - i * 0.15));
    }

    // Rocky texture: low noise
    const rockFilter = this.createFilter('lowpass', 800, 1, t);
    rockFilter.connect(out);
    this.createNoiseBurst(0.1, t, rockFilter, 0.3, 'brown');

    // Gritty mid-range
    this.createTone(400, 'sawtooth', {
      attack: 0.002, decay: 0.02, sustain: 0.05, release: 0.04, peak: 0.2,
    }, t, out);
  }

  /** hit_cosmic: Ethereal chime (Nova's attacks) */
  private synthHitCosmic(t: number, vol: number): void {
    const reverb = this.createSimpleReverb(1.2, 0.5, this.sfxGain!);
    const out = this.createEnvelopeGain(vol * 0.5, t, reverb.input);

    // Multiple detuned sine chimes
    const chimeFreqs = [880, 1320, 1760, 2200];
    const detunes = [-8, 5, -3, 7];
    for (let i = 0; i < chimeFreqs.length; i++) {
      this.createTone(chimeFreqs[i], 'sine', {
        attack: 0.005, decay: 0.08, sustain: 0.3, release: 0.25,
        peak: 0.35 * (1 - i * 0.05),
      }, t + i * 0.01, out, detunes[i]);
    }

    // Shimmer: very high, quiet sine
    this.createTone(4400, 'sine', {
      attack: 0.01, decay: 0.05, sustain: 0.15, release: 0.3, peak: 0.12,
    }, t, out, 12);

    // Sub harmonic for body
    this.createTone(220, 'sine', {
      attack: 0.01, decay: 0.06, sustain: 0.1, release: 0.15, peak: 0.3,
    }, t, out);

    // Soft noise wash
    const washFilter = this.createFilter('bandpass', 3000, 0.5, t);
    washFilter.connect(out);
    this.createNoiseBurst(0.2, t, washFilter, 0.08);
  }

  // ==========================================================================
  // SFX Synthesis: Movement
  // ==========================================================================

  /** jump: Quick upward pitch sweep */
  private synthJump(t: number, vol: number): void {
    const out = this.createEnvelopeGain(vol * 0.4, t, this.sfxGain!);

    const { osc } = this.createTone(400, 'sine', {
      attack: 0.002, decay: 0.015, sustain: 0.15, release: 0.04, peak: 0.7,
    }, t, out);
    osc.frequency.exponentialRampToValueAtTime(800, t + 0.06);

    // Airy noise
    const filter = this.createFilter('highpass', 3000, 1, t);
    filter.connect(out);
    this.createNoiseBurst(0.04, t, filter, 0.1);
  }

  /** double_jump: Higher pitch version with shimmer */
  private synthDoubleJump(t: number, vol: number): void {
    const out = this.createEnvelopeGain(vol * 0.45, t, this.sfxGain!);

    // Main sweep -- higher range
    const { osc } = this.createTone(600, 'sine', {
      attack: 0.002, decay: 0.015, sustain: 0.2, release: 0.05, peak: 0.7,
    }, t, out);
    osc.frequency.exponentialRampToValueAtTime(1400, t + 0.07);

    // Shimmer overlay
    this.createTone(1800, 'sine', {
      attack: 0.005, decay: 0.02, sustain: 0.1, release: 0.05, peak: 0.2,
    }, t, out, 15);

    this.createTone(2200, 'sine', {
      attack: 0.008, decay: 0.02, sustain: 0.08, release: 0.04, peak: 0.15,
    }, t + 0.01, out, -10);

    // Sparkle noise
    const filter = this.createFilter('highpass', 5000, 2, t);
    filter.connect(out);
    this.createNoiseBurst(0.04, t, filter, 0.1);
  }

  /** land: Short thud */
  private synthLand(t: number, vol: number): void {
    const out = this.createEnvelopeGain(vol * 0.35, t, this.sfxGain!);

    // Low thump
    const { osc } = this.createTone(100, 'sine', {
      attack: 0.001, decay: 0.01, sustain: 0.05, release: 0.03, peak: 0.8,
    }, t, out);
    osc.frequency.exponentialRampToValueAtTime(50, t + 0.04);

    // Short noise for texture
    const filter = this.createFilter('lowpass', 1000, 1, t);
    filter.connect(out);
    this.createNoiseBurst(0.03, t, filter, 0.2);
  }

  /** dash: Quick whoosh */
  private synthDash(t: number, vol: number): void {
    const out = this.createEnvelopeGain(vol * 0.35, t, this.sfxGain!);

    // Noise whoosh with bandpass sweep
    const filter = this.createFilter('bandpass', 1000, 1, t);
    filter.frequency.exponentialRampToValueAtTime(4000, t + 0.03);
    filter.frequency.exponentialRampToValueAtTime(1500, t + 0.08);
    filter.connect(out);
    this.createNoiseBurst(0.08, t, filter, 0.4);

    // Subtle tone
    const { osc } = this.createTone(500, 'sine', {
      attack: 0.002, decay: 0.02, sustain: 0, release: 0.03, peak: 0.15,
    }, t, out);
    osc.frequency.exponentialRampToValueAtTime(300, t + 0.05);
  }

  /** shield_on: Bubble sound with vibrato */
  private synthShieldOn(t: number, vol: number): void {
    const out = this.createEnvelopeGain(vol * 0.35, t, this.sfxGain!);

    // Main bubble tone
    const { osc } = this.createTone(500, 'sine', {
      attack: 0.01, decay: 0.03, sustain: 0.3, release: 0.06, peak: 0.5,
    }, t, out);

    // Vibrato LFO
    const lfo = this.ctx!.createOscillator();
    lfo.frequency.value = 12;
    const lfoGain = this.ctx!.createGain();
    lfoGain.gain.value = 40;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    lfo.start(t);
    lfo.stop(t + 0.12);

    // Harmonic
    this.createTone(1000, 'sine', {
      attack: 0.01, decay: 0.03, sustain: 0.1, release: 0.05, peak: 0.2,
    }, t, out);

    // Soft noise
    const filter = this.createFilter('bandpass', 2000, 0.5, t);
    filter.connect(out);
    this.createNoiseBurst(0.06, t, filter, 0.06);
  }

  /** shield_hit: Metallic ring */
  private synthShieldHit(t: number, vol: number): void {
    const out = this.createEnvelopeGain(vol * 0.5, t, this.sfxGain!);

    // Metallic harmonics
    const freqs = [1200, 2400, 3600, 4800];
    for (let i = 0; i < freqs.length; i++) {
      this.createTone(freqs[i], 'sine', {
        attack: 0.001, decay: 0.02, sustain: 0.15 * (1 - i * 0.03),
        release: 0.12 * (1 - i * 0.2), peak: 0.4 * (1 - i * 0.15),
      }, t, out, i * 3);
    }

    // Click transient
    this.createTone(5000, 'square', {
      attack: 0.001, decay: 0.003, sustain: 0, release: 0.008, peak: 0.2,
    }, t, out);

    // Body
    this.createTone(400, 'sine', {
      attack: 0.003, decay: 0.04, sustain: 0.1, release: 0.08, peak: 0.3,
    }, t, out);
  }

  /** shield_break: Glass shatter */
  private synthShieldBreak(t: number, vol: number): void {
    const reverb = this.createSimpleReverb(0.8, 0.4, this.sfxGain!);
    const out = this.createEnvelopeGain(vol * 0.8, t, reverb.input);

    // Initial crack
    const crackFilter = this.createFilter('highpass', 2000, 3, t);
    crackFilter.connect(out);
    this.createNoiseBurst(0.05, t, crackFilter, 0.6);

    // Descending shatter tones
    for (let i = 0; i < 6; i++) {
      const offset = i * 0.04;
      const freq = 3000 - i * 400;
      const { osc } = this.createTone(freq, 'sine', {
        attack: 0.001, decay: 0.01, sustain: 0.1,
        release: 0.08 + i * 0.03, peak: 0.3 * (1 - i * 0.04),
      }, t + offset, out, (Math.random() - 0.5) * 20);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.5, t + offset + 0.15);
    }

    // Cascading noise bursts (glass fragments)
    for (let i = 0; i < 8; i++) {
      const offset = i * 0.03 + Math.random() * 0.02;
      const filterFreq = 4000 + Math.random() * 4000;
      const filt = this.createFilter('bandpass', filterFreq, 3, t + offset);
      filt.connect(out);
      this.createNoiseBurst(0.04, t + offset, filt, 0.2 * (1 - i * 0.08));
    }

    // Sub bass impact at moment of break
    this.createTone(80, 'sine', {
      attack: 0.003, decay: 0.05, sustain: 0.1, release: 0.15, peak: 0.6,
    }, t, out);

    // Long noise tail
    const tailFilter = this.createFilter('highpass', 3000, 1, t);
    tailFilter.connect(out);
    this.createNoiseBurst(0.4, t + 0.05, tailFilter, 0.15);
  }

  /** dodge: Quick phase sound */
  private synthDodge(t: number, vol: number): void {
    const out = this.createEnvelopeGain(vol * 0.3, t, this.sfxGain!);

    // Downward sweep
    const { osc } = this.createTone(1200, 'sine', {
      attack: 0.002, decay: 0.015, sustain: 0.1, release: 0.035, peak: 0.5,
    }, t, out);
    osc.frequency.exponentialRampToValueAtTime(300, t + 0.06);

    // Phase texture: short filtered noise
    const filter = this.createFilter('bandpass', 2000, 2, t);
    filter.frequency.exponentialRampToValueAtTime(500, t + 0.05);
    filter.connect(out);
    this.createNoiseBurst(0.05, t, filter, 0.15);
  }

  /** grab: Quick snap */
  private synthGrab(t: number, vol: number): void {
    const out = this.createEnvelopeGain(vol * 0.4, t, this.sfxGain!);

    // Click
    this.createTone(3000, 'square', {
      attack: 0.001, decay: 0.003, sustain: 0, release: 0.005, peak: 0.5,
    }, t, out);

    // Short sine pop
    this.createTone(800, 'sine', {
      attack: 0.001, decay: 0.01, sustain: 0, release: 0.02, peak: 0.4,
    }, t + 0.003, out);

    // Tiny noise transient
    const filter = this.createFilter('highpass', 4000, 2, t);
    filter.connect(out);
    this.createNoiseBurst(0.015, t, filter, 0.15);
  }

  /** throw: Whoosh with impact */
  private synthThrow(t: number, vol: number): void {
    const out = this.createEnvelopeGain(vol * 0.5, t, this.sfxGain!);

    // Whoosh sweep
    const whooshFilter = this.createFilter('bandpass', 600, 1, t);
    whooshFilter.frequency.exponentialRampToValueAtTime(3000, t + 0.04);
    whooshFilter.frequency.exponentialRampToValueAtTime(800, t + 0.1);
    whooshFilter.connect(out);
    this.createNoiseBurst(0.1, t, whooshFilter, 0.4);

    // Impact thud at the end
    this.createTone(150, 'sine', {
      attack: 0.002, decay: 0.02, sustain: 0.1, release: 0.04, peak: 0.5,
    }, t + 0.06, out);

    // Impact noise
    const impactFilter = this.createFilter('lowpass', 2000, 1, t + 0.06);
    impactFilter.connect(out);
    this.createNoiseBurst(0.04, t + 0.06, impactFilter, 0.25);
  }

  // ==========================================================================
  // SFX Synthesis: KO / Match
  // ==========================================================================

  /** ko_blast: Explosion */
  private synthKOBlast(t: number, vol: number): void {
    const reverb = this.createSimpleReverb(0.8, 0.35, this.sfxGain!);
    const out = this.createEnvelopeGain(vol * 0.9, t, reverb.input);

    // Sub bass boom
    const { osc: boomOsc } = this.createTone(80, 'sine', {
      attack: 0.005, decay: 0.08, sustain: 0.2, release: 0.2, peak: 1.0,
    }, t, out);
    boomOsc.frequency.exponentialRampToValueAtTime(30, t + 0.3);

    // Mid ring
    this.createTone(300, 'sine', {
      attack: 0.003, decay: 0.05, sustain: 0.1, release: 0.15, peak: 0.5,
    }, t, out);

    // High ring
    this.createTone(1200, 'sine', {
      attack: 0.002, decay: 0.03, sustain: 0.05, release: 0.2, peak: 0.3,
    }, t, out, 7);

    // Explosion noise
    const noiseFilter = this.createFilter('lowpass', 3000, 1, t);
    noiseFilter.frequency.exponentialRampToValueAtTime(500, t + 0.3);
    noiseFilter.connect(out);
    this.createNoiseBurst(0.35, t, noiseFilter, 0.6);

    // Crackle layer
    const crackleFilter = this.createFilter('highpass', 4000, 2, t);
    crackleFilter.connect(out);
    this.createNoiseBurst(0.15, t, crackleFilter, 0.2);
  }

  /** ko_star: Star KO scream effect */
  private synthKOStar(t: number, vol: number): void {
    const reverb = this.createSimpleReverb(1.2, 0.4, this.sfxGain!);
    const out = this.createEnvelopeGain(vol * 0.6, t, reverb.input);

    // Descending "scream" -- sine with vibrato, descending
    const { osc: screamOsc, gain: screamGain } = this.createTone(1000, 'sawtooth', {
      attack: 0.01, decay: 0.1, sustain: 0.4, release: 0.5, peak: 0.4,
    }, t, out);
    screamOsc.frequency.exponentialRampToValueAtTime(200, t + 0.8);
    screamGain.gain.exponentialRampToValueAtTime(0.001, t + 0.8);

    // Vibrato on the scream
    const lfo = this.ctx!.createOscillator();
    lfo.frequency.value = 6;
    const lfoGain = this.ctx!.createGain();
    lfoGain.gain.value = 80;
    lfo.connect(lfoGain);
    lfoGain.connect(screamOsc.frequency);
    lfo.start(t);
    lfo.stop(t + 0.85);

    // Doppler-like noise fade
    const noiseFilter = this.createFilter('bandpass', 2000, 1, t);
    noiseFilter.frequency.exponentialRampToValueAtTime(400, t + 0.7);
    noiseFilter.connect(out);
    this.createNoiseBurst(0.7, t, noiseFilter, 0.2);

    // Star twinkle at the end
    this.createTone(2000, 'sine', {
      attack: 0.01, decay: 0.05, sustain: 0.15, release: 0.1, peak: 0.15,
    }, t + 0.5, out, 10);
  }

  /** match_start: Countdown beeps -- ascending tones for 3-2-1-GO */
  private synthMatchStart(t: number, vol: number): void {
    const out = this.createEnvelopeGain(vol * 0.5, t, this.sfxGain!);

    // 3 countdown beeps (0.5s apart)
    const beepFreqs = [600, 600, 600, 1000]; // 3, 2, 1, GO
    const beepTimes = [0, 0.6, 1.2, 1.8];

    for (let i = 0; i < 4; i++) {
      const isGo = i === 3;

      this.createTone(beepFreqs[i], 'sine', {
        attack: 0.005, decay: 0.02, sustain: 0.6,
        release: isGo ? 0.15 : 0.06, peak: isGo ? 0.8 : 0.5,
      }, t + beepTimes[i], out);

      if (isGo) {
        // "GO" gets an extra harmonic and wider sound
        this.createTone(2000, 'sine', {
          attack: 0.005, decay: 0.03, sustain: 0.3, release: 0.12, peak: 0.3,
        }, t + beepTimes[i], out);

        this.createTone(500, 'sine', {
          attack: 0.005, decay: 0.03, sustain: 0.4, release: 0.1, peak: 0.3,
        }, t + beepTimes[i], out);
      }

      // Click transient for each beep
      this.createTone(3000, 'square', {
        attack: 0.001, decay: 0.003, sustain: 0, release: 0.005, peak: 0.15,
      }, t + beepTimes[i], out);
    }
  }

  /** match_end: Dramatic finish chord */
  private synthMatchEnd(t: number, vol: number): void {
    const reverb = this.createSimpleReverb(1.5, 0.5, this.sfxGain!);
    const out = this.createEnvelopeGain(vol * 0.6, t, reverb.input);

    // Big chord: 3 harmonized sines (C-E-G)
    const chordFreqs = [261.63, 329.63, 392.00]; // C4, E4, G4
    for (let i = 0; i < chordFreqs.length; i++) {
      // Fundamental
      this.createTone(chordFreqs[i], 'sine', {
        attack: 0.02, decay: 0.1, sustain: 0.4, release: 0.6, peak: 0.5,
      }, t, out, (i - 1) * 5);

      // Octave harmonic
      this.createTone(chordFreqs[i] * 2, 'sine', {
        attack: 0.03, decay: 0.08, sustain: 0.2, release: 0.5, peak: 0.2,
      }, t, out, (i - 1) * -3);
    }

    // Sub bass
    this.createTone(130.81, 'sine', {
      attack: 0.02, decay: 0.1, sustain: 0.3, release: 0.5, peak: 0.35,
    }, t, out);

    // Dramatic hit transient
    const hitFilter = this.createFilter('lowpass', 5000, 1, t);
    hitFilter.connect(out);
    this.createNoiseBurst(0.1, t, hitFilter, 0.2);

    // Cymbal-like wash
    const washFilter = this.createFilter('highpass', 6000, 1, t);
    washFilter.connect(out);
    this.createNoiseBurst(0.8, t, washFilter, 0.08);
  }

  /** results_win: Victory fanfare -- ascending arpeggio C-E-G-C */
  private synthResultsWin(t: number, vol: number): void {
    const reverb = this.createSimpleReverb(1.0, 0.45, this.sfxGain!);
    const out = this.createEnvelopeGain(vol * 0.55, t, reverb.input);

    // Arpeggio notes: C4, E4, G4, C5
    const notes = [261.63, 329.63, 392.00, 523.25];
    const noteSpacing = 0.18;

    for (let i = 0; i < notes.length; i++) {
      const nt = t + i * noteSpacing;
      const isLast = i === notes.length - 1;

      // Bright lead tone (triangle for warmth)
      this.createTone(notes[i], 'triangle', {
        attack: 0.01, decay: 0.05, sustain: isLast ? 0.5 : 0.3,
        release: isLast ? 0.8 : 0.2, peak: 0.6,
      }, nt, out);

      // Octave above for brightness
      this.createTone(notes[i] * 2, 'sine', {
        attack: 0.015, decay: 0.04, sustain: isLast ? 0.3 : 0.15,
        release: isLast ? 0.6 : 0.15, peak: 0.25,
      }, nt, out, 5);

      // Harmonic fifth
      this.createTone(notes[i] * 1.5, 'sine', {
        attack: 0.02, decay: 0.04, sustain: isLast ? 0.2 : 0.1,
        release: isLast ? 0.5 : 0.12, peak: 0.15,
      }, nt, out);
    }

    // Final chord sustain (all notes together at the end)
    const chordTime = t + notes.length * noteSpacing + 0.05;
    for (const freq of notes) {
      this.createTone(freq, 'sine', {
        attack: 0.03, decay: 0.1, sustain: 0.35, release: 0.5, peak: 0.3,
      }, chordTime, out);
    }

    // Sub bass under the arpeggio
    this.createTone(130.81, 'sine', {
      attack: 0.02, decay: 0.1, sustain: 0.25, release: 0.6, peak: 0.3,
    }, t, out);

    // Shimmer at the peak
    const shimmerFilter = this.createFilter('highpass', 5000, 1, t);
    shimmerFilter.connect(out);
    this.createNoiseBurst(0.6, t + notes.length * noteSpacing, shimmerFilter, 0.06);
  }

  // ==========================================================================
  // SFX Synthesis: UI
  // ==========================================================================

  /** menu_move: Short click */
  private synthMenuMove(t: number, vol: number): void {
    const out = this.createEnvelopeGain(vol * 0.3, t, this.sfxGain!);

    this.createTone(2000, 'sine', {
      attack: 0.001, decay: 0.005, sustain: 0, release: 0.012, peak: 0.6,
    }, t, out);

    // Tiny click
    this.createTone(6000, 'square', {
      attack: 0.001, decay: 0.002, sustain: 0, release: 0.003, peak: 0.15,
    }, t, out);
  }

  /** menu_select: Confirm chime -- two-note ascending */
  private synthMenuSelect(t: number, vol: number): void {
    const out = this.createEnvelopeGain(vol * 0.35, t, this.sfxGain!);

    // First note
    this.createTone(800, 'sine', {
      attack: 0.003, decay: 0.015, sustain: 0.2, release: 0.04, peak: 0.6,
    }, t, out);

    // Second note (higher)
    this.createTone(1200, 'sine', {
      attack: 0.003, decay: 0.015, sustain: 0.2, release: 0.05, peak: 0.6,
    }, t + 0.05, out);

    // Harmonic layer
    this.createTone(1600, 'sine', {
      attack: 0.005, decay: 0.015, sustain: 0.1, release: 0.04, peak: 0.2,
    }, t + 0.05, out);
  }

  /** menu_back: Descending note */
  private synthMenuBack(t: number, vol: number): void {
    const out = this.createEnvelopeGain(vol * 0.3, t, this.sfxGain!);

    const { osc } = this.createTone(500, 'sine', {
      attack: 0.003, decay: 0.02, sustain: 0.15, release: 0.05, peak: 0.5,
    }, t, out);
    osc.frequency.exponentialRampToValueAtTime(300, t + 0.08);

    // Soft low harmonic
    this.createTone(250, 'sine', {
      attack: 0.005, decay: 0.02, sustain: 0.1, release: 0.04, peak: 0.2,
    }, t, out);
  }

  /** menu_error: Buzz */
  private synthMenuError(t: number, vol: number): void {
    const out = this.createEnvelopeGain(vol * 0.35, t, this.sfxGain!);

    // Low square wave buzz
    this.createTone(120, 'square', {
      attack: 0.005, decay: 0.03, sustain: 0.4, release: 0.1, peak: 0.4,
    }, t, out);

    // Dissonant second tone
    this.createTone(127, 'square', {
      attack: 0.005, decay: 0.03, sustain: 0.35, release: 0.1, peak: 0.3,
    }, t, out);

    // Noise texture
    const filter = this.createFilter('lowpass', 500, 1, t);
    filter.connect(out);
    this.createNoiseBurst(0.15, t, filter, 0.15);
  }

  /** text_type: Tiny click */
  private synthTextType(t: number, vol: number): void {
    const out = this.createEnvelopeGain(vol * 0.15, t, this.sfxGain!);

    this.createTone(4000, 'sine', {
      attack: 0.001, decay: 0.003, sustain: 0, release: 0.005, peak: 0.5,
    }, t, out);

    // Micro noise
    const filter = this.createFilter('highpass', 6000, 2, t);
    filter.connect(out);
    this.createNoiseBurst(0.008, t, filter, 0.1);
  }

  // ==========================================================================
  // Procedural Music Engine
  // ==========================================================================

  /** Schedule one beat of the current music theme. */
  private scheduleMusicBeat(theme: ThemeDefinition, time: number, beatIndex: number): void {
    if (!this.ctx || !this.musicGain) return;

    const beatDuration = 60 / theme.tempo;
    const beatsPerChord = 4; // chords change every 4 beats
    const chordIndex = Math.floor(beatIndex / beatsPerChord) % theme.chordProgression.length;
    const chord = theme.chordProgression[chordIndex];
    const beatInMeasure = beatIndex % 4; // 4/4 time

    // Apply swing
    let swungTime = time;
    if (beatInMeasure % 2 === 1 && theme.swingAmount > 0) {
      swungTime += beatDuration * theme.swingAmount * 0.3;
    }

    // --- Bass Layer ---
    if (theme.bassEnabled) {
      this.scheduleBassNote(theme, chord, swungTime, beatDuration, beatInMeasure);
    }

    // --- Pad Layer ---
    if (theme.padEnabled && beatInMeasure === 0) {
      this.schedulePadChord(theme, chord, time, beatDuration * beatsPerChord);
    }

    // --- Rhythm Layer ---
    if (theme.rhythmEnabled) {
      this.scheduleRhythm(theme, swungTime, beatDuration, beatInMeasure);
    }

    // --- Melody Layer ---
    if (theme.melodyEnabled) {
      this.scheduleMelodyNote(theme, chord, swungTime, beatDuration, beatIndex);
    }
  }

  /** Schedule a bass note. */
  private scheduleBassNote(
    theme: ThemeDefinition,
    chord: number[],
    time: number,
    beatDuration: number,
    beatInMeasure: number,
  ): void {
    // Bass plays the root of the chord on beats 1 and 3, with passing tones
    if (beatInMeasure !== 0 && beatInMeasure !== 2) return;

    const rootSemitone = chord[0];
    const bassFreq = midiToFreq(theme.rootNote - 12 + rootSemitone);
    const vol = theme.intensity * 0.35;

    // Saw wave through lowpass for warmth
    const filter = this.createFilter('lowpass', 400 + theme.intensity * 400, 2, time);
    filter.connect(this.musicGain!);

    const { osc } = this.createTone(bassFreq, 'sawtooth', {
      attack: 0.01, decay: beatDuration * 0.3, sustain: 0.3,
      release: beatDuration * 0.5, peak: vol,
    }, time, filter);

    this.activeMusicNodes.push(osc);
  }

  /** Schedule a pad chord (sustained, detuned). */
  private schedulePadChord(
    theme: ThemeDefinition,
    chord: number[],
    time: number,
    duration: number,
  ): void {
    const vol = theme.intensity * 0.12;

    for (const semitone of chord) {
      const freq = midiToFreq(theme.rootNote + semitone);

      // Two slightly detuned sines for chorus effect
      for (const detune of [-6, 6]) {
        const { osc } = this.createTone(freq, 'sine', {
          attack: duration * 0.15, decay: duration * 0.2,
          sustain: 0.6, release: duration * 0.4, peak: vol,
        }, time, this.musicGain!, detune);
        this.activeMusicNodes.push(osc);
      }
    }
  }

  /** Schedule a rhythm hit (kick/hat pattern). */
  private scheduleRhythm(
    theme: ThemeDefinition,
    time: number,
    beatDuration: number,
    beatInMeasure: number,
  ): void {
    const vol = theme.intensity * 0.25;

    // Kick on beats 1 and 3
    if (beatInMeasure === 0 || beatInMeasure === 2) {
      const { osc: kickOsc } = this.createTone(60, 'sine', {
        attack: 0.003, decay: 0.04, sustain: 0.1, release: 0.08, peak: vol * 1.2,
      }, time, this.musicGain!);
      kickOsc.frequency.exponentialRampToValueAtTime(30, time + 0.1);
      this.activeMusicNodes.push(kickOsc);

      // Kick click
      const clickFilter = this.createFilter('highpass', 3000, 1, time);
      clickFilter.connect(this.musicGain!);
      const { source: clickSource } = this.createNoiseBurst(0.01, time, clickFilter, vol * 0.5);
      this.activeMusicNodes.push(clickSource);
    }

    // Hi-hat on every beat (closed on beat, open on off-beats)
    const isOpen = beatInMeasure === 1 || beatInMeasure === 3;
    const hatDuration = isOpen ? 0.08 : 0.03;
    const hatFilter = this.createFilter('highpass', 7000, 2, time);
    hatFilter.connect(this.musicGain!);
    const { source: hatSource } = this.createNoiseBurst(hatDuration, time, hatFilter, vol * 0.4);
    this.activeMusicNodes.push(hatSource);

    // Snare on beat 2 and 4
    if (beatInMeasure === 1 || beatInMeasure === 3) {
      // Snare body
      const { osc: snareOsc } = this.createTone(200, 'triangle', {
        attack: 0.002, decay: 0.03, sustain: 0.05, release: 0.06, peak: vol * 0.7,
      }, time, this.musicGain!);
      this.activeMusicNodes.push(snareOsc);

      // Snare noise
      const snareFilter = this.createFilter('bandpass', 4000, 1.5, time);
      snareFilter.connect(this.musicGain!);
      const { source: snareSource } = this.createNoiseBurst(0.08, time, snareFilter, vol * 0.5);
      this.activeMusicNodes.push(snareSource);
    }

    // Eighth-note subdivisions for high intensity
    if (theme.intensity > 0.6) {
      const subTime = time + beatDuration * 0.5;
      const subHatFilter = this.createFilter('highpass', 8000, 3, subTime);
      subHatFilter.connect(this.musicGain!);
      const { source: subHatSource } = this.createNoiseBurst(0.02, subTime, subHatFilter, vol * 0.2);
      this.activeMusicNodes.push(subHatSource);
    }
  }

  /** Schedule a melody note using the scale. */
  private scheduleMelodyNote(
    theme: ThemeDefinition,
    chord: number[],
    time: number,
    beatDuration: number,
    beatIndex: number,
  ): void {
    // Melody plays on roughly half the beats with some rhythmic variation
    const melodyRhythm = [true, false, true, false, false, true, true, false];
    if (!melodyRhythm[beatIndex % melodyRhythm.length]) return;

    const vol = theme.intensity * 0.18;

    // Choose a melody note from the chord or scale
    // Use a simple deterministic sequence based on beatIndex for repeatability
    const seededValue = Math.sin(beatIndex * 1.618033988749895) * 0.5 + 0.5; // golden ratio pseudo-random
    let melodyNote: number;

    if (seededValue < 0.6) {
      // Chord tone
      const chordToneIndex = Math.floor(seededValue * chord.length / 0.6);
      melodyNote = chord[Math.min(chordToneIndex, chord.length - 1)];
    } else {
      // Scale tone
      const scaleDegree = Math.floor((seededValue - 0.6) / 0.4 * theme.scale.length);
      melodyNote = theme.scale[Math.min(scaleDegree, theme.scale.length - 1)];
    }

    // Place melody in a higher octave
    const freq = midiToFreq(theme.rootNote + 12 + melodyNote);

    // Square wave with slight portamento for character
    const filter = this.createFilter('lowpass', 2000 + theme.intensity * 2000, 1, time);
    filter.connect(this.musicGain!);

    const { osc } = this.createTone(freq, 'square', {
      attack: 0.01, decay: beatDuration * 0.2, sustain: 0.3,
      release: beatDuration * 0.4, peak: vol,
    }, time, filter);

    // Portamento: glide from slightly off-pitch
    osc.frequency.setValueAtTime(freq * 0.97, time);
    osc.frequency.exponentialRampToValueAtTime(freq, time + 0.03);

    this.activeMusicNodes.push(osc);
  }

  // ==========================================================================
  // Cleanup
  // ==========================================================================

  /** Destroy the audio manager, releasing all resources. */
  destroy(): void {
    this.stopMusic();
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
    this.contextInitialized = false;
    AudioManager.instance = null;
  }
}
