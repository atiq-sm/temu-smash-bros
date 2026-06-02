'use client';

import { useEffect, useCallback, useMemo } from 'react';

// ============================================================================
// Types
// ============================================================================

interface MatchResultStat {
  playerId: number;
  name: string;
  kos: number;
  falls: number;
  damageDealt: number;
}

interface MatchResult {
  winnerId: number;
  winnerName: string;
  winnerCharacter: string;
  winnerColor: string;
  winMethod: 'ko' | 'time';
  stats: MatchResultStat[];
}

interface ResultsScreenProps {
  result: MatchResult;
  onRematch: () => void;
  onQuit: () => void;
}

// ============================================================================
// Celebration Particles
// ============================================================================

function CelebrationParticles({ color }: { color: string }) {
  const particles = useMemo(
    () =>
      Array.from({ length: 30 }, (_, i) => ({
        id: i,
        left: `${10 + Math.random() * 80}%`,
        top: `${10 + Math.random() * 80}%`,
        size: 4 + Math.random() * 8,
        duration: `${1.5 + Math.random() * 2}s`,
        delay: `${Math.random() * 1}s`,
        color: i % 3 === 0 ? color : i % 3 === 1 ? '#ffffff' : 'var(--color-accent)',
      })),
    [color],
  );

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-full"
          style={{
            left: p.left,
            top: p.top,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            animation: `celebrationBurst ${p.duration} ${p.delay} ease-out forwards`,
            opacity: 0.8,
          }}
        />
      ))}
    </div>
  );
}

// ============================================================================
// Results Screen Component
// ============================================================================

export default function ResultsScreen({ result, onRematch, onQuit }: ResultsScreenProps) {
  // Keyboard support
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onRematch();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        onQuit();
      }
    },
    [onRematch, onQuit],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const announcement = result.winMethod === 'time' ? 'TIME!' : 'GAME!';

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center select-none animate-fade-in">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

      {/* Celebration particles */}
      <CelebrationParticles color={result.winnerColor} />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center gap-8 w-full max-w-lg px-6">
        {/* Announcement */}
        <div
          className="text-6xl font-black tracking-[0.2em] animate-scale-in"
          style={{
            color: 'var(--color-accent)',
            textShadow:
              '0 0 20px rgba(255, 204, 0, 0.6), 0 0 40px rgba(255, 204, 0, 0.3), 0 0 80px rgba(255, 204, 0, 0.15)',
          }}
        >
          {announcement}
        </div>

        {/* Winner Display */}
        <div
          className="flex flex-col items-center gap-3 animate-slide-in"
          style={{ animationDelay: '200ms', opacity: 0 }}
        >
          {/* Winner glow orb */}
          <div
            className="w-24 h-24 rounded-full flex items-center justify-center animate-glow-pulse"
            style={{
              background: `radial-gradient(circle, ${result.winnerColor}44 0%, transparent 70%)`,
              boxShadow: `0 0 30px ${result.winnerColor}44, 0 0 60px ${result.winnerColor}22`,
            }}
          >
            <div
              className="w-16 h-16 rounded-full"
              style={{
                background: result.winnerColor,
                boxShadow: `0 0 20px ${result.winnerColor}88`,
              }}
            />
          </div>

          <div className="text-center">
            <h3
              className="text-2xl font-black tracking-[0.15em]"
              style={{ color: result.winnerColor }}
            >
              {result.winnerName}
            </h3>
            <p className="text-xs tracking-[0.2em] text-white/40 uppercase mt-1">
              {result.winnerCharacter} &middot; Winner
            </p>
          </div>
        </div>

        {/* Divider */}
        <div className="w-full h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />

        {/* Match Stats */}
        <div
          className="w-full animate-slide-in"
          style={{ animationDelay: '400ms', opacity: 0 }}
        >
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] tracking-[0.2em] text-white/30 uppercase">
                <th className="text-left py-1 font-medium">Player</th>
                <th className="text-center py-1 font-medium">KOs</th>
                <th className="text-center py-1 font-medium">Falls</th>
                <th className="text-right py-1 font-medium">Damage</th>
              </tr>
            </thead>
            <tbody>
              {result.stats.map((stat) => {
                const isWinner = stat.playerId === result.winnerId;
                return (
                  <tr
                    key={stat.playerId}
                    className={`border-t border-white/5 ${isWinner ? 'text-white' : 'text-white/50'}`}
                  >
                    <td className="py-2 text-left font-bold tracking-wider">
                      {stat.name}
                      {isWinner && (
                        <span className="ml-2 text-[8px] text-[var(--color-accent)] tracking-[0.15em]">
                          WIN
                        </span>
                      )}
                    </td>
                    <td className="py-2 text-center tabular-nums">{stat.kos}</td>
                    <td className="py-2 text-center tabular-nums">{stat.falls}</td>
                    <td className="py-2 text-right tabular-nums">
                      {Math.floor(stat.damageDealt)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Action Buttons */}
        <div
          className="flex gap-4 animate-slide-in"
          style={{ animationDelay: '600ms', opacity: 0 }}
        >
          <button
            onClick={onRematch}
            className="menu-btn"
            style={{
              borderColor: 'var(--color-primary)',
              color: 'var(--color-primary)',
            }}
          >
            REMATCH
          </button>
          <button
            onClick={onQuit}
            className="menu-btn"
            style={{
              borderColor: 'rgba(255,255,255,0.2)',
              color: 'rgba(255,255,255,0.5)',
            }}
          >
            MENU
          </button>
        </div>

        {/* Hint */}
        <p className="text-[10px] tracking-[0.2em] text-white/15 uppercase">
          Enter to rematch &middot; Esc for menu
        </p>
      </div>
    </div>
  );
}
