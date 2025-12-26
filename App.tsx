import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GameState, Position, EntityStats, StatChoice, LevelTheme, ItemEntity, PotionEntity, Pet, Language } from './types';
import { INITIAL_PLAYER_STATS, MAX_LEVELS, MAP_WIDTH, MAP_HEIGHT, THEME_CONFIG, TRANSLATIONS } from './constants';
import { generateDungeon } from './utils/dungeon';
import GameMap from './components/GameMap';
import HUD from './components/HUD';
import { CombatModal, ChestModal, MerchantShopModal, TutorialModal } from './components/Modals';
import { Icon } from './components/Icons';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [currentLang, setCurrentLang] = useState<Language>('PT');
  const audioContext = useRef<AudioContext | null>(null);
  const audioInterval = useRef<any>(null);
  const currentSongIdx = useRef<number>(0);
  const isMutedRef = useRef(false);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    const saved = localStorage.getItem('rq_save_mobile_v2');
    if (saved) {
      const data = JSON.parse(saved);
      setGameState({ ...data, gameStatus: 'START_SCREEN' });
      setNameInput(data.playerName || '');
      if (data.language) setCurrentLang(data.language);
    } else {
      setGameState({
        playerName: '', gold: 0, level: 1, theme: 'VOID', playerPos: {x:0,y:0},
        playerStats: INITIAL_PLAYER_STATS, map: [], enemies: [], chests: [],
        potions: [], items: [], hasKey: false, enemiesKilledInLevel: 0,
        stairsPos: {x:0,y:0}, gameStatus: 'START_SCREEN', logs: [],
        tronModeActive: false, tronTimeLeft: 0, tronTrail: [], language: 'PT'
      });
    }
  }, []);

  // Timer do Cavalo (Tron Mode)
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

  const saveGame = (state: GameState) => {
    localStorage.setItem('rq_save_mobile_v2', JSON.stringify({ ...state, language: currentLang }));
  };

  const t = TRANSLATIONS[currentLang];

  const handleShare = async () => {
    const shareText = `𝗥𝗼𝗴𝘂𝗲 𝗤𝘂𝗲𝘀𝘁:\n"Exploração sombria em estilo roguelike ASCII: desça masmorras, lute, morra, evolua e tente ir mais fundo a cada run."\n\nhttps://t.me/RogueQuest_bot`;
    
    if (navigator.share) {
      try {
        await navigator.share({ text: shareText });
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') {
          console.error('Erro ao compartilhar:', err);
        }
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareText);
        alert("Mensagem copiada para a área de transferência!");
      } catch (e) {
        window.open('https://t.me/RogueQuest_bot', '_blank');
      }
    }
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

  const startMusic = () => {
    if (audioContext.current) return;
    audioContext.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    const tracks = [[261.63, 311.13, 349.23, 392.00, 466.16], [196.00, 220.00, 246.94, 261.63, 293.66], [329.63, 392.00, 440.00, 523.25, 659.25]];
    let step = 0;
    currentSongIdx.current = Math.floor(Math.random() * tracks.length);
    const playStep = () => {
      if (isMutedRef.current) return;
      const ctx = audioContext.current;
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const track = tracks[currentSongIdx.current % tracks.length];
      osc.frequency.setValueAtTime(track[step % track.length], ctx.currentTime);
      osc.type = step % 8 < 4 ? 'sawtooth' : 'square';
      gain.gain.setValueAtTime(0.006, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + 0.15);
      step++;
      if (step % 64 === 0) currentSongIdx.current++;
    };
    audioInterval.current = setInterval(playStep, 150);
  };

  const initLevel = useCallback((level: number, stats?: EntityStats, gold?: number, name?: string, activePet?: Pet) => {
    const dungeon = generateDungeon(level);
    const currentStats = stats ? { ...stats, armor: stats.maxArmor } : { ...INITIAL_PLAYER_STATS };
    const currentGold = gold ?? 0;
    const currentName = name || nameInput || 'Herói';
    const updatedPet = activePet ? { ...activePet, pos: { x: dungeon.playerPos.x - 1, y: dungeon.playerPos.y } } : undefined;
    
    // Pegando as traduções atuais para os logs iniciais
    const currentT = TRANSLATIONS[currentLang];
    const initialLog = level === 1 
      ? `${currentName} ${currentT.log_entry}` 
      : `${currentT.log_depth} ${level}.`;

    const newState: GameState = {
      ...dungeon, playerName: currentName, gold: currentGold, level, playerStats: currentStats,
      hasKey: false, enemiesKilledInLevel: 0, gameStatus: 'PLAYING', logs: [initialLog],
      items: [], tronModeActive: false, tronTimeLeft: 0, tronTrail: [], activePet: updatedPet, language: currentLang
    };
    setGameState(newState);
    saveGame(newState);
  }, [nameInput, currentLang]);

  const restartGame = () => {
    localStorage.removeItem('rq_save_mobile_v2');
    initLevel(1, INITIAL_PLAYER_STATS, 0, gameState?.playerName);
  };

  const movePlayer = (dx: number, dy: number) => {
    if (!gameState || gameState.gameStatus !== 'PLAYING') return;
    const { playerPos, map, enemies, potions, keyPos, merchantPos, hasKey, stairsPos, enemiesKilledInLevel, chests, tronModeActive, tronTrail = [], activePet } = gameState;
    const nx = playerPos.x + dx; const ny = playerPos.y + dy;
    if (nx < 0 || nx >= MAP_WIDTH || ny < 0 || ny >= MAP_HEIGHT || map[ny][nx] === 'WALL') return;
    
    const enemy = enemies.find(e => e.x === nx && e.y === ny);
    if (enemy) { 
        if (tronModeActive) {
            // Atropelar inimigo
            const goldGain = Math.floor(Math.random() * 8) + 12; playCoinSound();
            setGameState({ 
              ...gameState, 
              gold: gameState.gold + goldGain, 
              enemies: enemies.filter(e => e.id !== enemy.id), 
              enemiesKilledInLevel: enemiesKilledInLevel + 1, 
              playerPos: { x: nx, y: ny }, 
              tronTrail: [...tronTrail, playerPos], 
              activePet: activePet ? { ...activePet, pos: playerPos } : undefined,
              logs: [...gameState.logs, `${t.log_trampled} +${goldGain}G`]
            });
            return;
        } else { setGameState({ ...gameState, gameStatus: 'COMBAT', currentEnemy: enemy }); return; }
    }
    if (keyPos && nx === keyPos.x && ny === keyPos.y && !hasKey) {
        playChime(); setGameState({ ...gameState, hasKey: true, logs: [...gameState.logs, t.log_key], playerPos: { x: nx, y: ny }, activePet: activePet ? { ...activePet, pos: playerPos } : undefined }); return;
    }
    if (merchantPos && nx === merchantPos.x && ny === merchantPos.y) {
        setGameState({ ...gameState, gameStatus: 'MERCHANT_SHOP', playerPos: { x: nx, y: ny }, activePet: activePet ? { ...activePet, pos: playerPos } : undefined }); return;
    }
    const pot = potions.find(p => p.x === nx && p.y === ny);
    if (pot) {
        const heal = Math.floor(gameState.playerStats.maxHp * 0.3); setGameState({ ...gameState, playerStats: { ...gameState.playerStats, hp: Math.min(gameState.playerStats.maxHp, gameState.playerStats.hp + heal) }, potions: potions.filter(p => p.id !== pot.id), logs: [...gameState.logs, `Potion: +${heal} HP`], playerPos: { x: nx, y: ny }, activePet: activePet ? { ...activePet, pos: playerPos } : undefined }); return;
    }
    const chest = chests.find(c => c.x === nx && c.y === ny);
    if (chest) { setGameState({ ...gameState, gameStatus: 'CHEST_OPEN', playerPos: { x: nx, y: ny }, chests: chests.filter(c => c.id !== chest.id), activePet: activePet ? { ...activePet, pos: playerPos } : undefined }); return; }
    if (nx === stairsPos.x && ny === stairsPos.y) {
        if (hasKey && enemiesKilledInLevel >= 1) {
            if (gameState.level >= MAX_LEVELS) setGameState({ ...gameState, gameStatus: 'WON' });
            else setGameState({ ...gameState, gameStatus: 'NEXT_LEVEL' });
        } else { setGameState({ ...gameState, logs: [...gameState.logs, t.log_locked], playerPos: { x: nx, y: ny } }); } return;
    }
    setGameState({ ...gameState, playerPos: { x: nx, y: ny }, tronTrail: tronModeActive ? [...tronTrail, playerPos] : tronTrail, activePet: activePet ? { ...activePet, pos: playerPos } : undefined });
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
        <p className="text-zinc-600 mb-12 tracking-[0.4em] uppercase text-[10px]">{t.abyss}</p>
        <div className="bg-zinc-900/40 p-8 rounded-[2rem] border border-zinc-800 w-full max-w-xs backdrop-blur-md shadow-2xl space-y-4">
          <input type="text" placeholder={t.hero_placeholder} value={nameInput} onChange={e => setNameInput(e.target.value.toUpperCase())}
            className="w-full bg-black border-2 border-zinc-800 rounded-xl p-4 text-white text-center font-bold focus:border-red-600 outline-none text-sm transition-all" />
          {hasSavedGame && (
            <button onClick={() => { startMusic(); setGameState(prev => prev ? { ...prev, gameStatus: 'PLAYING' } : null); }}
              className="w-full py-4 bg-green-600 hover:bg-green-500 text-white font-black rounded-xl transition-all shadow-lg shadow-green-900/20 text-xs uppercase tracking-widest">
              {t.continue_journey} ({t.level} {gameState.level})
            </button>
          )}
          <button onClick={() => { startMusic(); setGameState(prev => prev ? { ...prev, gameStatus: 'TUTORIAL' } : null); }}
            className="w-full py-4 bg-red-600 hover:bg-red-500 text-white font-black rounded-xl transition-all shadow-lg shadow-red-900/20 text-xs uppercase tracking-widest disabled:opacity-50"
            disabled={!nameInput.trim()}>
            {hasSavedGame ? t.new_game : t.start_journey}
          </button>
          <a href="https://t.me/rurocoli" target="_blank" rel="noopener noreferrer" className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold rounded-xl transition-all text-[10px] uppercase tracking-widest flex items-center justify-center">
            {t.feedback}
          </a>
          <div className="flex justify-center gap-6 mt-4 pt-4 border-t border-zinc-800">
            <button onClick={() => setCurrentLang('PT')} className={`text-2xl transition-transform ${currentLang === 'PT' ? 'scale-125 border-b-2 border-red-600' : 'opacity-40 hover:opacity-100'}`} title="Português">🇧🇷</button>
            <button onClick={() => setCurrentLang('EN')} className={`text-2xl transition-transform ${currentLang === 'EN' ? 'scale-125 border-b-2 border-red-600' : 'opacity-40 hover:opacity-100'}`} title="English">🇺🇸</button>
            <button onClick={() => setCurrentLang('ES')} className={`text-2xl transition-transform ${currentLang === 'ES' ? 'scale-125 border-b-2 border-red-600' : 'opacity-40 hover:opacity-100'}`} title="Español">🇪🇸</button>
          </div>
        </div>
      </div>
    );
  }

  if (gameState?.gameStatus === 'TUTORIAL') return <TutorialModal onFinish={() => initLevel(1, INITIAL_PLAYER_STATS, 0, nameInput)} language={currentLang} />;
  if (!gameState || !gameState.map.length) return null;
  const currentTheme = THEME_CONFIG[gameState.theme];

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-100 flex flex-col items-center p-4 font-mono select-none overflow-x-hidden relative pb-10">
      <div className="max-w-md w-full flex flex-col gap-4 animate-in fade-in duration-700">
        <header className="flex justify-between items-center border-b border-zinc-900 pb-3">
          <div className="flex flex-col">
            <h1 className="text-2xl font-black text-white tracking-tighter uppercase leading-none">ROGUE<span className="text-red-600">QUEST</span></h1>
            <h2 className="text-zinc-500 text-[9px] font-bold uppercase tracking-[0.2em] mt-1.5">{t[currentTheme.nameKey]} — {t.level} {gameState.level}</h2>
          </div>
          <div className="text-right flex items-center gap-2">
            <button onClick={() => window.open('https://t.me/+rzUhHnyeeSM1MDNh', '_blank')} className="p-2.5 bg-zinc-900/50 hover:bg-zinc-800 rounded-xl border border-zinc-800 transition-colors text-zinc-400 hover:text-white" title="Comunidade"><Icon.Users /></button>
            <button onClick={handleShare} className="p-2.5 bg-zinc-900/50 hover:bg-zinc-800 rounded-xl border border-zinc-800 transition-colors text-zinc-400 hover:text-white"><Icon.Share /></button>
            <button onClick={() => setIsMuted(!isMuted)} className="p-2.5 bg-zinc-900/50 hover:bg-zinc-800 rounded-xl border border-red-900/30 transition-colors text-red-500 hover:text-red-400">{isMuted ? <Icon.VolumeX /> : <Icon.Volume2 />}</button>
          </div>
        </header>

        <GameMap 
          map={gameState.map} theme={gameState.theme} playerPos={gameState.playerPos}
          enemies={gameState.enemies} chests={gameState.chests} potions={gameState.potions}
          items={gameState.items} keyPos={gameState.keyPos} merchantPos={gameState.merchantPos} hasKey={gameState.hasKey}
          stairsPos={gameState.stairsPos} tronModeActive={gameState.tronModeActive} tronTrail={gameState.tronTrail}
          activePet={gameState.activePet} onTileClick={handleTileClick}
        />
        <HUD level={gameState.level} stats={gameState.playerStats} logs={gameState.logs} hasKey={gameState.hasKey} kills={gameState.enemiesKilledInLevel} gold={gameState.gold} playerName={gameState.playerName} activePet={gameState.activePet} language={currentLang} />
        
        {/* Timer UI do Cavalo */}
        {gameState.tronModeActive && (
          <div className="w-full bg-cyan-900/20 border border-cyan-500/50 p-2 rounded-lg flex justify-between items-center animate-pulse">
            <div className="flex items-center gap-2 text-cyan-400">
              <Icon.Horse />
              <span className="text-[10px] font-black uppercase tracking-widest">{t.tron_active}</span>
            </div>
            <span className="text-xs font-black text-cyan-400">{gameState.tronTimeLeft}s</span>
          </div>
        )}

        {gameState.gameStatus === 'LOST' && (
          <div className="fixed inset-0 bg-black/95 flex flex-col items-center justify-center p-8 z-[100] animate-in fade-in duration-1000">
            <div className="absolute inset-0 bg-red-900/10 animate-glitch pointer-events-none" />
            <h2 className="text-6xl font-black text-red-600 mb-2 italic tracking-tighter drop-shadow-[0_0_50px_rgba(220,38,38,0.8)] uppercase">{t.death_title}</h2>
            <p className="text-zinc-500 mb-8 uppercase text-[10px] tracking-[0.4em] animate-pulse text-center">{t.death_desc}</p>
            
            <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl w-full max-w-xs mb-8 space-y-3 shadow-[0_0_30px_rgba(0,0,0,1)]">
               <h3 className="text-zinc-400 text-center font-black text-xs border-b border-zinc-800 pb-2 mb-4 uppercase">{t.final_stats}</h3>
               <div className="flex justify-between text-[10px] font-bold"><span>{t.level.toUpperCase()}</span><span className="text-white">{gameState.level}</span></div>
               <div className="flex justify-between text-[10px] font-bold"><span>{t.hp}</span><span className="text-red-400">{gameState.playerStats.maxHp}</span></div>
               <div className="flex justify-between text-[10px] font-bold"><span>{t.atk}</span><span className="text-yellow-400">{gameState.playerStats.attack}</span></div>
               <div className="flex justify-between text-[10px] font-bold"><span>{t.armor}</span><span className="text-blue-400">{gameState.playerStats.maxArmor}</span></div>
               <div className="flex justify-between text-[10px] font-bold"><span>{t.vel}</span><span className="text-green-400">{gameState.playerStats.speed}</span></div>
            </div>

            <button onClick={restartGame} className="bg-white text-black px-12 py-4 rounded-full font-black hover:scale-105 transition-transform shadow-2xl text-xs uppercase tracking-widest">{t.rebirth}</button>
          </div>
        )}

        {gameState.gameStatus === 'NEXT_LEVEL' && (
          <div className="fixed inset-0 bg-black flex flex-col items-center justify-center p-8 z-[100] animate-in fade-in duration-500">
             <div className="text-center">
              <h2 className="text-3xl font-black text-red-600 mb-6 animate-pulse uppercase tracking-tighter drop-shadow-[0_0_15px_rgba(220,38,38,0.5)] italic">
                {t.descending} {gameState.level + 1}
              </h2>
              <button onClick={() => initLevel(gameState.level + 1, gameState.playerStats, gameState.gold, gameState.playerName, gameState.activePet)} className="bg-white text-black px-16 py-4 rounded-full font-black hover:scale-105 transition-all text-sm uppercase tracking-widest shadow-2xl">
                OK
              </button>
            </div>
          </div>
        )}
      </div>

      {gameState.gameStatus === 'COMBAT' && gameState.currentEnemy && (
        <CombatModal language={currentLang} playerStats={gameState.playerStats} enemy={gameState.currentEnemy} activePet={gameState.activePet} onAttackSound={playAttackSound} onFinish={(stats, win, gold, petHp) => {
          if (win) {
            playCoinSound();
            setGameState(prev => {
              if (!prev) return prev;
              const nextState: GameState = { ...prev, playerStats: stats, gold: prev.gold + gold, gameStatus: 'PLAYING', enemies: prev.enemies.filter(e => e.id !== prev.currentEnemy?.id), enemiesKilledInLevel: prev.enemiesKilledInLevel + 1, logs: [...prev.logs, `${t.victory}! +${gold}G`], activePet: prev.activePet ? { ...prev.activePet, hp: petHp || 0 } : undefined };
              saveGame(nextState); return nextState;
            });
          } else { setGameState(prev => prev ? { ...prev, gameStatus: 'LOST' } : null); }
        }} />
      )}
      {gameState.gameStatus === 'CHEST_OPEN' && <ChestModal language={currentLang} onChoice={c => {
        if (!gameState) return;
        const s = { ...gameState.playerStats };
        if (c === 'Ataque') s.attack += 5; else if (c === 'Armadura') { s.maxArmor += 3; s.armor = s.maxArmor; } else s.speed += 4;
        playChime(); const nextState: GameState = { ...gameState, playerStats: s, gameStatus: 'PLAYING', logs: [...gameState.logs, `Bless: ${c}`] };
        setGameState(nextState); saveGame(nextState);
      }} />}
      {gameState.gameStatus === 'MERCHANT_SHOP' && (
        <MerchantShopModal language={currentLang} gold={gameState.gold} level={gameState.level} hasPet={!!gameState.activePet} onClose={() => setGameState({...gameState, gameStatus: 'PLAYING'})} onBuyPet={(type) => {
          playChime();
          const petName = type === 'LOBO' ? t.pet_lobo : type === 'PUMA' ? t.pet_puma : t.pet_coruja;
          const newPet: Pet = { type, name: petName, hp: 60, maxHp: 60, pos: { x: gameState.playerPos.x - 1, y: gameState.playerPos.y } };
          const nextState: GameState = { ...gameState, gold: gameState.gold - (type === 'CORUJA' ? 12 : 10), activePet: newPet, logs: [...gameState.logs, t.bought_pet] };
          setGameState(nextState); saveGame(nextState);
        }} onBuyPotion={(p) => {
          const heal = Math.floor(gameState.playerStats.maxHp * (p.percent / 100));
          const nextState: GameState = { ...gameState, gold: gameState.gold - (p.price || 0), playerStats: { ...gameState.playerStats, hp: Math.min(gameState.playerStats.maxHp, gameState.playerStats.hp + heal) }, logs: [...gameState.logs, t.bought_potion] };
          setGameState(nextState); saveGame(nextState);
        }} onBuyItem={(item) => {
           const s = { ...gameState.playerStats };
           if (item.stat === 'maxHp') { s.maxHp += item.value; s.hp += item.value; } else { (s as any)[item.stat] += item.value; }
           const nextState: GameState = { ...gameState, gold: gameState.gold - (item.price || 0), playerStats: s, logs: [...gameState.logs, t.bought_item] };
           setGameState(nextState); saveGame(nextState);
        }} onRentTron={() => {
           playChime();
           setGameState({ 
             ...gameState, 
             gold: gameState.gold - 25, 
             tronModeActive: true, 
             tronTimeLeft: 15, 
             tronTrail: [], 
             gameStatus: 'PLAYING',
             logs: [...gameState.logs, t.tron_active]
           });
        }} />
      )}
    </div>
  );
};

export default App;