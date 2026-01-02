
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GameState, Position, EntityStats, StatChoice, PotionEntity, Pet, Language, Relic, AltarEffect, PoisonStatus, Trap } from './types';
import { INITIAL_PLAYER_STATS, MAP_WIDTH, MAP_HEIGHT, TRANSLATIONS, RELICS_POOL, THEME_CONFIG, MAX_LEVELS, BLESSINGS_POOL, CURSES_POOL } from './constants';
import { generateDungeon, findDungeonPath } from './utils/dungeon';
import GameMap from './components/GameMap';
import HUD from './components/HUD';
import { CombatModal, ChestModal, MerchantShopModal, TutorialModal, PotionPickupModal, RelicSelectionModal, AltarInteractionModal, AltarResultModal, EggStoryModal } from './components/Modals';
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

  const updateGuides = (state: GameState, pos: Position): { compass: Position[], map: Position[] } => {
     let compass: Position[] = [];
     let mapP: Position[] = [];

     if (state.hasCompass && state.enemies.length > 0) {
         let closestEnemy = state.enemies[0];
         let minLen = Infinity;
         let bestPath = null;
         for (const enemy of state.enemies) {
             const path = findDungeonPath(pos, enemy, state.map, state.enemies); 
             if (path && path.length < minLen) {
                 minLen = path.length;
                 bestPath = path;
             }
         }
         if (bestPath) compass = bestPath;
     }

     if (state.hasMap) {
         const path = findDungeonPath(pos, state.stairsPos, state.map, state.enemies);
         if (path) mapP = path;
     }
     return { compass, map: mapP };
  };

  useEffect(() => {
    try {
      const saved = localStorage.getItem('rq_save_v150_final');
      // Carregar status global do corvo
      const globalUnlock = localStorage.getItem('rq_crow_unlocked') === 'true';

      if (saved) {
        const data = JSON.parse(saved);
        
        if (data.gameStatus === 'LOST' || data.gameStatus === 'RELIC_SELECTION') {
            setGameState({ ...data, isCrowUnlocked: globalUnlock }); // Garante consistência
            setNameInput(data.playerName || '');
            if (data.language) setCurrentLang(data.language);
            playerPosRef.current = data.playerPos;
        } else {
            setGameState({ ...data, gameStatus: 'START_SCREEN' as const, isCrowUnlocked: globalUnlock });
            setNameInput(data.playerName || '');
            if (data.language) setCurrentLang(data.language);
            playerPosRef.current = data.playerPos;
        }
      } else {
        const initialPos = { x: 0, y: 0 };
        setGameState({
          playerName: '', gold: 0, level: 1, theme: 'VOID' as const, playerPos: initialPos,
          playerStats: { ...INITIAL_PLAYER_STATS }, map: [], enemies: [], chests: [],
          potions: [], items: [], traps: [], hasKey: false, enemiesKilledInLevel: 0,
          stairsPos: {x:0,y:0}, gameStatus: 'START_SCREEN' as const, logs: [],
          tronModeActive: false, tronTimeLeft: 0, tronTrail: [], language: 'PT',
          inventory: [], inventorySize: 5, hasUsedAltarInLevel: false, hasCompass: false, hasMap: false,
          isCrowUnlocked: globalUnlock
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
      if (state.isCrowUnlocked) {
          localStorage.setItem('rq_crow_unlocked', 'true');
      }
    } catch (e) {}
  }, [currentLang]);

  const changeLanguage = (lang: Language) => {
    setCurrentLang(lang);
    if (gameState) {
      const newState = { ...gameState, language: lang };
      try {
        localStorage.setItem('rq_save_v150_final', JSON.stringify(newState));
      } catch (e) {}
    }
  };

  const t = TRANSLATIONS[currentLang] || TRANSLATIONS.PT;

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
  const playTrapSound = () => playSound(150, 'sawtooth', 0.2, 0.1);

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
    
    // Check global crow unlock
    const globalCrow = localStorage.getItem('rq_crow_unlocked') === 'true';
    
    const dungeon = generateDungeon(level, globalCrow);
    let currentStats = stats ? { ...stats, armor: stats.maxArmor } : { ...INITIAL_PLAYER_STATS };
    let currentGold = gold ?? 0;
    let invSize = 5;
    let startInventory = inventory || [];
    
    setGameState(prev => {
        let finalHasCompass = prev?.hasCompass || false;
        let finalHasMap = prev?.hasMap || false;

        if (level === 1) {
            if (activeRelic?.id === 'slots') invSize = 10;
            if (activeRelic?.id === 'gaze') startInventory.push({ id: 'relic-potion', percent: 75, x: 0, y: 0 });
            if (activeRelic?.id === 'mark') { currentGold += 60; currentStats.maxHp = Math.floor(currentStats.maxHp * 0.9); currentStats.hp = currentStats.maxHp; }
            if (activeRelic?.id === 'heart') { currentStats.attack = Math.floor(currentStats.attack * 1.1); currentStats.maxHp = Math.floor(currentStats.maxHp * 0.95); currentStats.hp = Math.min(currentStats.hp, currentStats.maxHp); }
            if (activeRelic?.id === 'life_long') { currentStats.maxHp += 30; currentStats.hp = currentStats.maxHp; }
            
            finalHasCompass = false;
            finalHasMap = false;
        } else {
            if (activeRelic?.id === 'slots') invSize = 10;
        }

        const finalPlayerName = name || nameInput;
        const tempState: GameState = {
          ...dungeon, playerName: finalPlayerName, gold: currentGold, level, playerStats: currentStats, items: [], hasKey: false, enemiesKilledInLevel: 0,
          gameStatus: (level === 1 && !stats) ? 'TUTORIAL' as const : 'PLAYING' as const,
          logs: (level === 1 && !stats) ? [`${finalPlayerName} entrou no abismo.`] : [`Descendo para o nível ${level}`],
          inventory: startInventory, inventorySize: invSize, 
          activePet: activePet, 
          activeRelic, language: currentLang, hasUsedAltarInLevel: false, tronModeActive: false, tronTimeLeft: 0, tronTrail: [],
          activeAltarEffect: undefined, keyPath: undefined,
          hasCompass: finalHasCompass, hasMap: finalHasMap, poisonStatus: undefined,
          isCrowUnlocked: globalCrow,
          crowPos: globalCrow ? dungeon.playerPos : undefined // Initialize crow pos if unlocked
        };

        const guides = updateGuides(tempState, tempState.playerPos);
        tempState.compassPath = guides.compass;
        tempState.mapPath = guides.map;

        // Sync pet pos if exists
        if (tempState.activePet) tempState.activePet.pos = tempState.playerPos;

        playerPosRef.current = tempState.playerPos;
        saveGame(tempState); 
        return tempState;
    });
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
        
        // Pet normal (Lobo/Puma) sempre segue o jogador
        let updatedPet = prev.activePet ? { ...prev.activePet, pos: oldPos } : undefined;
        
        // --- CROW MOVEMENT LOGIC (Independente) ---
        let newCrowPos = nextPos; // Padrão: segue o jogador
        if (prev.isCrowUnlocked) {
            // Busca armadilha não acionada e não revelada perto do jogador (ou do corvo atual)
            // A prioridade do corvo é revelar armadilhas
            const scanCenter = nextPos;
            const nearbyTrap = prev.traps.find(t => 
                !t.triggered && 
                Math.abs(t.x - scanCenter.x) < 6 && 
                Math.abs(t.y - scanCenter.y) < 6
            );
            
            if (nearbyTrap) {
                // Se achou armadilha, vai pra ela
                newCrowPos = { x: nearbyTrap.x, y: nearbyTrap.y };
            } else {
                // Se não achou, volta pro jogador
                newCrowPos = nextPos;
            }
        }

        const enemy = prev.enemies.find(e => e.x === nextPos.x && e.y === nextPos.y);
        
        if (enemy) { 
          setMoveQueue([]); 
          if (prev.tronModeActive) {
            playAttackSound('player');
            return { ...prev, enemies: prev.enemies.filter(e => e.id !== enemy.id), enemiesKilledInLevel: prev.enemiesKilledInLevel + 1, gold: prev.gold + 10, logs: [...prev.logs, "ATROPELADO!"] } as GameState;
          }
          return { ...prev, gameStatus: 'COMBAT' as const, currentEnemy: enemy } as GameState; 
        }
        
        const chest = prev.chests.find(c => c.x === nextPos.x && c.y === nextPos.y);
        if (chest) { setMoveQueue([]); return { ...prev, gameStatus: 'CHEST_OPEN' as const, chests: prev.chests.filter(c => c.id !== chest.id) } as GameState; }
        
        if (prev.keyPos && nextPos.x === prev.keyPos.x && nextPos.y === prev.keyPos.y && !prev.hasKey) {
          playChime(); setMoveQueue(q => q.slice(1)); playerPosRef.current = nextPos;
          return { ...prev, hasKey: true, logs: [...prev.logs, t.log_key], playerPos: nextPos, activePet: updatedPet, crowPos: newCrowPos } as GameState;
        }
        
        const potion = prev.potions.find(p => p.x === nextPos.x && p.y === nextPos.y);
        if (potion) { setMoveQueue([]); return { ...prev, gameStatus: 'PICKUP_CHOICE' as const, currentPotion: potion, potions: prev.potions.filter(p => p.id !== potion.id) } as GameState; }
        
        if (prev.merchantPos && nextPos.x === prev.merchantPos.x && nextPos.y === prev.merchantPos.y) {
          setMoveQueue([]); playerPosRef.current = nextPos; return { ...prev, gameStatus: 'MERCHANT_SHOP' as const, playerPos: nextPos, activePet: updatedPet, crowPos: newCrowPos } as GameState;
        }
        
        if (prev.altarPos && nextPos.x === prev.altarPos.x && nextPos.y === prev.altarPos.y) {
          setMoveQueue([]); playerPosRef.current = nextPos; return { ...prev, gameStatus: 'ALTAR_INTERACTION' as const, playerPos: nextPos, activePet: updatedPet, crowPos: newCrowPos } as GameState;
        }

        // Egg Interaction
        if (prev.eggPos && nextPos.x === prev.eggPos.x && nextPos.y === prev.eggPos.y) {
            setMoveQueue([]); playerPosRef.current = nextPos;
            return { ...prev, gameStatus: 'EGG_INTERACTION' as const, playerPos: nextPos, activePet: updatedPet, crowPos: newCrowPos } as GameState;
        }
        
        if (nextPos.x === prev.stairsPos.x && nextPos.y === prev.stairsPos.y) {
          if (prev.hasKey && prev.enemiesKilledInLevel > 0) { playChime(); setMoveQueue([]); return { ...prev, gameStatus: 'NEXT_LEVEL' as const } as GameState; }
          else { setMoveQueue(q => q.slice(1)); playerPosRef.current = nextPos; return { ...prev, logs: [...prev.logs, t.log_locked], playerPos: nextPos, activePet: updatedPet, crowPos: newCrowPos } as GameState; }
        }
        
        setMoveQueue(q => q.slice(1));
        playerPosRef.current = nextPos;
        let newTrail = prev.tronTrail || [];
        if (prev.tronModeActive) newTrail = [...newTrail, oldPos].slice(-10);

        const guides = updateGuides(prev, nextPos);
        
        // --- POISON LOGIC IN MOVEMENT ---
        let currentPoison = prev.poisonStatus;
        let currentHp = prev.playerStats.hp;
        let newLogs = [...prev.logs];
        
        if (currentPoison) {
            const damage = Math.max(1, Math.floor(prev.playerStats.maxHp * (currentPoison.damagePerTurn / 100)));
            currentHp -= damage;
            if (currentHp <= 0) {
               currentHp = 0;
               setMoveQueue([]);
               return { ...prev, gameStatus: 'LOST' as const, lastStats: { ...prev.playerStats, hp: 0 }, logs: [...newLogs, `${t.poison_damage} -${damage}`] } as GameState;
            }
            
            const remaining = currentPoison.turnsRemaining - 1;
            if (remaining <= 0) {
                currentPoison = undefined;
                newLogs.push(t.cured);
            } else {
                currentPoison = { ...currentPoison, turnsRemaining: remaining };
            }
        }

        // --- TRAP LOGIC ---
        let finalHp = currentHp;
        let finalPoison = currentPoison;
        let triggeredTrap: Trap | undefined = undefined;
        let closestEnemyToTrigger: any = undefined;
        let nextGameStatus: GameState['gameStatus'] = prev.gameStatus;

        const trap = prev.traps.find(t => t.x === nextPos.x && t.y === nextPos.y && !t.triggered);
        if (trap) {
            // Evasion Check
            if (prev.playerStats.speed > 85) {
                newLogs.push(t.trap_evaded);
            } else {
                playTrapSound();
                triggeredTrap = { ...trap, triggered: true, revealed: true };
                
                if (trap.type === 'SPIKE') {
                    const dmg = Math.floor(prev.playerStats.maxHp * 0.10);
                    finalHp -= dmg;
                    newLogs.push(`${t.trap_spike} -${dmg} HP`);
                } else if (trap.type === 'POISON') {
                    const dmg = Math.floor(prev.playerStats.maxHp * 0.05);
                    finalHp -= dmg;
                    newLogs.push(`${t.trap_poison} -${dmg} HP`);
                    if (finalPoison) {
                        finalPoison = { ...finalPoison, turnsRemaining: finalPoison.turnsRemaining + 5 };
                    } else {
                        finalPoison = { type: 'WEAK', turnsRemaining: 5, damagePerTurn: 5 };
                    }
                } else if (trap.type === 'EXPLOSIVE') {
                    const dmg = Math.floor(prev.playerStats.maxHp * 0.15);
                    finalHp -= dmg;
                    newLogs.push(`${t.trap_explosive} -${dmg} HP`);
                } else if (trap.type === 'ALARM') {
                    newLogs.push(t.trap_alarm);
                    // Find nearest enemy
                    let minDist = Infinity;
                    let nearest = null;
                    prev.enemies.forEach(e => {
                        const d = Math.abs(e.x - nextPos.x) + Math.abs(e.y - nextPos.y);
                        if (d < minDist) { minDist = d; nearest = e; }
                    });
                    if (nearest) {
                        setMoveQueue([]);
                        closestEnemyToTrigger = nearest;
                        nextGameStatus = 'COMBAT';
                    }
                }

                if (finalHp <= 0) {
                    finalHp = 0;
                    setMoveQueue([]);
                    return { ...prev, gameStatus: 'LOST' as const, lastStats: { ...prev.playerStats, hp: 0 }, logs: newLogs } as GameState;
                }
            }
        }

        // --- CROW PASSIVE (Detect Traps) ---
        let updatedTraps = prev.traps.map(t => triggeredTrap && t.id === triggeredTrap.id ? triggeredTrap : t);
        if (prev.isCrowUnlocked && newCrowPos) {
            let revealedCount = 0;
            updatedTraps = updatedTraps.map(t => {
                // Crow reveals ANY trap in view range (e.g. 5 tiles) from ITS position
                if (!t.revealed && !t.triggered) {
                    const dist = Math.abs(t.x - newCrowPos.x) + Math.abs(t.y - newCrowPos.y);
                    if (dist <= 6) { // Range
                        revealedCount++;
                        return { ...t, revealed: true };
                    }
                }
                return t;
            });
            if (revealedCount > 0 && !prev.logs.includes(t.crow_reveal)) {
                 // Prevent spamming log every step
                 newLogs.push(t.crow_reveal);
            }
        }

        return { 
            ...prev, 
            playerPos: nextPos, 
            activePet: updatedPet, 
            crowPos: newCrowPos,
            tronTrail: newTrail, 
            compassPath: guides.compass, 
            mapPath: guides.map,
            playerStats: { ...prev.playerStats, hp: finalHp },
            poisonStatus: finalPoison,
            logs: newLogs,
            traps: updatedTraps,
            gameStatus: nextGameStatus,
            currentEnemy: closestEnemyToTrigger || prev.currentEnemy
        } as GameState;
      });
    };
    const speed = gameState.tronModeActive ? 40 : 80;
    const timer = setTimeout(moveStep, speed); 
    return () => clearTimeout(timer);
  }, [moveQueue, gameState?.gameStatus, gameState?.tronModeActive, t]);

  const onCombatFinish = useCallback((newStats: EntityStats, win: boolean, goldEarned: number, petHp?: number, isPoisoned?: boolean) => {
    setGameState(prev => {
      if (!prev) return prev;
      if (!win) {
          const lostState = { ...prev, gameStatus: 'LOST' as const, lastStats: { ...newStats, hp: 0 } };
          saveGame(lostState); 
          return lostState;
      }
      
      const updatedPet = prev.activePet ? { ...prev.activePet, hp: petHp || 0 } : undefined;
      let finalGold = goldEarned;
      if (prev.activeRelic?.id === 'bag') finalGold = Math.floor(finalGold * 1.05);
      if (prev.activeAltarEffect?.id === 'sacred_greed') finalGold = Math.floor(finalGold * 1.5);
      if (prev.activeAltarEffect?.id === 'cursed_greed') finalGold = Math.floor(finalGold * 0.5);

      let nextStats = { ...newStats };
      
      nextStats.armor = nextStats.maxArmor;

      if (prev.activeRelic?.id === 'vamp') {
        nextStats.hp = Math.min(nextStats.maxHp, nextStats.hp + Math.floor(nextStats.maxHp * 0.15));
      }
      if (prev.activeAltarEffect?.id === 'surrendered_blood') {
        nextStats.hp = Math.min(nextStats.maxHp, nextStats.hp + Math.floor(nextStats.maxHp * 0.3));
      }
      if (prev.activeAltarEffect?.id === 'blood_tribute' && finalGold > 0) {
        nextStats.hp = Math.max(1, nextStats.hp - 5);
      }

      // Poison Application Logic
      let newPoison = prev.poisonStatus;
      if (isPoisoned) {
          const isStrong = Math.random() > 0.7;
          const type = isStrong ? 'STRONG' : 'WEAK';
          const turns = isStrong ? 7 : 15;
          const dmg = isStrong ? 7 : 3;

          if (newPoison) {
              newPoison = { ...newPoison, turnsRemaining: newPoison.turnsRemaining + turns };
          } else {
              newPoison = { type: type as any, turnsRemaining: turns, damagePerTurn: dmg };
          }
      }

      playCoinSound();
      const newEnemies = prev.enemies.filter(e => e.id !== prev.currentEnemy?.id);
      
      const tempState = { ...prev, enemies: newEnemies };
      const guides = updateGuides(tempState, prev.playerPos);

      const updated: GameState = {
        ...prev, playerStats: nextStats, gold: prev.gold + finalGold, gameStatus: 'PLAYING' as const,
        enemies: newEnemies,
        enemiesKilledInLevel: prev.enemiesKilledInLevel + 1, activePet: updatedPet, currentEnemy: undefined, keyPath: undefined,
        compassPath: guides.compass, mapPath: guides.map,
        poisonStatus: newPoison
      };
      saveGame(updated);
      return updated;
    });
    setMoveQueue([]);
  }, [saveGame]); // Added saveGame to dependency array

  const usePotionFromInventory = (idx: number) => {
    let used = false;
    setGameState(prev => {
      if (!prev || !prev.inventory[idx]) return prev;
      
      if (prev.activeAltarEffect?.id === 'denied_offering') {
        const newInv = [...prev.inventory]; newInv.splice(idx, 1);
        used = true; return { ...prev, activeAltarEffect: undefined, inventory: newInv } as GameState;
      }

      const pot = prev.inventory[idx];
      const stats = { ...prev.playerStats };
      let boost = pot.percent;
      if (prev.activeRelic?.id === 'alch') boost += 5;
      if (prev.activeAltarEffect?.id === 'profane_thirst') boost -= 10;
      
      const heal = Math.floor(stats.maxHp * (boost / 100));
      stats.hp = Math.min(stats.maxHp, stats.hp + heal);
      
      const newInv = [...prev.inventory];
      const consumed = prev.activeAltarEffect?.id !== 'accepted_offering' && !(prev.activeRelic?.id === 'save' && Math.random() < 0.05);
      if (consumed) {
        newInv.splice(idx, 1);
      }
      
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

  const handleShare = async () => {
    const heroName = gameState?.playerName || 'Herói';
    const level = gameState?.level || 1;
    const atk = gameState?.playerStats.attack || 0;
    const armor = gameState?.playerStats.maxArmor || 0;
    const shareText = `🎮 ROGUEQUEST: O Despertar\n🏆 Herói: ${heroName}\n📍 Nível Alcançado: ${level}\n⚔️ Ataque: ${atk}\n🛡️ Escudo: ${armor}\n\nDesafie o abismo você também! #RogueQuest\nhttps://t.me/RogueQuest_bot`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'ROGUEQUEST: The Eternal Descent',
          text: shareText,
        });
      } catch (err) {
        await navigator.clipboard.writeText(shareText);
        alert("Desafio copiado para a área de transferência!");
      }
    } else {
      await navigator.clipboard.writeText(shareText);
      alert("Desafio copiado para a área de transferência!");
    }
  };

  const startRebirth = () => {
    const options = [...RELICS_POOL].sort(() => 0.5 - Math.random()).slice(0, 3);
    setGameState(prev => {
        if(!prev) return null;
        const newState = { ...prev, gameStatus: 'RELIC_SELECTION' as const, relicOptions: options };
        saveGame(newState); 
        return newState;
    });
  };

  const handleRelicSelect = (relic: Relic) => {
    let inherited = { ...INITIAL_PLAYER_STATS };
    if (relic.id === 'echo' && gameState?.lastStats) {
       inherited.attack += Math.floor(gameState.lastStats.attack * 0.2);
       inherited.maxHp += Math.floor(gameState.lastStats.maxHp * 0.2);
       inherited.maxArmor += Math.floor(gameState.lastStats.maxArmor * 0.2);
       inherited.speed += Math.floor(gameState.lastStats.speed * 0.2);
       inherited.hp = inherited.maxHp; inherited.armor = inherited.maxArmor;
    }
    initLevel(1, inherited, 0, nameInput, undefined, relic, []);
  };

  if (!gameState) return null;

  return (
    <div className="bg-black min-h-screen text-zinc-300 font-sans selection:bg-red-500/30 overflow-x-hidden">
      {gameState.gameStatus === 'START_SCREEN' ? (
        <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center p-8 bg-black">
          <div className="max-w-md w-full text-center space-y-12 animate-in fade-in zoom-in-95 duration-700">
            <h1 className="text-6xl md:text-7xl font-sans font-black tracking-tighter flex items-center justify-center leading-none">
              <span className="text-white">ROGUE</span><span className="text-red-800">QUEST</span>
            </h1>
            <div className="bg-[#0f0f0f] border border-zinc-800 rounded-[2.5rem] p-10 space-y-8 shadow-2xl">
              {!isNewGameMode && gameState.playerName ? (
                <div className="space-y-4">
                  <button onClick={() => { startMusic(); setGameState({ ...gameState, gameStatus: 'PLAYING' as const }); }} className="w-full bg-red-800 hover:bg-red-700 py-5 rounded-2xl text-white font-mono font-bold text-xs uppercase tracking-widest shadow-xl transition-all transform active:scale-95">{t.continue_journey}</button>
                  <button onClick={() => setIsNewGameMode(true)} className="w-full bg-[#1e1e1e] hover:bg-[#2a2a2a] py-5 rounded-2xl text-zinc-500 font-mono font-bold text-[10px] uppercase tracking-widest transition-all">{t.new_game}</button>
                  <button onClick={() => window.open('https://t.me/ComunidadeRQ/27', '_blank')} className="w-full bg-zinc-900 border-2 border-zinc-800 text-zinc-500 rounded-2xl py-4 font-mono font-bold text-[9px] uppercase tracking-widest hover:text-white transition-all">Feedback</button>
                  <div className="flex justify-center gap-3 pt-2">
                    <button onClick={() => changeLanguage('PT')} className={`p-3 rounded-xl border-2 transition-all ${currentLang === 'PT' ? 'border-green-600 bg-green-900/20 scale-110 shadow-lg shadow-green-900/20' : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-600 hover:bg-zinc-800 text-zinc-600'}`} title="Português">
                      <Icon.FlagBR />
                    </button>
                    <button onClick={() => changeLanguage('EN')} className={`p-3 rounded-xl border-2 transition-all ${currentLang === 'EN' ? 'border-blue-600 bg-blue-900/20 scale-110 shadow-lg shadow-blue-900/20' : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-600 hover:bg-zinc-800 text-zinc-600'}`} title="English">
                      <Icon.FlagUS />
                    </button>
                    <button onClick={() => changeLanguage('ES')} className={`p-3 rounded-xl border-2 transition-all ${currentLang === 'ES' ? 'border-yellow-600 bg-yellow-900/20 scale-110 shadow-lg shadow-yellow-900/20' : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-600 hover:bg-zinc-800 text-zinc-600'}`} title="Español">
                      <Icon.FlagES />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <input type="text" maxLength={12} placeholder={t.hero_placeholder} value={nameInput} onChange={e => setNameInput(e.target.value.toUpperCase())} className="w-full bg-[#0a0a0a] border-2 border-zinc-800 rounded-2xl py-5 px-6 text-center font-mono text-white focus:border-red-600 transition-all outline-none"/>
                  <button onClick={() => { if(!nameInput.trim()) return; startMusic(); initLevel(1, undefined, 0, nameInput); }} disabled={!nameInput.trim()} className="w-full bg-red-800 hover:bg-red-700 py-5 rounded-2xl text-white font-mono font-bold text-xs uppercase tracking-widest transition-all disabled:opacity-30">{t.start_journey}</button>
                  <button onClick={() => window.open('https://t.me/ComunidadeRQ/27', '_blank')} className="w-full bg-zinc-900 border-2 border-zinc-800 text-zinc-500 rounded-2xl py-4 font-mono font-bold text-[9px] uppercase tracking-widest hover:text-white transition-all">Feedback</button>
                  <div className="flex justify-center gap-3 pt-2">
                    <button onClick={() => changeLanguage('PT')} className={`p-3 rounded-xl border-2 transition-all ${currentLang === 'PT' ? 'border-green-600 bg-green-900/20 scale-110 shadow-lg shadow-green-900/20' : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-600 hover:bg-zinc-800 text-zinc-600'}`} title="Português">
                      <Icon.FlagBR />
                    </button>
                    <button onClick={() => changeLanguage('EN')} className={`p-3 rounded-xl border-2 transition-all ${currentLang === 'EN' ? 'border-blue-600 bg-blue-900/20 scale-110 shadow-lg shadow-blue-900/20' : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-600 hover:bg-zinc-800 text-zinc-600'}`} title="English">
                      <Icon.FlagUS />
                    </button>
                    <button onClick={() => changeLanguage('ES')} className={`p-3 rounded-xl border-2 transition-all ${currentLang === 'ES' ? 'border-yellow-600 bg-yellow-900/20 scale-110 shadow-lg shadow-yellow-900/20' : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-600 hover:bg-zinc-800 text-zinc-600'}`} title="Español">
                      <Icon.FlagES />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="max-w-[480px] mx-auto p-4 flex flex-col gap-4 min-h-screen">
          <header className="flex justify-between items-start py-4 px-1 border-b border-zinc-900 mb-2">
            <div className="flex flex-col">
              <h2 className="text-2xl font-black tracking-tighter uppercase flex leading-none">
                <span className="text-white">ROGUE</span><span className="text-red-800">QUEST</span>
              </h2>
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mt-1 leading-none">
                {t.level} {gameState.level} — {t[THEME_CONFIG[gameState.theme].nameKey]}
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => window.open('https://t.me/ComunidadeRQ', '_blank')} className="w-10 h-10 bg-zinc-900/80 border border-zinc-800 rounded-xl flex items-center justify-center text-zinc-400 hover:text-white transition-colors" title="Comunidade"><Icon.Users /></button>
              <button onClick={handleShare} className="w-10 h-10 bg-zinc-900/80 border border-zinc-800 rounded-xl flex items-center justify-center text-zinc-400 hover:text-white transition-colors" title="Compartilhar"><Icon.Share /></button>
              <button onClick={() => setIsMuted(!isMuted)} className={`w-10 h-10 bg-zinc-900/80 border border-zinc-800 rounded-xl flex items-center justify-center transition-colors ${isMuted ? 'text-zinc-600' : 'text-red-800'}`} title="Som">{isMuted ? <Icon.VolumeX /> : <Icon.Volume2 />}</button>
            </div>
          </header>

          {gameState.gameStatus !== 'WON' && gameState.gameStatus !== 'NEXT_LEVEL' && gameState.gameStatus !== 'RELIC_SELECTION' && gameState.map.length > 0 && (
            <div className="flex flex-col gap-4">
              <GameMap 
                map={gameState.map} theme={gameState.theme} playerPos={gameState.playerPos} enemies={gameState.enemies} chests={gameState.chests} potions={gameState.potions} items={gameState.items} keyPos={gameState.keyPos} merchantPos={gameState.merchantPos} altarPos={gameState.altarPos} eggPos={gameState.eggPos} hasKey={gameState.hasKey} stairsPos={gameState.stairsPos} activePet={gameState.activePet} isCrowUnlocked={gameState.isCrowUnlocked} crowPos={gameState.crowPos} keyPath={gameState.keyPath} onTileClick={handleTileClick} tronModeActive={gameState.tronModeActive} tronTrail={gameState.tronTrail} 
                ritualDarkness={gameState.activeAltarEffect?.id === 'ritual_darkness'}
                compassPath={gameState.compassPath} mapPath={gameState.mapPath}
                poisonStatus={gameState.poisonStatus}
                traps={gameState.traps}
              />
              <HUD level={gameState.level} stats={gameState.playerStats} logs={gameState.logs} hasKey={gameState.hasKey} kills={gameState.enemiesKilledInLevel} gold={gameState.gold} playerName={gameState.playerName} activePet={gameState.activePet} isCrowUnlocked={gameState.isCrowUnlocked} language={currentLang} inventory={gameState.inventory} inventorySize={gameState.inventorySize} activeRelic={gameState.activeRelic} activeAltarEffect={gameState.activeAltarEffect} poisonStatus={gameState.poisonStatus} onUsePotion={usePotionFromInventory} tronModeActive={gameState.tronModeActive} tronTimeLeft={gameState.tronTimeLeft}
                hasCompass={gameState.hasCompass} hasMap={gameState.hasMap} enemiesCount={gameState.enemies.length}
              />
            </div>
          )}
        </div>
      )}

      {gameState.gameStatus === 'LOST' && (
        <div className="fixed inset-0 z-[120] bg-black/98 flex flex-col items-center justify-center p-6 animate-in fade-in overflow-y-auto backdrop-blur-md">
          <div className="max-w-md w-full text-center space-y-8 animate-in zoom-in-95 duration-500">
            <h2 className="text-7xl font-black text-red-600 uppercase tracking-tighter drop-shadow-[0_0_20px_rgba(220,38,38,0.5)]">MORTE</h2>
            <div className="bg-[#0f0f0f] border-2 border-zinc-800 rounded-[2.5rem] p-8 space-y-6 shadow-2xl">
              <div className="space-y-4">
                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em]">ESTATÍSTICAS FINAIS</p>
                <div className="grid grid-cols-2 gap-3 text-center">
                   <div className="bg-black/40 p-3 rounded-2xl border border-zinc-800/50 flex flex-col items-center">
                      <span className="text-[8px] font-bold text-zinc-600 uppercase">NÍVEL ALCANÇADO</span>
                      <span className="text-lg font-black text-white">{gameState.level}</span>
                   </div>
                   <div className="bg-black/40 p-3 rounded-2xl border border-zinc-800/50 flex flex-col items-center">
                      <span className="text-[8px] font-bold text-zinc-600 uppercase">VIDA MÁXIMA</span>
                      <span className="text-lg font-black text-red-500">{gameState.lastStats?.maxHp}</span>
                   </div>
                   <div className="bg-black/40 p-3 rounded-2xl border border-zinc-800/50 flex flex-col items-center">
                      <span className="text-[8px] font-bold text-zinc-600 uppercase">ATAQUE (ATK)</span>
                      <span className="text-lg font-black text-yellow-500">{gameState.lastStats?.attack}</span>
                   </div>
                   <div className="bg-black/40 p-3 rounded-2xl border border-zinc-800/50 flex flex-col items-center">
                      <span className="text-[8px] font-bold text-zinc-600 uppercase">ESCUDO</span>
                      <span className="text-lg font-black text-blue-500">{gameState.lastStats?.maxArmor}</span>
                   </div>
                   <div className="col-span-2 bg-black/40 p-3 rounded-2xl border border-zinc-800/50 flex flex-col items-center">
                      <span className="text-[8px] font-bold text-zinc-600 uppercase">VELOCIDADE (VEL)</span>
                      <span className="text-lg font-black text-green-500">{gameState.lastStats?.speed}</span>
                   </div>
                </div>
              </div>

              {(gameState.activeAltarEffect || gameState.activeRelic) && (
                <div className="pt-4 border-t border-zinc-800/50 space-y-3">
                  <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em]">Efeitos Ativos</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {gameState.activeRelic && <div className="px-3 py-1 bg-purple-900/20 border border-purple-500/30 rounded-full text-[9px] font-black text-purple-400 uppercase">{gameState.activeRelic.name} (R)</div>}
                    {gameState.activeAltarEffect?.type === 'BLESSING' && <div className="px-3 py-1 bg-yellow-900/20 border border-yellow-500/30 rounded-full text-[9px] font-black text-yellow-400 uppercase">{t[gameState.activeAltarEffect.nameKey]} (B)</div>}
                    {gameState.activeAltarEffect?.type === 'CURSE' && <div className="px-3 py-1 bg-red-900/20 border border-red-500/30 rounded-full text-[9px] font-black text-red-400 uppercase">{t[gameState.activeAltarEffect.nameKey]} (M)</div>}
                  </div>
                </div>
              )}

              <button onClick={startRebirth} className="w-full py-5 bg-red-800 hover:bg-red-700 text-white font-black rounded-2xl uppercase tracking-widest text-sm shadow-xl transform active:scale-95 transition-all">RENASCER</button>
            </div>
          </div>
        </div>
      )}

      {/* Modais de Gameplay */}
      {gameState.gameStatus === 'EGG_INTERACTION' && (
        <EggStoryModal 
          language={currentLang} 
          onAccept={() => {
             // Unlock Crow permanently without replacing active pet
             localStorage.setItem('rq_crow_unlocked', 'true');
             setGameState(prev => {
                 if (!prev) return null;
                 return {
                     ...prev,
                     isCrowUnlocked: true,
                     eggPos: undefined, // Remove egg from map
                     crowPos: prev.playerPos, // Spawn crow at player location
                     gameStatus: 'PLAYING'
                 };
             });
          }}
        />
      )}

      {gameState.gameStatus === 'COMBAT' && gameState.currentEnemy && (
        <CombatModal 
          playerStats={gameState.playerStats} enemy={gameState.currentEnemy} 
          activePet={gameState.activePet} language={currentLang} 
          altarEffect={gameState.activeAltarEffect} relic={gameState.activeRelic} 
          inventory={gameState.inventory} onAttackSound={playAttackSound} 
          onUsePotion={usePotionFromInventory} onFinish={onCombatFinish} 
        />
      )}
      
      {gameState.gameStatus === 'CHEST_OPEN' && (
        <ChestModal 
          language={currentLang} 
          onChoice={(choice, extra) => {
            setGameState(prev => {
              if (!prev) return prev;
              const stats = { ...prev.playerStats };
              const mult = prev.activeAltarEffect?.id === 'consecrated_chest' ? 2 : 1;
              if (choice === 'Ataque') stats.attack += 5 * mult;
              if (choice === 'Armadura') { stats.maxArmor += 3 * mult; stats.armor += 3 * mult; }
              if (choice === 'Velocidade') stats.speed += 4 * mult;
              
              let gold = prev.gold; 
              let inv = [...prev.inventory];
              if (extra === 'gold') gold += Math.floor(Math.random() * 21) + 10;
              else if (inv.length < prev.inventorySize) {
                const perc = [25, 50, 75][Math.floor(Math.random() * 3)];
                inv.push({ id: `c-pot-${Date.now()}`, percent: perc, x: 0, y: 0 });
              }

              return { 
                ...prev, 
                playerStats: stats, gold: gold, inventory: inv, 
                gameStatus: 'PLAYING' as const, 
                activeAltarEffect: mult === 2 ? undefined : prev.activeAltarEffect 
              } as GameState;
            });
          }} 
        />
      )}

      {gameState.gameStatus === 'ALTAR_INTERACTION' && (
        <AltarInteractionModal 
          language={currentLang} 
          active={gameState.enemiesKilledInLevel > 0 && !gameState.hasUsedAltarInLevel} 
          onPray={() => {
            const isLucky = Math.random() > 0.5;
            const pool = isLucky ? BLESSINGS_POOL : CURSES_POOL;
            const effect = pool[Math.floor(Math.random() * pool.length)];
            
            let keyPath: Position[] | undefined = undefined;
            if (effect.id === 'open_eyes' && gameState!.keyPos) {
              const path = findDungeonPath(gameState!.playerPos, gameState!.keyPos, gameState!.map, gameState!.enemies);
              if (path) keyPath = path;
            }

            setGameState({ 
              ...gameState!, 
              gameStatus: 'ALTAR_RESULT' as const, 
              activeAltarEffect: effect, 
              hasUsedAltarInLevel: true,
              keyPath: keyPath || gameState!.keyPath
            });
          }} 
          onClose={() => setGameState({ ...gameState!, gameStatus: 'PLAYING' as const })} 
        />
      )}

      {gameState.gameStatus === 'ALTAR_RESULT' && gameState.activeAltarEffect && (
        <AltarResultModal 
          effect={gameState.activeAltarEffect} language={currentLang} 
          onClose={() => setGameState({ ...gameState!, gameStatus: 'PLAYING' as const })} 
        />
      )}

      {gameState.gameStatus === 'RELIC_SELECTION' && gameState.relicOptions && (
        <RelicSelectionModal options={gameState.relicOptions} language={currentLang} onSelect={handleRelicSelect} />
      )}

      {gameState.gameStatus === 'MERCHANT_SHOP' && (
        <MerchantShopModal 
          gold={gameState.gold} level={gameState.level} hasPet={!!gameState.activePet} 
          language={currentLang} activeAltarEffect={gameState.activeAltarEffect} 
          hasCompass={gameState.hasCompass} hasMap={gameState.hasMap}
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
              const stats = { ...gameState!.playerStats };
              const heal = Math.floor(stats.maxHp * (pot.percent / 100));
              stats.hp = Math.min(stats.maxHp, stats.hp + heal);
              setGameState({ ...gameState!, gold: gameState!.gold - pot.price!, playerStats: stats });
            } else {
              setGameState({ ...gameState!, gold: gameState!.gold - pot.price!, inventory: [...gameState!.inventory, pot] });
            }
          }} 
          onRentTron={() => setGameState(prev => prev ? { ...prev, gold: prev.gold - 25, tronModeActive: true, tronTimeLeft: 20, gameStatus: 'PLAYING' as const } as GameState : null)} 
          onBuyCompass={() => {
             setGameState(prev => {
                 if (!prev) return prev;
                 const tempState = { ...prev, gold: prev.gold - 90, hasCompass: true };
                 const guides = updateGuides(tempState, prev.playerPos);
                 return { ...tempState, compassPath: guides.compass, mapPath: guides.map } as GameState;
             });
          }}
          onBuyMap={() => {
             setGameState(prev => {
                 if (!prev) return prev;
                 const tempState = { ...prev, gold: prev.gold - 90, hasMap: true };
                 const guides = updateGuides(tempState, prev.playerPos);
                 return { ...tempState, compassPath: guides.compass, mapPath: guides.map } as GameState;
             });
          }}
          onBuyAntidote={() => {
             setGameState(prev => {
                 if (!prev) return prev;
                 return { 
                     ...prev, 
                     gold: prev.gold - 50, 
                     poisonStatus: undefined, 
                     logs: [...prev.logs, t.cured] 
                 } as GameState;
             });
          }}
          onBuyPet={(type) => {
            const pet: Pet = { type, name: type, hp: 50, maxHp: 50, pos: { ...playerPosRef.current } };
            setGameState(prev => prev ? { ...prev, gold: prev.gold - (type === 'URSO' ? 15 : 10), activePet: pet } as GameState : null);
          }} 
          onClose={() => setGameState(prev => prev ? { ...prev, gameStatus: 'PLAYING' as const } as GameState : null)} 
        />
      )}

      {gameState.gameStatus === 'TUTORIAL' && <TutorialModal language={currentLang} onFinish={() => setGameState({...gameState, gameStatus: 'PLAYING' as const})} />}
      
      {gameState.gameStatus === 'PICKUP_CHOICE' && gameState.currentPotion && (
        <PotionPickupModal 
          potion={gameState.currentPotion} language={currentLang} 
          onChoice={(choice) => {
            if (choice === 'use') {
              const stats = { ...gameState!.playerStats };
              const heal = Math.floor(stats.maxHp * (gameState!.currentPotion!.percent / 100));
              stats.hp = Math.min(stats.maxHp, stats.hp + heal);
              setGameState({...gameState!, playerStats: stats, gameStatus: 'PLAYING' as const, currentPotion: undefined});
            } else {
              if (gameState!.inventory.length < gameState!.inventorySize) {
                setGameState({...gameState!, inventory: [...gameState!.inventory, gameState!.currentPotion!], gameStatus: 'PLAYING' as const, currentPotion: undefined});
              } else {
                setInventoryFullAlert(true);
                setGameState({...gameState!, gameStatus: 'PLAYING' as const, currentPotion: undefined});
              }
            }
          }} 
        />
      )}

      {gameState.gameStatus === 'NEXT_LEVEL' && (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center p-8 space-y-12 animate-in fade-in">
          <h2 className="text-4xl md:text-5xl font-black text-red-600 uppercase tracking-tighter">DESCENDO MAIS FUNDO...</h2>
          <button onClick={() => initLevel(gameState.level + 1, gameState.playerStats, gameState.gold, gameState.playerName, gameState.activePet, gameState.activeRelic, gameState.inventory)} className="px-12 py-6 bg-white text-black font-black rounded-2xl uppercase tracking-[0.2em] text-lg hover:bg-zinc-200 shadow-2xl transition-all active:scale-95">Prosseguir</button>
        </div>
      )}

      {inventoryFullAlert && (
        <div className="fixed inset-0 z-[150] bg-black/80 flex items-center justify-center p-6 backdrop-blur-sm">
          <div className="bg-zinc-900 border-2 border-red-500 p-8 rounded-3xl max-w-xs w-full text-center space-y-4 animate-in zoom-in-95">
             <h3 className="text-white font-black uppercase text-sm">Inventário Cheio!</h3>
             <button onClick={() => setInventoryFullAlert(false)} className="w-full py-3 bg-red-600 text-white font-black rounded-xl uppercase text-xs">OK</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
