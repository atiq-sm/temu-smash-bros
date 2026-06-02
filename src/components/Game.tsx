'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { GameState, MatchConfig } from '@/game/core/types';
import { GameEngine, MatchResults } from '@/game/core/GameEngine';
import { AudioManager } from '@/game/audio/AudioManager';
import MainMenu from '@/components/ui/MainMenu';
import CharacterSelect from '@/components/ui/CharacterSelect';
import StageSelect from '@/components/ui/StageSelect';
import GameHUD from '@/components/ui/GameHUD';
import PauseMenu from '@/components/ui/PauseMenu';
import ResultsScreen from '@/components/ui/ResultsScreen';
import OnlineMenu from '@/components/ui/OnlineMenu';

interface PlayerHUDData {
  id: number;
  name: string;
  characterId: string;
  damage: number;
  stocks: number;
  maxStocks: number;
  color: string;
}

interface MatchResult {
  winnerId: number;
  winnerName: string;
  winnerCharacter: string;
  winnerColor: string;
  winMethod: 'ko' | 'time';
  stats: {
    playerId: number;
    name: string;
    kos: number;
    falls: number;
    damageDealt: number;
  }[];
}

interface CharacterSelection {
  player1: string | null;
  player2: string | null;
}

const CHARACTER_COLORS: Record<string, string> = {
  blaze: '#ff6622',
  zephyr: '#00f0ff',
  granite: '#cc8833',
  volt: '#ffee00',
  tide: '#0066ff',
  nova: '#aa44ff',
};

const CHARACTER_NAMES: Record<string, string> = {
  blaze: 'Blaze',
  zephyr: 'Zephyr',
  granite: 'Granite',
  volt: 'Volt',
  tide: 'Tide',
  nova: 'Nova',
};

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const audioRef = useRef<AudioManager | null>(null);
  const hudIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [gameState, setGameState] = useState<GameState>(GameState.Menu);
  const [characterSelection, setCharacterSelection] = useState<CharacterSelection>({
    player1: null,
    player2: null,
  });
  const [selectedStage, setSelectedStage] = useState<string | null>(null);
  const [matchTimer, setMatchTimer] = useState(480);
  const [players, setPlayers] = useState<PlayerHUDData[]>([
    { id: 1, name: 'P1', characterId: 'blaze', damage: 0, stocks: 3, maxStocks: 3, color: '#ff6622' },
    { id: 2, name: 'CPU', characterId: 'zephyr', damage: 0, stocks: 3, maxStocks: 3, color: '#00f0ff' },
  ]);
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new GameEngine();
    engine.init(canvas);
    engineRef.current = engine;

    const initAudio = () => {
      if (!audioRef.current) {
        audioRef.current = AudioManager.getInstance();
        audioRef.current.resume();
        audioRef.current.playMusic('menu_theme');
      }
      window.removeEventListener('click', initAudio);
      window.removeEventListener('keydown', initAudio);
    };
    window.addEventListener('click', initAudio);
    window.addEventListener('keydown', initAudio);

    engine.setOnStateChange((state: GameState) => {
      setGameState(state);
    });

    engine.setOnMatchEnd((results: MatchResults) => {
      const winnerId = results.winner;
      const winnerData = results.players.find(p => p.id === winnerId);
      const charId = winnerData?.characterId ?? 'nova';

      setMatchResult({
        winnerId,
        winnerName: winnerId === 1 ? 'P1' : 'CPU',
        winnerCharacter: CHARACTER_NAMES[charId] ?? charId,
        winnerColor: CHARACTER_COLORS[charId] ?? '#ffffff',
        winMethod: 'ko',
        stats: results.players.map(p => ({
          playerId: p.id,
          name: p.id === 1 ? 'P1' : 'CPU',
          kos: p.score,
          falls: 3 - p.stocks,
          damageDealt: Math.round(p.damage),
        })),
      });

      if (audioRef.current) {
        audioRef.current.stopMusic(500);
        audioRef.current.playSFX('match_end');
        setTimeout(() => audioRef.current?.playMusic('results_theme'), 1000);
      }

      if (hudIntervalRef.current) {
        clearInterval(hudIntervalRef.current);
        hudIntervalRef.current = null;
      }
    });

    return () => {
      engine.destroy();
      if (hudIntervalRef.current) {
        clearInterval(hudIntervalRef.current);
      }
    };
  }, []);

  const startHUDSync = useCallback(() => {
    if (hudIntervalRef.current) clearInterval(hudIntervalRef.current);

    hudIntervalRef.current = setInterval(() => {
      const engine = engineRef.current;
      if (!engine || engine.getState() !== GameState.Fighting) return;

      const enginePlayers = engine.getPlayers();
      if (enginePlayers.length === 0) return;

      setPlayers(enginePlayers.map((p, i) => ({
        id: p.id,
        name: i === 0 ? 'P1' : 'CPU',
        characterId: p.characterId,
        damage: Math.round(p.damage),
        stocks: p.stocks,
        maxStocks: 3,
        color: CHARACTER_COLORS[p.characterId] ?? '#ffffff',
      })));

      const frame = engine.getFrame();
      const timerSeconds = Math.max(0, 480 - Math.floor(frame / 60));
      setMatchTimer(timerSeconds);
    }, 66);
  }, []);

  const handleMenuSelect = useCallback((option: string) => {
    audioRef.current?.playSFX('menu_select');
    switch (option) {
      case 'battle':
      case 'training':
        setGameState(GameState.CharacterSelect);
        break;
      case 'online':
        setGameState(GameState.Online);
        break;
    }
  }, []);

  const handleCharacterSelect = useCallback((player: 1 | 2, characterId: string) => {
    audioRef.current?.playSFX('menu_move');
    setCharacterSelection(prev => ({
      ...prev,
      [player === 1 ? 'player1' : 'player2']: characterId,
    }));
  }, []);

  const handleCharacterConfirm = useCallback(() => {
    if (characterSelection.player1 && characterSelection.player2) {
      audioRef.current?.playSFX('menu_select');
      setGameState(GameState.StageSelect);
    }
  }, [characterSelection]);

  const handleStageSelect = useCallback((stageId: string) => {
    audioRef.current?.playSFX('menu_move');
    setSelectedStage(stageId);
  }, []);

  const handleStartBattle = useCallback(() => {
    const engine = engineRef.current;
    if (!engine || !selectedStage) return;

    audioRef.current?.playSFX('menu_select');
    if (audioRef.current) {
      audioRef.current.stopMusic(300);
      setTimeout(() => {
        audioRef.current?.playSFX('match_start');
        setTimeout(() => audioRef.current?.playMusic('battle_theme'), 2000);
      }, 500);
    }

    const p1Char = characterSelection.player1 ?? 'nova';
    const p2Char = characterSelection.player2 ?? 'nova';

    const config: MatchConfig = {
      stocks: 3,
      timer: 480,
      stageId: selectedStage,
      players: [
        { id: 1, characterId: p1Char, isAI: false, aiLevel: 0, controlScheme: 'keyboard1' },
        { id: 2, characterId: p2Char, isAI: true, aiLevel: 5, controlScheme: 'keyboard2' },
      ],
    };

    setPlayers([
      { id: 1, name: 'P1', characterId: p1Char, damage: 0, stocks: 3, maxStocks: 3, color: CHARACTER_COLORS[p1Char] ?? '#ffffff' },
      { id: 2, name: 'CPU', characterId: p2Char, damage: 0, stocks: 3, maxStocks: 3, color: CHARACTER_COLORS[p2Char] ?? '#ffffff' },
    ]);
    setMatchTimer(480);
    setMatchResult(null);

    engine.startMatch(config);
    startHUDSync();
  }, [selectedStage, characterSelection, startHUDSync]);

  const handlePauseResume = useCallback(() => {
    audioRef.current?.playSFX('menu_select');
    engineRef.current?.resume();
  }, []);

  const handlePauseRestart = useCallback(() => {
    audioRef.current?.playSFX('menu_select');
    handleStartBattle();
  }, [handleStartBattle]);

  const handleQuitToMenu = useCallback(() => {
    audioRef.current?.playSFX('menu_back');
    engineRef.current?.stop();
    if (hudIntervalRef.current) {
      clearInterval(hudIntervalRef.current);
      hudIntervalRef.current = null;
    }
    setCharacterSelection({ player1: null, player2: null });
    setSelectedStage(null);
    setMatchResult(null);
    setGameState(GameState.Menu);
    if (audioRef.current) {
      audioRef.current.stopMusic(300);
      setTimeout(() => audioRef.current?.playMusic('menu_theme'), 500);
    }
  }, []);

  const handleRematch = useCallback(() => {
    audioRef.current?.playSFX('menu_select');
    if (audioRef.current) {
      audioRef.current.stopMusic(300);
    }
    handleStartBattle();
  }, [handleStartBattle]);

  const handleBackFromCharacterSelect = useCallback(() => {
    audioRef.current?.playSFX('menu_back');
    setCharacterSelection({ player1: null, player2: null });
    setGameState(GameState.Menu);
  }, []);

  const handleBackFromStageSelect = useCallback(() => {
    audioRef.current?.playSFX('menu_back');
    setSelectedStage(null);
    setGameState(GameState.CharacterSelect);
  }, []);

  return (
    <div className="game-container">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ display: 'block' }}
      />

      {gameState === GameState.Online && (
        <div className="game-overlay">
          <OnlineMenu
            onBack={() => {
              audioRef.current?.playSFX('menu_back');
              setGameState(GameState.Menu);
            }}
            onStartMatch={() => {
              // Online match start — config comes from server
              if (audioRef.current) {
                audioRef.current.stopMusic(300);
                setTimeout(() => audioRef.current?.playMusic('battle_theme'), 500);
              }
            }}
          />
        </div>
      )}

      {gameState === GameState.Menu && (
        <div className="game-overlay">
          <MainMenu onSelect={handleMenuSelect} />
        </div>
      )}

      {gameState === GameState.CharacterSelect && (
        <div className="game-overlay">
          <CharacterSelect
            selection={characterSelection}
            onSelect={handleCharacterSelect}
            onConfirm={handleCharacterConfirm}
            onBack={handleBackFromCharacterSelect}
          />
        </div>
      )}

      {gameState === GameState.StageSelect && (
        <div className="game-overlay">
          <StageSelect
            selectedStage={selectedStage}
            onSelect={handleStageSelect}
            onConfirm={handleStartBattle}
            onBack={handleBackFromStageSelect}
          />
        </div>
      )}

      {gameState === GameState.Fighting && (
        <GameHUD players={players} timer={matchTimer} />
      )}

      {gameState === GameState.Paused && (
        <>
          <GameHUD players={players} timer={matchTimer} />
          <div className="game-overlay">
            <PauseMenu
              onResume={handlePauseResume}
              onRestart={handlePauseRestart}
              onQuit={handleQuitToMenu}
            />
          </div>
        </>
      )}

      {gameState === GameState.Results && matchResult && (
        <div className="game-overlay">
          <ResultsScreen
            result={matchResult}
            onRematch={handleRematch}
            onQuit={handleQuitToMenu}
          />
        </div>
      )}
    </div>
  );
}
