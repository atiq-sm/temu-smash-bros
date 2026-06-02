'use client';

import { useEffect, useCallback, useState } from 'react';

// ============================================================================
// Types
// ============================================================================

interface StageSelectProps {
  selectedStage: string | null;
  onSelect: (stageId: string) => void;
  onConfirm: () => void;
  onBack: () => void;
}

interface StageInfo {
  id: string;
  name: string;
  description: string;
  bgGradient: [string, string];
  platformColor: string;
  glowColor: string;
  platforms: { x: number; y: number; w: number }[];
}

// ============================================================================
// Stage Data
// ============================================================================

const STAGES: StageInfo[] = [
  {
    id: 'battlefield',
    name: 'COSMIC ARENA',
    description: 'Classic three-platform battlefield. Balanced layout for all playstyles.',
    bgGradient: ['#0f0b1e', '#2d1b69'],
    platformColor: '#60a5fa',
    glowColor: '#60a5fa',
    platforms: [
      { x: 20, y: 78, w: 60 },
      { x: 10, y: 52, w: 18 },
      { x: 72, y: 52, w: 18 },
      { x: 35, y: 30, w: 28 },
    ],
  },
  {
    id: 'final_destination',
    name: 'VOID PLATFORM',
    description: 'One stage. No platforms. Pure skill decides every match.',
    bgGradient: ['#0a0a1a', '#1a0a2e'],
    platformColor: '#f472b6',
    glowColor: '#f472b6',
    platforms: [{ x: 10, y: 78, w: 80 }],
  },
  {
    id: 'small_battlefield',
    name: 'NEBULA RING',
    description: 'Compact stage with a single floating platform. Fast, aggressive games.',
    bgGradient: ['#071a0f', '#0a2e1a'],
    platformColor: '#34d399',
    glowColor: '#34d399',
    platforms: [
      { x: 18, y: 78, w: 64 },
      { x: 35, y: 48, w: 28 },
    ],
  },
  {
    id: 'neon_district',
    name: 'NEON DISTRICT',
    description: 'Asymmetric urban rooftops. Elevated platform creates vertical play.',
    bgGradient: ['#0a0520', '#2a1060'],
    platformColor: '#ff00aa',
    glowColor: '#ff00aa',
    platforms: [
      { x: 15, y: 78, w: 55 },
      { x: 60, y: 60, w: 25 },
      { x: 15, y: 38, w: 16 },
    ],
  },
];

// ============================================================================
// Stage Preview Component
// ============================================================================

function StagePreview({ stage }: { stage: StageInfo }) {
  return (
    <div
      className="w-full h-24 rounded overflow-hidden relative"
      style={{
        background: `linear-gradient(180deg, ${stage.bgGradient[0]}, ${stage.bgGradient[1]})`,
      }}
    >
      {/* Platforms */}
      {stage.platforms.map((p, i) => (
        <div
          key={i}
          className="absolute rounded-sm"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: `${p.w}%`,
            height: '4px',
            background: stage.platformColor,
            boxShadow: `0 0 8px ${stage.glowColor}66, 0 2px 4px ${stage.glowColor}33`,
          }}
        />
      ))}

      {/* Subtle grid lines */}
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)
          `,
          backgroundSize: '20px 20px',
        }}
      />
    </div>
  );
}

// ============================================================================
// Stage Select Component
// ============================================================================

export default function StageSelect({
  selectedStage,
  onSelect,
  onConfirm,
  onBack,
}: StageSelectProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const handleRandom = useCallback(() => {
    const randomStage = STAGES[Math.floor(Math.random() * STAGES.length)];
    onSelect(randomStage.id);
  }, [onSelect]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onBack();
      }
      if (e.key === 'Enter' && selectedStage) {
        e.preventDefault();
        onConfirm();
      }
      if (e.key === 'r' || e.key === 'R') {
        handleRandom();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onBack, onConfirm, selectedStage, handleRandom]);

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center select-none animate-fade-in">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a2a] via-[var(--color-bg)] to-[#0a0a1a]" />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center gap-8 w-full max-w-5xl px-6">
        {/* Header */}
        <div className="flex items-center justify-between w-full">
          <button
            onClick={onBack}
            className="text-xs tracking-[0.2em] text-white/40 hover:text-white/80 transition-colors uppercase cursor-pointer"
          >
            &larr; Back
          </button>
          <h2 className="text-2xl font-black tracking-[0.2em] text-white">
            SELECT STAGE
          </h2>
          <button
            onClick={handleRandom}
            className="text-xs tracking-[0.2em] text-[var(--color-accent)]/60 hover:text-[var(--color-accent)] transition-colors uppercase cursor-pointer"
          >
            Random [R]
          </button>
        </div>

        {/* Stage Cards */}
        <div className="grid grid-cols-4 gap-4 w-full">
          {STAGES.map((stage, index) => {
            const isSelected = selectedStage === stage.id;
            const isHovered = hoveredId === stage.id;

            return (
              <button
                key={stage.id}
                className={`
                  flex flex-col rounded-md overflow-hidden border
                  transition-all duration-200 cursor-pointer animate-slide-in
                  ${isSelected
                    ? 'border-[var(--color-accent)] scale-[1.02]'
                    : isHovered
                      ? 'border-white/30'
                      : 'border-white/10'}
                `}
                style={{
                  animationDelay: `${100 + index * 80}ms`,
                  opacity: 0,
                  boxShadow: isSelected
                    ? `0 0 16px ${stage.glowColor}33, 0 0 32px ${stage.glowColor}11`
                    : 'none',
                }}
                onClick={() => onSelect(stage.id)}
                onMouseEnter={() => setHoveredId(stage.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                {/* Preview */}
                <StagePreview stage={stage} />

                {/* Info */}
                <div
                  className={`
                    p-3 transition-colors duration-200
                    ${isSelected
                      ? 'bg-white/[0.06]'
                      : 'bg-white/[0.02]'}
                  `}
                >
                  <h3
                    className={`
                      text-xs font-bold tracking-[0.15em] transition-colors duration-200
                      ${isSelected ? 'text-[var(--color-accent)]' : isHovered ? 'text-white' : 'text-white/70'}
                    `}
                  >
                    {stage.name}
                  </h3>
                  <p className="text-[9px] text-white/30 mt-1 leading-relaxed line-clamp-2">
                    {stage.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Action */}
        <div className="flex items-center gap-6">
          {selectedStage && (
            <button
              onClick={onConfirm}
              className="menu-btn animate-scale-in"
              style={{
                borderColor: 'var(--color-accent)',
                color: 'var(--color-accent)',
              }}
            >
              START BATTLE
            </button>
          )}
        </div>

        {/* Hint */}
        <p className="text-[10px] tracking-[0.3em] text-white/20 uppercase">
          Click to select &middot; R for random &middot; Esc to go back &middot; Enter to start
        </p>
      </div>
    </div>
  );
}
