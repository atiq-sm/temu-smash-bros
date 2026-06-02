'use client';

import { useMemo } from 'react';

// ============================================================================
// Types
// ============================================================================

interface PlayerHUDData {
  id: number;
  name: string;
  characterId: string;
  damage: number;
  stocks: number;
  maxStocks: number;
  color: string;
}

interface GameHUDProps {
  players: PlayerHUDData[];
  timer: number;
}

// ============================================================================
// Helper: Damage color
// ============================================================================

function getDamageColor(damage: number): string {
  if (damage < 50) return '#ffffff';
  if (damage < 100) return '#ffcc00';
  if (damage < 150) return '#ff8800';
  return '#ff2222';
}

function getDamageGlow(damage: number): string {
  if (damage < 50) return 'none';
  if (damage < 100) return '0 0 8px rgba(255, 204, 0, 0.5)';
  if (damage < 150) return '0 0 12px rgba(255, 136, 0, 0.6)';
  return '0 0 16px rgba(255, 34, 34, 0.7), 0 0 32px rgba(255, 34, 34, 0.3)';
}

// ============================================================================
// Timer Display
// ============================================================================

function TimerDisplay({ seconds }: { seconds: number }) {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const display = `${minutes}:${secs.toString().padStart(2, '0')}`;

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2">
      <div className="px-4 py-1.5 rounded-sm bg-black/50 border border-white/10 backdrop-blur-sm">
        <span className="text-lg font-bold tracking-[0.1em] text-white/80 tabular-nums">
          {display}
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// Player Damage Display
// ============================================================================

function PlayerDamageDisplay({
  player,
  side,
}: {
  player: PlayerHUDData;
  side: 'left' | 'right';
}) {
  const damageColor = getDamageColor(player.damage);
  const damageGlow = getDamageGlow(player.damage);

  const stockIcons = useMemo(
    () =>
      Array.from({ length: player.maxStocks }, (_, i) => (
        <div
          key={i}
          className="rounded-full transition-all duration-300"
          style={{
            width: 10,
            height: 10,
            backgroundColor: i < player.stocks ? player.color : 'rgba(255,255,255,0.1)',
            boxShadow:
              i < player.stocks ? `0 0 6px ${player.color}88` : 'none',
          }}
        />
      )),
    [player.stocks, player.maxStocks, player.color],
  );

  return (
    <div
      className={`
        absolute bottom-6
        ${side === 'left' ? 'left-8' : 'right-8'}
        flex flex-col
        ${side === 'left' ? 'items-start' : 'items-end'}
        gap-1
      `}
    >
      {/* Player label */}
      <span
        className="text-[10px] font-bold tracking-[0.2em] uppercase"
        style={{ color: `${player.color}99` }}
      >
        {player.name}
      </span>

      {/* Damage percentage */}
      <div
        className="text-5xl font-black tabular-nums tracking-tight transition-all duration-150"
        style={{
          color: damageColor,
          textShadow: damageGlow,
          fontFamily: "'Segoe UI', system-ui, sans-serif",
        }}
      >
        {Math.floor(player.damage)}
        <span className="text-2xl ml-0.5 text-white/40">%</span>
      </div>

      {/* Stock icons */}
      <div className={`flex gap-1.5 ${side === 'right' ? 'flex-row-reverse' : ''}`}>
        {stockIcons}
      </div>
    </div>
  );
}

// ============================================================================
// GameHUD Component
// ============================================================================

export default function GameHUD({ players, timer }: GameHUDProps) {
  return (
    <div className="game-hud">
      {/* Timer */}
      <TimerDisplay seconds={timer} />

      {/* Player damage displays */}
      {players.length >= 1 && (
        <PlayerDamageDisplay player={players[0]} side="left" />
      )}
      {players.length >= 2 && (
        <PlayerDamageDisplay player={players[1]} side="right" />
      )}
    </div>
  );
}
