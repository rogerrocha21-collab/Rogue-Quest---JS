
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GameState, Position, EntityStats, StatChoice, PotionEntity, Pet, Language, Relic } from './types';
import { INITIAL_PLAYER_STATS, MAP_WIDTH, MAP_HEIGHT, TRANSLATIONS, RELICS_POOL, THEME_CONFIG, MAX_LEVELS } from './constants';
import { generateDungeon } from './utils/dungeon';
import GameMap from './components/GameMap';
import HUD from './components/HUD';
import { CombatModal, ChestModal, MerchantShopModal, TutorialModal, PotionPickupModal, RelicSelectionModal } from './components/Modals';
import { Icon } from './components/Icons';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [currentLang, setCurrentLang] = useState<Language>('PT');
  const [moveQueue, setMoveQueue] = useState<Position[]>([]);
  const audioContext = useRef<AudioContext | null>(null);
  const currentSongIdx = useRef<number>(0);
  const isMutedRef = useRef(false);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('rq_save_mobile_v2');
      if (saved) {
        const data = JSON.parse(saved);
        setGameState({ ...data, gameStatus: 'START_SCREEN' });
        setNameInput(data.playerName || '');
        if (data.language) setCurrentLang(data.language);
      } else {
        setGameState({
          playerName: '', gold: 0, level: 1, theme: 'VOID', playerPos: {x:0,y:0},
          playerStats: { ...INITIAL_PLAYER_STATS }, map: [], enemies: [], chests: [],
          potions: [], items: [], hasKey: false, enemiesKilledInLevel: 0,
          stairsPos: {x:0,y:0}, gameStatus: 'START_SCREEN', logs: [],
          tronModeActive: false, tronTimeLeft: 0, tronTrail: [], language: 'PT',
          inventory: [], inventorySize: 5
        });
      }
    } catch (e) {
      console.error("Erro ao carregar save:", e);
      localStorage.removeItem('rq_save_mobile_v2');
      window.location.reload();
    }
  }, []);

  useEffect(() => {
    if (gameState?.tronModeActive) {
      const timer = setInterval(() => {
        setGameState(prev => {
          if (!prev || !prev.tronModeActive) return prev;
          const newTimeLeft = (prev.tronTimeLeft || 0) - 1;
          if (newTimeLeft <= 0) {
            return { ...prev, tronModeActive: false, tronTimeLeft: 0, tronTrail: [] };
          }
          return { ...prev, tronTimeLeft: newTimeLeft };
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [gameState?.tronModeActive]);

  const saveGame = useCallback((state: GameState) => {
    try {
      localStorage.setItem('rq_save_mobile_v2', JSON.stringify({ ...state, language: currentLang }));
    } catch (e) {
      console.warn("Não foi possível salvar o jogo automaticamente.");
    }
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
      setGameState(prev => prev ? { ...prev, gameStatus: 'WON' } : null);
      return;
    }

    const dungeon = generateDungeon(level);
    let currentStats = stats ? { ...stats, armor: stats.maxArmor } : { ...INITIAL_PLAYER_STATS };
    let currentGold = gold ?? 0;
    let invSize = 5;

    if (activeRelic?.id === 'mark') { currentGold += 60; currentStats.hp = Math.floor(currentStats.hp * 0.9); }
    if (activeRelic?.id === 'heart') { currentStats.attack = Math.floor(currentStats.attack * 1.1); currentStats.maxHp = Math.floor(currentStats.maxHp * 0.9); currentStats.hp = Math.min(currentStats.hp, currentStats.maxHp); }
    if (activeRelic?.id === 'slots') invSize = 10;
    if (activeRelic?.id === 'echo' && gameState?.lastStats) {
        currentStats.attack += Math.floor(gameState.lastStats.attack * 0.2);
        currentStats.maxHp += Math.floor(gameState.lastStats.maxHp * 0.2);
        currentStats.hp += Math.floor(gameState.lastStats.maxHp * 0.2);
        currentStats.speed += Math.floor(gameState.lastStats.speed * 0.2);
        currentStats.maxArmor += Math.floor(gameState.lastStats.maxArmor * 0.2);
        currentStats.armor += Math.floor(gameState.lastStats.maxArmor * 0.2);
    }

    const startInv = inventory || [];
    if (activeRelic?.id === 'gaze') startInv.push({ id: 'relic-pot', percent: 70, isSuper: true, x: 0, y: 0 });

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
      gameStatus: (level === 1 && !stats) ? 'TUTORIAL' : 'PLAYING',
      logs: (level === 1 && !stats) ? [`${finalPlayerName} ${TRANSLATIONS[currentLang].log_entry}`] : [`${TRANSLATIONS[currentLang].descending} ${level}`],
      inventory: startInv,
      inventorySize: invSize,
      activePet,
      activeRelic,
      language: currentLang,
      lastStats: gameState?.lastStats
    };
    
    setGameState(newState);
    saveGame(newState); 
    setMoveQueue([]);
  }, [nameInput, currentLang, gameState?.lastStats, saveGame]);

  const findPath = (start: Position, end: Position): Position[] | null => {
    if (!gameState || !gameState.map || gameState.map.length === 0) return null;
    const { map, enemies } = gameState;
    const queue: { pos: Position; path: Position[] }[] = [{ pos: start, path: [] }];
    const visited = new Set<string>();
    visited.add(`${start.x},${start.y}`);

    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) break;
      const { pos, path } = item;
      
      if (pos.x === end.x && pos.y === end.y) return path;

      for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
        const nx = pos.x + dx;
        const ny = pos.y + dy;
        const key = `${nx},${ny}`;

        if (nx >= 0 && nx < MAP_WIDTH && ny >= 0 && ny < MAP_HEIGHT && 
            map[ny] && map[ny][nx] !== 'WALL' && !visited.has(key)) {
          
          const hasEnemy = enemies.some(e => e.x === nx && e.y === ny);
          if (hasEnemy && (nx !== end.x || ny !== end.y)) continue;

          visited.add(key);
          queue.push({ pos: { x: nx, y: ny }, path: [...path, { x: nx, y: ny }] });
        }
      }
    }
    return null;
  };

  const handleMove = useCallback((dx: number, dy: number) => {
    setGameState(prev => {
      if (!prev || prev.gameStatus !== 'PLAYING') return prev;
      const nx = prev.playerPos.x + dx;
      const ny = prev.playerPos.y + dy;

      if (nx < 0 || nx >= MAP_WIDTH || ny < 0 || ny >= MAP_HEIGHT || !prev.map[ny] || prev.map[ny][nx] === 'WALL') {
        setMoveQueue([]);
        return prev;
      }

      const enemy = prev.enemies.find(e => e.x === nx && e.y === ny);
      if (enemy) {
        setMoveQueue([]);
        return { ...prev, gameStatus: 'COMBAT', currentEnemy: enemy };
      }

      const chest = prev.chests.find(c => c.x === nx && c.y === ny);
      if (chest) {
        setMoveQueue([]);
        return { ...prev, gameStatus: 'CHEST_OPEN', chests: prev.chests.filter(c => c.id !== chest.id) };
      }

      const potion = prev.potions.find(p => p.x === nx && p.y === ny);
      if (potion) {
        setMoveQueue([]);
        return { ...prev, gameStatus: 'PICKUP_CHOICE', currentPotion: potion, potions: prev.potions.filter(p => p.id !== potion.id) };
      }

      if (prev.keyPos && nx === prev.keyPos.x && ny === prev.keyPos.y && !prev.hasKey) {
        playChime();
        return { ...prev, hasKey: true, logs: [...prev.logs, TRANSLATIONS[currentLang].log_key], playerPos: { x: nx, y: ny } };
      }

      if (prev.merchantPos && nx === prev.merchantPos.x && ny === prev.merchantPos.y) {
        setMoveQueue([]);
        return { ...prev, gameStatus: 'MERCHANT_SHOP', playerPos: { x: nx, y: ny } };
      }

      if (nx === prev.stairsPos.x && ny === prev.stairsPos.y) {
        setMoveQueue([]);
        if (prev.hasKey && prev.enemiesKilledInLevel > 0) {
          playChime();
          return { ...prev, gameStatus: 'RELIC_SELECTION', relicOptions: RELICS_POOL.sort(() => 0.5 - Math.random()).slice(0, 3) };
        } else {
          return { ...prev, logs: [...prev.logs, TRANSLATIONS[currentLang].log_locked], playerPos: { x: nx, y: ny } };
        }
      }

      const newPos = { x: nx, y: ny };
      let newTrail = prev.tronTrail || [];
      if (prev.tronModeActive) {
        newTrail = [...newTrail, prev.playerPos];
      }

      let newPet = prev.activePet;
      if (newPet) {
        newPet = { ...newPet, pos: prev.playerPos };
      }

      return { ...prev, playerPos: newPos, tronTrail: newTrail, activePet: newPet };
    });
  }, [currentLang]);

  const handleTileClick = (tx: number, ty: number) => {
    if (!gameState || gameState.gameStatus !== 'PLAYING') return;
    const path = findPath(gameState.playerPos, { x: tx, y: ty });
    if (path && path.length > 0) {
      setMoveQueue(path);
    }
  };

  useEffect(() => {
    if (moveQueue.length > 0 && gameState?.gameStatus === 'PLAYING') {
      const timer = setTimeout(() => {
        const next = moveQueue[0];
        if (!next) {
          setMoveQueue([]);
          return;
        }
        const dx = next.x - gameState.playerPos.x;
        const dy = next.y - gameState.playerPos.y;
        
        if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1 && (Math.abs(dx) + Math.abs(dy) > 0)) {
           handleMove(dx, dy);
           setMoveQueue(prev => prev.slice(1));
        } else {
           setMoveQueue([]);
        }
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [moveQueue, gameState?.playerPos, gameState?.gameStatus, handleMove]);

  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if (gameState?.gameStatus !== 'PLAYING') return;
      if (['ArrowUp', 'w', 'W'].includes(e.key)) { setMoveQueue([]); handleMove(0, -1); }
      if (['ArrowDown', 's', 'S'].includes(e.key)) { setMoveQueue([]); handleMove(0, 1); }
      if (['ArrowLeft', 'a', 'A'].includes(e.key)) { setMoveQueue([]); handleMove(-1, 0); }
      if (['ArrowRight', 'd', 'D'].includes(e.key)) { setMoveQueue([]); handleMove(1, 0); }
    };
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, [gameState?.gameStatus, handleMove]);

  const onCombatFinish = (newStats: EntityStats, win: boolean, goldEarned: number, petHp?: number) => {
    setGameState(prev => {
      if (!prev) return prev;
      if (!win) return { ...prev, gameStatus: 'LOST', lastStats: prev.playerStats };
      
      const updatedPet = prev.activePet ? { ...prev.activePet, hp: petHp || 0 } : undefined;
      let finalGold = prev.gold + goldEarned;
      if (prev.activeRelic?.id === 'bag') finalGold += Math.floor(goldEarned * 0.05);
      if (prev.activeRelic?.id === 'coin' && Math.random() < 0.05) finalGold += 10;
      
      let nextStats = { ...newStats };
      if (prev.activeRelic?.id === 'vamp') {
        nextStats.hp = Math.min(nextStats.maxHp, nextStats.hp + Math.floor(nextStats.maxHp * 0.15));
      }

      playCoinSound();
      return {
        ...prev,
        playerStats: nextStats,
        gold: finalGold,
        gameStatus: 'PLAYING',
        enemies: prev.enemies.filter(e => e.id !== prev.currentEnemy?.id),
        enemiesKilledInLevel: prev.enemiesKilledInLevel + 1,
        activePet: updatedPet,
        currentEnemy: undefined
      };
    });
  };

  const onChestChoice = (choice: StatChoice) => {
    setGameState(prev => {
      if (!prev) return prev;
      const stats = { ...prev.playerStats };
      if (choice === 'Ataque') stats.attack += 5;
      if (choice === 'Armadura') { stats.maxArmor += 3; stats.armor += 3; }
      if (choice === 'Velocidade') stats.speed += 4;
      return { ...prev, playerStats: stats, gameStatus: 'PLAYING' };
    });
  };

  const onPotionPickup = (choice: 'use' | 'store') => {
    setGameState(prev => {
      if (!prev || !prev.currentPotion) return prev;
      if (choice === 'use') {
        const stats = { ...prev.playerStats };
        const heal = Math.floor(stats.maxHp * (prev.currentPotion.percent / 100));
        stats.hp = Math.min(stats.maxHp, stats.hp + heal);
        return { ...prev, playerStats: stats, gameStatus: 'PLAYING', currentPotion: undefined };
      } else {
        if (prev.inventory.length < prev.inventorySize) {
          return { ...prev, inventory: [...prev.inventory, prev.currentPotion], gameStatus: 'PLAYING', currentPotion: undefined };
        } else {
          alert(TRANSLATIONS[currentLang].inventory_full);
          return prev;
        }
      }
    });
  };

  const usePotionFromInventory = (idx: number) => {
    setGameState(prev => {
      if (!prev || !prev.inventory[idx]) return prev;
      const pot = prev.inventory[idx];
      const stats = { ...prev.playerStats };
      let boost = pot.percent;
      if (prev.activeRelic?.id === 'alch') boost += 5;
      const heal = Math.floor(stats.maxHp * (boost / 100));
      stats.hp = Math.min(stats.maxHp, stats.hp + heal);
      
      const newInv = [...prev.inventory];
      if (prev.activeRelic?.id !== 'save' || Math.random() > 0.05) {
          newInv.splice(idx, 1);
      }
      return { ...prev, playerStats: stats, inventory: newInv };
    });
  };

  const onRelicSelect = (relic: Relic) => {
    if (!gameState) return;
    initLevel(gameState.level + 1, gameState.playerStats, gameState.gold, gameState.playerName, gameState.activePet, relic, gameState.inventory);
  };

  if (!gameState) return <div className="bg-black min-h-screen" />;

  return (
    <div className="bg-black min-h-screen text-zinc-300 font-sans selection:bg-red-500/30 overflow-x-hidden">
      {gameState.gameStatus === 'START_SCREEN' && (
        <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center p-8 bg-black">
          <div className="max-w-md w-full text-center space-y-8 animate-in fade-in zoom-in-95 duration-700">
            <div className="space-y-2 mb-12">
              <h1 className="text-6xl md:text-7xl font-sans font-black tracking-tighter flex items-center justify-center">
                <span className="text-white">ROGUE</span>
                <span className="text-red-800">QUEST</span>
              </h1>
              <p className="text-zinc-500 font-mono text-[10px] tracking-[0.8em] font-bold uppercase mt-2 pl-[0.8em]">O ABISMO INFINITO</p>
            </div>
            
            <div className="bg-[#0f0f0f] border border-zinc-800 rounded-[2.5rem] p-10 space-y-8 shadow-2xl">
              <div className="space-y-6">
                <div className="relative group">
                  <input 
                    type="text" 
                    maxLength={12} 
                    placeholder={t.hero_placeholder}
                    value={nameInput}
                    onChange={e => setNameInput(e.target.value.toUpperCase())}
                    className="w-full bg-[#0a0a0a] border-2 border-zinc-800 rounded-2xl py-5 px-6 text-center text-base font-mono text-white placeholder-zinc-700 focus:border-red-600 transition-all outline-none"
                  />
                  <div className="absolute inset-0 border-2 border-transparent pointer-events-none rounded-2xl group-focus-within:border-red-600/50" />
                </div>

                <div className="space-y-4">
                  <button 
                    onClick={() => { startMusic(); initLevel(1, undefined, 0, nameInput); }}
                    disabled={!nameInput.trim()}
                    className="w-full bg-red-800 hover:bg-red-700 py-5 rounded-2xl text-white font-mono font-bold text-xs uppercase tracking-widest shadow-xl transition-all transform active:scale-95 disabled:opacity-30 disabled:grayscale"
                  >
                    {gameState.level > 1 ? t.continue_journey : t.start_journey}
                  </button>
                  
                  <button 
                    className="w-full bg-[#1e1e1e] hover:bg-[#2a2a2a] py-5 rounded-2xl text-zinc-500 font-mono font-bold text-[10px] uppercase tracking-widest transition-all"
                  >
                    {t.feedback}
                  </button>
                </div>
              </div>

              <div className="flex justify-center gap-8 pt-4 border-t border-zinc-900">
                <button onClick={() => setCurrentLang('PT')} className="relative flex flex-col items-center group">
                  <div className={`transition-transform hover:scale-110 ${currentLang === 'PT' ? 'opacity-100 scale-110' : 'opacity-40 grayscale group-hover:grayscale-0 group-hover:opacity-80'}`}>
                    <Icon.FlagBR />
                  </div>
                  {currentLang === 'PT' && <div className="absolute -bottom-3 w-6 h-1 bg-red-600 rounded-full" />}
                </button>
                <button onClick={() => setCurrentLang('EN')} className="relative flex flex-col items-center group">
                  <div className={`transition-transform hover:scale-110 ${currentLang === 'EN' ? 'opacity-100 scale-110' : 'opacity-40 grayscale group-hover:grayscale-0 group-hover:opacity-80'}`}>
                    <Icon.FlagUS />
                  </div>
                  {currentLang === 'EN' && <div className="absolute -bottom-3 w-6 h-1 bg-red-600 rounded-full" />}
                </button>
                <button onClick={() => setCurrentLang('ES')} className="relative flex flex-col items-center group">
                  <div className={`transition-transform hover:scale-110 ${currentLang === 'ES' ? 'opacity-100 scale-110' : 'opacity-40 grayscale group-hover:grayscale-0 group-hover:opacity-80'}`}>
                    <Icon.FlagES />
                  </div>
                  {currentLang === 'ES' && <div className="absolute -bottom-3 w-6 h-1 bg-red-600 rounded-full" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Interface Principal do Jogo */}
      {gameState.gameStatus !== 'START_SCREEN' && gameState.gameStatus !== 'WON' && gameState.map.length > 0 && (
        <div className="max-w-[480px] mx-auto p-4 flex flex-col gap-4 min-h-screen">
          <header className="flex justify-between items-start py-4 px-1 border-b border-zinc-900 mb-2">
            <div className="flex flex-col">
              <h2 className="text-2xl font-black tracking-tighter uppercase flex leading-none">
                <span className="text-white">ROGUE</span>
                <span className="text-red-800">QUEST</span>
              </h2>
              <p className="text-[9px] font-mono text-zinc-500 font-bold uppercase tracking-[0.2em] mt-1">
                {t[THEME_CONFIG[gameState.theme].nameKey]} – {t.level} {gameState.level}
              </p>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => window.open('https://t.me/+rzUhHnyeeSM1MDNh', '_blank')}
                className="w-10 h-10 bg-zinc-900/80 border border-zinc-800 rounded-xl flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
              >
                <Icon.Users />
              </button>
              <button onClick={handleShare} className="w-10 h-10 bg-zinc-900/80 border border-zinc-800 rounded-xl flex items-center justify-center text-zinc-400 hover:text-white transition-colors">
                <Icon.Share />
              </button>
              <button onClick={() => setIsMuted(!isMuted)} className={`w-10 h-10 bg-zinc-900/80 border border-zinc-800 rounded-xl flex items-center justify-center transition-colors ${isMuted ? 'text-zinc-600' : 'text-red-800'}`}>
                {isMuted ? <Icon.VolumeX /> : <Icon.Volume2 />}
              </button>
            </div>
          </header>

          <GameMap 
            map={gameState.map}
            theme={gameState.theme}
            playerPos={gameState.playerPos}
            enemies={gameState.enemies}
            chests={gameState.chests}
            potions={gameState.potions}
            items={gameState.items}
            keyPos={gameState.keyPos}
            merchantPos={gameState.merchantPos}
            hasKey={gameState.hasKey}
            stairsPos={gameState.stairsPos}
            tronModeActive={gameState.tronModeActive}
            tronTrail={gameState.tronTrail}
            activePet={gameState.activePet}
            onTileClick={handleTileClick}
          />

          <HUD 
            level={gameState.level}
            stats={gameState.playerStats}
            logs={gameState.logs}
            hasKey={gameState.hasKey}
            kills={gameState.enemiesKilledInLevel}
            gold={gameState.gold}
            playerName={gameState.playerName}
            activePet={gameState.activePet}
            language={currentLang}
            inventory={gameState.inventory}
            inventorySize={gameState.inventorySize}
            activeRelic={gameState.activeRelic}
            onUsePotion={usePotionFromInventory}
          />
        </div>
      )}

      {/* Modais */}
      {gameState.gameStatus === 'TUTORIAL' && <TutorialModal onFinish={() => setGameState({ ...gameState, gameStatus: 'PLAYING' })} language={currentLang} />}
      {gameState.gameStatus === 'COMBAT' && gameState.currentEnemy && (
        <CombatModal 
          playerStats={gameState.playerStats}
          enemy={gameState.currentEnemy}
          activePet={gameState.activePet}
          language={currentLang}
          onAttackSound={playAttackSound}
          onFinish={onCombatFinish}
        />
      )}
      {gameState.gameStatus === 'CHEST_OPEN' && <ChestModal onChoice={onChestChoice} language={currentLang} />}
      {gameState.gameStatus === 'PICKUP_CHOICE' && gameState.currentPotion && (
        <PotionPickupModal potion={gameState.currentPotion} language={currentLang} onChoice={onPotionPickup} />
      )}
      {gameState.gameStatus === 'RELIC_SELECTION' && gameState.relicOptions && (
        <RelicSelectionModal options={gameState.relicOptions} language={currentLang} onSelect={onRelicSelect} />
      )}
      {gameState.gameStatus === 'MERCHANT_SHOP' && (
        <MerchantShopModal 
            gold={gameState.gold} 
            level={gameState.level} 
            hasPet={!!gameState.activePet}
            language={currentLang}
            onBuyItem={(item) => {
                setGameState(prev => {
                    if (!prev || prev.gold < (item.price || 0)) return prev;
                    const stats = { ...prev.playerStats };
                    const statKey = item.stat;
                    (stats as any)[statKey] += item.value;
                    if (statKey === 'maxArmor') stats.armor += item.value;
                    if (statKey === 'maxHp') stats.hp += item.value;
                    return { ...prev, gold: prev.gold - (item.price || 0), playerStats: stats, logs: [...prev.logs, t.bought_item] };
                });
            }}
            onBuyPotion={(pot, choice) => {
                setGameState(prev => {
                    if (!prev || prev.gold < (pot.price || 0)) return prev;
                    const gold = prev.gold - (pot.price || 0);
                    if (choice === 'use') {
                        const stats = { ...prev.playerStats };
                        stats.hp = Math.min(stats.maxHp, stats.hp + Math.floor(stats.maxHp * (pot.percent / 100)));
                        return { ...prev, gold, playerStats: stats, logs: [...prev.logs, t.bought_potion] };
                    } else {
                        if (prev.inventory.length < prev.inventorySize) {
                            return { ...prev, gold, inventory: [...prev.inventory, pot], logs: [...prev.logs, t.bought_potion] };
                        } else { alert(t.inventory_full); return prev; }
                    }
                });
            }}
            onRentTron={() => {
                setGameState(prev => {
                    if (!prev || prev.gold < 25) return prev;
                    return { ...prev, gold: prev.gold - 25, tronModeActive: true, tronTimeLeft: 15, tronTrail: [], logs: [...prev.logs, t.tron_active] };
                });
            }}
            onBuyPet={(type) => {
                setGameState(prev => {
                    if (!prev) return prev;
                    const cost = type === 'CORUJA' ? 12 : 10;
                    if (prev.gold < cost) return prev;
                    const pet: Pet = { type, name: type, hp: 50, maxHp: 50, pos: prev.playerPos };
                    return { ...prev, gold: prev.gold - cost, activePet: pet, logs: [...prev.logs, t.bought_pet] };
                });
            }}
            onClose={() => setGameState({ ...gameState, gameStatus: 'PLAYING' })}
        />
      )}
      {gameState.gameStatus === 'LOST' && (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center p-8 space-y-8 animate-in fade-in">
          <div className="text-center space-y-2">
            <h2 className="text-6xl font-black text-red-600 tracking-tighter uppercase">{t.death_title}</h2>
            <p className="text-zinc-500 font-bold text-xs uppercase tracking-widest">{t.death_desc}</p>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-3xl w-full max-w-xs space-y-4">
            <h3 className="text-[10px] font-black text-zinc-600 uppercase text-center">{t.final_stats}</h3>
            <div className="grid grid-cols-2 gap-4">
               <div className="text-center"><p className="text-[8px] text-zinc-500 uppercase">{t.level}</p><p className="text-xl font-black text-white">{gameState.level}</p></div>
               <div className="text-center"><p className="text-[8px] text-zinc-500 uppercase">{t.hp}</p><p className="text-lg font-black text-red-500">{gameState.playerStats.hp}/{gameState.playerStats.maxHp}</p></div>
               <div className="text-center"><p className="text-[8px] text-zinc-500 uppercase">{t.atk}</p><p className="text-lg font-black text-yellow-500">{gameState.playerStats.attack}</p></div>
               <div className="text-center"><p className="text-[8px] text-zinc-500 uppercase">{t.armor}</p><p className="text-lg font-black text-blue-500">{gameState.playerStats.maxArmor}</p></div>
               <div className="text-center"><p className="text-[8px] text-zinc-500 uppercase">{t.vel}</p><p className="text-lg font-black text-green-500">{gameState.playerStats.speed}</p></div>
               <div className="text-center"><p className="text-[8px] text-zinc-500 uppercase">OURO</p><p className="text-lg font-black text-yellow-400">{gameState.gold}</p></div>
            </div>
            {gameState.activeRelic && (
              <div className="pt-4 border-t border-zinc-800 text-center">
                <p className="text-[8px] text-zinc-500 uppercase mb-1">{t.relic_active}</p>
                <p className="text-[10px] font-black text-purple-400 uppercase">{gameState.activeRelic.name}</p>
              </div>
            )}
          </div>
          <button 
            onClick={() => { localStorage.removeItem('rq_save_mobile_v2'); window.location.reload(); }}
            className="w-full max-w-xs py-5 bg-zinc-100 text-black font-black rounded-2xl uppercase tracking-widest text-sm hover:bg-white transition-all transform active:scale-95"
          >
            {t.rebirth}
          </button>
        </div>
      )}
      {gameState.gameStatus === 'WON' && (
        <div className="fixed inset-0 z-[120] bg-black flex flex-col items-center justify-center p-8 space-y-8 animate-in fade-in">
          <div className="text-center space-y-2">
            <h2 className="text-6xl font-black text-green-500 tracking-tighter uppercase">{t.victory}</h2>
            <p className="text-zinc-500 font-bold text-xs uppercase tracking-widest">VOCÊ CONQUISTOU O ABISMO</p>
          </div>
          <div className="bg-zinc-900/50 border border-green-500/30 p-8 rounded-[2.5rem] w-full max-w-sm text-center">
            <p className="text-white font-mono text-sm leading-relaxed mb-6">Herói, você desceu até as profundezas mais remotas e sobreviveu. Seu nome será gravado nas paredes do tempo.</p>
            <button 
              onClick={() => { localStorage.removeItem('rq_save_mobile_v2'); window.location.reload(); }}
              className="w-full py-5 bg-green-600 text-white font-black rounded-2xl uppercase tracking-widest text-sm hover:bg-green-500 transition-all"
            >
              NOVA JORNADA
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
