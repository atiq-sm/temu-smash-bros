'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';

// ============================================================================
// Types
// ============================================================================

interface MainMenuProps {
  onSelect: (option: string) => void;
}

interface MenuOption {
  id: string;
  label: string;
  sublabel: string;
  available: boolean;
}

// ============================================================================
// Background Particles
// ============================================================================

function BackgroundParticles() {
  const particles = useMemo(
    () =>
      Array.from({ length: 40 }, (_, i) => ({
        id: i,
        left: `${Math.random() * 100}%`,
        animationDuration: `${8 + Math.random() * 12}s`,
        animationDelay: `${Math.random() * 8}s`,
        size: 1 + Math.random() * 3,
        color:
          i % 3 === 0
            ? 'var(--color-primary)'
            : i % 3 === 1
              ? 'var(--color-secondary)'
              : 'var(--color-accent)',
        opacity: 0.3 + Math.random() * 0.5,
      })),
    [],
  );

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p) => (
        <div
          key={p.id}
          className="bg-particle"
          style={{
            left: p.left,
            bottom: '-10px',
            width: p.size,
            height: p.size,
            background: p.color,
            animationDuration: p.animationDuration,
            animationDelay: p.animationDelay,
            opacity: undefined, // controlled by animation
          }}
        />
      ))}
    </div>
  );
}

// ============================================================================
// Main Menu Component
// ============================================================================

const MENU_OPTIONS: MenuOption[] = [
  { id: 'battle', label: 'BATTLE', sublabel: 'Local versus', available: true },
  { id: 'online', label: 'ONLINE', sublabel: 'Play online', available: true },
  { id: 'training', label: 'TRAINING', sublabel: 'Practice mode', available: true },
  { id: 'options', label: 'OPTIONS', sublabel: 'Settings', available: false },
];

export default function MainMenu({ onSelect }: MainMenuProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const activeIndex = hoveredIndex ?? selectedIndex;

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowUp':
        case 'w':
          e.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + MENU_OPTIONS.length) % MENU_OPTIONS.length);
          setHoveredIndex(null);
          break;
        case 'ArrowDown':
        case 's':
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % MENU_OPTIONS.length);
          setHoveredIndex(null);
          break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          const opt = MENU_OPTIONS[selectedIndex];
          if (opt.available) onSelect(opt.id);
          break;
      }
    },
    [selectedIndex, onSelect],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center select-none">
      {/* Background gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a2a]/90 via-[var(--color-bg)]/80 to-[var(--color-bg)]" />

      {/* Background particles */}
      <BackgroundParticles />

      {/* Radial spotlight behind title */}
      <div
        className="absolute top-[15%] left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse, rgba(0, 240, 255, 0.08) 0%, transparent 70%)',
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center gap-12">
        {/* Title Block */}
        <div className="flex flex-col items-center gap-2 animate-fade-in">
          {/* Main title */}
          <h1
            className="text-6xl md:text-7xl font-black tracking-[0.2em] text-[var(--color-primary)] glow-cyan"
            style={{
              fontFamily: "'Segoe UI', system-ui, sans-serif",
              lineHeight: 1.1,
            }}
          >
            COSMIC
          </h1>
          <h1
            className="text-6xl md:text-7xl font-black tracking-[0.2em] text-white"
            style={{
              fontFamily: "'Segoe UI', system-ui, sans-serif",
              lineHeight: 1.1,
              textShadow:
                '0 0 10px rgba(255, 255, 255, 0.3), 0 0 30px rgba(0, 240, 255, 0.2)',
            }}
          >
            KNOCKOUTS
          </h1>

          {/* Decorative line */}
          <div className="flex items-center gap-3 mt-2">
            <div className="w-16 h-px bg-gradient-to-r from-transparent to-[var(--color-primary)]" />
            <span
              className="text-xs tracking-[0.5em] text-[var(--color-accent)] font-semibold glow-gold"
            >
              PLATFORM FIGHTER
            </span>
            <div className="w-16 h-px bg-gradient-to-l from-transparent to-[var(--color-primary)]" />
          </div>
        </div>

        {/* Menu Options */}
        <nav className="flex flex-col items-center gap-3 w-80">
          {MENU_OPTIONS.map((option, index) => {
            const isActive = activeIndex === index;
            const isAvailable = option.available;

            return (
              <button
                key={option.id}
                className={`
                  animate-slide-in w-full relative group
                  ${!isAvailable ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
                `}
                style={{ animationDelay: `${300 + index * 100}ms`, opacity: 0 }}
                onMouseEnter={() => isAvailable && setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
                onClick={() => isAvailable && onSelect(option.id)}
                disabled={!isAvailable}
              >
                {/* Hover/select indicator bar */}
                <div
                  className={`
                    absolute left-0 top-1/2 -translate-y-1/2 w-1 rounded-full
                    transition-all duration-300
                    ${isActive && isAvailable
                      ? 'h-8 bg-[var(--color-primary)] shadow-[0_0_10px_var(--color-primary)]'
                      : 'h-0 bg-transparent'}
                  `}
                />

                <div
                  className={`
                    py-3 px-8 border transition-all duration-200 rounded-sm
                    ${isActive && isAvailable
                      ? 'border-[var(--color-primary)]/50 bg-[var(--color-primary)]/5 box-glow-cyan'
                      : 'border-white/10 bg-white/[0.02]'}
                  `}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`
                        text-lg font-bold tracking-[0.15em] transition-colors duration-200
                        ${isActive && isAvailable ? 'text-[var(--color-primary)] glow-cyan-subtle' : 'text-white/80'}
                      `}
                    >
                      {option.label}
                    </span>
                    <span className="text-[10px] tracking-[0.2em] text-white/30 uppercase">
                      {option.sublabel}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </nav>

        {/* Navigation hint */}
        <p
          className="text-[10px] tracking-[0.3em] text-white/20 uppercase animate-fade-in"
          style={{ animationDelay: '800ms', opacity: 0 }}
        >
          W/S or Arrows to navigate &middot; Enter to select
        </p>
      </div>

      {/* Version number */}
      <div className="absolute bottom-4 right-5 text-[10px] tracking-wider text-white/15">
        v0.1.0-alpha
      </div>

      {/* Bottom decorative bar */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[var(--color-primary)]/20 to-transparent" />
    </div>
  );
}
