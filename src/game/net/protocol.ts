// ============================================================================
// Temu Smash Bros - Network Protocol Types
// ============================================================================

import type { InputState } from '../core/types';

// --- Message Types ---

export enum MessageType {
  // Room lifecycle
  CREATE_ROOM = 'create_room',
  JOIN_ROOM = 'join_room',
  ROOM_CREATED = 'room_created',
  ROOM_JOINED = 'room_joined',
  PLAYER_JOINED = 'player_joined',
  PLAYER_LEFT = 'player_left',
  LEAVE_ROOM = 'leave_room',
  ROOM_UPDATE = 'room_update',

  // Pre-match lobby
  CHARACTER_SELECT = 'character_select',
  STAGE_SELECT = 'stage_select',
  READY = 'ready',

  // Match lifecycle
  START_MATCH = 'start_match',
  MATCH_STARTED = 'match_started',
  UPDATE_SETTINGS = 'update_settings',

  // Gameplay
  GAME_INPUT = 'game_input',
  GAME_STATE_SYNC = 'game_state_sync',

  // Utility
  PING = 'ping',
  PONG = 'pong',
  ERROR = 'error',
  CHAT_MESSAGE = 'chat_message',
}

// --- Player Info ---

export interface PlayerInfo {
  id: string;
  name: string;
  characterId: string;
  isHost: boolean;
  slotIndex: number;          // 0-3, the player's position in the room
  ready: boolean;
}

// --- Match Settings ---

export interface MatchSettings {
  stocks: number;
  timer: number;              // seconds, 0 = infinite
  stageId: string | null;
}

export const DEFAULT_MATCH_SETTINGS: MatchSettings = {
  stocks: 3,
  timer: 480,                 // 8 minutes
  stageId: null,
};

// --- Room State ---

export interface RoomState {
  code: string;
  hostId: string;
  players: PlayerInfo[];
  settings: MatchSettings;
  state: RoomPhase;
  createdAt: number;
}

export enum RoomPhase {
  Waiting = 'waiting',
  CharacterSelect = 'character_select',
  Playing = 'playing',
  Finished = 'finished',
}

// --- Compressed Input (only changed fields + frame) ---

export interface CompressedInput {
  /** Frame number this input applies to */
  f: number;
  /** Bitmask of boolean inputs (see INPUT_BITS) */
  b: number;
  /** C-stick X (-1 to 1), omitted if 0 */
  cx?: number;
  /** C-stick Y (-1 to 1), omitted if 0 */
  cy?: number;
}

/**
 * Bit positions for boolean input fields in the compressed bitmask.
 * Order matches InputState boolean fields.
 */
export const INPUT_BITS = {
  left:    1 << 0,
  right:   1 << 1,
  up:      1 << 2,
  down:    1 << 3,
  attack:  1 << 4,
  special: 1 << 5,
  shield:  1 << 6,
  grab:    1 << 7,
  jump:    1 << 8,
} as const;

// --- Message Payloads ---

export interface CreateRoomPayload {
  playerName: string;
  characterId: string;
}

export interface JoinRoomPayload {
  roomCode: string;
  playerName: string;
  characterId: string;
}

export interface RoomCreatedPayload {
  room: RoomState;
  playerId: string;
}

export interface RoomJoinedPayload {
  room: RoomState;
  playerId: string;
}

export interface PlayerJoinedPayload {
  player: PlayerInfo;
  room: RoomState;
}

export interface PlayerLeftPayload {
  playerId: string;
  newHostId: string | null;
  room: RoomState;
}

export interface CharacterSelectPayload {
  characterId: string;
}

export interface StageSelectPayload {
  stageId: string;
}

export interface ReadyPayload {
  ready: boolean;
}

export interface StartMatchPayload {
  settings: MatchSettings;
}

export interface MatchStartedPayload {
  settings: MatchSettings;
  playerSlots: Record<string, number>;  // playerId -> slot index
  seed: number;                          // RNG seed for deterministic play
}

export interface UpdateSettingsPayload {
  settings: Partial<MatchSettings>;
}

export interface GameInputPayload {
  input: CompressedInput;
  playerId: string;
}

export interface GameStateSyncPayload {
  frame: number;
  checksum: number;           // simple hash to detect desync
}

export interface PingPayload {
  timestamp: number;
}

export interface PongPayload {
  timestamp: number;
  serverTime: number;
}

export interface ErrorPayload {
  code: ErrorCode;
  message: string;
}

export interface ChatMessagePayload {
  playerId: string;
  playerName: string;
  message: string;
  timestamp: number;
}

// --- Error Codes ---

export enum ErrorCode {
  ROOM_NOT_FOUND = 'room_not_found',
  ROOM_FULL = 'room_full',
  ROOM_IN_PROGRESS = 'room_in_progress',
  NOT_HOST = 'not_host',
  NOT_ENOUGH_PLAYERS = 'not_enough_players',
  NOT_ALL_READY = 'not_all_ready',
  INVALID_INPUT = 'invalid_input',
  RATE_LIMITED = 'rate_limited',
  UNKNOWN = 'unknown',
}

// --- Serialization Helpers ---

/**
 * Compress an InputState into a compact wire format.
 * Boolean fields become a single bitmask; analog sticks are only
 * included when non-zero.
 */
export function compressInput(input: InputState, frame: number): CompressedInput {
  let bitmask = 0;
  if (input.left)    bitmask |= INPUT_BITS.left;
  if (input.right)   bitmask |= INPUT_BITS.right;
  if (input.up)      bitmask |= INPUT_BITS.up;
  if (input.down)    bitmask |= INPUT_BITS.down;
  if (input.attack)  bitmask |= INPUT_BITS.attack;
  if (input.special) bitmask |= INPUT_BITS.special;
  if (input.shield)  bitmask |= INPUT_BITS.shield;
  if (input.grab)    bitmask |= INPUT_BITS.grab;
  if (input.jump)    bitmask |= INPUT_BITS.jump;

  const compressed: CompressedInput = { f: frame, b: bitmask };
  if (input.cStickX !== 0) compressed.cx = Math.round(input.cStickX * 100) / 100;
  if (input.cStickY !== 0) compressed.cy = Math.round(input.cStickY * 100) / 100;
  return compressed;
}

/**
 * Decompress a CompressedInput back into a full InputState.
 */
export function decompressInput(compressed: CompressedInput): InputState {
  const b = compressed.b;
  return {
    left:    (b & INPUT_BITS.left) !== 0,
    right:   (b & INPUT_BITS.right) !== 0,
    up:      (b & INPUT_BITS.up) !== 0,
    down:    (b & INPUT_BITS.down) !== 0,
    attack:  (b & INPUT_BITS.attack) !== 0,
    special: (b & INPUT_BITS.special) !== 0,
    shield:  (b & INPUT_BITS.shield) !== 0,
    grab:    (b & INPUT_BITS.grab) !== 0,
    jump:    (b & INPUT_BITS.jump) !== 0,
    cStickX: compressed.cx ?? 0,
    cStickY: compressed.cy ?? 0,
  };
}

/**
 * Compute a simple checksum for a game frame (for desync detection).
 * This hashes an array of numbers (positions, damages, etc.) into a single uint32.
 */
export function computeChecksum(values: number[]): number {
  let hash = 0x811c9dc5;       // FNV-1a offset basis
  for (const v of values) {
    // Convert float to integer bits for consistency
    const bits = Math.round(v * 1000);
    hash ^= bits & 0xff;
    hash = Math.imul(hash, 0x01000193);
    hash ^= (bits >> 8) & 0xff;
    hash = Math.imul(hash, 0x01000193);
    hash ^= (bits >> 16) & 0xff;
    hash = Math.imul(hash, 0x01000193);
    hash ^= (bits >> 24) & 0xff;
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;            // ensure unsigned
}
