
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GameState, Position, EntityStats, StatChoice, PotionEntity, Pet, Language, Relic, AltarEffect } from './types';
import { INITIAL_PLAYER_STATS, MAP_WIDTH, MAP_HEIGHT, TRANSLATIONS, RELICS_POOL, THEME_CONFIG, MAX_LEVELS, BLESSINGS_POOL, CURSES_POOL } from './constants';
import { generateDungeon, findDungeonPath } from './utils/dungeon';
import GameMap from './components/GameMap';
import HUD from './components/HUD';
import { CombatModal, ChestModal, MerchantShopModal, TutorialModal, PotionPickupModal, RelicSelectionModal, AltarInteractionModal, AltarResultModal } from './components/Modals';
import { Icon } from './components/Icons';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [currentLang, setCurrentLang] = useState<Language>('PT');
  const [moveQueue, setMoveQueue] = useState<Position[]>([]);
  const [isNewGameMode, setIsNewGameMode] = useState(false);
  const [inventoryFullAlert, setInventoryFullAlert] = useState(false);
  
  const audioContext = useRef<AudioContext | null>(null);
  const currentSongIdx = useRef<number>(0);
  const isMutedRef = useRef(false);
  const playerPosRef = useRef<Position>({ x: 0, y: 0 });

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('rq_save_v150_final');
      if (saved) {
        const data = JSON.parse(saved);
        setGameState({ ...data, gameStatus: 'START_SCREEN' as const });
        setNameInput(data.playerName || '');
        if (data.language) setCurrentLang(data.language);
        playerPosRef.current = data.playerPos;
      } else {
        const initialPos = { x: 0, y: 0 };
        setGameState({
          playerName: '', gold: 0, level: 1, theme: 'VOID' as const, playerPos: initialPos,
          playerStats: { ...INITIAL_PLAYER_STATS }, map: [], enemies: [], chests: [],
          potions: [], items: [], hasKey: false, enemiesKilledInLevel: 0,
          stairsPos: {x:0,y:0}, gameStatus: 'START_SCREEN' as const, logs: [],
          tronModeActive: false, tronTimeLeft: 0, tronTrail: [], language: 'PT',
          inventory: [], inventorySize: 5, hasUsedAltarInLevel: false
        });
        playerPosRef.current = initialPos;
        setIsNewGameMode(true);
      }
    } catch (e) {
      localStorage.removeItem('rq_save_v150_final');
      window.location.reload();
    }
  }, []);

  const saveGame = useCallback((state: GameState) => {
    try {
      localStorage.setItem('rq_save_v150_final', JSON.stringify({ ...state, language: currentLang }));
    } catch (e) {}
  }, [currentLang]);

  const t = TRANSLATIONS[currentLang];

  const handleShare = async () => {
    const shareText = `𝗥𝗼𝗴𝘂𝗲 𝗤𝘂𝗲𝘀𝘁:\n"Desci até o nível ${gameState?.level || 1} no Abismo Eterno! Consegue chegar mais longe?"\n\nhttps://t.me/RogueQuest_bot`;
    if (navigator.share) {
      try { await navigator.share({ text: shareText }); } catch (err) {}
    } else {
      try { await navigator.clipboard.writeText(shareText); alert("Link de convite copiado!"); } catch (e) { }
    }
  };

  const playSound = (freq: number, type: OscillatorType = 'sine', duration: number = 0.1, gainVal: number = 0.05) => {
    if (isMutedRef.current || !audioContext.current) return;
    try {
      const ctx = audioContext.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(gainVal, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {}
  };

  const playChime = () => playSound(880, 'sine', 0.3);
  const playCoinSound = () => playSound(987, 'sine', 0.1, 0.03);
  const playAttackSound = (attacker: 'player' | 'enemy') => {
    if (attacker === 'player') playSound(600, 'square', 0.2, 0.02);
    else playSound(200, 'sawtooth', 0.2, 0.04);
  };

  const startMusic = () => {
    if (audioContext.current) return;
    audioContext.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    const tracks = [[261.63, 311.13, 349.23, 392.00, 466.16], [196.00, 220.00, 246.94, 261.63, 293.66], [329.63, 392.00, 440.00, 523.25, 659.25]];
    let step = 0;
    currentSongIdx.current = Math.floor(Math.random() * tracks.length);
    setInterval(() => {
      if (isMutedRef.current || !audioContext.current) return;
      const track = tracks[currentSongIdx.current % tracks.length];
      playSound(track[step % track.length], step % 8 < 4 ? 'sawtooth' : 'square', 0.15, 0.006);
      step++;
      if (step % 64 === 0) currentSongIdx.current++;
    }, 150);
  };

  const initLevel = useCallback((level: number, stats?: EntityStats, gold?: number, name?: string, activePet?: Pet, activeRelic?: Relic, inventory?: PotionEntity[]) => {
    if (level > MAX_LEVELS) {
      setGameState(prev => prev ? { ...prev, gameStatus: 'WON' as const } : null);
      return;
    }

    const dungeon = generateDungeon(level);
    let currentStats = stats ? { ...stats, armor: stats.maxArmor } : { ...INITIAL_PLAYER_STATS };
    let currentGold = gold ?? 0;
    let invSize = 5;

    if (activeRelic?.id === 'slots') invSize = 10;
    
    const startInv = inventory || [];
    const finalPlayerName = name || nameInput;

    const newState: GameState = {
      ...dungeon,
      playerName: finalPlayerName,
      gold: currentGold,
      level,
      playerStats: currentStats,
      items: [],
      hasKey: false,
      enemiesKilledInLevel: 0,
      gameStatus: (level === 1 && !stats) ? 'TUTORIAL' as const : 'PLAYING' as const,
      logs: (level === 1 && !stats) ? [`${finalPlayerName} entrou no abismo.`] : [`Descendo para o nível ${level}`],
      inventory: startInv,
      inventorySize: invSize,
      activePet,
      activeRelic,
      language: currentLang,
      hasUsedAltarInLevel: false,
      activeAltarEffect: undefined,
      keyPath: undefined
    };
    
    playerPosRef.current = newState.playerPos;
    setGameState(newState);
    saveGame(newState); 
    setMoveQueue([]);
  }, [nameInput, currentLang, saveGame]);

  useEffect(() => {
    if (moveQueue.length === 0 || !gameState || gameState.gameStatus !== 'PLAYING') return;

    const moveStep = () => {
      setGameState(prev => {
        if (!prev || prev.gameStatus !== 'PLAYING' || moveQueue.length === 0) return prev;

        const nextPos = moveQueue[0];
        const oldPos = { ...prev.playerPos };
        
        const updatedPet = prev.activePet ? { ...prev.activePet, pos: oldPos } : undefined;

        // PRIORIDADE DE INTERAÇÃO NO TILE DE DESTINO
        const enemy = prev.enemies.find(e => e.x === nextPos.x && e.y === nextPos.y);
        if (enemy) {
          setMoveQueue([]);
          return { ...prev, gameStatus: 'COMBAT' as const, currentEnemy: enemy } as GameState;
        }

        const chest = prev.chests.find(c => c.x === nextPos.x && c.y === nextPos.y);
        if (chest) {
          setMoveQueue([]);
          return { ...prev, gameStatus: 'CHEST_OPEN' as const, chests: prev.chests.filter(c => c.id !== chest.id) } as GameState;
        }

        if (prev.keyPos && nextPos.x === prev.keyPos.x && nextPos.y === prev.keyPos.y && !prev.hasKey) {
          playChime();
          setMoveQueue(q => q.slice(1));
          playerPosRef.current = nextPos;
          return { ...prev, hasKey: true, logs: [...prev.logs, t.log_key], playerPos: nextPos, activePet: updatedPet, keyPath: undefined } as GameState;
        }

        const potion = prev.potions.find(p => p.x === nextPos.x && p.y === nextPos.y);
        if (potion) {
          setMoveQueue([]);
          return { ...prev, gameStatus: 'PICKUP_CHOICE' as const, currentPotion: potion, potions: prev.potions.filter(p => p.id !== potion.id) } as GameState;
        }

        if (prev.merchantPos && nextPos.x === prev.merchantPos.x && nextPos.y === prev.merchantPos.y) {
          setMoveQueue([]);
          playerPosRef.current = nextPos;
          return { ...prev, gameStatus: 'MERCHANT_SHOP' as const, playerPos: nextPos, activePet: updatedPet } as GameState;
        }

        if (prev.altarPos && nextPos.x === prev.altarPos.x && nextPos.y === prev.altarPos.y) {
          setMoveQueue([]);
          playerPosRef.current = nextPos;
          return { ...prev, gameStatus: 'ALTAR_INTERACTION' as const, playerPos: nextPos, activePet: updatedPet } as GameState;
        }

        if (nextPos.x === prev.stairsPos.x && nextPos.y === prev.stairsPos.y) {
          if (prev.hasKey && prev.enemiesKilledInLevel > 0) {
            playChime();
            setMoveQueue([]);
            return { ...prev, gameStatus: 'NEXT_LEVEL' as const } as GameState;
          } else {
            setMoveQueue(q => q.slice(1));
            playerPosRef.current = nextPos;
            return { ...prev, logs: [...prev.logs, t.log_locked], playerPos: nextPos, activePet: updatedPet } as GameState;
          }
        }

        // Recalcular pegadas brilhantes se o efeito Olhos Abertos estiver ativo
        let newKeyPath = prev.keyPath;
        if (prev.activeAltarEffect?.id === 'open_eyes' && !prev.hasKey && prev.keyPos) {
           const path = findDungeonPath(nextPos, prev.keyPos, prev.map, prev.enemies);
           if (path) newKeyPath = path;
        }

        setMoveQueue(q => q.slice(1));
        playerPosRef.current = nextPos;
        return { ...prev, playerPos: nextPos, activePet: updatedPet, keyPath: newKeyPath } as GameState;
      });
    };

    const timer = setTimeout(moveStep, 80); 
    return () => clearTimeout(timer);
  }, [moveQueue, gameState?.gameStatus, t]);

  const handleTileClick = (tx: number, ty: number) => {
    if (!gameState || gameState.gameStatus !== 'PLAYING') return;
    
    // O findDungeonPath original ignora inimigos apenas para visual, mas aqui precisamos considerar obstáculos
    // Modifiquei findDungeonPath no dungeon.ts para sempre ignorar inimigos no cálculo do caminho para não "travar"
    // Mas o loop de movimento acima interrompe se encontrar um inimigo no caminho.
    const path = findDungeonPath(playerPosRef.current, { x: tx, y: ty }, gameState.map, gameState.enemies);
    if (path && path.length > 0) {
      setMoveQueue(path);
    } else {
      setMoveQueue([]);
    }
  };

  const onCombatFinish = (newStats: EntityStats, win: boolean, goldEarned: number, petHp?: number) => {
    setGameState(prev => {
      if (!prev) return prev;
      if (!win) return { ...prev, gameStatus: 'LOST' as const, lastStats: { ...prev.playerStats, hp: 0 } };
      
      const updatedPet = prev.activePet ? { ...prev.activePet, hp: petHp || 0 } : undefined;
      let finalGoldEarned = goldEarned;
      if (prev.activeAltarEffect?.id === 'sacred_greed') finalGoldEarned = Math.floor(finalGoldEarned * 1.5);
      if (prev.activeAltarEffect?.id === 'cursed_greed') finalGoldEarned = Math.floor(finalGoldEarned * 0.5);
      
      let nextStats = { ...newStats };
      if (prev.activeAltarEffect?.id === 'surrendered_blood') nextStats.hp = Math.min(nextStats.maxHp, nextStats.hp + Math.floor(nextStats.maxHp * 0.3));
      if (prev.activeAltarEffect?.id === 'blood_tribute' && finalGoldEarned > 0) nextStats.hp = Math.max(1, nextStats.hp - 5);

      playCoinSound();
      const updated: GameState = {
        ...prev, 
        playerStats: nextStats, 
        gold: prev.gold + finalGoldEarned, 
        gameStatus: 'PLAYING' as const,
        enemies: prev.enemies.filter(e => e.id !== prev.currentEnemy?.id),
        enemiesKilledInLevel: prev.enemiesKilledInLevel + 1,
        activePet: updatedPet, 
        currentEnemy: undefined,
        keyPath: undefined 
      };
      saveGame(updated);
      return updated;
    });
    setMoveQueue([]);
  };

  const usePotionFromInventory = (idx: number) => {
    let used = false;
    setGameState(prev => {
      if (!prev || !prev.inventory[idx]) return prev;
      if (prev.activeAltarEffect?.id === 'denied_offering') {
        const newInv = [...prev.inventory];
        newInv.splice(idx, 1);
        used = true;
        return { ...prev, activeAltarEffect: undefined, inventory: newInv } as GameState;
      }
      const pot = prev.inventory[idx];
      const stats = { ...prev.playerStats };
      let boost = pot.percent;
      if (prev.activeAltarEffect?.id === 'profane_thirst') boost -= 10;
      const heal = Math.floor(stats.maxHp * (boost / 100));
      stats.hp = Math.min(stats.maxHp, stats.hp + heal);
      const newInv = [...prev.inventory];
      if (prev.activeAltarEffect?.id !== 'accepted_offering') newInv.splice(idx, 1);
      used = true;
      return { 
        ...prev, 
        playerStats: stats, 
        inventory: newInv, 
        activeAltarEffect: prev.activeAltarEffect?.id === 'accepted_offering' ? undefined : prev.activeAltarEffect 
      } as GameState;
    });
    return used;
  };

  if (!gameState) return null;

  return (
    <div className="bg-black min-h-screen text-zinc-300 font-sans selection:bg-red-500/30 overflow-x-hidden">
      {gameState.gameStatus === 'START_SCREEN' && (
        <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center p-8 bg-black">
          <div className="max-w-md w-full text-center space-y-8 animate-in fade-in zoom-in-95 duration-700">
            <div className="space-y-2 mb-12">
              <h1 className="text-6xl md:text-7xl font-sans font-black tracking-tighter flex items-center justify-center">
                <span className="text-white">ROGUE</span><span className="text-red-800">QUEST</span>
              </h1>
              <p className="text-zinc-500 font-mono text-[10px] tracking-[0.8em] font-bold uppercase mt-2 pl-[0.8em]">O ABISMO INFINITO</p>
            </div>
            
            <div className="bg-[#0f0f0f] border border-zinc-800 rounded-[2.5rem] p-10 space-y-8 shadow-2xl">
              <div className="space-y-6">
                {!isNewGameMode && gameState.playerName ? (
                  <div className="space-y-4">
                    <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-2xl">
                      <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-1">Herói Ativo</p>
                      <p className="text-sm font-black text-white">{gameState.playerName}</p>
                      <p className="text-[10px] font-bold text-red-800 uppercase">Profundidade: {gameState.level}</p>
                    </div>
                    <button onClick={() => { startMusic(); setGameState({ ...gameState, gameStatus: 'PLAYING' as const }); }} className="w-full bg-red-800 hover:bg-red-700 py-5 rounded-2xl text-white font-mono font-bold text-xs uppercase tracking-widest shadow-xl transition-all transform active:scale-95">{t.continue_journey}</button>
                    <button onClick={() => setIsNewGameMode(true)} className="w-full bg-[#1e1e1e] hover:bg-[#2a2a2a] py-5 rounded-2xl text-zinc-500 font-mono font-bold text-[10px] uppercase tracking-widest transition-all">{t.new_game}</button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="relative group"><input type="text" maxLength={12} placeholder={t.hero_placeholder} value={nameInput} onChange={e => setNameInput(e.target.value.toUpperCase())} className="w-full bg-[#0a0a0a] border-2 border-zinc-800 rounded-2xl py-5 px-6 text-center text-base font-mono text-white placeholder-zinc-700 focus:border-red-600 transition-all outline-none"/><div className="absolute inset-0 border-2 border-transparent pointer-events-none rounded-2xl group-focus-within:border-red-600/50" /></div>
                    <button onClick={() => { if(!nameInput.trim()) return; startMusic(); initLevel(1, undefined, 0, nameInput); }} disabled={!nameInput.trim()} className="w-full bg-red-800 hover:bg-red-700 py-5 rounded-2xl text-white font-mono font-bold text-xs uppercase tracking-widest shadow-xl transition-all transform active:scale-95 disabled:opacity-30 disabled:grayscale">{t.start_journey}</button>
                  </div>
                )}
                <button onClick={() => window.open('https://t.me/c/2134721525/27', '_blank')} className="w-full bg-zinc-900 border-2 border-zinc-700 text-zinc-400 rounded-2xl py-4 font-mono font-bold text-[10px] uppercase tracking-widest hover:text-white hover:border-zinc-500 hover:bg-zinc-800 transition-all shadow-lg active:scale-95">Feedback</button>
              </div>
              <div className="flex justify-center gap-8 pt-4 border-t border-zinc-900">
                <button onClick={() => setCurrentLang('PT')} className="relative flex flex-col items-center group"><div className={`transition-transform hover:scale-110 ${currentLang === 'PT' ? 'opacity-100 scale-110' : 'opacity-40 grayscale group-hover:grayscale-0 group-hover:opacity-80'}`}><Icon.FlagBR /></div></button>
                <button onClick={() => setCurrentLang('EN')} className="relative flex flex-col items-center group"><div className={`transition-transform hover:scale-110 ${currentLang === 'EN' ? 'opacity-100 scale-110' : 'opacity-40 grayscale group-hover:grayscale-0 group-hover:opacity-80'}`}><Icon.FlagUS /></div></button>
                <button onClick={() => setCurrentLang('ES')} className="relative flex flex-col items-center group"><div className={`transition-transform hover:scale-110 ${currentLang === 'ES' ? 'opacity-100 scale-110' : 'opacity-40 grayscale group-hover:grayscale-0 group-hover:opacity-80'}`}><Icon.FlagES /></div></button>
              </div>
            </div>
          </div>
        </div>
      )}

      {gameState.gameStatus !== 'START_SCREEN' && gameState.gameStatus !== 'WON' && gameState.gameStatus !== 'NEXT_LEVEL' && gameState.map.length > 0 && (
        <div className="max-w-[480px] mx-auto p-4 flex flex-col gap-4 min-h-screen">
          <header className="flex justify-between items-start py-4 px-1 border-b border-zinc-900 mb-2">
            <div className="flex flex-col">
              <h2 className="text-2xl font-black tracking-tighter uppercase flex leading-none"><span className="text-white">ROGUE</span><span className="text-red-800">QUEST</span></h2>
              <p className="text-[9px] font-mono text-zinc-500 font-bold uppercase tracking-[0.2em] mt-1">{t[THEME_CONFIG[gameState.theme].nameKey]} – {t.level} {gameState.level}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => window.open('https://t.me/ComunidadeRQ', '_blank')} className="w-10 h-10 bg-zinc-900/80 border border-zinc-800 rounded-xl flex items-center justify-center text-zinc-400 hover:text-white transition-colors"><Icon.Users /></button>
              <button onClick={handleShare} className="w-10 h-10 bg-zinc-900/80 border border-zinc-800 rounded-xl flex items-center justify-center text-zinc-400 hover:text-white transition-colors"><Icon.Share /></button>
              <button onClick={() => setIsMuted(!isMuted)} className={`w-10 h-10 bg-zinc-900/80 border border-zinc-800 rounded-xl flex items-center justify-center transition-colors ${isMuted ? 'text-zinc-600' : 'text-red-800'}`}>{isMuted ? <Icon.VolumeX /> : <Icon.Volume2 />}</button>
            </div>
          </header>

          <GameMap 
            map={gameState.map} theme={gameState.theme} playerPos={gameState.playerPos} enemies={gameState.enemies} chests={gameState.chests} potions={gameState.potions} items={gameState.items} keyPos={gameState.keyPos} merchantPos={gameState.merchantPos} altarPos={gameState.altarPos} hasKey={gameState.hasKey} stairsPos={gameState.stairsPos} activePet={gameState.activePet} 
            ritualDarkness={gameState.activeAltarEffect?.id === 'ritual_darkness'} keyPath={gameState.keyPath} onTileClick={handleTileClick}
          />

          <HUD level={gameState.level} stats={gameState.playerStats} logs={gameState.logs} hasKey={gameState.hasKey} kills={gameState.enemiesKilledInLevel} gold={gameState.gold} playerName={gameState.playerName} activePet={gameState.activePet} language={currentLang} inventory={gameState.inventory} inventorySize={gameState.inventorySize} activeRelic={gameState.activeRelic} activeAltarEffect={gameState.activeAltarEffect} onUsePotion={usePotionFromInventory}/>
        </div>
      )}

      {gameState.gameStatus === 'COMBAT' && gameState.currentEnemy && (
        <CombatModal 
          playerStats={gameState.playerStats} enemy={gameState.currentEnemy} activePet={gameState.activePet} language={currentLang} 
          altarEffect={gameState.activeAltarEffect} inventory={gameState.inventory} onAttackSound={playAttackSound} 
          onUsePotion={usePotionFromInventory} onFinish={onCombatFinish}
        />
      )}
      {gameState.gameStatus === 'CHEST_OPEN' && <ChestModal onChoice={(choice) => {
          setGameState(prev => {
            if (!prev) return prev;
            const stats = { ...prev.playerStats };
            let multiplier = prev.activeAltarEffect?.id === 'consecrated_chest' ? 2 : 1;
            if (choice === 'Ataque') stats.attack += 5 * multiplier;
            if (choice === 'Armadura') { stats.maxArmor += 3 * multiplier; stats.armor += 3 * multiplier; }
            if (choice === 'Velocidade') stats.speed += 4 * multiplier;
            return { ...prev, playerStats: stats, gameStatus: 'PLAYING' as const, activeAltarEffect: multiplier === 2 ? undefined : prev.activeAltarEffect } as GameState;
          });
      }} language={currentLang} doubleBonus={gameState.activeAltarEffect?.id === 'consecrated_chest'} />}
      
      {gameState.gameStatus === 'MERCHANT_SHOP' && (
        <MerchantShopModal 
          gold={gameState.gold} level={gameState.level} hasPet={!!gameState.activePet} language={currentLang}
          discount={gameState.activeAltarEffect?.id === 'merchant_blessing'}
          onBuyItem={(item) => {
              setGameState(prev => {
                if(!prev) return prev;
                const stats = { ...prev.playerStats };
                stats[item.stat as keyof EntityStats] += item.value;
                if(item.stat === 'maxArmor') stats.armor += item.value;
                return { ...prev, gold: prev.gold - item.price!, playerStats: stats } as GameState;
              });
          }}
          onBuyPotion={(pot, choice) => {
             if(choice === 'use') {
               setGameState(prev => {
                 if(!prev) return prev;
                 const stats = { ...prev.playerStats };
                 const heal = Math.floor(stats.maxHp * (pot.percent / 100));
                 stats.hp = Math.min(stats.maxHp, stats.hp + heal);
                 return { ...prev, gold: prev.gold - pot.price!, playerStats: stats } as GameState;
               });
             } else {
               setGameState(prev => {
                 if(!prev) return prev;
                 if (prev.inventory.length >= prev.inventorySize) {
                   setInventoryFullAlert(true);
                   return prev;
                 }
                 return { ...prev, gold: prev.gold - pot.price!, inventory: [...prev.inventory, pot] } as GameState;
               });
             }
          }}
          onRentTron={() => {
              setGameState(prev => prev ? { ...prev, gold: prev.gold - 25, tronModeActive: true, tronTimeLeft: 15, gameStatus: 'PLAYING' as const } as GameState : null);
          }}
          onBuyPet={(type) => {
             const pet: Pet = { type, name: type, hp: 50, maxHp: 50, pos: { ...playerPosRef.current } };
             setGameState(prev => prev ? { ...prev, gold: prev.gold - (type === 'CORUJA' ? 12 : 10), activePet: pet } as GameState : null);
          }}
          onClose={() => setGameState(prev => prev ? { ...prev, gameStatus: 'PLAYING' as const } as GameState : null)}
        />
      )}

      {gameState.gameStatus === 'ALTAR_INTERACTION' && (
        <AltarInteractionModal 
          active={gameState.enemiesKilledInLevel > 0 && !gameState.hasUsedAltarInLevel} language={currentLang} 
          onPray={() => {
              setGameState(prev => {
                if (!prev) return prev;
                const isLucky = Math.random() > 0.4; 
                const pool = isLucky ? BLESSINGS_POOL : CURSES_POOL;
                const effect = pool[Math.floor(Math.random() * pool.length)];
                let playerStats = { ...prev.playerStats };
                if (effect.id === 'anxious_strike') playerStats.attack = Math.floor(playerStats.attack * 2); 
                
                let keyPath: Position[] | undefined = undefined;
                if (effect.id === 'open_eyes' && prev.keyPos) {
                    const path = findDungeonPath(prev.playerPos, prev.keyPos, prev.map, prev.enemies);
                    if (path) keyPath = path;
                }

                let inventorySize = prev.inventorySize;
                if (effect.id === 'less_weight') inventorySize = Math.max(1, inventorySize - 2);

                return { 
                    ...prev, 
                    gameStatus: 'ALTAR_RESULT' as const, 
                    activeAltarEffect: effect, 
                    hasUsedAltarInLevel: true, 
                    playerStats, 
                    keyPath,
                    inventorySize
                } as GameState;
              });
          }} onClose={() => setGameState(prev => prev ? { ...prev, gameStatus: 'PLAYING' as const } as GameState : null)} 
        />
      )}
      {gameState.gameStatus === 'ALTAR_RESULT' && gameState.activeAltarEffect && (
        <AltarResultModal effect={gameState.activeAltarEffect} language={currentLang} onClose={() => setGameState(prev => prev ? { ...prev, gameStatus: 'PLAYING' as const } as GameState : null)} />
      )}
      
      {gameState.gameStatus === 'WON' && (
        <div className="fixed inset-0 z-[120] bg-black flex flex-col items-center justify-center p-8 space-y-8 animate-in fade-in">
          <div className="text-center space-y-2"><h2 className="text-6xl font-black text-green-500 tracking-tighter uppercase">VITÓRIA</h2><p className="text-zinc-500 font-bold text-xs uppercase tracking-widest">VOCÊ CONQUISTOU O ABISMO</p></div>
          <button onClick={() => { localStorage.removeItem('rq_save_v150_final'); window.location.reload(); }} className="w-full py-5 bg-green-600 text-white font-black rounded-2xl uppercase tracking-widest text-sm hover:bg-green-500 transition-all">REINICIAR LENDA</button>
        </div>
      )}
      
      {gameState.gameStatus === 'LOST' && (
        <div className="fixed inset-0 z-[120] bg-black flex flex-col items-center justify-center p-6 space-y-6 animate-in fade-in overflow-y-auto">
          <div className="text-center space-y-2">
            <h2 className="text-6xl font-black text-red-600 tracking-tighter uppercase drop-shadow-[0_0_15px_rgba(220,38,38,0.5)]">
              {t.death_title}
            </h2>
            <p className="text-zinc-500 font-bold text-[10px] uppercase tracking-[0.3em]">
              {t.death_desc}
            </p>
          </div>

          <div className="w-full max-w-md bg-zinc-900/50 border border-zinc-800 rounded-[2.5rem] p-8 space-y-6 shadow-2xl backdrop-blur-md">
            <h3 className="text-center text-xs font-black text-zinc-400 uppercase tracking-widest border-b border-zinc-800 pb-4">
              {t.final_stats}
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-black/40 p-4 rounded-2xl border border-zinc-800/50 flex flex-col items-center gap-1">
                <span className="text-[10px] font-bold text-zinc-500 uppercase">{t.level}</span>
                <span className="text-xl font-black text-white">{gameState.level}</span>
              </div>
              <div className="bg-black/40 p-4 rounded-2xl border border-zinc-800/50 flex flex-col items-center gap-1">
                <span className="text-[10px] font-bold text-zinc-500 uppercase">{t.hp}</span>
                <span className="text-xl font-black text-red-500">{gameState.lastStats?.maxHp || 0}</span>
              </div>
              <div className="bg-black/40 p-4 rounded-2xl border border-zinc-800/50 flex flex-col items-center gap-1">
                <span className="text-[10px] font-bold text-zinc-500 uppercase">{t.atk}</span>
                <span className="text-xl font-black text-yellow-500">{gameState.lastStats?.attack || 0}</span>
              </div>
              <div className="bg-black/40 p-4 rounded-2xl border border-zinc-800/50 flex flex-col items-center gap-1">
                <span className="text-[10px] font-bold text-zinc-500 uppercase">{t.armor}</span>
                <span className="text-xl font-black text-blue-500">{gameState.lastStats?.maxArmor || 0}</span>
              </div>
              <div className="bg-black/40 p-4 rounded-2xl border border-zinc-800/50 flex flex-col items-center gap-1 col-span-2">
                <span className="text-[10px] font-bold text-zinc-500 uppercase">{t.vel}</span>
                <span className="text-xl font-black text-green-500">{gameState.lastStats?.speed || 0}</span>
              </div>
            </div>

            {gameState.activeRelic && (
              <div className="bg-purple-950/10 border border-purple-500/20 p-4 rounded-2xl flex items-center gap-4">
                <div className="text-purple-400">
                  {React.createElement((Icon as any)[gameState.activeRelic.icon], { width: 24, height: 24 })}
                </div>
                <div className="text-left">
                  <p className="text-[8px] font-black text-purple-500 uppercase tracking-widest">{t.relic_active}</p>
                  <p className="text-xs font-black text-white uppercase">{gameState.activeRelic.name}</p>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-3">
              <button 
                onClick={handleShare} 
                className="w-full py-4 bg-zinc-800 hover:bg-zinc-700 text-white font-black rounded-xl uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 transition-all border border-zinc-700"
              >
                <Icon.Share width={14} height={14} /> COMPARTILHAR CONQUISTA
              </button>
              <button 
                onClick={() => { localStorage.removeItem('rq_save_v150_final'); window.location.reload(); }} 
                className="w-full py-5 bg-red-800 text-white font-black rounded-2xl uppercase tracking-widest text-sm hover:bg-red-700 transition-all shadow-[0_0_20px_rgba(185,28,28,0.3)]"
              >
                {t.rebirth}
              </button>
            </div>
          </div>
        </div>
      )}

      {gameState.gameStatus === 'NEXT_LEVEL' && (
        <div className="fixed inset-0 z-[120] bg-black flex flex-col items-center justify-center p-8 space-y-8 animate-in fade-in">
          <div className="text-center space-y-4">
            <h2 className="text-4xl font-black text-red-600 tracking-tighter uppercase animate-pulse">
              Descendo para o próximo nível...
            </h2>
            <p className="text-zinc-500 font-bold text-xs uppercase tracking-widest">Alcançando profundidade {gameState.level + 1}</p>
          </div>
          <button 
            onClick={() => initLevel(gameState.level + 1, gameState.playerStats, gameState.gold, gameState.playerName, gameState.activePet, gameState.activeRelic, gameState.inventory)} 
            className="w-full max-w-xs py-5 bg-white text-black font-black rounded-2xl uppercase tracking-widest text-sm hover:bg-zinc-200 transition-all shadow-[0_0_20px_rgba(255,255,255,0.2)]"
          >
            Prosseguir
          </button>
        </div>
      )}

      {gameState.gameStatus === 'TUTORIAL' && <TutorialModal onFinish={() => setGameState({...gameState, gameStatus: 'PLAYING' as const})} language={currentLang} />}
      
      {gameState.gameStatus === 'PICKUP_CHOICE' && gameState.currentPotion && (
        <PotionPickupModal potion={gameState.currentPotion} language={currentLang} onChoice={(choice) => {
          if (choice === 'use') {
            const stats = { ...gameState.playerStats };
            let boost = gameState.currentPotion!.percent;
            if (gameState.activeAltarEffect?.id === 'profane_thirst') boost -= 10;
            const heal = Math.floor(stats.maxHp * (boost / 100));
            stats.hp = Math.min(stats.maxHp, stats.hp + heal);
            setGameState({...gameState, playerStats: stats, gameStatus: 'PLAYING' as const, currentPotion: undefined});
          } else {
            if (gameState.inventory.length < gameState.inventorySize) {
              setGameState({...gameState, inventory: [...gameState.inventory, gameState.currentPotion!], gameStatus: 'PLAYING' as const, currentPotion: undefined});
            } else {
              setInventoryFullAlert(true);
              setGameState({...gameState, gameStatus: 'PLAYING' as const, currentPotion: undefined, logs: [...gameState.logs, t.inventory_full]});
            }
          }
        }} />
      )}

      {inventoryFullAlert && (
        <div className="fixed inset-0 z-[150] bg-black/80 flex items-center justify-center p-6 backdrop-blur-sm">
          <div className="bg-zinc-900 border-2 border-red-500 p-8 rounded-3xl max-w-xs w-full text-center space-y-4 animate-in zoom-in-95">
             <div className="text-red-500 flex justify-center scale-150 mb-2"><Icon.Backpack /></div>
             <h3 className="text-white font-black uppercase text-sm">Inventário Cheio!</h3>
             <p className="text-zinc-500 text-xs">{t.inventory_full}</p>
             <button onClick={() => setInventoryFullAlert(false)} className="w-full py-3 bg-red-600 text-white font-black rounded-xl uppercase text-xs">OK</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
