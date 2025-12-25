
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GameState, Position, EntityStats, StatChoice, LevelTheme, ItemEntity, PotionEntity, Pet } from './types';
import { INITIAL_PLAYER_STATS, MAX_LEVELS, MAP_WIDTH, MAP_HEIGHT, THEME_CONFIG } from './constants';
import { generateDungeon } from './utils/dungeon';
import GameMap from './components/GameMap';
import HUD from './components/HUD';
import { CombatModal, ChestModal, MerchantShopModal, TutorialModal } from './components/Modals';
import { Icon } from './components/Icons';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const audioContext = useRef<AudioContext | null>(null);
  const audioInterval = useRef<any>(null);
  const currentSongIdx = useRef<number>(0);
  const isMutedRef = useRef(false);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    const saved = localStorage.getItem('rq_save_mobile');
    if (saved) {
      const data = JSON.parse(saved);
      setGameState({ ...data, gameStatus: 'START_SCREEN' });
      setNameInput(data.playerName || '');
    } else {
      setGameState({
        playerName: '', gold: 0, level: 1, theme: 'VOID', playerPos: {x:0,y:0},
        playerStats: INITIAL_PLAYER_STATS, map: [], enemies: [], chests: [],
        potions: [], items: [], hasKey: false, enemiesKilledInLevel: 0,
        stairsPos: {x:0,y:0}, gameStatus: 'START_SCREEN', logs: [],
        tronModeActive: false, tronTimeLeft: 0, tronTrail: []
      });
    }
  }, []);

  const saveGame = (state: GameState) => {
    localStorage.setItem('rq_save_mobile', JSON.stringify(state));
  };

  const playChime = () => {
    if (isMutedRef.current) return;
    const ctx = audioContext.current;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  };

  const playCoinSound = () => {
    if (isMutedRef.current) return;
    const ctx = audioContext.current;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(987, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1318, ctx.currentTime + 0.05);
    gain.gain.setValueAtTime(0.03, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  };

  const playAttackSound = (attacker: 'player' | 'enemy') => {
    if (isMutedRef.current) return;
    const ctx = audioContext.current;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    if (attacker === 'player') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.02, ctx.currentTime);
    } else {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(200, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(50, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.04, ctx.currentTime);
    }
    
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  };

  const playTronSound = () => {
    if (isMutedRef.current) return;
    const ctx = audioContext.current;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(110, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(660, ctx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.6);
  };

  const startMusic = () => {
    if (audioContext.current) return;
    audioContext.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    const tracks = [
      [261.63, 311.13, 349.23, 392.00, 466.16], 
      [196.00, 220.00, 246.94, 261.63, 293.66], 
      [329.63, 392.00, 440.00, 523.25, 659.25], 
      [130.81, 155.56, 174.61, 196.00, 233.08], 
      [440.00, 493.88, 523.25, 587.33, 659.25], 
      [220.00, 261.63, 293.66, 329.63, 349.23], 
      [164.81, 196.00, 220.00, 246.94, 261.63], 
      [98.00, 110.00, 123.47, 130.81, 146.83],
      [110.00, 130.81, 146.83, 164.81, 196.00], 
      [329.63, 293.66, 261.63, 220.00, 196.00], 
      [523.25, 659.25, 783.99, 880.00, 1046.50],
      [349.23, 415.30, 523.25, 622.25, 523.25, 415.30], 
      [587.33, 739.99, 880.00, 1174.66, 880.00, 739.99], 
      [146.83, 174.61, 220.00, 293.66, 349.23, 440.00], 
      [659.25, 523.25, 392.00, 329.63, 392.00, 523.25], 
      [466.16, 554.37, 698.46, 932.33, 1108.73, 1396.91] 
    ];

    let step = 0;
    currentSongIdx.current = Math.floor(Math.random() * tracks.length);

    const playStep = () => {
      if (isMutedRef.current) return;
      const ctx = audioContext.current;
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      const track = tracks[currentSongIdx.current];
      osc.frequency.setValueAtTime(track[step % track.length], ctx.currentTime);
      osc.type = step % 8 < 4 ? 'sawtooth' : 'square';
      
      gain.gain.setValueAtTime(0.006, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);
      
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + 0.15);
      step++;
      
      if (step % 64 === 0) {
        currentSongIdx.current = (currentSongIdx.current + 1) % tracks.length;
      }
    };
    audioInterval.current = setInterval(playStep, 150);
  };

  const handleShare = async () => {
    const shareData = {
      title: 'RogueQuest',
      text: 'Estou explorando o Abismo Infinito! Venha jogar também!',
      url: 'https://t.me/RogueQuest_bot',
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        console.error('Erro ao compartilhar:', err);
      }
    } else {
      window.open('https://t.me/RogueQuest_bot', '_blank');
    }
  };

  const initLevel = useCallback((level: number, stats?: EntityStats, gold?: number, name?: string, activePet?: Pet) => {
    const dungeon = generateDungeon(level);
    const currentStats = stats ? { ...stats, armor: stats.maxArmor } : { ...INITIAL_PLAYER_STATS };
    const currentGold = gold ?? 0;
    const currentName = name || nameInput || 'Herói';

    const updatedPet = activePet ? { ...activePet, pos: { x: dungeon.playerPos.x - 1, y: dungeon.playerPos.y } } : undefined;

    const newState: GameState = {
      ...dungeon,
      playerName: currentName,
      gold: currentGold,
      level,
      playerStats: currentStats,
      hasKey: false,
      enemiesKilledInLevel: 0,
      gameStatus: 'PLAYING',
      logs: level === 1 ? [`${currentName} entrou no abismo profundo.`] : [`Profundidade alcançada: ${level}.`],
      items: [],
      tronModeActive: false,
      tronTimeLeft: 0,
      tronTrail: [],
      activePet: updatedPet
    };
    setGameState(newState);
    saveGame(newState);
  }, [nameInput]);

  const restartGame = () => {
    localStorage.removeItem('rq_save_mobile');
    initLevel(1, INITIAL_PLAYER_STATS, 0, gameState?.playerName);
  };

  useEffect(() => {
    if (!gameState || !gameState.tronModeActive) return;
    
    const timer = setInterval(() => {
      setGameState(prev => {
        if (!prev || !prev.tronModeActive) return prev;
        const newTime = (prev.tronTimeLeft || 0) - 1;
        if (newTime <= 0) {
          return { 
            ...prev, 
            tronModeActive: false, 
            tronTimeLeft: 0, 
            tronTrail: [], 
            logs: [...prev.logs, "Energia da Moto esgotada."] 
          };
        }
        return { ...prev, tronTimeLeft: newTime };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameState?.tronModeActive]);

  const movePlayer = (dx: number, dy: number) => {
    if (!gameState || gameState.gameStatus !== 'PLAYING') return;
    const { playerPos, map, enemies, potions, keyPos, merchantPos, hasKey, stairsPos, enemiesKilledInLevel, chests, tronModeActive, tronTrail = [], activePet } = gameState;
    const nx = playerPos.x + dx;
    const ny = playerPos.y + dy;

    if (nx < 0 || nx >= MAP_WIDTH || ny < 0 || ny >= MAP_HEIGHT || map[ny][nx] === 'WALL') return;

    const enemy = enemies.find(e => e.x === nx && e.y === ny);
    if (enemy) { 
      if (tronModeActive) {
        const goldGain = Math.floor(Math.random() * 5) + 5;
        playCoinSound();
        setGameState({
          ...gameState,
          gold: gameState.gold + goldGain,
          enemies: enemies.filter(e => e.id !== enemy.id),
          enemiesKilledInLevel: enemiesKilledInLevel + 1,
          logs: [...gameState.logs, `Atropelou ${enemy.type}! +${goldGain}G`],
          playerPos: { x: nx, y: ny },
          tronTrail: [...tronTrail, playerPos],
          activePet: activePet ? { ...activePet, pos: playerPos } : undefined
        });
        return;
      } else {
        setGameState({ ...gameState, gameStatus: 'COMBAT', currentEnemy: enemy }); 
        return; 
      }
    }

    if (keyPos && nx === keyPos.x && ny === keyPos.y && !hasKey) {
      playChime();
      setGameState({ 
        ...gameState, 
        hasKey: true, 
        logs: [...gameState.logs, "Chave coletada!"], 
        playerPos: { x: nx, y: ny },
        tronTrail: tronModeActive ? [...tronTrail, playerPos] : tronTrail,
        activePet: activePet ? { ...activePet, pos: playerPos } : undefined
      });
      return;
    }

    if (merchantPos && nx === merchantPos.x && ny === merchantPos.y) {
      setGameState({ 
        ...gameState, 
        gameStatus: 'MERCHANT_SHOP', 
        playerPos: { x: nx, y: ny },
        tronTrail: tronModeActive ? [...tronTrail, playerPos] : tronTrail,
        activePet: activePet ? { ...activePet, pos: playerPos } : undefined
      });
      return;
    }

    const pot = potions.find(p => p.x === nx && p.y === ny);
    if (pot) {
      const heal = Math.floor(gameState.playerStats.maxHp * 0.3);
      const newHp = Math.min(gameState.playerStats.maxHp, gameState.playerStats.hp + heal);
      setGameState({ 
        ...gameState, 
        playerStats: { ...gameState.playerStats, hp: newHp },
        potions: potions.filter(p => p.id !== pot.id),
        logs: [...gameState.logs, `Cura: +${heal} VIDA`],
        playerPos: { x: nx, y: ny },
        tronTrail: tronModeActive ? [...tronTrail, playerPos] : tronTrail,
        activePet: activePet ? { ...activePet, pos: playerPos } : undefined
      });
      return;
    }

    const chest = chests.find(c => c.x === nx && c.y === ny);
    if (chest) { 
      setGameState({ 
        ...gameState, 
        gameStatus: 'CHEST_OPEN', 
        playerPos: { x: nx, y: ny },
        chests: chests.filter(c => c.id !== chest.id),
        tronTrail: tronModeActive ? [...tronTrail, playerPos] : tronTrail,
        activePet: activePet ? { ...activePet, pos: playerPos } : undefined
      }); 
      return; 
    }

    if (nx === stairsPos.x && ny === stairsPos.y) {
      if (hasKey && enemiesKilledInLevel >= 1) {
        if (gameState.level >= MAX_LEVELS) setGameState({ ...gameState, gameStatus: 'WON' });
        else setGameState({ ...gameState, gameStatus: 'NEXT_LEVEL' });
      } else {
        setGameState({ 
          ...gameState, 
          logs: [...gameState.logs, "Saída bloqueada. Sangue e Chave!"], 
          playerPos: { x: nx, y: ny },
          tronTrail: tronModeActive ? [...tronTrail, playerPos] : tronTrail,
          activePet: activePet ? { ...activePet, pos: playerPos } : undefined
        });
      }
      return;
    }

    setGameState({ 
      ...gameState, 
      playerPos: { x: nx, y: ny },
      tronTrail: tronModeActive ? [...tronTrail, playerPos] : tronTrail,
      activePet: activePet ? { ...activePet, pos: playerPos } : undefined
    });
  };

  const handleTileClick = (tx: number, ty: number) => {
    if (!gameState || gameState.gameStatus !== 'PLAYING') return;
    const { playerPos } = gameState;
    const dx = tx - playerPos.x;
    const dy = ty - playerPos.y;

    if (dx === 0 && dy === 0) return;

    let moveX = 0;
    let moveY = 0;

    if (Math.abs(dx) >= Math.abs(dy)) {
      moveX = dx > 0 ? 1 : -1;
    } else {
      moveY = dy > 0 ? 1 : -1;
    }

    movePlayer(moveX, moveY);
  };

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === 'w' || k === 'arrowup') movePlayer(0, -1);
      if (k === 's' || k === 'arrowdown') movePlayer(0, 1);
      if (k === 'a' || k === 'arrowleft') movePlayer(-1, 0);
      if (k === 'd' || k === 'arrowright') movePlayer(1, 0);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [gameState]);

  if (gameState?.gameStatus === 'START_SCREEN') {
    const hasSavedGame = gameState.level > 1 || gameState.gold > 0;
    
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-6 text-center">
        <h1 className="text-6xl font-black text-white tracking-tighter mb-4 animate-pulse uppercase">Rogue<span className="text-red-600">Quest</span></h1>
        <p className="text-zinc-600 mb-12 tracking-[0.4em] uppercase text-[10px]">O Abismo Infinito</p>
        <div className="bg-zinc-900/40 p-8 rounded-[2rem] border border-zinc-800 w-full max-w-xs backdrop-blur-md shadow-2xl space-y-4">
          <input type="text" placeholder="NOME DO HERÓI" value={nameInput} onChange={e => setNameInput(e.target.value.toUpperCase())}
            className="w-full bg-black border-2 border-zinc-800 rounded-xl p-4 text-white text-center font-bold focus:border-red-600 outline-none text-sm transition-all" />
          
          {hasSavedGame && (
            <button onClick={() => { startMusic(); setGameState(prev => prev ? { ...prev, gameStatus: 'PLAYING' } : null); }}
              className="w-full py-4 bg-green-600 hover:bg-green-500 text-white font-black rounded-xl transition-all shadow-lg shadow-green-900/20 text-xs uppercase tracking-widest"
            >
              Continuar Jornada (Nível {gameState.level})
            </button>
          )}

          <button onClick={() => { startMusic(); setGameState(prev => prev ? { ...prev, gameStatus: 'TUTORIAL' } : null); }}
            className="w-full py-4 bg-red-600 hover:bg-red-500 text-white font-black rounded-xl transition-all shadow-lg shadow-red-900/20 text-xs uppercase tracking-widest disabled:opacity-50"
            disabled={!nameInput.trim()}
          >
            {hasSavedGame ? 'Novo Jogo' : 'Iniciar Jornada'}
          </button>

          <a href="https://t.me/rurocoli" target="_blank" rel="noopener noreferrer" className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold rounded-xl transition-all text-[10px] uppercase tracking-widest flex items-center justify-center gap-2">
            <Icon.MessageCircle /> Dar Feedback
          </a>
        </div>
      </div>
    );
  }

  if (gameState?.gameStatus === 'TUTORIAL') {
    return <TutorialModal onFinish={() => initLevel(1, INITIAL_PLAYER_STATS, 0, nameInput)} />;
  }

  if (!gameState || !gameState.map.length) return null;

  const currentTheme = THEME_CONFIG[gameState.theme];

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-100 flex flex-col items-center p-4 font-mono select-none overflow-x-hidden relative pb-10">
      <div className="max-w-md w-full flex flex-col gap-4 animate-in fade-in duration-700">
        <header className="flex justify-between items-end border-b border-zinc-900 pb-3">
          <div className="flex flex-col">
            <h1 className="text-3xl font-black text-white tracking-tighter uppercase leading-none">
              ROGUE<span className="text-red-600">QUEST</span>
            </h1>
            <div className="flex items-center gap-2 mt-1.5">
              <h2 className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">{currentTheme.name}</h2>
              <span className="text-zinc-800 text-[10px] font-bold">|</span>
              <h3 className="text-zinc-400 text-[10px] font-bold uppercase">Nível {gameState.level}</h3>
            </div>
            {gameState.tronModeActive && (
              <div className="text-cyan-400 text-[10px] font-black animate-pulse mt-2 flex items-center gap-1.5">
                <Icon.Boot /> MOTO TRON: {gameState.tronTimeLeft}s
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={handleShare}
              className="p-2.5 bg-zinc-900/50 hover:bg-zinc-800 rounded-xl border border-zinc-800 transition-colors text-zinc-400 hover:text-white"
              title="Compartilhar"
            >
              <Icon.Share />
            </button>
            <button 
              onClick={() => setIsMuted(!isMuted)} 
              className="p-2.5 bg-zinc-900/50 hover:bg-zinc-800 rounded-xl border border-red-900/30 transition-colors text-red-500 hover:text-red-400"
            >
              {isMuted ? <Icon.VolumeX /> : <Icon.Volume2 />}
            </button>
          </div>
        </header>

        <GameMap 
          map={gameState.map} theme={gameState.theme} playerPos={gameState.playerPos}
          enemies={gameState.enemies} chests={gameState.chests} potions={gameState.potions}
          items={gameState.items} keyPos={gameState.keyPos} merchantPos={gameState.merchantPos} hasKey={gameState.hasKey}
          stairsPos={gameState.stairsPos} tronModeActive={gameState.tronModeActive} tronTrail={gameState.tronTrail}
          activePet={gameState.activePet}
          onTileClick={handleTileClick}
        />
        
        <HUD 
          level={gameState.level} stats={gameState.playerStats} logs={gameState.logs} 
          hasKey={gameState.hasKey} kills={gameState.enemiesKilledInLevel} gold={gameState.gold} playerName={gameState.playerName}
          activePet={gameState.activePet}
        />
        
        {gameState.gameStatus === 'LOST' && (
          <div className="fixed inset-0 bg-black/95 flex flex-col items-center justify-center p-8 z-[100] animate-in fade-in duration-1000">
            <div className="absolute inset-0 bg-red-900/10 animate-glitch pointer-events-none" />
            <h2 className="text-6xl font-black text-red-600 mb-4 italic tracking-tighter drop-shadow-[0_0_50px_rgba(220,38,38,0.8)] uppercase">Morte</h2>
            <p className="text-zinc-500 mb-12 uppercase text-[10px] tracking-[0.4em] animate-pulse text-center px-4">O Abismo reivindicou sua alma.</p>
            <button onClick={restartGame} className="bg-white text-black px-12 py-4 rounded-full font-black hover:scale-105 transition-transform shadow-2xl text-xs uppercase tracking-widest">Renascer</button>
          </div>
        )}

        {gameState.gameStatus === 'NEXT_LEVEL' && (
          <div className="fixed inset-0 bg-black flex flex-col items-center justify-center p-8 z-[100] animate-in fade-in duration-500">
             <div className="text-center">
              <h2 className="text-2xl font-black text-zinc-700 mb-2 animate-pulse uppercase">Descendo...</h2>
              <p className="text-zinc-900 text-[10px] tracking-[0.8em] uppercase font-bold">PROFUNDIDADE {gameState.level + 1}</p>
              <button 
                onClick={() => initLevel(gameState.level + 1, gameState.playerStats, gameState.gold, gameState.playerName, gameState.activePet)}
                className="mt-8 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 px-8 py-3 rounded-lg font-bold uppercase text-[10px] transition-all"
              >
                Entrar
              </button>
            </div>
          </div>
        )}

        {gameState.gameStatus === 'WON' && (
          <div className="fixed inset-0 bg-white text-black flex flex-col items-center justify-center p-8 z-[100]">
            <h2 className="text-5xl font-black mb-4 uppercase tracking-tighter">Ascensão</h2>
            <p className="mb-12 text-[10px] font-bold tracking-widest uppercase text-center">VOCÊ DOMINOU O INFINITO E ESCAPOU DO ABISMO!</p>
            <button onClick={restartGame} className="bg-black text-white px-12 py-4 rounded-full font-black text-xs uppercase tracking-widest">Reiniciar Tudo</button>
          </div>
        )}
      </div>

      {gameState.gameStatus === 'COMBAT' && gameState.currentEnemy && (
        <CombatModal 
          playerStats={gameState.playerStats} 
          enemy={gameState.currentEnemy} 
          activePet={gameState.activePet}
          onAttackSound={playAttackSound}
          onFinish={(stats, win, gold, petHp) => {
            if (win) {
              playCoinSound();
              setGameState(prev => {
                if (!prev) return prev;
                const newEnemies = prev.enemies.filter(e => e.id !== prev.currentEnemy?.id);
                const updatedPet = prev.activePet ? { ...prev.activePet, hp: petHp || 0 } : undefined;
                const nextState: GameState = { 
                    ...prev, 
                    playerStats: stats, 
                    gold: prev.gold + gold, 
                    gameStatus: 'PLAYING', 
                    enemies: newEnemies, 
                    enemiesKilledInLevel: prev.enemiesKilledInLevel + 1,
                    logs: [...prev.logs, `Vitória! +${gold}G`],
                    activePet: updatedPet
                };
                saveGame(nextState);
                return nextState;
              });
            } else { setGameState(prev => prev ? { ...prev, gameStatus: 'LOST' } : null); }
          }} 
        />
      )}
      {gameState.gameStatus === 'CHEST_OPEN' && (
        <ChestModal onChoice={c => {
          if (!gameState) return;
          const s = { ...gameState.playerStats };
          if (c === 'Ataque') s.attack += 5; else if (c === 'Armadura') { s.maxArmor += 3; s.armor = s.maxArmor; } else s.speed += 4;
          playChime();
          const nextState: GameState = { ...gameState, playerStats: s, gameStatus: 'PLAYING', logs: [...gameState.logs, `Bênção de ${c}!`] };
          setGameState(nextState);
          saveGame(nextState);
        }} />
      )}
      {gameState.gameStatus === 'MERCHANT_SHOP' && (
        <MerchantShopModal 
          gold={gameState.gold} 
          level={gameState.level} 
          hasPet={!!gameState.activePet}
          onClose={() => setGameState({...gameState, gameStatus: 'PLAYING'})}
          onBuyPet={(type) => {
            playChime();
            const newPet: Pet = {
                type,
                name: type === 'LOBO' ? 'Lobo Gris' : 'Puma Veloz',
                hp: 60,
                maxHp: 60,
                pos: { x: gameState.playerPos.x - 1, y: gameState.playerPos.y }
            };
            const nextState: GameState = {
                ...gameState,
                gold: gameState.gold - 10,
                activePet: newPet,
                logs: [...gameState.logs, `Mascote ${newPet.name} comprado!`]
            };
            setGameState(nextState);
            saveGame(nextState);
          }}
          onBuyPotion={(p) => {
            const heal = Math.floor(gameState.playerStats.maxHp * (p.percent / 100));
            const nextState: GameState = {
              ...gameState,
              gold: gameState.gold - (p.price || 0),
              playerStats: { ...gameState.playerStats, hp: Math.min(gameState.playerStats.maxHp, gameState.playerStats.hp + heal) },
              logs: [...gameState.logs, `Poção: +${heal} VIDA`]
            };
            setGameState(nextState);
            saveGame(nextState);
          }}
          onBuyItem={(item) => {
             const s = { ...gameState.playerStats };
             if (item.stat === 'maxHp') {
                s.maxHp += item.value;
                s.hp += item.value;
             } else {
                (s as any)[item.stat] += item.value;
             }
             const nextState: GameState = {
               ...gameState,
               gold: gameState.gold - (item.price || 0),
               playerStats: s,
               logs: [...gameState.logs, `Equipado: ${item.name}`]
             };
             setGameState(nextState);
             saveGame(nextState);
          }}
          onRentTron={() => {
            playTronSound();
            const nextState: GameState = {
              ...gameState,
              gold: gameState.gold - 25,
              tronModeActive: true,
              tronTimeLeft: 10,
              tronTrail: [],
              gameStatus: 'PLAYING',
              logs: [...gameState.logs, "MOTO TRON ATIVADA! (10s)"]
            };
            setGameState(nextState);
            saveGame(nextState);
          }}
        />
      )}
    </div>
  );
};

export default App;
