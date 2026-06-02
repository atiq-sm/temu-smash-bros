// ============================================================================
// Cosmic Knockout - Client-Side Network Manager
// ============================================================================

import { io, Socket } from 'socket.io-client';
import type { InputState } from '../core/types';
import {
  MessageType,
  CompressedInput,
  compressInput,
  decompressInput,
  ErrorCode,
  type CreateRoomPayload,
  type JoinRoomPayload,
  type RoomCreatedPayload,
  type RoomJoinedPayload,
  type PlayerJoinedPayload,
  type PlayerLeftPayload,
  type MatchStartedPayload,
  type UpdateSettingsPayload,
  type GameInputPayload,
  type CharacterSelectPayload,
  type StageSelectPayload,
  type ReadyPayload,
  type PingPayload,
  type PongPayload,
  type ErrorPayload,
  type ChatMessagePayload,
  type RoomState,
  type MatchSettings,
} from './protocol';

// --- Connection State ---

export enum ConnectionState {
  Disconnected = 'disconnected',
  Connecting = 'connecting',
  Connected = 'connected',
  InRoom = 'in_room',
  Playing = 'playing',
}

// --- Event Types ---

export type NetworkEventMap = {
  connectionStateChanged: ConnectionState;
  roomCreated: RoomState;
  roomJoined: RoomState;
  playerJoined: PlayerJoinedPayload;
  playerLeft: PlayerLeftPayload;
  matchStarted: MatchStartedPayload;
  opponentInput: { playerId: string; input: InputState; frame: number };
  chatMessage: ChatMessagePayload;
  error: ErrorPayload;
  pingUpdated: number;
  roomUpdated: RoomState;
};

type EventCallback<T> = (data: T) => void;

// --- Constants ---

const INPUT_DELAY_FRAMES = 3;
const PING_INTERVAL_MS = 2000;
const RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY_MS = 1000;

// ============================================================================
// NetworkManager
// ============================================================================

export class NetworkManager {
  private static _instance: NetworkManager | null = null;

  private socket: Socket | null = null;
  private _connectionState: ConnectionState = ConnectionState.Disconnected;
  private _playerId: string = '';
  private _room: RoomState | null = null;
  private _ping: number = 0;
  private _serverUrl: string;

  // Input delay buffer: stores our own inputs to be sent INPUT_DELAY_FRAMES later
  private localInputQueue: Map<number, CompressedInput> = new Map();
  // Received opponent inputs indexed by frame
  private remoteInputQueues: Map<string, Map<number, InputState>> = new Map();

  // Ping measurement
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private lastPingTimestamp: number = 0;

  // Event emitter
  private listeners: Map<string, Set<EventCallback<unknown>>> = new Map();

  // Reconnection
  private reconnectAttempts: number = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  // Anti-spam: track our own send rate
  private inputSendTimestamps: number[] = [];
  private readonly MAX_INPUTS_PER_SECOND = 70; // slightly above 60fps

  constructor(serverUrl?: string) {
    // Default to same-origin WebSocket or localhost in dev
    this._serverUrl = serverUrl ?? (
      typeof window !== 'undefined'
        ? `${window.location.protocol}//${window.location.hostname}:3001`
        : 'http://localhost:3001'
    );
  }

  // --- Singleton ---

  static getInstance(serverUrl?: string): NetworkManager {
    if (!NetworkManager._instance) {
      NetworkManager._instance = new NetworkManager(serverUrl);
    }
    return NetworkManager._instance;
  }

  static destroyInstance(): void {
    if (NetworkManager._instance) {
      NetworkManager._instance.disconnect();
      NetworkManager._instance = null;
    }
  }

  // --- Getters ---

  get connectionState(): ConnectionState {
    return this._connectionState;
  }

  get playerId(): string {
    return this._playerId;
  }

  get room(): RoomState | null {
    return this._room;
  }

  get ping(): number {
    return this._ping;
  }

  get isHost(): boolean {
    return this._room?.hostId === this._playerId;
  }

  get inputDelay(): number {
    return INPUT_DELAY_FRAMES;
  }

  get isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  // --- Connection ---

  connect(): void {
    if (this.socket?.connected) return;

    this.setConnectionState(ConnectionState.Connecting);

    this.socket = io(this._serverUrl, {
      transports: ['websocket'],
      reconnection: false,      // we handle reconnection ourselves
      timeout: 10000,
    });

    this.setupSocketListeners();
  }

  disconnect(): void {
    this.cleanup();
    this.setConnectionState(ConnectionState.Disconnected);
  }

  // --- Room Management ---

  createRoom(playerName: string, characterId: string = ''): void {
    if (!this.socket?.connected) {
      this.emitError(ErrorCode.UNKNOWN, 'Not connected to server');
      return;
    }

    const payload: CreateRoomPayload = { playerName, characterId };
    this.socket.emit(MessageType.CREATE_ROOM, payload);
  }

  joinRoom(roomCode: string, playerName: string, characterId: string = ''): void {
    if (!this.socket?.connected) {
      this.emitError(ErrorCode.UNKNOWN, 'Not connected to server');
      return;
    }

    const payload: JoinRoomPayload = {
      roomCode: roomCode.toUpperCase(),
      playerName,
      characterId,
    };
    this.socket.emit(MessageType.JOIN_ROOM, payload);
  }

  leaveRoom(): void {
    if (!this.socket?.connected) return;

    this.socket.emit(MessageType.LEAVE_ROOM);
    this._room = null;
    this.remoteInputQueues.clear();
    this.localInputQueue.clear();
    this.setConnectionState(ConnectionState.Connected);
  }

  updateSettings(settings: Partial<MatchSettings>): void {
    if (!this.socket?.connected || !this.isHost) return;

    const payload: UpdateSettingsPayload = { settings };
    this.socket.emit(MessageType.UPDATE_SETTINGS, payload);
  }

  // --- Lobby ---

  sendCharacterSelect(characterId: string): void {
    if (!this.socket?.connected || this._connectionState !== ConnectionState.InRoom) return;

    const payload: CharacterSelectPayload = { characterId };
    this.socket.emit(MessageType.CHARACTER_SELECT, payload);
  }

  sendStageSelect(stageId: string): void {
    if (!this.socket?.connected || !this.isHost) return;

    const payload: StageSelectPayload = { stageId };
    this.socket.emit(MessageType.STAGE_SELECT, payload);
  }

  sendReady(ready: boolean = true): void {
    if (!this.socket?.connected || this._connectionState !== ConnectionState.InRoom) return;

    const payload: ReadyPayload = { ready };
    this.socket.emit(MessageType.READY, payload);
  }

  // --- Match ---

  startMatch(): void {
    if (!this.socket?.connected || !this.isHost) return;

    this.socket.emit(MessageType.START_MATCH);
  }

  /**
   * Send a local player's input for a given frame.
   * The input is buffered and sent with the appropriate delay.
   */
  sendInput(input: InputState, frame: number): void {
    if (!this.socket?.connected || this._connectionState !== ConnectionState.Playing) return;

    // Rate limiting on client side
    const now = Date.now();
    this.inputSendTimestamps.push(now);
    // Trim timestamps older than 1 second
    const cutoff = now - 1000;
    while (this.inputSendTimestamps.length > 0 && this.inputSendTimestamps[0] < cutoff) {
      this.inputSendTimestamps.shift();
    }
    if (this.inputSendTimestamps.length > this.MAX_INPUTS_PER_SECOND) {
      return; // silently drop if we're sending too fast
    }

    const compressed = compressInput(input, frame + INPUT_DELAY_FRAMES);
    this.localInputQueue.set(compressed.f, compressed);

    const payload: GameInputPayload = {
      input: compressed,
      playerId: this._playerId,
    };
    this.socket.emit(MessageType.GAME_INPUT, payload);

    // Clean old entries (keep last 120 frames)
    for (const [f] of this.localInputQueue) {
      if (f < frame - 120) {
        this.localInputQueue.delete(f);
      }
    }
  }

  /**
   * Get the local player's delayed input for a frame (what was queued
   * INPUT_DELAY_FRAMES ago).
   */
  getLocalDelayedInput(frame: number): CompressedInput | undefined {
    return this.localInputQueue.get(frame);
  }

  /**
   * Get an opponent's input for a specific frame.
   * Returns undefined if the input hasn't arrived yet (caller should
   * pause/wait).
   */
  getRemoteInput(playerId: string, frame: number): InputState | undefined {
    return this.remoteInputQueues.get(playerId)?.get(frame);
  }

  /**
   * Check if all remote inputs for a given frame have arrived.
   */
  hasAllInputsForFrame(frame: number): boolean {
    if (!this._room) return true;

    for (const player of this._room.players) {
      if (player.id === this._playerId) continue;
      const queue = this.remoteInputQueues.get(player.id);
      if (!queue || !queue.has(frame)) return false;
    }
    return true;
  }

  // --- Callback Helpers ---

  onOpponentInput(callback: (data: { playerId: string; input: InputState; frame: number }) => void): () => void {
    return this.on('opponentInput', callback);
  }

  onRoomUpdate(callback: (room: RoomState) => void): () => void {
    return this.on('roomUpdated', callback);
  }

  onMatchStart(callback: (data: MatchStartedPayload) => void): () => void {
    return this.on('matchStarted', callback);
  }

  onError(callback: (data: ErrorPayload) => void): () => void {
    return this.on('error', callback);
  }

  // --- Chat ---

  sendChatMessage(message: string): void {
    if (!this.socket?.connected || !this._room) return;

    const player = this._room.players.find(p => p.id === this._playerId);
    const payload: ChatMessagePayload = {
      playerId: this._playerId,
      playerName: player?.name ?? 'Unknown',
      message: message.slice(0, 200), // cap message length
      timestamp: Date.now(),
    };
    this.socket.emit(MessageType.CHAT_MESSAGE, payload);
  }

  // --- Event Emitter ---

  on<K extends keyof NetworkEventMap>(
    event: K,
    callback: EventCallback<NetworkEventMap[K]>,
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback as EventCallback<unknown>);

    // Return unsubscribe function
    return () => {
      this.listeners.get(event)?.delete(callback as EventCallback<unknown>);
    };
  }

  off<K extends keyof NetworkEventMap>(
    event: K,
    callback: EventCallback<NetworkEventMap[K]>,
  ): void {
    this.listeners.get(event)?.delete(callback as EventCallback<unknown>);
  }

  private emit<K extends keyof NetworkEventMap>(event: K, data: NetworkEventMap[K]): void {
    const callbacks = this.listeners.get(event);
    if (!callbacks) return;
    for (const cb of callbacks) {
      try {
        cb(data);
      } catch (err) {
        console.error(`[NetworkManager] Error in "${event}" listener:`, err);
      }
    }
  }

  // --- Private: Socket Listeners ---

  private setupSocketListeners(): void {
    const socket = this.socket!;

    socket.on('connect', () => {
      this.reconnectAttempts = 0;
      this.setConnectionState(ConnectionState.Connected);
      this.startPingLoop();
    });

    socket.on('disconnect', (reason) => {
      console.warn('[NetworkManager] Disconnected:', reason);
      this.stopPingLoop();

      if (reason === 'io server disconnect') {
        // Server kicked us, don't reconnect
        this.setConnectionState(ConnectionState.Disconnected);
      } else {
        // Attempt reconnection
        this.attemptReconnect();
      }
    });

    socket.on('connect_error', (err) => {
      console.error('[NetworkManager] Connection error:', err.message);
      this.attemptReconnect();
    });

    // --- Room events ---

    socket.on(MessageType.ROOM_CREATED, (data: RoomCreatedPayload) => {
      this._playerId = data.playerId;
      this._room = data.room;
      this.setConnectionState(ConnectionState.InRoom);
      this.emit('roomCreated', data.room);
      this.emit('roomUpdated', data.room);
    });

    socket.on(MessageType.ROOM_JOINED, (data: RoomJoinedPayload) => {
      this._playerId = data.playerId;
      this._room = data.room;
      this.initRemoteQueues();
      this.setConnectionState(ConnectionState.InRoom);
      this.emit('roomJoined', data.room);
      this.emit('roomUpdated', data.room);
    });

    socket.on(MessageType.PLAYER_JOINED, (data: PlayerJoinedPayload) => {
      this._room = data.room;
      this.initRemoteQueues();
      this.emit('playerJoined', data);
      this.emit('roomUpdated', data.room);
    });

    socket.on(MessageType.PLAYER_LEFT, (data: PlayerLeftPayload) => {
      this._room = data.room;
      this.remoteInputQueues.delete(data.playerId);
      this.emit('playerLeft', data);
      this.emit('roomUpdated', data.room);
    });

    // --- Room update (character select, ready, settings, stage) ---

    socket.on(MessageType.ROOM_UPDATE, (data: { room: RoomState }) => {
      this._room = data.room;
      this.emit('roomUpdated', data.room);
    });

    // Also listen for legacy UPDATE_SETTINGS event
    socket.on(MessageType.UPDATE_SETTINGS, (data: { room: RoomState }) => {
      this._room = data.room;
      this.emit('roomUpdated', data.room);
    });

    // --- Match events ---

    socket.on(MessageType.MATCH_STARTED, (data: MatchStartedPayload) => {
      this.localInputQueue.clear();
      this.initRemoteQueues();
      this.inputSendTimestamps = [];
      this.setConnectionState(ConnectionState.Playing);
      this.emit('matchStarted', data);
    });

    // --- Game input ---

    socket.on(MessageType.GAME_INPUT, (data: GameInputPayload) => {
      if (data.playerId === this._playerId) return; // ignore our own inputs

      const input = decompressInput(data.input);
      const frame = data.input.f;

      // Store in remote queue
      if (!this.remoteInputQueues.has(data.playerId)) {
        this.remoteInputQueues.set(data.playerId, new Map());
      }
      this.remoteInputQueues.get(data.playerId)!.set(frame, input);

      // Clean old entries
      const queue = this.remoteInputQueues.get(data.playerId)!;
      for (const [f] of queue) {
        if (f < frame - 120) {
          queue.delete(f);
        }
      }

      this.emit('opponentInput', { playerId: data.playerId, input, frame });
    });

    // --- Ping/Pong ---

    socket.on(MessageType.PONG, (data: PongPayload) => {
      const rtt = Date.now() - data.timestamp;
      this._ping = rtt;
      this.emit('pingUpdated', rtt);
    });

    // --- Chat ---

    socket.on(MessageType.CHAT_MESSAGE, (data: ChatMessagePayload) => {
      this.emit('chatMessage', data);
    });

    // --- Error ---

    socket.on(MessageType.ERROR, (data: ErrorPayload) => {
      console.error('[NetworkManager] Server error:', data.code, data.message);
      this.emit('error', data);
    });
  }

  // --- Private: Helpers ---

  private setConnectionState(state: ConnectionState): void {
    if (this._connectionState === state) return;
    this._connectionState = state;
    this.emit('connectionStateChanged', state);
  }

  private emitError(code: ErrorCode, message: string): void {
    this.emit('error', { code, message });
  }

  private initRemoteQueues(): void {
    if (!this._room) return;
    for (const player of this._room.players) {
      if (player.id === this._playerId) continue;
      if (!this.remoteInputQueues.has(player.id)) {
        this.remoteInputQueues.set(player.id, new Map());
      }
    }
  }

  private startPingLoop(): void {
    this.stopPingLoop();
    this.pingTimer = setInterval(() => {
      if (!this.socket?.connected) return;
      this.lastPingTimestamp = Date.now();
      const payload: PingPayload = { timestamp: this.lastPingTimestamp };
      this.socket.emit(MessageType.PING, payload);
    }, PING_INTERVAL_MS);
  }

  private stopPingLoop(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= RECONNECT_ATTEMPTS) {
      console.error('[NetworkManager] Max reconnection attempts reached');
      this.setConnectionState(ConnectionState.Disconnected);
      this.emitError(ErrorCode.UNKNOWN, 'Connection lost. Please try again.');
      return;
    }

    this.setConnectionState(ConnectionState.Connecting);
    this.reconnectAttempts++;

    const delay = RECONNECT_DELAY_MS * Math.pow(2, this.reconnectAttempts - 1);
    console.log(`[NetworkManager] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${RECONNECT_ATTEMPTS})`);

    this.reconnectTimer = setTimeout(() => {
      if (this.socket) {
        this.socket.connect();
      }
    }, delay);
  }

  private cleanup(): void {
    this.stopPingLoop();

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }

    this._room = null;
    this._playerId = '';
    this._ping = 0;
    this.localInputQueue.clear();
    this.remoteInputQueues.clear();
    this.inputSendTimestamps = [];
    this.reconnectAttempts = 0;
  }
}

// --- Convenience singleton exports (backwards-compatible) ---

let _instance: NetworkManager | null = null;

export function getNetworkManager(serverUrl?: string): NetworkManager {
  if (!_instance) {
    _instance = new NetworkManager(serverUrl);
  }
  return _instance;
}

export function destroyNetworkManager(): void {
  if (_instance) {
    _instance.disconnect();
    _instance = null;
  }
}
