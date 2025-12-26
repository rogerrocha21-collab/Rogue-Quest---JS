
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GameState, Position, EntityStats, StatChoice, LevelTheme, ItemEntity, PotionEntity, Pet, Language, Relic } from './types';
import { INITIAL_PLAYER_STATS, MAX_LEVELS, MAP_WIDTH, MAP_HEIGHT, THEME_CONFIG, TRANSLATIONS, RELICS_POOL } from './constants';
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
        tronModeActive: false, tronTimeLeft: 0, tronTrail: [], language: 'PT',
        inventory: [], inventorySize: 5
      });
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

  const saveGame = (state: GameState) => {
    localStorage.setItem('rq_save_mobile_v2', JSON.stringify({ ...state, language: currentLang }));
  };

  const t = TRANSLATIONS[currentLang];

  const handleShare = async () => {
    const shareText = `𝗥𝗼𝗴𝘂𝗲 𝗤𝘂𝗲𝘀𝘁:\n"Exploração sombria em estilo roguelike ASCII: desça masmorras, lute, morra, evolua e tente ir mais fundo a cada run."\n\nhttps://t.me/RogueQuest_bot`;
    if (navigator.share) {
      try { await navigator.share({ text: shareText }); } catch (err) {}
    } else {
      try { await navigator.clipboard.writeText(shareText); alert("Mensagem copiada para a área de transferência!"); } catch (e) { window.open('https://t.me/RogueQuest_bot', '_blank'); }
    }
  };

  const playSound = (freq: number, type: OscillatorType = 'sine', duration: number = 0.1, gainVal: number = 0.05) => {
    if (isMutedRef.current) return;
    const ctx = audioContext.current;
    if (!ctx) return;
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

    const currentT = TRANSLATIONS[currentLang];
    const newState: GameState = {
      ...dungeon, playerName: name || nameInput || 'Herói', gold: currentGold, level, playerStats: currentStats,
      hasKey: false, enemiesKilledInLevel: 0, gameStatus: 'PLAYING', logs: [level === 1 ? `${name || 'Herói'} ${currentT.log_entry}` : `${currentT.log_depth} ${level}.`],
      items: [], tronModeActive: false, tronTimeLeft: 0, tronTrail: [], activePet: activePet ? { ...activePet, pos: { x: dungeon.playerPos.x - 1, y: dungeon.playerPos.y } } : undefined,
      language: currentLang, inventory: startInv, inventorySize: invSize, activeRelic
    };
    setGameState(newState);
    saveGame(newState);
  }, [nameInput, currentLang, gameState?.lastStats]);

  const usePotion = (pot: PotionEntity) => {
    if (!gameState) return;
    let healPct = pot.percent;
    if (gameState.activeRelic?.id === 'alch') healPct += 5;
    const heal = Math.floor(gameState.playerStats.maxHp * (healPct / 100));
    const newStats = { ...gameState.playerStats, hp: Math.min(gameState.playerStats.maxHp, gameState.playerStats.hp + heal) };
    setGameState({ ...gameState, playerStats: newStats, logs: [...gameState.logs, `Curou +${heal} HP`] });
    playChime();
  };

  const handlePickupPotion = (pot: PotionEntity, choice: 'use' | 'store') => {
    if (!gameState) return;
    if (choice === 'use') {
      usePotion(pot);
      setGameState(prev => prev ? { ...prev, gameStatus: 'PLAYING', potions: prev.potions.filter(p => p.id !== pot.id) } : null);
    } else {
      if (gameState.inventory.length < gameState.inventorySize) {
        setGameState(prev => prev ? { ...prev, gameStatus: 'PLAYING', inventory: [...prev.inventory, pot], potions: prev.potions.filter(p => p.id !== pot.id) } : null);
      } else {
        alert(t.inventory_full);
      }
    }
  };

  const movePlayer = (dx: number, dy: number) => {
    if (!gameState || gameState.gameStatus !== 'PLAYING') return;
    const { playerPos, map, enemies, potions, keyPos, merchantPos, hasKey, stairsPos, enemiesKilledInLevel, chests, tronModeActive, tronTrail = [], activePet } = gameState;
    const nx = playerPos.x + dx; const ny = playerPos.y + dy;
    if (nx < 0 || nx >= MAP_WIDTH || ny < 0 || ny >= MAP_HEIGHT || map[ny][nx] === 'WALL') return;
    const enemy = enemies.find(e => e.x === nx && e.y === ny);
    if (enemy) { 
        if (tronModeActive) {
            const goldGain = Math.floor(Math.random() * 8) + 12; playCoinSound();
            setGameState({ ...gameState, gold: gameState.gold + goldGain, enemies: enemies.filter(e => e.id !== enemy.id), enemiesKilledInLevel: enemiesKilledInLevel + 1, playerPos: { x: nx, y: ny }, tronTrail: [...tronTrail, playerPos], activePet: activePet ? { ...activePet, pos: playerPos } : undefined, logs: [...gameState.logs, `${t.log_trampled} +${goldGain}G`] });
            return;
        } else { setGameState({ ...gameState, gameStatus: 'COMBAT', currentEnemy: enemy }); return; }
    }
    const pot = potions.find(p => p.x === nx && p.y === ny);
    if (pot) { setGameState({ ...gameState, gameStatus: 'PICKUP_CHOICE', currentPotion: pot, playerPos: { x: nx, y: ny } }); return; }
    if (keyPos && nx === keyPos.x && ny === keyPos.y && !hasKey) { playChime(); setGameState({ ...gameState, hasKey: true, logs: [...gameState.logs, t.log_key], playerPos: { x: nx, y: ny } }); return; }
    if (merchantPos && nx === merchantPos.x && ny === merchantPos.y) { setGameState({ ...gameState, gameStatus: 'MERCHANT_SHOP', playerPos: { x: nx, y: ny } }); return; }
    const chest = chests.find(c => c.x === nx && c.y === ny);
    if (chest) { setGameState({ ...gameState, gameStatus: 'CHEST_OPEN', playerPos: { x: nx, y: ny }, chests: chests.filter(c => c.id !== chest.id) }); return; }
    if (nx === stairsPos.x && ny === stairsPos.y) {
        if (hasKey && enemiesKilledInLevel >= 1) {
            if (gameState.level >= MAX_LEVELS) setGameState({ ...gameState, gameStatus: 'WON' });
            else setGameState({ ...gameState, gameStatus: 'NEXT_LEVEL' });
        } else { setGameState({ ...gameState, logs: [...gameState.logs, t.log_locked], playerPos: { x: nx, y: ny } }); } return;
    }
    setGameState({ ...gameState, playerPos: { x: nx, y: ny }, tronTrail: tronModeActive ? [...tronTrail, playerPos] : tronTrail, activePet: activePet ? { ...activePet, pos: playerPos } : undefined });
  };

  const handleDeath = () => {
    if (!gameState) return;
    const shuffledRelics = [...RELICS_POOL].sort(() => 0.5 - Math.random()).slice(0, 3);
    setGameState({ ...gameState, gameStatus: 'RELIC_SELECTION', relicOptions: shuffledRelics, lastStats: gameState.playerStats });
  };

  if (gameState?.gameStatus === 'START_SCREEN') {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-6 text-center">
        <h1 className="text-6xl font-black text-white tracking-tighter mb-4 animate-pulse uppercase">Rogue<span className="text-red-600">Quest</span></h1>
        <p className="text-zinc-600 mb-12 tracking-[0.4em] uppercase text-[10px]">{t.abyss}</p>
        <div className="bg-zinc-900/40 p-8 rounded-[2rem] border border-zinc-800 w-full max-w-xs backdrop-blur-md shadow-2xl space-y-4">
          <input type="text" placeholder={t.hero_placeholder} value={nameInput} onChange={e => setNameInput(e.target.value.toUpperCase())}
            className="w-full bg-black border-2 border-zinc-800 rounded-xl p-4 text-white text-center font-bold focus:border-red-600 outline-none text-sm transition-all" />
          <button onClick={() => { startMusic(); setGameState(prev => prev ? { ...prev, gameStatus: 'TUTORIAL' } : null); }}
            className="w-full py-4 bg-red-600 hover:bg-red-500 text-white font-black rounded-xl transition-all shadow-lg shadow-red-900/20 text-xs uppercase tracking-widest disabled:opacity-50"
            disabled={!nameInput.trim()}>
            {t.start_journey}
          </button>
          <div className="flex justify-center gap-6 mt-4 pt-4 border-t border-zinc-800">
            {['PT', 'EN', 'ES'].map(lang => (<button key={lang} onClick={() => setCurrentLang(lang as Language)} className={`text-2xl transition-transform ${currentLang === lang ? 'scale-125 border-b-2 border-red-600' : 'opacity-40'}`}>{lang === 'PT' ? '🇧🇷' : lang === 'EN' ? '🇺🇸' : '🇪🇸'}</button>))}
          </div>
        </div>
      </div>
    );
  }

  if (gameState?.gameStatus === 'TUTORIAL') return <TutorialModal onFinish={() => initLevel(1)} language={currentLang} />;
  if (!gameState || !gameState.map.length) return null;

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-100 flex flex-col items-center p-4 font-mono select-none overflow-x-hidden relative pb-10">
      <div className="max-w-md w-full flex flex-col gap-4 animate-in fade-in duration-700">
        <header className="flex justify-between items-center border-b border-zinc-900 pb-3">
          <div className="flex flex-col">
            <h1 className="text-2xl font-black text-white tracking-tighter uppercase leading-none">ROGUE<span className="text-red-600">QUEST</span></h1>
            <h2 className="text-zinc-500 text-[9px] font-bold uppercase tracking-[0.2em] mt-1.5">{t[THEME_CONFIG[gameState.theme].nameKey]} — {t.level} {gameState.level}</h2>
          </div>
          <div className="text-right flex items-center gap-2">
            <button onClick={() => window.open('https://t.me/+rzUhHnyeeSM1MDNh', '_blank')} className="p-2.5 bg-zinc-900/50 hover:bg-zinc-800 rounded-xl border border-zinc-800 transition-colors text-zinc-400 hover:text-white" title="Comunidade"><Icon.Users /></button>
            <button onClick={handleShare} className="p-2.5 bg-zinc-900/50 hover:bg-zinc-800 rounded-xl border border-zinc-800 transition-colors text-zinc-400 hover:text-white"><Icon.Share /></button>
            <button onClick={() => setIsMuted(!isMuted)} className="p-2.5 bg-zinc-900/50 hover:bg-zinc-800 rounded-xl border border-red-900/30 transition-colors text-red-500">{isMuted ? <Icon.VolumeX /> : <Icon.Volume2 />}</button>
          </div>
        </header>

        <GameMap map={gameState.map} theme={gameState.theme} playerPos={gameState.playerPos} enemies={gameState.enemies} chests={gameState.chests} potions={gameState.potions} items={gameState.items} keyPos={gameState.keyPos} merchantPos={gameState.merchantPos} hasKey={gameState.hasKey} stairsPos={gameState.stairsPos} tronModeActive={gameState.tronModeActive} tronTrail={gameState.tronTrail} activePet={gameState.activePet} onTileClick={(x,y) => movePlayer(x-gameState.playerPos.x, y-gameState.playerPos.y)} />
        <HUD level={gameState.level} stats={gameState.playerStats} logs={gameState.logs} hasKey={gameState.hasKey} kills={gameState.enemiesKilledInLevel} gold={gameState.gold} playerName={gameState.playerName} activePet={gameState.activePet} language={currentLang} inventory={gameState.inventory} inventorySize={gameState.inventorySize} activeRelic={gameState.activeRelic} onUsePotion={(i) => {
          const pot = gameState.inventory[i];
          usePotion(pot);
          setGameState(prev => prev ? { ...prev, inventory: prev.inventory.filter((_, idx) => idx !== i) } : null);
        }} />
        
        {gameState.tronModeActive && (
          <div className="w-full bg-cyan-900/20 border border-cyan-500/50 p-2 rounded-lg flex justify-between items-center animate-pulse">
            <div className="flex items-center gap-2 text-cyan-400"><Icon.Horse /><span className="text-[10px] font-black uppercase tracking-widest">{t.tron_active}</span></div>
            <span className="text-xs font-black text-cyan-400">{gameState.tronTimeLeft}s</span>
          </div>
        )}

        {gameState.gameStatus === 'LOST' && (
          <div className="fixed inset-0 bg-black/95 flex flex-col items-center justify-center p-8 z-[100] animate-in fade-in duration-1000">
            <h2 className="text-6xl font-black text-red-600 mb-2 italic tracking-tighter drop-shadow-[0_0_50px_rgba(220,38,38,0.8)] uppercase">{t.death_title}</h2>
            <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl w-full max-w-xs mb-8 space-y-3">
               <h3 className="text-zinc-400 text-center font-black text-xs border-b border-zinc-800 pb-2 mb-4 uppercase">{t.final_stats}</h3>
               <div className="flex justify-between text-[10px] font-bold"><span>{t.level.toUpperCase()}</span><span className="text-white">{gameState.level}</span></div>
               <div className="flex justify-between text-[10px] font-bold"><span>{t.hp}</span><span className="text-red-400">{gameState.playerStats.maxHp}</span></div>
               <div className="flex justify-between text-[10px] font-bold"><span>{t.atk}</span><span className="text-yellow-400">{gameState.playerStats.attack}</span></div>
            </div>
            <button onClick={handleDeath} className="bg-white text-black px-12 py-4 rounded-full font-black text-xs uppercase tracking-widest">{t.rebirth}</button>
          </div>
        )}

        {gameState.gameStatus === 'NEXT_LEVEL' && (
          <div className="fixed inset-0 bg-black flex flex-col items-center justify-center p-8 z-[100] animate-in fade-in duration-500">
             <div className="text-center">
              <h2 className="text-3xl font-black text-red-600 mb-6 animate-pulse uppercase tracking-tighter italic">{t.descending} {gameState.level + 1}</h2>
              <button onClick={() => initLevel(gameState.level + 1, gameState.playerStats, gameState.gold, gameState.playerName, gameState.activePet, gameState.activeRelic, gameState.inventory)} className="bg-white text-black px-16 py-4 rounded-full font-black text-sm uppercase tracking-widest">OK</button>
            </div>
          </div>
        )}
      </div>

      {gameState.gameStatus === 'COMBAT' && gameState.currentEnemy && (
        <CombatModal language={currentLang} playerStats={gameState.playerStats} enemy={gameState.currentEnemy} activePet={gameState.activePet} onAttackSound={playAttackSound} onFinish={(stats, win, gold, petHp) => {
          if (win) {
            playCoinSound();
            let goldEarned = gold;
            if (gameState.activeRelic?.id === 'bag') goldEarned = Math.floor(goldEarned * 1.05);
            setGameState(prev => prev ? { ...prev, playerStats: stats, gold: prev.gold + goldEarned, gameStatus: 'PLAYING', enemies: prev.enemies.filter(e => e.id !== prev.currentEnemy?.id), enemiesKilledInLevel: prev.enemiesKilledInLevel + 1, activePet: prev.activePet ? { ...prev.activePet, hp: petHp || 0 } : undefined } : null);
          } else { setGameState(prev => prev ? { ...prev, gameStatus: 'LOST' } : null); }
        }} />
      )}
      {gameState.gameStatus === 'PICKUP_CHOICE' && gameState.currentPotion && (
        <PotionPickupModal potion={gameState.currentPotion} language={currentLang} onChoice={(c) => handlePickupPotion(gameState.currentPotion!, c)} />
      )}
      {gameState.gameStatus === 'RELIC_SELECTION' && gameState.relicOptions && (
        <RelicSelectionModal options={gameState.relicOptions} language={currentLang} onSelect={(relic) => initLevel(1, undefined, 0, gameState.playerName, undefined, relic, [])} />
      )}
      {gameState.gameStatus === 'CHEST_OPEN' && <ChestModal language={currentLang} onChoice={c => {
        const s = { ...gameState.playerStats };
        if (c === 'Ataque') s.attack += 5; else if (c === 'Armadura') { s.maxArmor += 3; s.armor = s.maxArmor; } else s.speed += 4;
        setGameState({ ...gameState, playerStats: s, gameStatus: 'PLAYING' }); playChime();
      }} />}
      {gameState.gameStatus === 'MERCHANT_SHOP' && (
        <MerchantShopModal language={currentLang} gold={gameState.gold} level={gameState.level} hasPet={!!gameState.activePet} onClose={() => setGameState({...gameState, gameStatus: 'PLAYING'})} onBuyPet={(type) => {
          const newPet: Pet = { type, name: type, hp: 60, maxHp: 60, pos: { x: gameState.playerPos.x - 1, y: gameState.playerPos.y } };
          setGameState({ ...gameState, gold: gameState.gold - (type === 'CORUJA' ? 12 : 10), activePet: newPet, logs: [...gameState.logs, t.bought_pet] }); playChime();
        }} onBuyPotion={(pot, choice) => {
          if (gameState.playerStats.hp === gameState.playerStats.maxHp || choice === 'store') {
            if (gameState.inventory.length < gameState.inventorySize) {
                setGameState({ ...gameState, gold: gameState.gold - (pot.price || 0), inventory: [...gameState.inventory, pot], logs: [...gameState.logs, t.store] });
            } else { alert(t.inventory_full); }
          } else {
            usePotion(pot);
            setGameState(prev => prev ? { ...prev, gold: prev.gold - (pot.price || 0) } : null);
          }
        }} onBuyItem={(item) => {
           const s = { ...gameState.playerStats };
           if (item.stat === 'maxHp') { s.maxHp += item.value; s.hp += item.value; } else { (s as any)[item.stat] += item.value; }
           setGameState({ ...gameState, gold: gameState.gold - (item.price || 0), playerStats: s, logs: [...gameState.logs, t.bought_item] });
        }} onRentTron={() => {
           setGameState({ ...gameState, gold: gameState.gold - 25, tronModeActive: true, tronTimeLeft: 15, tronTrail: [], gameStatus: 'PLAYING', logs: [...gameState.logs, t.tron_active] }); playChime();
        }} />
      )}
    </div>
  );
};

export default App;
