'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { NetworkManager, ConnectionState } from '@/game/net/NetworkManager';
import type { RoomState, ErrorPayload, ChatMessagePayload, MatchStartedPayload } from '@/game/net/protocol';

// ============================================================================
// Types
// ============================================================================

interface OnlineMenuProps {
  onBack: () => void;
  onStartMatch: (config: {
    settings: MatchStartedPayload['settings'];
    playerSlots: MatchStartedPayload['playerSlots'];
    seed: number;
  }) => void;
}

type MenuView = 'choice' | 'create' | 'join' | 'lobby';

interface ChatEntry {
  id: number;
  playerName: string;
  message: string;
  timestamp: number;
  isSystem?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const PLAYER_COLORS = ['#00f0ff', '#ff00aa', '#ffcc00', '#44ff88'];

// ============================================================================
// Sub-components
// ============================================================================

function ConnectionDot({ state }: { state: ConnectionState }) {
  const color =
    state === ConnectionState.Connected || state === ConnectionState.InRoom || state === ConnectionState.Playing
      ? '#44ff88'
      : state === ConnectionState.Connecting
        ? '#ffcc00'
        : '#ff4444';

  const label =
    state === ConnectionState.Connected || state === ConnectionState.InRoom
      ? 'Connected'
      : state === ConnectionState.Connecting
        ? 'Connecting...'
        : state === ConnectionState.Playing
          ? 'In Match'
          : 'Disconnected';

  return (
    <div className="flex items-center gap-2">
      <div
        className="w-2.5 h-2.5 rounded-full"
        style={{
          backgroundColor: color,
          boxShadow: `0 0 6px ${color}, 0 0 12px ${color}80`,
        }}
      />
      <span className="text-[10px] tracking-[0.15em] uppercase" style={{ color }}>
        {label}
      </span>
    </div>
  );
}

function NeonButton({
  children,
  onClick,
  disabled,
  variant = 'cyan',
  size = 'normal',
  className = '',
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'cyan' | 'magenta' | 'gold';
  size?: 'normal' | 'small' | 'large';
  className?: string;
}) {
  const colorMap = {
    cyan: { color: '#00f0ff', rgb: '0, 240, 255' },
    magenta: { color: '#ff00aa', rgb: '255, 0, 170' },
    gold: { color: '#ffcc00', rgb: '255, 204, 0' },
  };
  const { color, rgb } = colorMap[variant];

  const sizeClasses = {
    small: 'py-2 px-5 text-xs',
    normal: 'py-3 px-8 text-sm',
    large: 'py-4 px-10 text-base',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        ${sizeClasses[size]} font-bold tracking-[0.15em] uppercase
        transition-all duration-200 cursor-pointer select-none
        ${disabled ? 'opacity-30 cursor-not-allowed' : 'hover:scale-[1.03] active:scale-[0.97]'}
        ${className}
      `}
      style={{
        color: disabled ? '#555' : color,
        border: `1px solid ${disabled ? '#333' : color}60`,
        background: disabled ? 'transparent' : `rgba(${rgb}, 0.05)`,
        boxShadow: disabled ? 'none' : `0 0 10px rgba(${rgb}, 0.2), inset 0 0 10px rgba(${rgb}, 0.05)`,
      }}
    >
      {children}
    </button>
  );
}

// ============================================================================
// OnlineMenu Component
// ============================================================================

export default function OnlineMenu({ onBack, onStartMatch }: OnlineMenuProps) {
  // --- State ---
  const [view, setView] = useState<MenuView>('choice');
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.Disconnected);
  const [room, setRoom] = useState<RoomState | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [playerName] = useState(() => `Player${Math.floor(Math.random() * 9000 + 1000)}`);
  const [error, setError] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatEntry[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [ping, setPing] = useState(0);
  const [copied, setCopied] = useState(false);

  const chatIdRef = useRef(0);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const networkRef = useRef<NetworkManager | null>(null);

  // --- Network Manager lifecycle ---

  useEffect(() => {
    const net = NetworkManager.getInstance();
    networkRef.current = net;

    const unsubs: (() => void)[] = [];

    unsubs.push(net.on('connectionStateChanged', (state) => {
      setConnectionState(state);
    }));

    unsubs.push(net.on('roomCreated', (roomState) => {
      setRoom(roomState);
      setView('lobby');
      setError(null);
      addSystemMessage('Room created. Share the code with friends!');
    }));

    unsubs.push(net.on('roomJoined', (roomState) => {
      setRoom(roomState);
      setView('lobby');
      setError(null);
      addSystemMessage(`Joined room ${roomState.code}`);
    }));

    unsubs.push(net.on('roomUpdated', (roomState) => {
      setRoom(roomState);
    }));

    unsubs.push(net.on('playerJoined', (data) => {
      addSystemMessage(`${data.player.name} joined`);
    }));

    unsubs.push(net.on('playerLeft', (data) => {
      addSystemMessage(`A player left the room`);
    }));

    unsubs.push(net.on('matchStarted', (data) => {
      onStartMatch({
        settings: data.settings,
        playerSlots: data.playerSlots,
        seed: data.seed,
      });
    }));

    unsubs.push(net.on('chatMessage', (data: ChatMessagePayload) => {
      addChatMessage(data.playerName, data.message);
    }));

    unsubs.push(net.on('error', (err: ErrorPayload) => {
      setError(err.message);
      // Auto-clear error after 5 seconds
      setTimeout(() => setError(null), 5000);
    }));

    unsubs.push(net.on('pingUpdated', (rtt) => {
      setPing(rtt);
    }));

    // Connect automatically
    if (!net.isConnected) {
      net.connect();
    }
    setConnectionState(net.connectionState);

    return () => {
      unsubs.forEach(fn => fn());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Chat helpers ---

  const addSystemMessage = useCallback((message: string) => {
    setChatMessages(prev => [
      ...prev.slice(-49),
      { id: ++chatIdRef.current, playerName: '', message, timestamp: Date.now(), isSystem: true },
    ]);
  }, []);

  const addChatMessage = useCallback((playerName: string, message: string) => {
    setChatMessages(prev => [
      ...prev.slice(-49),
      { id: ++chatIdRef.current, playerName, message, timestamp: Date.now() },
    ]);
  }, []);

  // Auto-scroll chat
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // --- Handlers ---

  const handleCreate = useCallback(() => {
    const net = networkRef.current;
    if (!net) return;

    if (net.connectionState === ConnectionState.Disconnected || net.connectionState === ConnectionState.Connecting) {
      net.connect();
      // Wait for connection, then create
      const unsub = net.on('connectionStateChanged', (state) => {
        if (state === ConnectionState.Connected) {
          unsub();
          net.createRoom(playerName);
        }
      });
    } else {
      net.createRoom(playerName);
    }

    setView('create');
  }, [playerName]);

  const handleJoinView = useCallback(() => {
    setView('join');
    setJoinCode('');
    setError(null);
  }, []);

  const handleJoinSubmit = useCallback(() => {
    const net = networkRef.current;
    if (!net) return;

    const code = joinCode.trim().toUpperCase();
    if (code.length !== 4) {
      setError('Room code must be 4 characters');
      return;
    }

    if (net.connectionState === ConnectionState.Disconnected || net.connectionState === ConnectionState.Connecting) {
      net.connect();
      const unsub = net.on('connectionStateChanged', (state) => {
        if (state === ConnectionState.Connected) {
          unsub();
          net.joinRoom(code, playerName);
        }
      });
    } else {
      net.joinRoom(code, playerName);
    }
  }, [joinCode, playerName]);

  const handleReady = useCallback(() => {
    const net = networkRef.current;
    if (!net || !room) return;

    const me = room.players.find(p => p.id === net.playerId);
    if (me) {
      net.sendReady(!me.ready);
    }
  }, [room]);

  const handleStartMatch = useCallback(() => {
    const net = networkRef.current;
    if (!net) return;
    net.startMatch();
  }, []);

  const handleLeave = useCallback(() => {
    const net = networkRef.current;
    if (!net) return;

    net.leaveRoom();
    setRoom(null);
    setChatMessages([]);
    setView('choice');
    setError(null);
  }, []);

  const handleBackButton = useCallback(() => {
    if (view === 'lobby') {
      handleLeave();
    } else if (view === 'create' || view === 'join') {
      setView('choice');
      setError(null);
    } else {
      const net = networkRef.current;
      if (net) {
        net.disconnect();
      }
      onBack();
    }
  }, [view, handleLeave, onBack]);

  const handleCopyCode = useCallback(async () => {
    if (!room) return;
    try {
      await navigator.clipboard.writeText(room.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select text if clipboard fails
    }
  }, [room]);

  const handleSendChat = useCallback(() => {
    const net = networkRef.current;
    if (!net || !chatInput.trim()) return;

    net.sendChatMessage(chatInput.trim());
    setChatInput('');
  }, [chatInput]);

  const handleChatKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSendChat();
    }
  }, [handleSendChat]);

  // --- Keyboard navigation for code input ---

  const handleCodeKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleJoinSubmit();
    }
  }, [handleJoinSubmit]);

  // Global keyboard handler for Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleBackButton();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleBackButton]);

  // --- Derived state ---

  const net = networkRef.current;
  const myPlayer = room?.players.find(p => p.id === net?.playerId);
  const isHost = net?.isHost ?? false;
  const allReady = room ? room.players.length >= 2 && room.players.every(p => p.ready) : false;

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center select-none">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a2a]/90 via-[var(--color-bg)]/80 to-[var(--color-bg)]" />

      {/* Radial spotlight */}
      <div
        className="absolute top-[10%] left-1/2 -translate-x-1/2 w-[500px] h-[250px] rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse, rgba(255, 0, 170, 0.06) 0%, transparent 70%)',
        }}
      />

      {/* Content container */}
      <div className="relative z-10 flex flex-col items-center gap-6 w-full max-w-lg px-4">

        {/* Header */}
        <div className="flex flex-col items-center gap-1">
          <h2
            className="text-3xl font-black tracking-[0.2em] text-[var(--color-secondary)] glow-magenta"
            style={{ fontFamily: "'Segoe UI', system-ui, sans-serif" }}
          >
            ONLINE
          </h2>
          <div className="flex items-center gap-3">
            <div className="w-12 h-px bg-gradient-to-r from-transparent to-[var(--color-secondary)]" />
            <span className="text-[10px] tracking-[0.4em] text-white/30 uppercase">
              Multiplayer
            </span>
            <div className="w-12 h-px bg-gradient-to-l from-transparent to-[var(--color-secondary)]" />
          </div>
        </div>

        {/* Connection status + ping */}
        <div className="flex items-center justify-between w-full">
          <ConnectionDot state={connectionState} />
          {connectionState !== ConnectionState.Disconnected && ping > 0 && (
            <span className="text-[10px] tracking-wider text-white/30">
              {ping}ms
            </span>
          )}
        </div>

        {/* Error banner */}
        {error && (
          <div
            className="w-full py-2 px-4 border border-red-500/50 bg-red-500/10 rounded-sm text-red-400 text-xs tracking-wide text-center animate-fade-in"
          >
            {error}
          </div>
        )}

        {/* --- CHOICE VIEW --- */}
        {view === 'choice' && (
          <div className="flex flex-col items-center gap-4 w-full animate-fade-in">
            <NeonButton onClick={handleCreate} variant="cyan" size="large" className="w-full">
              CREATE ROOM
            </NeonButton>
            <NeonButton onClick={handleJoinView} variant="magenta" size="large" className="w-full">
              JOIN ROOM
            </NeonButton>
          </div>
        )}

        {/* --- CREATE VIEW (waiting for room creation) --- */}
        {view === 'create' && !room && (
          <div className="flex flex-col items-center gap-4 animate-fade-in">
            <div className="text-sm text-white/50 tracking-wider animate-pulse-glow">
              Creating room...
            </div>
          </div>
        )}

        {/* --- JOIN VIEW --- */}
        {view === 'join' && !room && (
          <div className="flex flex-col items-center gap-4 w-full animate-fade-in">
            <label className="text-xs tracking-[0.2em] text-white/40 uppercase">
              Enter Room Code
            </label>
            <input
              type="text"
              maxLength={4}
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              onKeyDown={handleCodeKeyDown}
              placeholder="XXXX"
              className="w-48 text-center text-3xl font-black tracking-[0.5em] py-3 bg-white/5 border border-white/20
                         text-[var(--color-primary)] placeholder:text-white/15
                         focus:border-[var(--color-primary)]/60 focus:outline-none transition-colors"
              autoFocus
            />
            <NeonButton
              onClick={handleJoinSubmit}
              variant="magenta"
              disabled={joinCode.length !== 4}
            >
              JOIN
            </NeonButton>
          </div>
        )}

        {/* --- LOBBY VIEW --- */}
        {view === 'lobby' && room && (
          <div className="flex flex-col gap-4 w-full animate-fade-in">

            {/* Room code display */}
            <div className="flex flex-col items-center gap-2">
              <span className="text-[10px] tracking-[0.3em] text-white/30 uppercase">Room Code</span>
              <button
                onClick={handleCopyCode}
                className="group relative flex items-center gap-3 cursor-pointer"
                title="Click to copy"
              >
                <span
                  className="text-4xl font-black tracking-[0.5em] text-[var(--color-primary)] glow-cyan
                             group-hover:text-white transition-colors"
                >
                  {room.code}
                </span>
                <span className="text-[10px] text-white/30 group-hover:text-[var(--color-primary)] transition-colors">
                  {copied ? 'COPIED!' : 'COPY'}
                </span>
              </button>
            </div>

            {/* Divider */}
            <div className="w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

            {/* Player list */}
            <div className="flex flex-col gap-2">
              <span className="text-[10px] tracking-[0.2em] text-white/30 uppercase">
                Players ({room.players.length}/4)
              </span>
              <div className="flex flex-col gap-1.5">
                {room.players.map((player, idx) => {
                  const color = PLAYER_COLORS[player.slotIndex % PLAYER_COLORS.length];
                  const isMe = player.id === net?.playerId;
                  return (
                    <div
                      key={player.id}
                      className="flex items-center justify-between py-2 px-3 border rounded-sm"
                      style={{
                        borderColor: isMe ? `${color}40` : 'rgba(255,255,255,0.08)',
                        background: isMe ? `${color}08` : 'rgba(255,255,255,0.02)',
                      }}
                    >
                      <div className="flex items-center gap-3">
                        {/* Player color dot */}
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{
                            backgroundColor: color,
                            boxShadow: `0 0 4px ${color}80`,
                          }}
                        />
                        {/* Name */}
                        <span className="text-sm font-semibold tracking-wider" style={{ color }}>
                          {player.name}
                          {isMe && <span className="text-white/30 ml-1">(you)</span>}
                        </span>
                        {/* Host badge */}
                        {player.isHost && (
                          <span className="text-[9px] tracking-[0.15em] px-1.5 py-0.5 bg-[var(--color-accent)]/15 text-[var(--color-accent)] border border-[var(--color-accent)]/30 rounded-sm uppercase">
                            Host
                          </span>
                        )}
                      </div>
                      {/* Character + ready */}
                      <div className="flex items-center gap-3">
                        {player.characterId && (
                          <span className="text-[10px] text-white/30 tracking-wider uppercase">
                            {player.characterId}
                          </span>
                        )}
                        <div
                          className="text-[10px] tracking-wider font-bold uppercase"
                          style={{ color: player.ready ? '#44ff88' : '#ff6644' }}
                        >
                          {player.ready ? 'READY' : 'NOT READY'}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Empty slots */}
                {Array.from({ length: 4 - room.players.length }).map((_, i) => (
                  <div
                    key={`empty-${i}`}
                    className="flex items-center justify-center py-2 px-3 border border-white/5 rounded-sm"
                  >
                    <span className="text-[10px] tracking-[0.2em] text-white/15 uppercase">
                      Waiting for player...
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Divider */}
            <div className="w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

            {/* Chat */}
            <div className="flex flex-col gap-2">
              <span className="text-[10px] tracking-[0.2em] text-white/30 uppercase">Chat</span>
              <div
                ref={chatScrollRef}
                className="h-28 overflow-y-auto rounded-sm border border-white/5 bg-white/[0.02] p-2 flex flex-col gap-0.5"
                style={{ scrollbarWidth: 'none' }}
              >
                {chatMessages.length === 0 && (
                  <span className="text-[10px] text-white/15 italic">No messages yet</span>
                )}
                {chatMessages.map((msg) => (
                  <div key={msg.id} className="text-xs">
                    {msg.isSystem ? (
                      <span className="text-white/25 italic">{msg.message}</span>
                    ) : (
                      <>
                        <span className="text-[var(--color-primary)] font-semibold">{msg.playerName}: </span>
                        <span className="text-white/60">{msg.message}</span>
                      </>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={handleChatKeyDown}
                  maxLength={200}
                  placeholder="Type a message..."
                  className="flex-1 text-xs py-1.5 px-3 bg-white/5 border border-white/10 text-white/80
                             placeholder:text-white/20 focus:border-[var(--color-primary)]/40 focus:outline-none
                             transition-colors"
                />
                <NeonButton onClick={handleSendChat} variant="cyan" size="small" disabled={!chatInput.trim()}>
                  Send
                </NeonButton>
              </div>
            </div>

            {/* Divider */}
            <div className="w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

            {/* Action buttons */}
            <div className="flex gap-3 w-full">
              <NeonButton
                onClick={handleReady}
                variant={myPlayer?.ready ? 'gold' : 'cyan'}
                className="flex-1"
              >
                {myPlayer?.ready ? 'UNREADY' : 'READY'}
              </NeonButton>

              {isHost && (
                <NeonButton
                  onClick={handleStartMatch}
                  variant="magenta"
                  disabled={!allReady}
                  className="flex-1"
                >
                  START
                </NeonButton>
              )}
            </div>
          </div>
        )}

        {/* Back button */}
        <button
          onClick={handleBackButton}
          className="mt-2 text-[10px] tracking-[0.3em] text-white/30 uppercase
                     hover:text-white/60 transition-colors cursor-pointer"
        >
          {view === 'choice' ? '< BACK TO MENU' : '< BACK'}
        </button>

        {/* Navigation hint */}
        <p className="text-[10px] tracking-[0.2em] text-white/15 uppercase">
          ESC to go back
        </p>
      </div>

      {/* Bottom decorative bar */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[var(--color-secondary)]/20 to-transparent" />
    </div>
  );
}
