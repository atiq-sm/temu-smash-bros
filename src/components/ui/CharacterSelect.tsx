'use client';

import { useState, useCallback, useEffect } from 'react';

// ============================================================================
// Types
// ============================================================================

interface CharacterSelectProps {
  selection: { player1: string | null; player2: string | null };
  onSelect: (player: 1 | 2, characterId: string) => void;
  onConfirm: () => void;
  onBack: () => void;
}

interface CharacterInfo {
  id: string;
  name: string;
  title: string;
  color: string;
  secondaryColor: string;
  accentColor: string;
  stats: {
    speed: number;
    power: number;
    weight: number;
  };
}

// ============================================================================
// Character Data
// ============================================================================

const CHARACTERS: CharacterInfo[] = [
  {
    id: 'blaze',
    name: 'BLAZE',
    title: 'The Inferno',
    color: '#ff4400',
    secondaryColor: '#ff8800',
    accentColor: '#ffcc00',
    stats: { speed: 7, power: 8, weight: 5 },
  },
  {
    id: 'zephyr',
    name: 'ZEPHYR',
    title: 'The Tempest',
    color: '#00ccff',
    secondaryColor: '#88eeff',
    accentColor: '#ffffff',
    stats: { speed: 9, power: 5, weight: 3 },
  },
  {
    id: 'granite',
    name: 'GRANITE',
    title: 'The Colossus',
    color: '#aa7744',
    secondaryColor: '#cc9966',
    accentColor: '#ffddaa',
    stats: { speed: 3, power: 9, weight: 10 },
  },
  {
    id: 'volt',
    name: 'VOLT',
    title: 'The Spark',
    color: '#ffee00',
    secondaryColor: '#88ccff',
    accentColor: '#ffffff',
    stats: { speed: 10, power: 6, weight: 4 },
  },
  {
    id: 'tide',
    name: 'TIDE',
    title: 'The Abyss',
    color: '#0055cc',
    secondaryColor: '#0088ff',
    accentColor: '#66ddff',
    stats: { speed: 6, power: 7, weight: 7 },
  },
  {
    id: 'nova',
    name: 'NOVA',
    title: 'The Singularity',
    color: '#aa22ff',
    secondaryColor: '#dd66ff',
    accentColor: '#ffaaff',
    stats: { speed: 8, power: 8, weight: 5 },
  },
];

// ============================================================================
// Character Portrait Component
// ============================================================================

function BlazePortrait({ primary, secondary, accent }: { primary: string; secondary: string; accent: string }) {
  return (
    <g>
      {/* Body / Broad shoulders */}
      <path
        d="M14,78 L20,52 Q25,44 30,42 L40,38 L40,36 L34,32 Q30,28 30,24
           L32,18 Q34,14 40,12 Q44,11 40,10
           L38,8 Q40,4 44,6 L42,4 Q44,2 48,6
           L46,3 Q48,1 50,6
           L52,2 Q54,4 53,7
           L56,4 Q58,6 55,9
           Q58,10 56,11 Q60,12 58,14
           L60,18 Q62,22 60,26 L58,30
           Q56,34 52,36 L52,38 L62,42
           Q68,44 72,52 L78,78 Z"
        fill={`url(#blazeBodyGrad)`}
        stroke={accent}
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      {/* Inner flame chest detail */}
      <path
        d="M30,78 L36,56 Q38,50 40,48 L46,44 Q48,42 52,44 L58,48 Q60,50 62,56 L68,78 Z"
        fill={secondary}
        fillOpacity="0.3"
      />
      {/* Pentagon/diamond head */}
      <path
        d="M34,32 Q32,26 34,20 Q36,14 40,13 L48,12 Q54,13 56,16 Q60,20 58,26 Q57,30 54,34 L48,36 L42,36 Z"
        fill={`url(#blazeHeadGrad)`}
        stroke={accent}
        strokeWidth="0.8"
      />
      {/* Strong jaw line */}
      <path d="M36,30 L40,35 L48,37 L54,34 L56,28" fill="none" stroke={accent} strokeWidth="0.6" strokeOpacity="0.5" />
      {/* Flame spike left */}
      <path d="M38,14 L36,6 Q38,9 40,5 Q41,8 42,12" fill={accent} fillOpacity="0.9" />
      {/* Flame spike center */}
      <path d="M44,12 L43,3 Q45,7 47,1 Q48,6 50,3 Q49,8 48,12" fill={accent} fillOpacity="0.95" />
      {/* Flame spike right */}
      <path d="M50,12 L52,5 Q51,9 54,7 Q53,10 52,14" fill={accent} fillOpacity="0.9" />
      {/* Glowing eyes */}
      <ellipse cx="42" cy="23" rx="2.5" ry="1.8" fill={accent} />
      <ellipse cx="52" cy="23" rx="2.5" ry="1.8" fill={accent} />
      <ellipse cx="42" cy="23" rx="1.2" ry="1" fill="#fff" fillOpacity="0.8" />
      <ellipse cx="52" cy="23" rx="1.2" ry="1" fill="#fff" fillOpacity="0.8" />
      {/* Shoulder armor lines */}
      <path d="M22,54 L28,46 L34,42" fill="none" stroke={accent} strokeWidth="0.6" strokeOpacity="0.4" />
      <path d="M70,54 L64,46 L58,42" fill="none" stroke={accent} strokeWidth="0.6" strokeOpacity="0.4" />
      {/* Gradients */}
      <defs>
        <linearGradient id="blazeBodyGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={secondary} />
          <stop offset="100%" stopColor={primary} />
        </linearGradient>
        <radialGradient id="blazeHeadGrad" cx="0.5" cy="0.4">
          <stop offset="0%" stopColor={secondary} />
          <stop offset="100%" stopColor={primary} />
        </radialGradient>
      </defs>
    </g>
  );
}

function ZephyrPortrait({ primary, secondary, accent }: { primary: string; secondary: string; accent: string }) {
  return (
    <g>
      {/* Slim narrow shoulders / body */}
      <path
        d="M28,78 L32,54 Q34,48 38,44 L42,40 L42,36
           Q36,34 34,28 Q32,22 34,16 Q36,10 42,8
           Q46,6 50,8 Q56,10 58,16 Q60,22 58,28
           Q56,34 50,36 L50,40 L54,44 Q58,48 60,54 L64,78 Z"
        fill={`url(#zephyrBodyGrad)`}
        stroke={primary}
        strokeWidth="1"
        strokeLinejoin="round"
      />
      {/* Teardrop/helmet head */}
      <path
        d="M36,30 Q34,24 35,18 Q36,12 40,9 Q44,6 48,6 Q52,7 54,10
           Q58,14 58,20 Q58,26 54,30 Q50,34 48,35 Q44,35 40,32 Z"
        fill={`url(#zephyrHeadGrad)`}
        stroke={secondary}
        strokeWidth="0.8"
      />
      {/* Visor slit */}
      <path
        d="M39,22 Q44,20 48,20 Q52,20 55,22"
        fill="none"
        stroke={accent}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M40,22 Q44,21 48,21 Q51,21 54,22"
        fill="none"
        stroke={accent}
        strokeWidth="0.6"
        strokeOpacity="0.6"
        strokeLinecap="round"
      />
      {/* Pointed chin */}
      <path d="M42,32 L46,37 L50,32" fill={primary} stroke={secondary} strokeWidth="0.5" />
      {/* Wind trail lines behind head */}
      <path d="M30,16 Q26,16 20,14" fill="none" stroke={secondary} strokeWidth="0.8" strokeOpacity="0.6" strokeLinecap="round" />
      <path d="M32,20 Q26,20 18,19" fill="none" stroke={secondary} strokeWidth="0.7" strokeOpacity="0.5" strokeLinecap="round" />
      <path d="M32,24 Q28,25 22,24" fill="none" stroke={secondary} strokeWidth="0.6" strokeOpacity="0.4" strokeLinecap="round" />
      <path d="M60,14 Q64,13 70,14" fill="none" stroke={secondary} strokeWidth="0.5" strokeOpacity="0.3" strokeLinecap="round" />
      <path d="M60,19 Q64,18 68,19" fill="none" stroke={secondary} strokeWidth="0.4" strokeOpacity="0.25" strokeLinecap="round" />
      {/* Streamlined body lines */}
      <path d="M38,44 L40,54 L38,64" fill="none" stroke={secondary} strokeWidth="0.4" strokeOpacity="0.3" />
      <path d="M54,44 L52,54 L54,64" fill="none" stroke={secondary} strokeWidth="0.4" strokeOpacity="0.3" />
      {/* Aerodynamic neck */}
      <path d="M44,35 L44,40" fill="none" stroke={secondary} strokeWidth="0.5" strokeOpacity="0.3" />
      <path d="M48,35 L48,40" fill="none" stroke={secondary} strokeWidth="0.5" strokeOpacity="0.3" />
      <defs>
        <linearGradient id="zephyrBodyGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={secondary} />
          <stop offset="100%" stopColor={primary} />
        </linearGradient>
        <radialGradient id="zephyrHeadGrad" cx="0.5" cy="0.3">
          <stop offset="0%" stopColor={secondary} />
          <stop offset="100%" stopColor={primary} />
        </radialGradient>
      </defs>
    </g>
  );
}

function GranitePortrait({ primary, secondary, accent }: { primary: string; secondary: string; accent: string }) {
  return (
    <g>
      {/* Massive blocky shoulders / body - widest character */}
      <path
        d="M4,78 L8,50 Q10,44 14,40 L24,36 L28,34
           Q28,28 28,24 L28,18 Q30,12 36,10 L44,8 L48,8
           Q54,10 58,14 L60,18 L60,24 Q60,28 60,34
           L64,36 L74,40 Q78,44 80,50 L84,78 Z"
        fill={`url(#graniteBodyGrad)`}
        stroke={accent}
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      {/* Square head with flat top */}
      <path
        d="M30,30 L30,14 Q30,10 34,9 L38,8 L52,8 Q58,9 58,12 L58,30 Q58,34 54,35 L34,35 Q30,34 30,30 Z"
        fill={`url(#graniteHeadGrad)`}
        stroke={accent}
        strokeWidth="0.8"
      />
      {/* Flat top emphasis */}
      <line x1="32" y1="10" x2="56" y2="10" stroke={accent} strokeWidth="1.5" strokeLinecap="round" />
      {/* Small deep-set eyes */}
      <rect x="36" y="20" width="4" height="3" rx="0.5" fill={accent} />
      <rect x="50" y="20" width="4" height="3" rx="0.5" fill={accent} />
      <rect x="37" y="20.5" width="2" height="2" rx="0.3" fill="#fff" fillOpacity="0.6" />
      <rect x="51" y="20.5" width="2" height="2" rx="0.3" fill="#fff" fillOpacity="0.6" />
      {/* Stern mouth */}
      <line x1="40" y1="28" x2="50" y2="28" stroke={accent} strokeWidth="1" strokeOpacity="0.5" strokeLinecap="round" />
      {/* Crack texture lines across body */}
      <path d="M20,50 L28,46 L34,52 L30,60" fill="none" stroke={accent} strokeWidth="0.5" strokeOpacity="0.35" />
      <path d="M68,48 L62,44 L56,50 L60,58" fill="none" stroke={accent} strokeWidth="0.5" strokeOpacity="0.35" />
      <path d="M34,14 L38,18 L36,22" fill="none" stroke={accent} strokeWidth="0.4" strokeOpacity="0.3" />
      <path d="M56,12 L52,16 L54,22" fill="none" stroke={accent} strokeWidth="0.4" strokeOpacity="0.3" />
      <path d="M40,60 L46,56 L52,62" fill="none" stroke={accent} strokeWidth="0.5" strokeOpacity="0.3" />
      {/* Chunky shoulder armor plates */}
      <path d="M14,40 L24,36 L26,42 L16,46 Z" fill={secondary} fillOpacity="0.4" stroke={accent} strokeWidth="0.5" strokeOpacity="0.4" />
      <path d="M74,40 L64,36 L62,42 L72,46 Z" fill={secondary} fillOpacity="0.4" stroke={accent} strokeWidth="0.5" strokeOpacity="0.4" />
      {/* More crack details */}
      <path d="M32,42 L36,38 L42,40" fill="none" stroke={accent} strokeWidth="0.3" strokeOpacity="0.25" />
      <path d="M56,42 L52,38 L46,40" fill="none" stroke={accent} strokeWidth="0.3" strokeOpacity="0.25" />
      <defs>
        <linearGradient id="graniteBodyGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={secondary} />
          <stop offset="100%" stopColor={primary} />
        </linearGradient>
        <radialGradient id="graniteHeadGrad" cx="0.5" cy="0.4">
          <stop offset="0%" stopColor={secondary} />
          <stop offset="100%" stopColor={primary} />
        </radialGradient>
      </defs>
    </g>
  );
}

function VoltPortrait({ primary, secondary, accent }: { primary: string; secondary: string; accent: string }) {
  return (
    <g>
      {/* Jagged angular body with lightning bolt edges */}
      <path
        d="M22,78 L26,60 L20,56 L28,48 L24,44 L32,38 L36,36
           L38,32 Q36,26 36,20 Q38,14 42,10 L46,8
           Q50,8 54,10 Q58,14 58,20 Q58,26 56,32
           L58,36 L62,38 L70,44 L66,48 L72,56 L66,60 L70,78 Z"
        fill={`url(#voltBodyGrad)`}
        stroke={primary}
        strokeWidth="1"
        strokeLinejoin="round"
      />
      {/* Sharp triangular head */}
      <path
        d="M38,30 Q36,24 37,18 Q38,12 42,10 L46,8 L50,8
           Q56,10 57,16 Q58,22 56,30 L50,34 L44,34 Z"
        fill={`url(#voltHeadGrad)`}
        stroke={primary}
        strokeWidth="0.8"
      />
      {/* Antenna spike left */}
      <path d="M40,10 L36,2 L38,8" fill={primary} stroke={primary} strokeWidth="0.6" />
      {/* Antenna spike right */}
      <path d="M54,10 L58,2 L56,8" fill={primary} stroke={primary} strokeWidth="0.6" />
      {/* Electric arc between antennae */}
      <path d="M38,4 L42,6 L44,3 L48,5 L50,3 L54,5 L56,3" fill="none" stroke={primary} strokeWidth="0.7" strokeOpacity="0.7" strokeLinecap="round" />
      <path d="M40,5 L43,7 L46,4 L50,6 L53,4" fill="none" stroke={accent} strokeWidth="0.4" strokeOpacity="0.5" />
      {/* Angular eyes */}
      <polygon points="41,20 44,18 46,20 44,22" fill={accent} />
      <polygon points="50,20 52,18 55,20 52,22" fill={accent} />
      <circle cx="43.5" cy="20" r="0.8" fill="#fff" fillOpacity="0.9" />
      <circle cx="52" cy="20" r="0.8" fill="#fff" fillOpacity="0.9" />
      {/* Lightning bolt body detail (asymmetric) */}
      <path d="M38,42 L44,38 L42,44 L48,40 L46,48 L40,52" fill="none" stroke={primary} strokeWidth="0.6" strokeOpacity="0.5" />
      <path d="M56,40 L60,46 L54,44 L58,52" fill="none" stroke={primary} strokeWidth="0.5" strokeOpacity="0.4" />
      {/* Jagged edge sparks */}
      <path d="M20,56 L18,54 L22,55" fill="none" stroke={primary} strokeWidth="0.5" strokeOpacity="0.4" />
      <path d="M72,56 L74,54 L70,55" fill="none" stroke={primary} strokeWidth="0.5" strokeOpacity="0.4" />
      {/* Asymmetric shoulder detail */}
      <path d="M32,38 L28,36 L30,40" fill={secondary} fillOpacity="0.3" stroke={primary} strokeWidth="0.4" />
      <path d="M62,38 L68,34 L66,40 L72,38" fill={secondary} fillOpacity="0.3" stroke={primary} strokeWidth="0.4" />
      <defs>
        <linearGradient id="voltBodyGrad" x1="0.3" y1="0" x2="0.7" y2="1">
          <stop offset="0%" stopColor={primary} />
          <stop offset="50%" stopColor={secondary} stopOpacity="0.6" />
          <stop offset="100%" stopColor={primary} />
        </linearGradient>
        <radialGradient id="voltHeadGrad" cx="0.5" cy="0.3">
          <stop offset="0%" stopColor={accent} stopOpacity="0.8" />
          <stop offset="100%" stopColor={primary} />
        </radialGradient>
      </defs>
    </g>
  );
}

function TidePortrait({ primary, secondary, accent }: { primary: string; secondary: string; accent: string }) {
  return (
    <g>
      {/* Rounded flowing body */}
      <path
        d="M18,78 Q20,60 24,52 Q28,44 34,40 Q36,38 38,36
           Q34,32 32,26 Q30,20 32,14 Q36,8 44,6 Q48,5 52,6
           Q58,8 60,14 Q62,20 60,26 Q58,32 54,36
           Q56,38 58,40 Q64,44 68,52 Q72,60 74,78 Z"
        fill={`url(#tideBodyGrad)`}
        stroke={accent}
        strokeWidth="1"
        strokeLinejoin="round"
      />
      {/* Circular head */}
      <circle cx="46" cy="20" r="14" fill={`url(#tideHeadGrad)`} stroke={accent} strokeWidth="0.8" />
      {/* Flowing tentacle/tendril appendages */}
      <path d="M34,14 Q28,12 24,16 Q20,20 22,26" fill="none" stroke={accent} strokeWidth="1.2" strokeLinecap="round" strokeOpacity="0.7" />
      <path d="M32,18 Q26,20 24,26 Q22,32 26,36" fill="none" stroke={accent} strokeWidth="1" strokeLinecap="round" strokeOpacity="0.6" />
      <path d="M58,14 Q64,12 68,16 Q72,20 70,26" fill="none" stroke={accent} strokeWidth="1.2" strokeLinecap="round" strokeOpacity="0.7" />
      <path d="M60,18 Q66,20 68,26 Q70,32 66,36" fill="none" stroke={accent} strokeWidth="1" strokeLinecap="round" strokeOpacity="0.6" />
      {/* Eyes - rounded */}
      <ellipse cx="41" cy="19" rx="3" ry="2.5" fill={accent} />
      <ellipse cx="51" cy="19" rx="3" ry="2.5" fill={accent} />
      <ellipse cx="41" cy="19" rx="1.5" ry="1.2" fill="#fff" fillOpacity="0.7" />
      <ellipse cx="51" cy="19" rx="1.5" ry="1.2" fill="#fff" fillOpacity="0.7" />
      {/* Curved organic body edges */}
      <path d="M30,48 Q34,44 38,46 Q42,48 40,52" fill="none" stroke={accent} strokeWidth="0.5" strokeOpacity="0.3" />
      <path d="M62,48 Q58,44 54,46 Q50,48 52,52" fill="none" stroke={accent} strokeWidth="0.5" strokeOpacity="0.3" />
      {/* Water droplet shapes */}
      <path d="M26,44 Q28,40 30,44 Q28,46 26,44 Z" fill={accent} fillOpacity="0.4" />
      <path d="M64,42 Q66,38 68,42 Q66,44 64,42 Z" fill={accent} fillOpacity="0.4" />
      <path d="M36,56 Q37,53 38,56 Q37,57 36,56 Z" fill={accent} fillOpacity="0.3" />
      {/* Bubble details */}
      <circle cx="22" cy="40" r="1.5" fill="none" stroke={accent} strokeWidth="0.5" strokeOpacity="0.4" />
      <circle cx="70" cy="38" r="1.2" fill="none" stroke={accent} strokeWidth="0.5" strokeOpacity="0.35" />
      <circle cx="28" cy="58" r="1" fill="none" stroke={accent} strokeWidth="0.4" strokeOpacity="0.3" />
      <circle cx="66" cy="56" r="1.3" fill="none" stroke={accent} strokeWidth="0.4" strokeOpacity="0.3" />
      <circle cx="18" cy="50" r="0.8" fill="none" stroke={accent} strokeWidth="0.3" strokeOpacity="0.25" />
      {/* Mouth - gentle wave */}
      <path d="M42,26 Q44,28 46,26 Q48,28 50,26" fill="none" stroke={accent} strokeWidth="0.6" strokeOpacity="0.4" />
      <defs>
        <linearGradient id="tideBodyGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={secondary} />
          <stop offset="100%" stopColor={primary} />
        </linearGradient>
        <radialGradient id="tideHeadGrad" cx="0.5" cy="0.4">
          <stop offset="0%" stopColor={secondary} />
          <stop offset="100%" stopColor={primary} />
        </radialGradient>
      </defs>
    </g>
  );
}

function NovaPortrait({ primary, secondary, accent }: { primary: string; secondary: string; accent: string }) {
  return (
    <g>
      {/* Balanced symmetrical body */}
      <path
        d="M20,78 L26,54 Q30,46 36,42 L40,38 L40,34
           Q34,30 32,24 Q30,18 32,12 Q36,6 44,4 Q48,3 52,4
           Q58,6 60,12 Q62,18 60,24 Q58,30 52,34
           L52,38 L56,42 Q62,46 66,54 L72,78 Z"
        fill={`url(#novaBodyGrad)`}
        stroke={accent}
        strokeWidth="1"
        strokeLinejoin="round"
      />
      {/* Circular head */}
      <circle cx="46" cy="18" r="13" fill={`url(#novaHeadGrad)`} stroke={secondary} strokeWidth="0.8" />
      {/* Halo / corona ring */}
      <ellipse cx="46" cy="18" rx="17" ry="5" fill="none" stroke={accent} strokeWidth="0.8" strokeOpacity="0.5" strokeDasharray="2 1.5" />
      <ellipse cx="46" cy="18" rx="18" ry="5.5" fill="none" stroke={secondary} strokeWidth="0.4" strokeOpacity="0.3" />
      {/* Star-shaped eyes */}
      <polygon points="41,17 42,15.5 43,17 44,15.5 45,17 43,18.5" fill={accent} />
      <polygon points="49,17 50,15.5 51,17 52,15.5 53,17 51,18.5" fill={accent} />
      <circle cx="43" cy="17" r="0.6" fill="#fff" fillOpacity="0.9" />
      <circle cx="51" cy="17" r="0.6" fill="#fff" fillOpacity="0.9" />
      {/* Orbital ring around torso */}
      <ellipse cx="46" cy="52" rx="22" ry="6" fill="none" stroke={secondary} strokeWidth="0.8" strokeOpacity="0.4" strokeDasharray="3 2" />
      <ellipse cx="46" cy="52" rx="24" ry="7" fill="none" stroke={accent} strokeWidth="0.4" strokeOpacity="0.2" />
      {/* Small orbiting particles */}
      <circle cx="24" cy="52" r="1.8" fill={accent} fillOpacity="0.6" />
      <circle cx="68" cy="52" r="1.8" fill={accent} fillOpacity="0.6" />
      <circle cx="34" cy="46" r="1.2" fill={secondary} fillOpacity="0.5" />
      <circle cx="58" cy="46" r="1.2" fill={secondary} fillOpacity="0.5" />
      <circle cx="30" cy="56" r="0.8" fill={accent} fillOpacity="0.4" />
      <circle cx="62" cy="56" r="0.8" fill={accent} fillOpacity="0.4" />
      {/* Gentle mouth */}
      <path d="M43,24 Q46,26 49,24" fill="none" stroke={accent} strokeWidth="0.5" strokeOpacity="0.4" />
      {/* Chest glow */}
      <circle cx="46" cy="44" r="3" fill={accent} fillOpacity="0.15" />
      <circle cx="46" cy="44" r="1.5" fill={accent} fillOpacity="0.3" />
      <defs>
        <linearGradient id="novaBodyGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={secondary} />
          <stop offset="100%" stopColor={primary} />
        </linearGradient>
        <radialGradient id="novaHeadGrad" cx="0.5" cy="0.4">
          <stop offset="0%" stopColor={secondary} />
          <stop offset="100%" stopColor={primary} />
        </radialGradient>
      </defs>
    </g>
  );
}

function CharacterPortrait({
  characterId,
  color,
  secondaryColor,
  accentColor,
  size = 80,
}: {
  characterId: string;
  color: string;
  secondaryColor: string;
  accentColor: string;
  size?: number;
}) {
  const filterId = `glow-${characterId}-${size}`;

  const renderCharacter = () => {
    switch (characterId) {
      case 'blaze':
        return <BlazePortrait primary={color} secondary={secondaryColor} accent={accentColor} />;
      case 'zephyr':
        return <ZephyrPortrait primary={color} secondary={secondaryColor} accent={accentColor} />;
      case 'granite':
        return <GranitePortrait primary={color} secondary={secondaryColor} accent={accentColor} />;
      case 'volt':
        return <VoltPortrait primary={color} secondary={secondaryColor} accent={accentColor} />;
      case 'tide':
        return <TidePortrait primary={color} secondary={secondaryColor} accent={accentColor} />;
      case 'nova':
        return <NovaPortrait primary={color} secondary={secondaryColor} accent={accentColor} />;
      default:
        return null;
    }
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 80 80"
      className="drop-shadow-lg"
    >
      <defs>
        {/* Backdrop glow */}
        <radialGradient id={`${filterId}-bg`} cx="0.5" cy="0.45" r="0.5">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="70%" stopColor={color} stopOpacity="0.08" />
          <stop offset="100%" stopColor="transparent" stopOpacity="0" />
        </radialGradient>
        {/* Neon outline glow filter */}
        <filter id={filterId} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>
      {/* Dark background circle */}
      <circle cx="40" cy="40" r="38" fill="#0a0a1a" stroke={color} strokeWidth="0.6" strokeOpacity="0.3" />
      {/* Soft backdrop glow */}
      <circle cx="40" cy="40" r="36" fill={`url(#${filterId}-bg)`} />
      {/* Character art with glow filter */}
      <g filter={`url(#${filterId})`}>
        {renderCharacter()}
      </g>
      {/* Outer neon ring */}
      <circle cx="40" cy="40" r="38" fill="none" stroke={color} strokeWidth="1" strokeOpacity="0.2" />
      <circle cx="40" cy="40" r="39" fill="none" stroke={color} strokeWidth="0.4" strokeOpacity="0.1" />
    </svg>
  );
}

// ============================================================================
// Stat Bar
// ============================================================================

function StatBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] tracking-wider text-white/50 w-12 uppercase">{label}</span>
      <div className="stat-bar flex-1">
        <div
          className="stat-bar-fill"
          style={{
            width: `${value * 10}%`,
            background: `linear-gradient(90deg, ${color}, ${color}88)`,
            boxShadow: `0 0 6px ${color}44`,
          }}
        />
      </div>
      <span className="text-[10px] text-white/40 w-4 text-right">{value}</span>
    </div>
  );
}

// ============================================================================
// Character Select Component
// ============================================================================

export default function CharacterSelect({
  selection,
  onSelect,
  onConfirm,
  onBack,
}: CharacterSelectProps) {
  const [activePlayer, setActivePlayer] = useState<1 | 2>(1);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const displayedCharacter =
    hoveredId ?? (activePlayer === 1 ? selection.player1 : selection.player2);
  const displayedInfo = CHARACTERS.find((c) => c.id === displayedCharacter);

  const bothSelected = selection.player1 !== null && selection.player2 !== null;

  const handleSelect = useCallback(
    (characterId: string) => {
      onSelect(activePlayer, characterId);
      if (activePlayer === 1 && !selection.player2) {
        setActivePlayer(2);
      } else if (activePlayer === 2 && !selection.player1) {
        setActivePlayer(1);
      }
    },
    [activePlayer, onSelect, selection],
  );

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onBack();
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        setActivePlayer((prev) => (prev === 1 ? 2 : 1));
      }
      if (e.key === 'Enter' && bothSelected) {
        e.preventDefault();
        onConfirm();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onBack, onConfirm, bothSelected]);

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center select-none animate-fade-in">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a2a] via-[var(--color-bg)] to-[#0a0a1a]" />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center gap-6 w-full max-w-4xl px-6">
        {/* Header */}
        <div className="flex items-center justify-between w-full">
          <button
            onClick={onBack}
            className="text-xs tracking-[0.2em] text-white/40 hover:text-white/80 transition-colors uppercase cursor-pointer"
          >
            &larr; Back
          </button>
          <h2 className="text-2xl font-black tracking-[0.2em] text-white">
            SELECT FIGHTER
          </h2>
          <div className="w-16" />
        </div>

        {/* Player tabs */}
        <div className="flex gap-4">
          {([1, 2] as const).map((p) => (
            <button
              key={p}
              onClick={() => setActivePlayer(p)}
              className={`
                px-6 py-2 text-sm font-bold tracking-[0.15em] rounded-sm
                transition-all duration-200 cursor-pointer
                ${activePlayer === p
                  ? p === 1
                    ? 'bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/50 text-[var(--color-primary)] box-glow-cyan'
                    : 'bg-[var(--color-secondary)]/10 border border-[var(--color-secondary)]/50 text-[var(--color-secondary)] box-glow-magenta'
                  : 'border border-white/10 text-white/40'}
              `}
            >
              PLAYER {p}
              {(p === 1 ? selection.player1 : selection.player2) && (
                <span className="ml-2 text-[10px] text-white/30">
                  {CHARACTERS.find((c) => c.id === (p === 1 ? selection.player1 : selection.player2))?.name}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Character Grid + Info Panel */}
        <div className="flex gap-6 w-full items-start">
          {/* Character Grid */}
          <div className="grid grid-cols-3 gap-3 flex-1">
            {CHARACTERS.map((char) => {
              const isP1 = selection.player1 === char.id;
              const isP2 = selection.player2 === char.id;
              const isHovered = hoveredId === char.id;

              return (
                <button
                  key={char.id}
                  className={`
                    relative flex flex-col items-center gap-2 p-4 rounded-md
                    border transition-all duration-200 cursor-pointer group
                    ${isP1 && isP2
                      ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10 box-glow-gold'
                      : isP1
                        ? 'border-[var(--color-primary)]/60 bg-[var(--color-primary)]/10 box-glow-cyan'
                        : isP2
                          ? 'border-[var(--color-secondary)]/60 bg-[var(--color-secondary)]/10 box-glow-magenta'
                          : isHovered
                            ? 'border-white/30 bg-white/5'
                            : 'border-white/10 bg-white/[0.02]'}
                  `}
                  onClick={() => handleSelect(char.id)}
                  onMouseEnter={() => setHoveredId(char.id)}
                  onMouseLeave={() => setHoveredId(null)}
                >
                  {/* Player indicator badges */}
                  {isP1 && (
                    <div className="absolute top-1 left-1 text-[8px] font-bold tracking-wider text-[var(--color-primary)] bg-[var(--color-primary)]/20 px-1.5 py-0.5 rounded">
                      P1
                    </div>
                  )}
                  {isP2 && (
                    <div className="absolute top-1 right-1 text-[8px] font-bold tracking-wider text-[var(--color-secondary)] bg-[var(--color-secondary)]/20 px-1.5 py-0.5 rounded">
                      P2
                    </div>
                  )}

                  {/* Portrait */}
                  <div className="transition-transform duration-200 group-hover:scale-110">
                    <CharacterPortrait
                      characterId={char.id}
                      color={char.color}
                      secondaryColor={char.secondaryColor}
                      accentColor={char.accentColor}
                      size={56}
                    />
                  </div>

                  {/* Name */}
                  <span
                    className="text-xs font-bold tracking-[0.15em] transition-colors duration-200"
                    style={{ color: isHovered || isP1 || isP2 ? char.color : 'rgba(255,255,255,0.6)' }}
                  >
                    {char.name}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Info Panel */}
          <div
            className="w-56 shrink-0 surface-panel rounded-md p-5 neon-border animate-fade-in"
            style={{ minHeight: 260 }}
          >
            {displayedInfo ? (
              <div className="flex flex-col items-center gap-4">
                <CharacterPortrait
                  characterId={displayedInfo.id}
                  color={displayedInfo.color}
                  secondaryColor={displayedInfo.secondaryColor}
                  accentColor={displayedInfo.accentColor}
                  size={80}
                />
                <div className="text-center">
                  <h3
                    className="text-lg font-black tracking-[0.15em]"
                    style={{ color: displayedInfo.color }}
                  >
                    {displayedInfo.name}
                  </h3>
                  <p className="text-[10px] tracking-[0.2em] text-white/40 uppercase mt-0.5">
                    {displayedInfo.title}
                  </p>
                </div>

                {/* Stats */}
                <div className="w-full flex flex-col gap-2">
                  <StatBar
                    label="Speed"
                    value={displayedInfo.stats.speed}
                    color={displayedInfo.color}
                  />
                  <StatBar
                    label="Power"
                    value={displayedInfo.stats.power}
                    color={displayedInfo.color}
                  />
                  <StatBar
                    label="Weight"
                    value={displayedInfo.stats.weight}
                    color={displayedInfo.color}
                  />
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-xs tracking-[0.2em] text-white/20 uppercase">
                  Select a fighter
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-4 mt-2">
          {bothSelected && (
            <button
              onClick={onConfirm}
              className="menu-btn animate-scale-in"
              style={{
                borderColor: 'var(--color-accent)',
                color: 'var(--color-accent)',
              }}
            >
              READY &rarr;
            </button>
          )}
        </div>

        {/* Hint */}
        <p className="text-[10px] tracking-[0.3em] text-white/20 uppercase">
          Tab to switch player &middot; Esc to go back &middot; Enter when ready
        </p>
      </div>
    </div>
  );
}
