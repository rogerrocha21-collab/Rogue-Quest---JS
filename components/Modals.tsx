
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Enemy, EntityStats, StatChoice, PotionEntity, ItemEntity, Pet, Language, Relic, AltarEffect } from '../types';
import { Icon } from './Icons';
import { ITEM_POOL, TRANSLATIONS, RELICS_POOL } from '../constants';

interface CombatModalProps {
  playerStats: EntityStats;
  enemy: Enemy;
  activePet?: Pet;
  language?: Language;
  altarEffect?: AltarEffect;
  relic?: Relic;
  inventory?: PotionEntity[];
  onAttackSound?: (attacker: 'player' | 'enemy') => void;
  onUsePotion: (idx: number) => boolean;
  onFinish: (newPlayerStats: EntityStats, win: boolean, goldEarned: number, petHp?: number) => void;
}

export const CombatModal: React.FC<CombatModalProps> = ({ playerStats, enemy, activePet, language = 'PT', altarEffect, relic, inventory = [], onAttackSound, onUsePotion, onFinish }) => {
  const [currentPStats, setCurrentPStats] = useState({ ...playerStats });
  const [currentEStats, setCurrentEStats] = useState({ ...enemy.stats });
  const [petHp, setPetHp] = useState(activePet?.hp || 0);
  const [isDone, setIsDone] = useState(false);
  const [lastAttacker, setLastAttacker] = useState<'player' | 'enemy' | 'pet' | null>(null);
  const [isTakingDamage, setIsTakingDamage] = useState<'player' | 'enemy' | 'pet' | null>(null);
  const [combatLogs, setCombatLogs] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pRef = useRef({ ...playerStats }); 
  const t = TRANSLATIONS[language];

  const addLog = (msg: string) => {
    setCombatLogs(prev => [...prev, msg]);
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [combatLogs]);

  useEffect(() => {
    let e = { ...currentEStats };
    let curPetHp = petHp;
    let turnCount = 0;
    let lastPlayerAttackTurn = -1;
    let isFirstPlayerHitInCombat = true;
    
    const resolveTurn = () => {
      if (pRef.current.hp <= 0 || e.hp <= 0) { setIsDone(true); return; }
      const executeSequence = async () => {
        turnCount++;
        
        // Pet Turn
        if (activePet && curPetHp > 0) {
            setLastAttacker('pet');
            setIsTakingDamage('enemy');
            if (onAttackSound) onAttackSound('player');
            
            let petAtk = Math.max(1, Math.floor(pRef.current.attack / 2));
            if (relic?.id === 'collar') petAtk += 10;

            e.hp -= petAtk;
            if (e.hp < 0) e.hp = 0;
            addLog(`${t.combat_pet} ${t.combat_dealt} ${petAtk} ${t.combat_damage}`);
            setCurrentEStats({ ...e });
            await new Promise(r => setTimeout(r, 400));
            setIsTakingDamage(null);
            if (e.hp <= 0) { setIsDone(true); return; }
        }

        const enemiesFirst = altarEffect?.id === 'slow_reflexes';
        const playersTurn = !enemiesFirst && (pRef.current.speed >= e.speed);
        const turnOrder = playersTurn ? ['player', 'enemy'] : ['enemy', 'player'];

        const processSide = async (side: 'player' | 'enemy') => {
            if (pRef.current.hp <= 0 || e.hp <= 0) return;
            
            if (side === 'player' && altarEffect?.id === 'short_breath' && lastPlayerAttackTurn === turnCount - 1) {
                addLog(`Você recupera o fôlego...`);
                return;
            }
            if (side === 'player' && altarEffect?.id === 'trembling_hands' && Math.random() < 0.25) {
                addLog(`Você errou o ataque!`);
                return;
            }

            let atkValue = side === 'player' ? pRef.current.attack : e.attack;
            if (side === 'player') {
                if (relic?.id === 'power' && isFirstPlayerHitInCombat) {
                    atkValue = Math.floor(atkValue * 1.1);
                    isFirstPlayerHitInCombat = false;
                }
                if (relic?.id === 'crit' && Math.random() < 0.01) {
                    atkValue *= 2;
                    addLog(`CRÍTICO!`);
                }
            }

            setLastAttacker(side);
            setIsTakingDamage(side === 'player' ? 'enemy' : 'player');
            if (onAttackSound) onAttackSound(side);
            
            let defender = side === 'player' ? e : pRef.current;
            let originalAtk = atkValue;
            if (side === 'enemy' && relic?.id === 'defense') originalAtk = Math.max(1, originalAtk - 1);

            let absorbed = 0;
            if (defender.armor > 0) {
              absorbed = Math.min(defender.armor, originalAtk);
              defender.armor = Math.max(0, defender.armor - absorbed);
              atkValue -= absorbed;
            }
            if (atkValue > 0) defender.hp -= atkValue;
            
            if (defender.hp < 0) defender.hp = 0;
            if (side === 'player') lastPlayerAttackTurn = turnCount;

            addLog(`${side === 'player' ? t.combat_player : t.combat_enemy} ${t.combat_dealt} ${originalAtk} ${t.combat_damage}`);
            setCurrentPStats({ ...pRef.current }); 
            setCurrentEStats({ ...e }); 

            await new Promise(r => setTimeout(r, 400));
            setIsTakingDamage(null);
        };

        await processSide(turnOrder[0] as any);
        if (pRef.current.hp > 0 && e.hp > 0) {
            await new Promise(r => setTimeout(r, 300));
            await processSide(turnOrder[1] as any);
            if (pRef.current.hp > 0 && e.hp > 0) setTimeout(resolveTurn, 500);
            else setIsDone(true);
        } else { setIsDone(true); }
      };
      executeSequence();
    };
    setTimeout(resolveTurn, 800);
  }, []);

  const handleUsePotion = (idx: number) => {
    if (isDone) return;
    const success = onUsePotion(idx);
    if (success) {
      setCurrentPStats({ ...pRef.current });
      addLog(`Poção usada!`);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-50 p-4 md:p-6 backdrop-blur-md">
      <div className="bg-zinc-900 border-2 border-zinc-800 max-w-xl w-full p-5 md:p-8 rounded-[2.5rem] shadow-2xl flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-6 md:gap-12 font-mono">
          <div className={`text-center space-y-4 transition-all duration-200 ${lastAttacker === 'player' ? 'scale-105' : ''} ${isTakingDamage === 'player' ? 'animate-shake' : ''}`}>
            <div className={`p-5 rounded-3xl border-2 transition-colors relative ${isTakingDamage === 'player' ? 'bg-red-900/40 border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.4)]' : 'bg-zinc-800 border-zinc-700'}`}>
              <span className="text-yellow-400 scale-125 block"><Icon.Player /></span>
              {isTakingDamage === 'player' && <div className="absolute inset-0 bg-red-600/20 animate-pulse rounded-3xl" />}
            </div>
            <div className="h-3 bg-zinc-800 rounded-full overflow-hidden border border-zinc-700">
                <div className="h-full bg-red-500 transition-all duration-300" style={{ width: `${(currentPStats.hp / currentPStats.maxHp) * 100}%` }} />
            </div>
            <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest">{t.hp}: <span className="text-white">{currentPStats.hp}</span></p>
          </div>
          <div className={`text-center space-y-4 transition-all duration-200 ${lastAttacker === 'enemy' ? 'scale-105' : ''} ${isTakingDamage === 'enemy' ? 'animate-shake' : ''}`}>
            <div className={`p-5 rounded-3xl border-2 transition-colors relative ${enemy.isBoss ? 'bg-red-950 border-red-800' : isTakingDamage === 'enemy' ? 'bg-red-900/40 border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.4)]' : 'bg-zinc-800 border-zinc-700'}`}>
              <span className={enemy.isBoss ? 'text-red-500' : 'text-zinc-300'}><Icon.Enemy isBoss={enemy.isBoss} /></span>
              {isTakingDamage === 'enemy' && <div className="absolute inset-0 bg-red-600/20 animate-pulse rounded-3xl" />}
            </div>
            <div className="h-3 bg-zinc-800 rounded-full overflow-hidden border border-zinc-700">
                <div className="h-full bg-red-700 transition-all duration-300" style={{ width: `${(currentEStats.hp / currentEStats.maxHp) * 100}%` }} />
            </div>
            <p className="text-[9px] text-zinc-500 uppercase font-black tracking-widest">{enemy.type}</p>
          </div>
        </div>

        {!isDone && inventory.length > 0 && (
          <div className="flex justify-center gap-2 p-3 bg-black/30 rounded-2xl border border-zinc-800/50">
            {inventory.map((pot, i) => (
              <button key={i} onClick={() => handleUsePotion(i)} className="p-2 bg-pink-900/10 border border-pink-500/30 rounded-xl text-pink-400 hover:bg-pink-500/20 transition-all flex flex-col items-center">
                <Icon.Potion />
                <span className="text-[7px] font-black">+{pot.percent}%</span>
              </button>
            ))}
          </div>
        )}

        <div className="bg-black/50 border border-zinc-800 rounded-2xl p-4 h-32 md:h-40 overflow-hidden">
          <div ref={scrollRef} className="overflow-y-auto h-full pr-2 space-y-1.5 scroll-smooth no-scrollbar">
            {combatLogs.map((log, i) => (
              <p key={i} className="text-[9px] font-mono leading-tight text-zinc-400 flex gap-2">
                <span className="text-zinc-700">[{i+1}]</span>
                <span className={log.includes(t.combat_player) ? 'text-white font-bold' : 'text-zinc-400'}>{log}</span>
              </p>
            ))}
          </div>
        </div>

        {isDone && (
          <button onClick={() => onFinish(currentPStats, currentPStats.hp > 0, Math.floor(Math.random() * 10) + 10, petHp)} className={`w-full font-black py-5 rounded-2xl transition-all uppercase text-xs tracking-widest ${currentPStats.hp > 0 ? "bg-green-600 hover:bg-green-500 shadow-[0_0_20px_rgba(22,163,74,0.3)]" : "bg-red-700 hover:bg-red-600 shadow-[0_0_20px_rgba(185,28,28,0.3)]"}`}>
            {currentPStats.hp > 0 ? t.collect_reward : t.succumb}
          </button>
        )}
      </div>
    </div>
  );
};

export const MerchantShopModal: React.FC<MerchantShopModalProps> = ({
  gold, level, hasPet, language = 'PT', discount, onBuyItem, onBuyPotion, onRentTron, onBuyPet, onClose
}) => {
  const t = TRANSLATIONS[language];
  const mult = discount ? 0.7 : 1.0;

  const shopItems = useMemo(() => {
    return [...ITEM_POOL]
      .sort(() => 0.5 - Math.random())
      .slice(0, 3)
      .map(item => ({
        ...item,
        id: `shop-item-${Math.random()}`,
        price: Math.floor(item.basePrice * (1 + level * 0.1) * mult),
        x: 0, y: 0
      })) as ItemEntity[];
  }, [level, mult]);

  const potions = useMemo(() => [
    { id: 'p25', percent: 25, price: Math.floor(12 * mult) },
    { id: 'p50', percent: 50, price: Math.floor(25 * mult) },
    { id: 'p75', percent: 75, price: Math.floor(40 * mult) }
  ], [mult]);

  return (
    <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-50 p-4 md:p-6 backdrop-blur-lg overflow-y-auto">
      <div className="bg-zinc-900 border-2 border-indigo-500 max-w-xl w-full p-6 md:p-10 rounded-[3rem] shadow-[0_0_60px_rgba(99,102,241,0.2)] flex flex-col gap-8 animate-in slide-in-from-bottom-10">
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <h2 className="text-3xl font-black text-white uppercase tracking-tighter">{t.merchant_title}</h2>
            <div className="flex items-center gap-2 text-yellow-500 font-mono font-bold">
              <Icon.Gold /> <span>{gold}</span>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-zinc-500 hover:text-white"><Icon.VolumeX /></button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {shopItems.map(item => (
            <button
              key={item.id}
              disabled={gold < (item.price || 0)}
              onClick={() => onBuyItem(item)}
              className="flex items-center gap-4 p-4 bg-zinc-800/50 border border-zinc-800 rounded-3xl hover:border-indigo-500 transition-all disabled:opacity-40"
            >
              <div className="w-12 h-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-400">
                {item.iconType === 'sword' ? <Icon.Sword /> : item.iconType === 'shield' ? <Icon.Shield /> : item.iconType === 'boot' ? <Icon.Boot /> : <Icon.Heart />}
              </div>
              <div className="flex-1 text-left">
                <p className="text-[10px] font-black text-white uppercase">{item.name}</p>
                <p className="text-[9px] text-yellow-500 font-black mt-1">{item.price} G</p>
              </div>
            </button>
          ))}

          <div className="md:col-span-2 p-4 bg-zinc-800/50 border border-zinc-800 rounded-3xl flex flex-col gap-4">
             <p className="text-[9px] font-black text-pink-500 uppercase tracking-widest text-center">Poções de Cura</p>
             <div className="grid grid-cols-3 gap-2">
                {potions.map(p => (
                   <div key={p.id} className="flex flex-col gap-2">
                      <div className="flex items-center justify-center p-2 bg-pink-500/10 rounded-xl text-pink-400">
                        <Icon.Potion width={16} height={16} /> <span className="text-[10px] font-bold ml-1">{p.percent}%</span>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => onBuyPotion(p as any, 'use')} disabled={gold < p.price} className="flex-1 py-1 bg-pink-600/20 text-pink-400 text-[7px] font-black rounded border border-pink-500/20">USAR</button>
                        <button onClick={() => onBuyPotion(p as any, 'store')} disabled={gold < p.price} className="flex-1 py-1 bg-zinc-700/50 text-zinc-300 text-[7px] font-black rounded">GUARDAR</button>
                      </div>
                      <p className="text-[8px] text-center text-yellow-500 font-black">{p.price} G</p>
                   </div>
                ))}
             </div>
          </div>

          {!hasPet && (
            <div className="md:col-span-2 p-4 bg-orange-950/10 border border-orange-500/20 rounded-3xl flex flex-col gap-4">
               <p className="text-[9px] font-black text-orange-500 uppercase tracking-widest text-center">Companheiros Leais</p>
               <div className="grid grid-cols-3 gap-2">
                  {(['LOBO', 'PUMA', 'CORVO'] as Pet['type'][]).map(type => (
                    <button 
                      key={type}
                      onClick={() => onBuyPet(type)}
                      disabled={gold < 10}
                      className="flex flex-col items-center gap-2 p-3 bg-black/40 rounded-2xl border border-zinc-800 hover:border-orange-500 transition-all disabled:opacity-30"
                    >
                      <span className="text-orange-400">{type === 'LOBO' ? <Icon.Wolf /> : type === 'PUMA' ? <Icon.Puma /> : <Icon.Corvo />}</span>
                      <span className="text-[8px] font-black text-zinc-300">{type}</span>
                      <span className="text-[8px] font-black text-yellow-500">10 G</span>
                    </button>
                  ))}
               </div>
            </div>
          )}

          <button 
            disabled={gold < 25}
            onClick={onRentTron}
            className="md:col-span-2 p-5 bg-cyan-900/20 border border-cyan-500/40 rounded-3xl flex items-center gap-6 hover:bg-cyan-900/40 transition-all disabled:opacity-30 group"
          >
            <div className="w-14 h-14 bg-cyan-500/10 rounded-2xl flex items-center justify-center text-cyan-400 group-hover:animate-tron-pulse"><Icon.Horse width={32} height={32}/></div>
            <div className="flex-1 text-left">
              <p className="text-[11px] font-black text-white uppercase tracking-tighter">Cavalo Fantasma (15s)</p>
              <p className="text-[9px] text-cyan-500 font-bold uppercase tracking-widest">Velocidade Extrema & Rastro</p>
              <p className="text-[10px] text-yellow-500 font-black mt-1">25 G</p>
            </div>
          </button>
        </div>

        <button onClick={onClose} className="w-full py-5 bg-zinc-800 text-zinc-400 font-black rounded-2xl uppercase text-xs hover:text-white transition-all border border-zinc-700">{t.close_deal}</button>
      </div>
    </div>
  );
};

export const ChestModal: React.FC<ChestModalProps> = ({ onChoice, language = 'PT', doubleBonus }) => {
  const t = TRANSLATIONS[language];
  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-6 backdrop-blur-md">
      <div className="bg-zinc-900 border-2 border-blue-500 max-w-sm w-full p-8 rounded-[2.5rem] shadow-[0_0_50px_rgba(59,130,246,0.3)] text-center space-y-8 animate-in zoom-in-95">
        <div className="text-blue-400 flex justify-center scale-[2.5] mb-4 drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]"><Icon.Chest /></div>
        <div className="space-y-2">
          <h2 className="text-2xl font-black text-white uppercase tracking-tighter">{t.chest_title}</h2>
          {doubleBonus && <p className="text-yellow-500 font-bold text-[10px] uppercase tracking-widest animate-pulse">Bônus Duplicado!</p>}
        </div>
        <div className="grid grid-cols-1 gap-3">
          {(['Ataque', 'Armadura', 'Velocidade'] as StatChoice[]).map(choice => (
            <button key={choice} onClick={() => onChoice(choice)} className="group relative overflow-hidden py-4 bg-zinc-800 hover:bg-zinc-700 rounded-2xl border border-zinc-700 transition-all active:scale-95">
              <span className="relative z-10 font-black text-xs uppercase tracking-widest text-zinc-300 group-hover:text-white">
                {choice} {choice === 'Ataque' ? '+5' : choice === 'Armadura' ? '+3' : '+4'}{doubleBonus ? ' x2' : ''}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export const TutorialModal: React.FC<TutorialModalProps> = ({ onFinish, language = 'PT' }) => {
  const t = TRANSLATIONS[language];
  return (
    <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-[100] p-6 backdrop-blur-xl">
      <div className="max-w-md w-full space-y-8 animate-in fade-in zoom-in-95 duration-500">
        <div className="text-center space-y-4">
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-red-900/20 border-2 border-red-600 rounded-3xl flex items-center justify-center text-red-500 animate-pulse"><Icon.Player width={40} height={40} /></div>
          </div>
          <h2 className="text-4xl font-black text-white uppercase tracking-tighter">BEM-VINDO, HERÓI</h2>
          <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-3xl text-zinc-400 font-mono text-xs leading-relaxed text-left space-y-5">
            <p className="text-white border-b border-zinc-800 pb-2 font-black uppercase">O Caminho do Guerreiro:</p>
            <p>&gt; Batalhas são resolvidas <span className="text-yellow-500 font-black">automaticamente</span> em turnos.</p>
            <p>&gt; ❤️ <span className="text-red-500">VIDA:</span> Se chegar a 0, você perderá a alma.</p>
            <p>&gt; ⚔️ <span className="text-yellow-400">ATAQUE:</span> Representa o dano que você provoca por turno.</p>
            <p>&gt; 🛡️ <span className="text-blue-400">ESCUDO:</span> Absorve o dano antes da vida. Ele se <span className="text-zinc-200">recupera</span> entre batalhas.</p>
            <p>&gt; 🥾 <span className="text-green-500">VELOCIDADE:</span> Determina quem ataca primeiro no turno.</p>
            <p className="pt-2 border-t border-zinc-800 text-red-400 italic font-bold">Aviso: Você deve derramar o SANGUE de ao menos um inimigo e possuir a CHAVE para provar seu valor e abrir as escadas.</p>
          </div>
        </div>
        <button onClick={onFinish} className="w-full py-6 bg-red-800 hover:bg-red-700 text-white font-black rounded-[2rem] uppercase tracking-widest text-sm shadow-[0_0_30px_rgba(153,27,27,0.4)] transition-all">{t.start}</button>
      </div>
    </div>
  );
};

export const PotionPickupModal: React.FC<PotionPickupModalProps> = ({ potion, language = 'PT', onChoice }) => {
  const t = TRANSLATIONS[language];
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-6 backdrop-blur-sm">
      <div className="bg-zinc-900 border-2 border-pink-500 p-8 rounded-[2.5rem] max-w-xs w-full text-center space-y-6 animate-in zoom-in-95">
         <div className="text-pink-400 flex justify-center scale-[2.5] mb-4 drop-shadow-[0_0_15px_rgba(236,72,153,0.5)]"><Icon.Potion /></div>
         <h3 className="text-white font-black uppercase text-base tracking-tighter">Frasco Encontrado</h3>
         <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Cura {potion.percent}% da vida</p>
         <div className="grid grid-cols-1 gap-3">
           <button onClick={() => onChoice('use')} className="w-full py-4 bg-pink-600 hover:bg-pink-500 text-white font-black rounded-2xl uppercase text-[10px] tracking-widest">{t.use}</button>
           <button onClick={() => onChoice('store')} className="w-full py-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-black rounded-2xl uppercase text-[10px] tracking-widest border border-zinc-700">{t.store}</button>
         </div>
      </div>
    </div>
  );
};

export const RelicSelectionModal: React.FC<RelicSelectionModalProps> = ({ options, language = 'PT', onSelect }) => {
  const t = TRANSLATIONS[language];
  return (
    <div className="fixed inset-0 bg-black z-[130] flex flex-col items-center justify-center p-6 space-y-10 animate-in fade-in">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-black text-purple-500 tracking-tighter uppercase drop-shadow-[0_0_10px_rgba(168,85,247,0.5)]">{t.relic_choice}</h2>
        <p className="text-zinc-500 font-bold text-[10px] uppercase tracking-widest">Escolha o seu legado para a nova jornada</p>
      </div>
      <div className="grid grid-cols-1 gap-4 w-full max-w-sm">
        {options.map(relic => (
          <button key={relic.id} onClick={() => onSelect(relic)} className="group p-6 bg-zinc-900 border border-zinc-800 rounded-[2rem] text-left hover:border-purple-500/50 hover:bg-zinc-800/50 transition-all flex items-center gap-6">
            <div className="text-purple-400 group-hover:scale-125 transition-transform">{React.createElement((Icon as any)[relic.icon], { width: 32, height: 32 })}</div>
            <div className="space-y-1">
              <h4 className="text-sm font-black text-white uppercase">{relic.name}</h4>
              <p className="text-[10px] text-zinc-500 font-mono leading-tight">{relic.description}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export const AltarInteractionModal: React.FC<AltarInteractionModalProps> = ({ active, language = 'PT', onPray, onClose }) => {
  const t = TRANSLATIONS[language];
  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-6 backdrop-blur-md">
      <div className={`bg-zinc-900 border-2 p-8 rounded-[3rem] max-w-sm w-full text-center space-y-8 animate-in zoom-in-95 ${active ? 'border-purple-600 shadow-[0_0_50px_rgba(147,51,234,0.3)]' : 'border-zinc-800 opacity-80'}`}>
         <div className={`${active ? 'text-purple-500 animate-pulse' : 'text-zinc-700'} flex justify-center scale-[2.5] mb-4`}><Icon.Altar /></div>
         <h3 className="text-white font-black uppercase text-xl tracking-tighter">{t.altar_title}</h3>
         <p className="text-zinc-500 text-[10px] font-bold leading-relaxed">{active ? t.altar_prompt : t.altar_inactive}</p>
         <div className="flex flex-col gap-3">
            {active && <button onClick={onPray} className="w-full py-5 bg-purple-700 hover:bg-purple-600 text-white font-black rounded-2xl uppercase text-xs tracking-widest">ORAR</button>}
            <button onClick={onClose} className="w-full py-4 bg-zinc-800 text-zinc-400 font-black rounded-2xl uppercase text-[10px] border border-zinc-700">{t.close_deal}</button>
         </div>
      </div>
    </div>
  );
};

export const AltarResultModal: React.FC<AltarResultModalProps> = ({ effect, language = 'PT', onClose }) => {
  const t = TRANSLATIONS[language];
  const isBlessing = effect.type === 'BLESSING';
  return (
    <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-[60] p-6 backdrop-blur-xl">
      <div className={`bg-zinc-900 border-4 p-10 rounded-[3.5rem] max-sm w-full text-center space-y-8 animate-in zoom-in-95 ${isBlessing ? 'border-yellow-500 shadow-[0_0_60px_rgba(234,179,8,0.2)]' : 'border-purple-900 shadow-[0_0_60px_rgba(88,28,135,0.2)]'}`}>
         <div className={`flex justify-center scale-[3] mb-8 ${isBlessing ? 'text-yellow-500' : 'text-purple-600'}`}><Icon.Altar /></div>
         <div className="space-y-4">
            <h3 className="text-2xl font-black text-white uppercase tracking-tighter">{t[effect.nameKey]}</h3>
            <p className="text-zinc-400 font-mono text-xs leading-relaxed">{t[effect.descKey]}</p>
         </div>
         <button onClick={onClose} className={`w-full py-5 font-black rounded-2xl uppercase text-xs tracking-widest ${isBlessing ? 'bg-yellow-600 text-black' : 'bg-zinc-800 text-zinc-300'}`}>PROSSEGUIR</button>
      </div>
    </div>
  );
};

interface MerchantShopModalProps {
  gold: number;
  level: number;
  hasPet: boolean;
  language?: Language;
  discount?: boolean;
  onBuyItem: (item: ItemEntity) => void;
  onBuyPotion: (pot: PotionEntity, choice: 'use' | 'store') => void;
  onRentTron: () => void;
  onBuyPet: (type: Pet['type']) => void;
  onClose: () => void;
}

interface TutorialModalProps { onFinish: () => void; language?: Language; }
interface PotionPickupModalProps { potion: PotionEntity; language?: Language; onChoice: (choice: 'use' | 'store') => void; }
interface RelicSelectionModalProps { options: Relic[]; language?: Language; onSelect: (relic: Relic) => void; }
interface AltarInteractionModalProps { active: boolean; language?: Language; onPray: () => void; onClose: () => void; }
interface AltarResultModalProps { effect: AltarEffect; language?: Language; onClose: () => void; }
interface ChestModalProps {
  onChoice: (choice: StatChoice) => void;
  language?: Language;
  doubleBonus?: boolean;
}
