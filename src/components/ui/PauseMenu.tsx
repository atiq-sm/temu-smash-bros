'use client';

import { useState, useEffect, useCallback } from 'react';

// ============================================================================
// Types
// ============================================================================

interface PauseMenuProps {
  onResume: () => void;
  onRestart: () => void;
  onQuit: () => void;
}

interface PauseOption {
  id: string;
  label: string;
  action: () => void;
}

// ============================================================================
// Pause Menu Component
// ============================================================================

export default function PauseMenu({ onResume, onRestart, onQuit }: PauseMenuProps) {
  const options: PauseOption[] = [
    { id: 'resume', label: 'RESUME', action: onResume },
    { id: 'restart', label: 'RESTART', action: onRestart },
    { id: 'quit', label: 'QUIT TO MENU', action: onQuit },
  ];

  const [selectedIndex, setSelectedIndex] = useState(0);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowUp':
        case 'w':
          e.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + options.length) % options.length);
          break;
        case 'ArrowDown':
        case 's':
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % options.length);
          break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          options[selectedIndex].action();
          break;
        case 'Escape':
          e.preventDefault();
          onResume();
          break;
      }
    },
    [selectedIndex, options, onResume],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center animate-fade-in">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Panel */}
      <div className="relative z-10 flex flex-col items-center gap-8 animate-scale-in">
        {/* Title */}
        <h2
          className="text-4xl font-black tracking-[0.3em] text-white"
          style={{
            textShadow: '0 0 20px rgba(255, 255, 255, 0.2)',
          }}
        >
          PAUSED
        </h2>

        {/* Divider */}
        <div className="w-32 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

        {/* Options */}
        <div className="flex flex-col gap-3 w-64">
          {options.map((option, index) => {
            const isSelected = selectedIndex === index;

            return (
              <button
                key={option.id}
                className={`
                  py-3 px-6 text-sm font-bold tracking-[0.2em] text-center
                  border rounded-sm transition-all duration-200 cursor-pointer
                  ${isSelected
                    ? 'border-[var(--color-primary)]/50 bg-[var(--color-primary)]/10 text-[var(--color-primary)] box-glow-cyan'
                    : 'border-white/10 bg-white/[0.03] text-white/60 hover:border-white/20 hover:text-white/80'}
                `}
                onClick={option.action}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        {/* Hint */}
        <p className="text-[10px] tracking-[0.2em] text-white/20 uppercase">
          Esc to resume
        </p>
      </div>
    </div>
  );
}
