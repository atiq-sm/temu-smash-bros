// ============================================================================
// Temu Smash Bros - WebSocket Game Server
// Run with: npx tsx server/index.ts
// ============================================================================

import { Server, Socket } from 'socket.io';
import { Room } from './Room';

// --- Message type strings (mirrored from protocol to avoid cross-project import) ---

const MSG = {
  CREATE_ROOM: 'create_room',
  JOIN_ROOM: 'join_room',
  ROOM_CREATED: 'room_created',
  ROOM_JOINED: 'room_joined',
  PLAYER_JOINED: 'player_joined',
  PLAYER_LEFT: 'player_left',
  LEAVE_ROOM: 'leave_room',
  ROOM_UPDATE: 'room_update',
  CHARACTER_SELECT: 'character_select',
  STAGE_SELECT: 'stage_select',
  READY: 'ready',
  START_MATCH: 'start_match',
  MATCH_STARTED: 'match_started',
  UPDATE_SETTINGS: 'update_settings',
  GAME_INPUT: 'game_input',
  GAME_STATE_SYNC: 'game_state_sync',
  PING: 'ping',
  PONG: 'pong',
  ERROR: 'error',
  CHAT_MESSAGE: 'chat_message',
} as const;

// --- Error codes ---

const ERR = {
  ROOM_NOT_FOUND: 'room_not_found',
  ROOM_FULL: 'room_full',
  ROOM_IN_PROGRESS: 'room_in_progress',
  NOT_HOST: 'not_host',
  NOT_ENOUGH_PLAYERS: 'not_enough_players',
  NOT_ALL_READY: 'not_all_ready',
  INVALID_INPUT: 'invalid_input',
  RATE_LIMITED: 'rate_limited',
  UNKNOWN: 'unknown',
} as const;

// --- Server Setup ---

const PORT = parseInt(process.env.PORT ?? '3001', 10);

const io = new Server(PORT, {
  cors: { origin: '*' },
  pingInterval: 10000,
  pingTimeout: 5000,
});

// --- State ---

const rooms = new Map<string, Room>();
// Map socket.id -> room code for fast lookup on disconnect
const socketToRoom = new Map<string, string>();

// --- Helpers ---

function sendError(socket: Socket, code: string, message: string): void {
  socket.emit(MSG.ERROR, { code, message });
}

function findRoomBySocket(socketId: string): Room | null {
  const code = socketToRoom.get(socketId);
  if (!code) return null;
  return rooms.get(code) ?? null;
}

function sanitizeName(name: unknown): string {
  if (typeof name !== 'string') return 'Player';
  const trimmed = name.trim().slice(0, 20);
  return trimmed.length > 0 ? trimmed : 'Player';
}

function sanitizeString(value: unknown, maxLen: number = 50): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLen);
}

// ============================================================================
// Connection Handler
// ============================================================================

io.on('connection', (socket: Socket) => {
  console.log(`[Server] Player connected: ${socket.id}`);

  // --- CREATE ROOM ---

  socket.on(MSG.CREATE_ROOM, (data: { playerName?: string; characterId?: string }) => {
    // Prevent creating a room while already in one
    if (socketToRoom.has(socket.id)) {
      sendError(socket, ERR.UNKNOWN, 'Already in a room');
      return;
    }

    const playerName = sanitizeName(data?.playerName);
    const characterId = sanitizeString(data?.characterId);

    try {
      const room = new Room(socket.id, playerName, characterId, socket);
      rooms.set(room.code, room);
      socketToRoom.set(socket.id, room.code);

      console.log(`[Server] Room ${room.code} created by "${playerName}" (${socket.id})`);

      socket.emit(MSG.ROOM_CREATED, {
        room: room.getState(),
        playerId: socket.id,
      });
    } catch (err) {
      console.error('[Server] Failed to create room:', err);
      sendError(socket, ERR.UNKNOWN, 'Failed to create room');
    }
  });

  // --- JOIN ROOM ---

  socket.on(MSG.JOIN_ROOM, (data: { roomCode?: string; playerName?: string; characterId?: string }) => {
    if (socketToRoom.has(socket.id)) {
      sendError(socket, ERR.UNKNOWN, 'Already in a room');
      return;
    }

    const roomCode = sanitizeString(data?.roomCode, 10).toUpperCase();
    const playerName = sanitizeName(data?.playerName);
    const characterId = sanitizeString(data?.characterId);

    const room = rooms.get(roomCode);
    if (!room) {
      sendError(socket, ERR.ROOM_NOT_FOUND, 'Room not found');
      return;
    }

    if (room.isFull) {
      sendError(socket, ERR.ROOM_FULL, 'Room is full');
      return;
    }

    if (room.phase !== 'waiting') {
      sendError(socket, ERR.ROOM_IN_PROGRESS, 'Match already in progress');
      return;
    }

    const player = room.addPlayer(socket.id, playerName, characterId, socket);
    if (!player) {
      sendError(socket, ERR.UNKNOWN, 'Failed to join room');
      return;
    }

    socketToRoom.set(socket.id, room.code);

    console.log(`[Server] "${playerName}" (${socket.id}) joined room ${room.code}`);

    // Notify the joining player
    socket.emit(MSG.ROOM_JOINED, {
      room: room.getState(),
      playerId: socket.id,
    });

    // Notify existing players
    socket.to(room.code).emit(MSG.PLAYER_JOINED, {
      player,
      room: room.getState(),
    });
  });

  // --- LEAVE ROOM ---

  socket.on(MSG.LEAVE_ROOM, () => {
    handleLeaveRoom(socket);
  });

  // --- CHARACTER SELECT ---

  socket.on(MSG.CHARACTER_SELECT, (data: { characterId?: string }) => {
    const room = findRoomBySocket(socket.id);
    if (!room) return;

    const characterId = sanitizeString(data?.characterId);
    if (room.setCharacter(socket.id, characterId)) {
      // Broadcast updated room state to everyone in the room
      io.to(room.code).emit(MSG.ROOM_UPDATE, { room: room.getState() });
    }
  });

  // --- STAGE SELECT ---

  socket.on(MSG.STAGE_SELECT, (data: { stageId?: string }) => {
    const room = findRoomBySocket(socket.id);
    if (!room) return;

    // Only host can select stage
    if (room.hostId !== socket.id) {
      sendError(socket, ERR.NOT_HOST, 'Only the host can select a stage');
      return;
    }

    const stageId = sanitizeString(data?.stageId);
    room.updateSettings({ stageId });
    io.to(room.code).emit(MSG.ROOM_UPDATE, { room: room.getState() });
  });

  // --- READY ---

  socket.on(MSG.READY, (data: { ready?: boolean }) => {
    const room = findRoomBySocket(socket.id);
    if (!room) return;

    const ready = typeof data?.ready === 'boolean' ? data.ready : true;
    if (room.setReady(socket.id, ready)) {
      io.to(room.code).emit(MSG.ROOM_UPDATE, { room: room.getState() });
    }
  });

  // --- UPDATE SETTINGS ---

  socket.on(MSG.UPDATE_SETTINGS, (data: { settings?: Partial<{ stocks: number; timer: number; stageId: string }> }) => {
    const room = findRoomBySocket(socket.id);
    if (!room) return;

    if (room.hostId !== socket.id) {
      sendError(socket, ERR.NOT_HOST, 'Only the host can change settings');
      return;
    }

    if (data?.settings) {
      room.updateSettings(data.settings);
      io.to(room.code).emit(MSG.ROOM_UPDATE, { room: room.getState() });
    }
  });

  // --- START MATCH ---

  socket.on(MSG.START_MATCH, () => {
    const room = findRoomBySocket(socket.id);
    if (!room) return;

    if (room.hostId !== socket.id) {
      sendError(socket, ERR.NOT_HOST, 'Only the host can start the match');
      return;
    }

    const result = room.startMatch();
    if (!result.success) {
      const code = result.error?.includes('ready') ? ERR.NOT_ALL_READY
        : result.error?.includes('2') ? ERR.NOT_ENOUGH_PLAYERS
        : ERR.UNKNOWN;
      sendError(socket, code, result.error ?? 'Failed to start match');
      return;
    }

    console.log(`[Server] Match started in room ${room.code} (seed: ${result.seed})`);

    io.to(room.code).emit(MSG.MATCH_STARTED, {
      settings: room.settings,
      playerSlots: result.playerSlots,
      seed: result.seed,
    });
  });

  // --- GAME INPUT ---

  socket.on(MSG.GAME_INPUT, (data: { input?: { f: number; b: number; cx?: number; cy?: number }; playerId?: string }) => {
    const room = findRoomBySocket(socket.id);
    if (!room) return;

    if (room.phase !== 'playing') return;

    // Rate limiting
    if (!room.checkInputRate(socket.id)) {
      sendError(socket, ERR.RATE_LIMITED, 'Input rate exceeded');
      return;
    }

    // Basic validation
    if (!data?.input || typeof data.input.f !== 'number' || typeof data.input.b !== 'number') {
      return; // silently drop malformed inputs
    }

    // Relay to all other players in the room
    socket.to(room.code).emit(MSG.GAME_INPUT, {
      input: data.input,
      playerId: socket.id,
    });

    room.touch();
  });

  // --- GAME STATE SYNC ---

  socket.on(MSG.GAME_STATE_SYNC, (data: { frame: number; checksum: number }) => {
    const room = findRoomBySocket(socket.id);
    if (!room) return;

    // Relay to other players for desync detection
    socket.to(room.code).emit(MSG.GAME_STATE_SYNC, {
      frame: data.frame,
      checksum: data.checksum,
      playerId: socket.id,
    });
  });

  // --- CHAT MESSAGE ---

  socket.on(MSG.CHAT_MESSAGE, (data: { message?: string }) => {
    const room = findRoomBySocket(socket.id);
    if (!room) return;

    const player = room.players.get(socket.id);
    if (!player) return;

    const message = sanitizeString(data?.message, 200);
    if (message.length === 0) return;

    const chatPayload = {
      playerId: socket.id,
      playerName: player.name,
      message,
      timestamp: Date.now(),
    };

    // Broadcast to everyone in the room (including sender)
    io.to(room.code).emit(MSG.CHAT_MESSAGE, chatPayload);
    room.touch();
  });

  // --- PING / PONG ---

  socket.on(MSG.PING, (data: { timestamp?: number }) => {
    socket.emit(MSG.PONG, {
      timestamp: data?.timestamp ?? Date.now(),
      serverTime: Date.now(),
    });
  });

  // --- DISCONNECT ---

  socket.on('disconnect', (reason: string) => {
    console.log(`[Server] Player disconnected: ${socket.id} (${reason})`);
    handleLeaveRoom(socket);
  });
});

// ============================================================================
// Leave / Disconnect Handler
// ============================================================================

function handleLeaveRoom(socket: Socket): void {
  const room = findRoomBySocket(socket.id);
  if (!room) return;

  const result = room.removePlayer(socket.id);
  socketToRoom.delete(socket.id);

  if (!result.removed) return;

  if (result.isEmpty) {
    // Room is empty, destroy it
    console.log(`[Server] Room ${room.code} is empty, destroying`);
    room.destroy();
    rooms.delete(room.code);
  } else {
    // Notify remaining players
    const payload = {
      playerId: socket.id,
      newHostId: result.newHostId,
      room: room.getState(),
    };
    io.to(room.code).emit(MSG.PLAYER_LEFT, payload);

    if (result.newHostId) {
      console.log(`[Server] Host transferred in room ${room.code} to ${result.newHostId}`);
    }
  }
}

// ============================================================================
// Room Cleanup Interval
// ============================================================================

const CLEANUP_INTERVAL_MS = 60_000;        // check every 60 seconds
const ROOM_INACTIVITY_MS = 5 * 60_000;     // 5 minutes of inactivity

setInterval(() => {
  const now = Date.now();
  let cleaned = 0;

  for (const [code, room] of rooms) {
    if (now - room.lastActivity > ROOM_INACTIVITY_MS) {
      console.log(`[Server] Cleaning up inactive room ${code} (last activity: ${Math.round((now - room.lastActivity) / 1000)}s ago)`);

      // Disconnect all sockets from the room
      for (const [socketId] of room.sockets) {
        socketToRoom.delete(socketId);
      }

      room.destroy();
      rooms.delete(code);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    console.log(`[Server] Cleaned up ${cleaned} inactive room(s). Active rooms: ${rooms.size}`);
  }
}, CLEANUP_INTERVAL_MS);

// ============================================================================
// Startup
// ============================================================================

console.log('============================================');
console.log('  COSMIC KNOCKOUTS - Game Server');
console.log(`  Listening on port ${PORT}`);
console.log(`  CORS: origin *`);
console.log(`  Room cleanup: every ${CLEANUP_INTERVAL_MS / 1000}s, inactive > ${ROOM_INACTIVITY_MS / 1000}s`);
console.log('============================================');
