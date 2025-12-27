
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
    if (!gameState || !gameState.tronModeActive) return;
    const timer = setInterval(() => {
      setGameState(prev => {
        if (!prev || prev.tronTimeLeft === undefined) return prev;
        if (prev.tronTimeLeft <= 1) {
          return { ...prev, tronModeActive: false, tronTimeLeft: 0, tronTrail: [] };
        }
        return { ...prev, tronTimeLeft: prev.tronTimeLeft - 1 };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [gameState?.tronModeActive]);

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

  const playSound = (freq: number, type: OscillatorType = 'sine', duration: number = 0.1, gainVal: number = 0.05) => {
    if (isMutedRef.current || !audioContext.current) return;
    try {
      const ctx = audioContext.current;
      if (ctx.state === 'suspended') ctx.resume();
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
    if (attacker === 'player') playSound(600, 'square', 0.15, 0.04);
    else playSound(220, 'sawtooth', 0.2, 0.06);
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
      playSound(track[step % track.length], step % 8 < 4 ? 'sawtooth' : 'square', 0.15, 0.005);
      step++;
      if (step % 64 === 0) currentSongIdx.current++;
    }, 180);
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
    let startInventory = inventory || [];
    
    if (level === 1) {
        if (activeRelic?.id === 'slots') invSize = 10;
        if (activeRelic?.id === 'gaze') startInventory.push({ id: 'relic-potion', percent: 70, x: 0, y: 0 });
        if (activeRelic?.id === 'mark') { currentGold += 60; currentStats.maxHp = Math.floor(currentStats.maxHp * 0.9); currentStats.hp = currentStats.maxHp; }
        if (activeRelic?.id === 'heart') { currentStats.attack = Math.floor(currentStats.attack * 1.1); currentStats.maxHp = Math.floor(currentStats.maxHp * 0.95); currentStats.hp = Math.min(currentStats.hp, currentStats.maxHp); }
    } else {
        // Redefine o tamanho do inventário caso não haja maldição no andar anterior que foi limpa
        if (activeRelic?.id === 'slots') invSize = 10;
    }

    const finalPlayerName = name || nameInput;
    const newState: GameState = {
      ...dungeon, playerName: finalPlayerName, gold: currentGold, level, playerStats: currentStats, items: [], hasKey: false, enemiesKilledInLevel: 0,
      gameStatus: (level === 1 && !stats) ? 'TUTORIAL' as const : 'PLAYING' as const,
      logs: (level === 1 && !stats) ? [`${finalPlayerName} entrou no abismo.`] : [`Descendo para o nível ${level}`],
      inventory: startInventory, inventorySize: invSize, activePet, activeRelic, language: currentLang, hasUsedAltarInLevel: false, tronModeActive: false, tronTimeLeft: 0, tronTrail: [],
      // IMPORTANTE: Bençãos e Maldições são limpas entre andares
      activeAltarEffect: undefined, keyPath: undefined 
    };
    playerPosRef.current = newState.playerPos;
    setGameState(newState);
    saveGame(newState); 
    setMoveQueue([]);
  }, [nameInput, currentLang, saveGame]);

  const handleTileClick = (tx: number, ty: number) => {
    if (!gameState || gameState.gameStatus !== 'PLAYING') return;
    const path = findDungeonPath(playerPosRef.current, { x: tx, y: ty }, gameState.map, gameState.enemies);
    if (path && path.length > 0) setMoveQueue(path);
    else setMoveQueue([]);
  };

  useEffect(() => {
    if (moveQueue.length === 0 || !gameState || gameState.gameStatus !== 'PLAYING') return;
    const moveStep = () => {
      setGameState(prev => {
        if (!prev || prev.gameStatus !== 'PLAYING' || moveQueue.length === 0) return prev;
        const nextPos = moveQueue[0];
        const oldPos = { ...prev.playerPos };
        const updatedPet = prev.activePet ? { ...prev.activePet, pos: oldPos } : undefined;
        const enemy = prev.enemies.find(e => e.x === nextPos.x && e.y === nextPos.y);
        
        if (enemy) { setMoveQueue([]); return { ...prev, gameStatus: 'COMBAT' as const, currentEnemy: enemy } as GameState; }
        
        const chest = prev.chests.find(c => c.x === nextPos.x && c.y === nextPos.y);
        if (chest) { setMoveQueue([]); return { ...prev, gameStatus: 'CHEST_OPEN' as const, chests: prev.chests.filter(c => c.id !== chest.id) } as GameState; }
        
        if (prev.keyPos && nextPos.x === prev.keyPos.x && nextPos.y === prev.keyPos.y && !prev.hasKey) {
          playChime(); setMoveQueue(q => q.slice(1)); playerPosRef.current = nextPos;
          return { ...prev, hasKey: true, logs: [...prev.logs, t.log_key], playerPos: nextPos, activePet: updatedPet } as GameState;
        }
        
        const potion = prev.potions.find(p => p.x === nextPos.x && p.y === nextPos.y);
        if (potion) { setMoveQueue([]); return { ...prev, gameStatus: 'PICKUP_CHOICE' as const, currentPotion: potion, potions: prev.potions.filter(p => p.id !== potion.id) } as GameState; }
        
        if (prev.merchantPos && nextPos.x === prev.merchantPos.x && nextPos.y === prev.merchantPos.y) {
          setMoveQueue([]); playerPosRef.current = nextPos; return { ...prev, gameStatus: 'MERCHANT_SHOP' as const, playerPos: nextPos, activePet: updatedPet } as GameState;
        }
        
        if (prev.altarPos && nextPos.x === prev.altarPos.x && nextPos.y === prev.altarPos.y) {
          setMoveQueue([]); playerPosRef.current = nextPos; return { ...prev, gameStatus: 'ALTAR_INTERACTION' as const, playerPos: nextPos, activePet: updatedPet } as GameState;
        }
        
        if (nextPos.x === prev.stairsPos.x && nextPos.y === prev.stairsPos.y) {
          if (prev.hasKey && prev.enemiesKilledInLevel > 0) { playChime(); setMoveQueue([]); return { ...prev, gameStatus: 'NEXT_LEVEL' as const } as GameState; }
          else { setMoveQueue(q => q.slice(1)); playerPosRef.current = nextPos; return { ...prev, logs: [...prev.logs, t.log_locked], playerPos: nextPos, activePet: updatedPet } as GameState; }
        }
        
        setMoveQueue(q => q.slice(1));
        playerPosRef.current = nextPos;
        let newTrail = prev.tronTrail || [];
        if (prev.tronModeActive) newTrail = [...newTrail, oldPos].slice(-8);
        return { ...prev, playerPos: nextPos, activePet: updatedPet, tronTrail: newTrail } as GameState;
      });
    };
    const speed = gameState.tronModeActive ? 40 : 80;
    const timer = setTimeout(moveStep, speed); 
    return () => clearTimeout(timer);
  }, [moveQueue, gameState?.gameStatus, gameState?.tronModeActive, t]);

  const onCombatFinish = (newStats: EntityStats, win: boolean, goldEarned: number, petHp?: number) => {
    setGameState(prev => {
      if (!prev) return prev;
      if (!win) return { ...prev, gameStatus: 'LOST' as const, lastStats: { ...newStats, hp: 0 } };
      
      const updatedPet = prev.activePet ? { ...prev.activePet, hp: petHp || 0 } : undefined;
      let finalGoldEarned = goldEarned;

      // Bençãos/Relíquias de Ouro
      if (prev.activeRelic?.id === 'bag') finalGoldEarned = Math.floor(finalGoldEarned * 1.05);
      if (prev.activeAltarEffect?.id === 'sacred_greed') finalGoldEarned = Math.floor(finalGoldEarned * 1.5);
      if (prev.activeAltarEffect?.id === 'cursed_greed') finalGoldEarned = Math.floor(finalGoldEarned * 0.5);
      
      let nextStats = { ...newStats };

      // Benção Sangue Afiado (+10% dano permanente no andar após primeira morte)
      if (prev.activeAltarEffect?.id === 'sharp_blood') {
         nextStats.attack = Math.floor(nextStats.attack * 1.1);
      }

      // Benção Sangue Rendido (Cura 30% ao matar)
      if (prev.activeAltarEffect?.id === 'surrendered_blood') {
        nextStats.hp = Math.min(nextStats.maxHp, nextStats.hp + Math.floor(nextStats.maxHp * 0.3));
      }

      // Maldição Tributo de Sangue (Perde HP ao ganhar ouro)
      if (prev.activeAltarEffect?.id === 'blood_tribute' && finalGoldEarned > 0) {
        nextStats.hp = Math.max(1, nextStats.hp - 5);
      }

      playCoinSound();
      const updated: GameState = {
        ...prev, playerStats: nextStats, gold: prev.gold + finalGoldEarned, gameStatus: 'PLAYING' as const,
        enemies: prev.enemies.filter(e => e.id !== prev.currentEnemy?.id),
        enemiesKilledInLevel: prev.enemiesKilledInLevel + 1, activePet: updatedPet, currentEnemy: undefined, keyPath: undefined
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
      
      // Maldição Oferta Negada (Poção desperdiçada)
      if (prev.activeAltarEffect?.id === 'denied_offering') {
        const newInv = [...prev.inventory];
        newInv.splice(idx, 1);
        used = true;
        return { ...prev, activeAltarEffect: undefined, inventory: newInv } as GameState;
      }

      const pot = prev.inventory[idx];
      const stats = { ...prev.playerStats };
      let boost = pot.percent;
      
      // Maldição Sede Profana (-10% eficácia)
      if (prev.activeAltarEffect?.id === 'profane_thirst') boost -= 10;
      
      const heal = Math.floor(stats.maxHp * (boost / 100));
      stats.hp = Math.min(stats.maxHp, stats.hp + heal);
      
      const newInv = [...prev.inventory];
      
      // Benção Oferta Aceita (Não consome a poção)
      if (prev.activeAltarEffect?.id !== 'accepted_offering') {
        newInv.splice(idx, 1);
      }
      
      used = true;
      return { ...prev, playerStats: stats, inventory: newInv, activeAltarEffect: prev.activeAltarEffect?.id === 'accepted_offering' ? undefined : prev.activeAltarEffect } as GameState;
    });
    return used;
  };

  const handleShare = useCallback(() => {
    const shareText = `RogueQuest - Profundidade: ${gameState?.level} do Abismo!`;
    if (navigator.share) {
      navigator.share({ title: 'RogueQuest', text: shareText, url: window.location.href }).catch(() => {});
    } else {
      navigator.clipboard.writeText(`${shareText} ${window.location.href}`);
      alert("Link Copiado!");
    }
  }, [gameState?.level]);

  const startRebirth = () => {
    if (!gameState) return;
    const options = [...RELICS_POOL].sort(() => 0.5 - Math.random()).slice(0, 3);
    setGameState({ ...gameState, gameStatus: 'RELIC_SELECTION' as const, relicOptions: options });
  };

  const handleRelicSelect = (relic: Relic) => {
    const stats = { ...INITIAL_PLAYER_STATS };
    const oldStats = gameState?.lastStats;
    if (relic.id === 'echo' && oldStats) {
        stats.attack += Math.floor(oldStats.attack * 0.2); stats.maxArmor += Math.floor(oldStats.maxArmor * 0.2);
        stats.armor = stats.maxArmor; stats.speed += Math.floor(oldStats.speed * 0.2);
        stats.maxHp += Math.floor(oldStats.maxHp * 0.2); stats.hp = stats.maxHp;
    }
    initLevel(1, stats, 0, nameInput, undefined, relic, []);
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
                  <input type="text" maxLength={12} placeholder={t.hero_placeholder} value={nameInput} onChange={e => setNameInput(e.target.value.toUpperCase())} className="w-full bg-[#0a0a0a] border-2 border-zinc-800 rounded-2xl py-5 px-6 text-center font-mono text-white focus:border-red-600 transition-all outline-none"/>
                  <button onClick={() => { if(!nameInput.trim()) return; startMusic(); initLevel(1, undefined, 0, nameInput); }} disabled={!nameInput.trim()} className="w-full bg-red-800 hover:bg-red-700 py-5 rounded-2xl text-white font-mono font-bold text-xs uppercase tracking-widest transition-all disabled:opacity-30">{t.start_journey}</button>
                  <button onClick={() => window.open('https://t.me/c/2134721525/27', '_blank')} className="w-full bg-zinc-900 border-2 border-zinc-800 text-zinc-500 rounded-2xl py-4 font-mono font-bold text-[9px] uppercase tracking-widest hover:text-white transition-all">Feedback</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {gameState.gameStatus === 'NEXT_LEVEL' && (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center p-8 space-y-12 animate-in fade-in duration-500">
          <div className="text-center space-y-4">
            <h2 className="text-4xl md:text-5xl font-black text-red-600 uppercase tracking-tighter animate-pulse drop-shadow-[0_0_15px_rgba(220,38,38,0.5)]">
              VOCÊ ESTÁ DESCENDO MAIS FUNDO...
            </h2>
            <div className="w-24 h-1 bg-red-900 mx-auto rounded-full" />
          </div>
          <button onClick={() => initLevel(gameState.level + 1, gameState.playerStats, gameState.gold, gameState.playerName, gameState.activePet, gameState.activeRelic, gameState.inventory)} className="px-12 py-6 bg-white text-black font-black rounded-2xl uppercase tracking-[0.2em] text-lg hover:bg-zinc-200 transition-all shadow-[0_0_40px_rgba(255,255,255,0.3)] active:scale-95">Prosseguir</button>
        </div>
      )}

      {gameState.gameStatus !== 'START_SCREEN' && gameState.gameStatus !== 'WON' && gameState.gameStatus !== 'NEXT_LEVEL' && gameState.gameStatus !== 'RELIC_SELECTION' && gameState.map.length > 0 && (
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
            map={gameState.map} theme={gameState.theme} playerPos={gameState.playerPos} enemies={gameState.enemies} chests={gameState.chests} potions={gameState.potions} items={gameState.items} keyPos={gameState.keyPos} merchantPos={gameState.merchantPos} altarPos={gameState.altarPos} hasKey={gameState.hasKey} stairsPos={gameState.stairsPos} activePet={gameState.activePet} keyPath={gameState.keyPath} onTileClick={handleTileClick} tronModeActive={gameState.tronModeActive} tronTrail={gameState.tronTrail} 
            ritualDarkness={gameState.activeAltarEffect?.id === 'ritual_darkness'}
          />
          <HUD level={gameState.level} stats={gameState.playerStats} logs={gameState.logs} hasKey={gameState.hasKey} kills={gameState.enemiesKilledInLevel} gold={gameState.gold} playerName={gameState.playerName} activePet={gameState.activePet} language={currentLang} inventory={gameState.inventory} inventorySize={gameState.inventorySize} activeRelic={gameState.activeRelic} activeAltarEffect={gameState.activeAltarEffect} onUsePotion={usePotionFromInventory} tronModeActive={gameState.tronModeActive} tronTimeLeft={gameState.tronTimeLeft}/>
        </div>
      )}

      {gameState.gameStatus === 'LOST' && (
        <div className="fixed inset-0 z-[120] bg-black flex flex-col items-center justify-center p-6 animate-in fade-in overflow-y-auto backdrop-blur-md">
          <div className="max-w-md w-full text-center space-y-8 py-10">
            <h2 className="text-6xl font-black text-red-600 uppercase tracking-tighter drop-shadow-[0_0_20px_rgba(220,38,38,0.5)]">{t.death_title}</h2>
            <div className="bg-[#0f0f0f] border-2 border-zinc-800 rounded-[2.5rem] p-8 space-y-8 shadow-2xl">
              <div className="space-y-4">
                <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.4em] font-bold border-b border-zinc-800 pb-2">{t.final_stats}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-black/40 p-3 rounded-2xl border border-zinc-800/50 flex flex-col items-center">
                    <span className="text-[9px] font-bold text-zinc-500 uppercase">{t.level}</span>
                    <span className="text-lg font-black text-white">{gameState.level}</span>
                  </div>
                  <div className="bg-black/40 p-3 rounded-2xl border border-zinc-800/50 flex flex-col items-center">
                    <span className="text-[9px] font-bold text-zinc-500 uppercase">{t.hp}</span>
                    <span className="text-lg font-black text-red-500">0</span>
                  </div>
                  <div className="bg-black/40 p-3 rounded-2xl border border-zinc-800/50 flex flex-col items-center">
                    <span className="text-[9px] font-bold text-zinc-500 uppercase">{t.atk}</span>
                    <span className="text-lg font-black text-yellow-500">{gameState.lastStats?.attack || 0}</span>
                  </div>
                  <div className="bg-black/40 p-3 rounded-2xl border border-zinc-800/50 flex flex-col items-center">
                    <span className="text-[9px] font-bold text-zinc-500 uppercase">{t.armor}</span>
                    <span className="text-lg font-black text-blue-500">{gameState.lastStats?.maxArmor || 0}</span>
                  </div>
                  <div className="bg-black/40 p-3 rounded-2xl border border-zinc-800/50 flex flex-col items-center col-span-2">
                    <span className="text-[9px] font-bold text-zinc-500 uppercase">{t.vel}</span>
                    <span className="text-lg font-black text-green-500">{gameState.lastStats?.speed || 0}</span>
                  </div>
                </div>
                {gameState.activeRelic && (
                  <div className="p-4 bg-purple-950/10 border border-purple-500/20 rounded-2xl text-left flex items-center gap-4">
                    <div className="text-purple-500">{React.createElement((Icon as any)[gameState.activeRelic.icon], { width: 24, height: 24 })}</div>
                    <div>
                      <p className="text-[8px] font-black text-purple-400 uppercase tracking-widest">{t.relic_active}</p>
                      <p className="text-[10px] text-white font-bold">{gameState.activeRelic.name}</p>
                    </div>
                  </div>
                )}
                {gameState.activeAltarEffect && (
                  <div className={`p-4 bg-[#111] border rounded-2xl text-left flex items-center gap-4 ${gameState.activeAltarEffect.type === 'BLESSING' ? 'border-yellow-500/20' : 'border-purple-600/20'}`}>
                    <div className={gameState.activeAltarEffect.type === 'BLESSING' ? 'text-yellow-500' : 'text-purple-600'}><Icon.Altar width={24} height={24} /></div>
                    <div>
                      <p className={`text-[8px] font-black uppercase tracking-widest ${gameState.activeAltarEffect.type === 'BLESSING' ? 'text-yellow-500' : 'text-purple-600'}`}>{gameState.activeAltarEffect.type}</p>
                      <p className="text-[10px] text-white font-bold">{t[gameState.activeAltarEffect.nameKey]}</p>
                    </div>
                  </div>
                )}
              </div>
              <button onClick={startRebirth} className="w-full py-5 bg-red-800 hover:bg-red-700 text-white font-black rounded-2xl uppercase tracking-widest text-sm transition-all shadow-xl active:scale-95">{t.rebirth}</button>
            </div>
          </div>
        </div>
      )}

      {gameState.gameStatus === 'COMBAT' && gameState.currentEnemy && <CombatModal playerStats={gameState.playerStats} enemy={gameState.currentEnemy} activePet={gameState.activePet} language={currentLang} altarEffect={gameState.activeAltarEffect} relic={gameState.activeRelic} inventory={gameState.inventory} onAttackSound={playAttackSound} onUsePotion={usePotionFromInventory} onFinish={onCombatFinish} />}
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
      }} language={currentLang} />}
      {gameState.gameStatus === 'MERCHANT_SHOP' && <MerchantShopModal gold={gameState.gold} level={gameState.level} hasPet={!!gameState.activePet} language={currentLang} activeAltarEffect={gameState.activeAltarEffect} onBuyItem={(item) => {
          setGameState(prev => {
            if(!prev) return prev;
            const stats = { ...prev.playerStats };
            stats[item.stat as keyof EntityStats] += item.value;
            if(item.stat === 'maxArmor') stats.armor += item.value;
            return { ...prev, gold: prev.gold - item.price!, playerStats: stats } as GameState;
          });
      }} onBuyPotion={(pot, choice) => {
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
              if (prev.inventory.length >= prev.inventorySize) { setInventoryFullAlert(true); return prev; }
              return { ...prev, gold: prev.gold - pot.price!, inventory: [...prev.inventory, pot] } as GameState;
            });
          }
      }} onRentTron={() => setGameState(prev => prev ? { ...prev, gold: prev.gold - 25, tronModeActive: true, tronTimeLeft: 15, gameStatus: 'PLAYING' as const } as GameState : null)} onBuyPet={(type) => {
          const pet: Pet = { type, name: type, hp: 50, maxHp: 50, pos: { ...playerPosRef.current } };
          setGameState(prev => prev ? { ...prev, gold: prev.gold - 10, activePet: pet } as GameState : null);
      }} onClose={() => setGameState(prev => prev ? { ...prev, gameStatus: 'PLAYING' as const } as GameState : null)} />}
      
      {gameState.gameStatus === 'ALTAR_INTERACTION' && <AltarInteractionModal active={gameState.enemiesKilledInLevel > 0 && !gameState.hasUsedAltarInLevel} language={currentLang} onPray={() => {
          setGameState(prev => {
            if (!prev) return prev;
            const isLucky = Math.random() > 0.4; 
            const pool = isLucky ? BLESSINGS_POOL : CURSES_POOL;
            const effect = pool[Math.floor(Math.random() * pool.length)];
            
            let playerStats = { ...prev.playerStats };
            let keyPath: Position[] | undefined = undefined;
            let inventorySize = prev.inventorySize;

            // Benção: Olhos Abertos
            if (effect.id === 'open_eyes' && prev.keyPos) {
                const path = findDungeonPath(prev.playerPos, prev.keyPos, prev.map, prev.enemies);
                if (path) keyPath = path;
            }

            // Maldição: Menos Peso
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
      }} onClose={() => setGameState(prev => prev ? { ...prev, gameStatus: 'PLAYING' as const } : null)} />}
      
      {gameState.gameStatus === 'ALTAR_RESULT' && gameState.activeAltarEffect && <AltarResultModal effect={gameState.activeAltarEffect} language={currentLang} onClose={() => setGameState(prev => prev ? { ...prev, gameStatus: 'PLAYING' as const } as GameState : null)} />}
      {gameState.gameStatus === 'RELIC_SELECTION' && gameState.relicOptions && <RelicSelectionModal options={gameState.relicOptions} language={currentLang} onSelect={handleRelicSelect} />}
      {gameState.gameStatus === 'TUTORIAL' && <TutorialModal onFinish={() => setGameState({...gameState, gameStatus: 'PLAYING' as const})} language={currentLang} />}
      {gameState.gameStatus === 'PICKUP_CHOICE' && gameState.currentPotion && <PotionPickupModal potion={gameState.currentPotion} language={currentLang} onChoice={(choice) => {
          if (choice === 'use') {
            const stats = { ...gameState.playerStats };
            const heal = Math.floor(stats.maxHp * (gameState.currentPotion!.percent / 100));
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
      }} />}
      {inventoryFullAlert && (
        <div className="fixed inset-0 z-[150] bg-black/80 flex items-center justify-center p-6 backdrop-blur-sm">
          <div className="bg-zinc-900 border-2 border-red-500 p-8 rounded-3xl max-w-xs w-full text-center space-y-4 animate-in zoom-in-95">
             <div className="text-red-500 flex justify-center scale-150 mb-2"><Icon.Backpack /></div>
             <h3 className="text-white font-black uppercase text-sm">Inventário Cheio!</h3>
             <button onClick={() => setInventoryFullAlert(false)} className="w-full py-3 bg-red-600 text-white font-black rounded-xl uppercase text-xs">OK</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
