'use client';

import dynamic from 'next/dynamic';

const Game = dynamic(() => import('@/components/Game'), {
  ssr: false,
  loading: () => <LoadingScreen />,
});

function LoadingScreen() {
  return (
    <div className="game-container flex items-center justify-center">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a2a] via-[var(--color-bg)] to-[#0a0a1a]" />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center gap-8">
        {/* Title */}
        <h1
          className="text-5xl font-black tracking-widest text-[var(--color-primary)] glow-cyan animate-pulse-glow"
          style={{ fontFamily: "'Segoe UI', system-ui, sans-serif" }}
        >
          COSMIC KNOCKOUTS
        </h1>

        {/* Loading bar */}
        <div className="w-64 h-1 rounded-full bg-[var(--color-surface)] overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-secondary)] animate-shimmer"
            style={{ width: '60%' }}
          />
        </div>

        {/* Loading text */}
        <p className="text-sm uppercase tracking-[0.3em] text-[var(--color-text-dim)] animate-pulse-glow">
          Initializing Arena
        </p>
      </div>
    </div>
  );
}

export default function GameLoader() {
  return <Game />;
}
