// ============================================================================
// Cosmic Knockouts - Server Room Management
// ============================================================================

import type { Socket } from 'socket.io';

// --- Types (duplicated from protocol to avoid cross-project imports) ---

export interface PlayerInfo {
  id: string;
  name: string;
  characterId: string;
  isHost: boolean;
  slotIndex: number;
  ready: boolean;
}

export interface MatchSettings {
  stocks: number;
  timer: number;
  stageId: string | null;
}

export enum RoomPhase {
  Waiting = 'waiting',
  CharacterSelect = 'character_select',
  Playing = 'playing',
  Finished = 'finished',
}

export interface RoomState {
  code: string;
  hostId: string;
  players: PlayerInfo[];
  settings: MatchSettings;
  state: RoomPhase;
  createdAt: number;
}

// --- Constants ---

const MAX_PLAYERS = 4;
const CODE_LENGTH = 4;
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I, O, 0, 1 to avoid confusion

// Track all active codes to prevent collisions
const activeRoomCodes = new Set<string>();

// ============================================================================
// Room
// ============================================================================

export class Room {
  readonly code: string;
  hostId: string;
  players: Map<string, PlayerInfo> = new Map();
  sockets: Map<string, Socket> = new Map();
  settings: MatchSettings;
  phase: RoomPhase = RoomPhase.Waiting;
  readonly createdAt: number;
  lastActivity: number;
  readonly maxPlayers: number = MAX_PLAYERS;

  // Anti-cheat: input rate tracking per player
  private inputCounts: Map<string, number[]> = new Map();
  private readonly MAX_INPUTS_PER_SECOND = 75;

  constructor(hostId: string, hostName: string, characterId: string, hostSocket: Socket) {
    this.code = Room.generateCode();
    this.hostId = hostId;
    this.createdAt = Date.now();
    this.lastActivity = Date.now();

    this.settings = {
      stocks: 3,
      timer: 480,
      stageId: null,
    };

    const hostPlayer: PlayerInfo = {
      id: hostId,
      name: hostName,
      characterId,
      isHost: true,
      slotIndex: 0,
      ready: false,
    };

    this.players.set(hostId, hostPlayer);
    this.sockets.set(hostId, hostSocket);
    hostSocket.join(this.code);
  }

  // --- Player Management ---

  addPlayer(playerId: string, name: string, characterId: string, socket: Socket): PlayerInfo | null {
    if (this.players.size >= MAX_PLAYERS) return null;
    if (this.phase !== RoomPhase.Waiting) return null;
    if (this.players.has(playerId)) return null;

    // Find the first available slot
    const usedSlots = new Set<number>();
    for (const p of this.players.values()) {
      usedSlots.add(p.slotIndex);
    }
    let slotIndex = 0;
    while (usedSlots.has(slotIndex)) slotIndex++;

    const player: PlayerInfo = {
      id: playerId,
      name,
      characterId,
      isHost: false,
      slotIndex,
      ready: false,
    };

    this.players.set(playerId, player);
    this.sockets.set(playerId, socket);
    socket.join(this.code);
    this.touch();

    return player;
  }

  removePlayer(playerId: string): { removed: boolean; newHostId: string | null; isEmpty: boolean } {
    const player = this.players.get(playerId);
    if (!player) return { removed: false, newHostId: null, isEmpty: false };

    this.players.delete(playerId);
    this.sockets.get(playerId)?.leave(this.code);
    this.sockets.delete(playerId);
    this.inputCounts.delete(playerId);
    this.touch();

    const isEmpty = this.players.size === 0;
    let newHostId: string | null = null;

    // Transfer host if the host left
    if (playerId === this.hostId && !isEmpty) {
      const nextPlayer = this.players.values().next().value;
      if (nextPlayer) {
        nextPlayer.isHost = true;
        this.hostId = nextPlayer.id;
        newHostId = nextPlayer.id;
      }
    }

    // If the match was in progress and only 1 player remains, end it
    if (this.phase === RoomPhase.Playing && this.players.size < 2) {
      this.phase = RoomPhase.Finished;
    }

    return { removed: true, newHostId, isEmpty };
  }

  // --- Character & Ready ---

  setCharacter(playerId: string, characterId: string): boolean {
    const player = this.players.get(playerId);
    if (!player) return false;
    player.characterId = characterId;
    // Reset ready when changing character
    player.ready = false;
    this.touch();
    return true;
  }

  setReady(playerId: string, ready: boolean): boolean {
    const player = this.players.get(playerId);
    if (!player) return false;
    player.ready = ready;
    this.touch();
    return true;
  }

  allReady(): boolean {
    if (this.players.size < 2) return false;
    for (const player of this.players.values()) {
      if (!player.ready) return false;
    }
    return true;
  }

  // --- Match Lifecycle ---

  startMatch(): { success: boolean; error?: string; seed?: number; playerSlots?: Record<string, number> } {
    if (this.phase !== RoomPhase.Waiting) {
      return { success: false, error: 'Match already in progress' };
    }
    if (this.players.size < 2) {
      return { success: false, error: 'Need at least 2 players' };
    }
    if (!this.allReady()) {
      return { success: false, error: 'Not all players are ready' };
    }

    this.phase = RoomPhase.Playing;
    this.touch();

    const seed = Math.floor(Math.random() * 0x7fffffff);
    const playerSlots: Record<string, number> = {};
    for (const [id, player] of this.players) {
      playerSlots[id] = player.slotIndex;
    }

    return { success: true, seed, playerSlots };
  }

  endMatch(): void {
    this.phase = RoomPhase.Finished;
    this.touch();
  }

  returnToLobby(): void {
    this.phase = RoomPhase.Waiting;
    // Reset ready states
    for (const player of this.players.values()) {
      player.ready = false;
    }
    this.touch();
  }

  // --- Settings ---

  updateSettings(settings: Partial<MatchSettings>): void {
    if (settings.stocks !== undefined) {
      this.settings.stocks = Math.max(1, Math.min(99, settings.stocks));
    }
    if (settings.timer !== undefined) {
      this.settings.timer = Math.max(0, Math.min(3600, settings.timer));
    }
    if (settings.stageId !== undefined) {
      this.settings.stageId = settings.stageId ? String(settings.stageId).slice(0, 50) : null;
    }
    this.touch();
  }

  // --- Anti-Cheat: Input Rate Limiting ---

  checkInputRate(playerId: string): boolean {
    const now = Date.now();
    if (!this.inputCounts.has(playerId)) {
      this.inputCounts.set(playerId, []);
    }
    const timestamps = this.inputCounts.get(playerId)!;
    timestamps.push(now);

    // Remove timestamps older than 1 second
    const cutoff = now - 1000;
    while (timestamps.length > 0 && timestamps[0] < cutoff) {
      timestamps.shift();
    }

    return timestamps.length <= this.MAX_INPUTS_PER_SECOND;
  }

  // --- Serialization ---

  getState(): RoomState {
    return {
      code: this.code,
      hostId: this.hostId,
      players: Array.from(this.players.values()),
      settings: { ...this.settings },
      state: this.phase,
      createdAt: this.createdAt,
    };
  }

  // --- Utility ---

  touch(): void {
    this.lastActivity = Date.now();
  }

  get playerCount(): number {
    return this.players.size;
  }

  get isFull(): boolean {
    return this.players.size >= MAX_PLAYERS;
  }

  destroy(): void {
    activeRoomCodes.delete(this.code);
    for (const socket of this.sockets.values()) {
      socket.leave(this.code);
    }
    this.players.clear();
    this.sockets.clear();
    this.inputCounts.clear();
  }

  // --- Static: Code Generation ---

  static generateCode(): string {
    let code: string;
    let attempts = 0;
    do {
      code = '';
      for (let i = 0; i < CODE_LENGTH; i++) {
        code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
      }
      attempts++;
      if (attempts > 1000) {
        throw new Error('Failed to generate unique room code');
      }
    } while (activeRoomCodes.has(code));

    activeRoomCodes.add(code);
    return code;
  }
}
