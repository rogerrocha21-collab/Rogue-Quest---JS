
import React, { useEffect, useState, useRef } from 'react';
import { Enemy, EntityStats, StatChoice, PotionEntity, ItemEntity, Pet, Language, Relic, AltarEffect } from '../types';
import { Icon } from './Icons';
import { ITEM_POOL, TRANSLATIONS, RELICS_POOL } from '../constants';

interface CombatModalProps {
  playerStats: EntityStats;
  enemy: Enemy;
  activePet?: Pet;
  language?: Language;
  altarEffect?: AltarEffect;
  inventory?: PotionEntity[];
  onAttackSound?: (attacker: 'player' | 'enemy') => void;
  onUsePotion: (idx: number) => boolean;
  onFinish: (newPlayerStats: EntityStats, win: boolean, goldEarned: number, petHp?: number) => void;
}

export const CombatModal: React.FC<CombatModalProps> = ({ playerStats, enemy, activePet, language = 'PT', altarEffect, inventory = [], onAttackSound, onUsePotion, onFinish }) => {
  const [currentPStats, setCurrentPStats] = useState({ ...playerStats });
  const [currentEStats, setCurrentEStats] = useState({ ...enemy.stats });
  const [petHp, setPetHp] = useState(activePet?.hp || 0);
  const [isDone, setIsDone] = useState(false);
  const [lastAttacker, setLastAttacker] = useState<'player' | 'enemy' | 'pet' | null>(null);
  const [isTakingDamage, setIsTakingDamage] = useState<'player' | 'enemy' | 'pet' | null>(null);
  const [combatLogs, setCombatLogs] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pRef = useRef({ ...playerStats }); // Use ref for turn loop to see updates
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
    
    const resolveTurn = () => {
      if (pRef.current.hp <= 0 || e.hp <= 0) { setIsDone(true); return; }
      const executeSequence = async () => {
        turnCount++;
        if (activePet && curPetHp > 0) {
            setLastAttacker('pet');
            setIsTakingDamage('enemy');
            if (onAttackSound) onAttackSound('player');
            const petAtk = Math.max(1, Math.floor(pRef.current.attack / 2));
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
            
            if (side === 'player' && altarEffect?.id === 'contained_fury' && pRef.current.hp < pRef.current.maxHp * 0.5) {
                atkValue = Math.floor(atkValue * 1.15);
            }

            if (side === 'player' && altarEffect?.id === 'sharp_blood') {
                atkValue = Math.floor(atkValue * 1.10);
            }

            let attackerName = side === 'player' ? t.combat_player : t.combat_enemy;
            setLastAttacker(side);
            setIsTakingDamage(side === 'player' ? 'enemy' : 'player');
            if (onAttackSound) onAttackSound(side);
            setTimeout(() => setIsTakingDamage(null), 200);
            
            let defender = side === 'player' ? e : pRef.current;
            let originalAtk = atkValue;
            
            if (side === 'enemy' && altarEffect?.id === 'fragile_blood') {
                originalAtk = Math.floor(originalAtk * 1.1);
            }

            let absorbed = 0;
            let effectiveArmor = defender.armor;
            if (side === 'player' && altarEffect?.id === 'consecrated_fists') {
                effectiveArmor = Math.floor(effectiveArmor * 0.4);
            }

            if (effectiveArmor > 0) {
              absorbed = Math.min(effectiveArmor, originalAtk);
              defender.armor = Math.max(0, defender.armor - absorbed);
              atkValue -= absorbed;
            }
            if (atkValue > 0) defender.hp -= atkValue;
            
            if (side === 'enemy' && altarEffect?.id === 'mark_of_prey' && Math.random() < 0.3) {
                 defender.hp -= 2;
                 addLog(`Você está sangrando! (-2 HP)`);
            }

            if (defender.hp < 0) defender.hp = 0;
            if (side === 'player') lastPlayerAttackTurn = turnCount;

            let logMsg = `${attackerName} ${t.combat_dealt} ${originalAtk} ${t.combat_damage}`;
            if (absorbed > 0) logMsg += ` (${absorbed} ${t.combat_absorbed})`;
            addLog(logMsg);
            setCurrentPStats({ ...pRef.current }); 
            setCurrentEStats({ ...e }); 
        };

        await processSide(turnOrder[0] as any);
        if (pRef.current.hp > 0 && e.hp > 0) {
          setTimeout(async () => {
            await processSide(turnOrder[1] as any);
            if (pRef.current.hp <= 0 || e.hp <= 0) setIsDone(true);
            else setTimeout(resolveTurn, 500);
          }, 500);
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
      // In a real app we'd get the new state back, but we can approximate for the UI:
      const pot = inventory[idx];
      let healPct = pot.percent;
      if (altarEffect?.id === 'profane_thirst') healPct -= 10;
      
      const heal = Math.floor(pRef.current.maxHp * (healPct / 100));
      pRef.current.hp = Math.min(pRef.current.maxHp, pRef.current.hp + heal);
      setCurrentPStats({ ...pRef.current });
      addLog(`Você usou uma poção e recuperou ${heal} HP!`);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-50 p-4 md:p-6 backdrop-blur-md">
      <div className="bg-zinc-900 border-2 border-zinc-800 max-w-xl w-full p-5 md:p-8 rounded-[2.5rem] shadow-2xl flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-6 md:gap-12 font-mono">
          <div className={`text-center space-y-4 transition-all duration-200 ${lastAttacker === 'player' ? 'scale-105' : ''} ${isTakingDamage === 'player' ? 'animate-shake' : ''}`}>
            <div className={`p-5 rounded-3xl border-2 transition-colors relative ${isTakingDamage === 'player' ? 'bg-red-900/40 border-red-500' : 'bg-zinc-800 border-zinc-700'}`}>
              <span className="text-yellow-400 scale-125 block"><Icon.Player /></span>
            </div>
            <div className="h-3 bg-zinc-800 rounded-full overflow-hidden border border-zinc-700">
                <div className="h-full bg-red-500 transition-all duration-300" style={{ width: `${(currentPStats.hp / currentPStats.maxHp) * 100}%` }} />
            </div>
            <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest">{t.hp}: <span className="text-white">{currentPStats.hp}</span> {t.armor}: <span className="text-blue-400">{currentPStats.armor}</span></p>
          </div>
          <div className={`text-center space-y-4 transition-all duration-200 ${lastAttacker === 'enemy' ? 'scale-105' : ''} ${isTakingDamage === 'enemy' ? 'animate-shake' : ''}`}>
            <div className={`p-5 rounded-3xl border-2 transition-colors ${enemy.isBoss ? 'bg-red-950 border-red-800' : isTakingDamage === 'enemy' ? 'bg-red-900/40 border-red-500' : 'bg-zinc-800 border-zinc-700'}`}>
              <span className={enemy.isBoss ? 'text-red-500' : 'text-zinc-300'}><Icon.Enemy isBoss={enemy.isBoss} /></span>
            </div>
            <div className="h-3 bg-zinc-800 rounded-full overflow-hidden border border-zinc-700">
                <div className="h-full bg-red-700 transition-all duration-300" style={{ width: `${(currentEStats.hp / currentEStats.maxHp) * 100}%` }} />
            </div>
            <p className="text-[9px] text-zinc-500 uppercase font-black tracking-widest">{enemy.type}</p>
          </div>
        </div>

        {/* Inventory in Combat */}
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

        <div className="bg-black/50 border border-zinc-800 rounded-2xl p-4 h-32 md:h-40 flex flex-col gap-1 overflow-hidden">
          <div ref={scrollRef} className="overflow-y-auto h-full pr-2 space-y-1.5 scroll-smooth">
            {combatLogs.map((log, i) => (
              <p key={i} className="text-[9px] font-mono leading-tight text-zinc-400 flex gap-2">
                <span className="text-zinc-700">[{i+1}]</span>
                <span className={log.includes(t.combat_player) ? 'text-zinc-100' : log.includes(t.combat_pet) ? 'text-orange-400' : 'text-red-400/80'}>
                  {log}
                </span>
              </p>
            ))}
            {combatLogs.length === 0 && <p className="text-[10px] text-zinc-600 animate-pulse text-center mt-8">{t.abyss.toUpperCase()}...</p>}
          </div>
        </div>

        {isDone && (
          <button onClick={() => onFinish(currentPStats, currentPStats.hp > 0, Math.floor(Math.random() * 10) + 10, petHp)} className={`w-full font-black py-5 rounded-2xl transition-all uppercase text-xs tracking-widest ${currentPStats.hp > 0 ? "bg-green-600 hover:bg-green-500 text-white shadow-[0_0_20px_rgba(22,163,74,0.4)]" : "bg-red-700 hover:bg-red-600 text-white shadow-[0_0_20px_rgba(185,28,28,0.4)]"}`}>
            {currentPStats.hp > 0 ? t.collect_reward : t.succumb}
          </button>
        )}
      </div>
    </div>
  );
};

export const AltarInteractionModal: React.FC<{
    active: boolean, 
    language?: Language, 
    onPray: () => void, 
    onClose: () => void
}> = ({ active, language = 'PT', onPray, onClose }) => {
    const t = TRANSLATIONS[language];
    return (
        <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-50 p-6 backdrop-blur-xl">
          <div className="bg-zinc-900 border-2 border-purple-500/30 p-10 rounded-[3rem] max-w-sm w-full text-center space-y-8 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-purple-500/10 blur-[80px] pointer-events-none" />
            <div className={`flex justify-center scale-[2.5] mb-4 ${active ? 'text-purple-400 animate-pulse' : 'text-zinc-700'}`}>
                <Icon.Altar />
            </div>
            <div className="space-y-3">
              <h3 className="text-white font-black uppercase text-lg tracking-tighter">{t.altar_title}</h3>
              <p className="text-zinc-500 text-xs leading-relaxed">
                {active ? t.altar_prompt : t.altar_inactive}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4">
              {active && (
                <button 
                    onClick={onPray} 
                    className="bg-purple-600 hover:bg-purple-500 py-4 rounded-2xl text-white font-black text-sm uppercase tracking-widest transition-all transform active:scale-95 shadow-[0_0_25px_rgba(168,85,247,0.4)]"
                >
                    {t.altar_button}
                </button>
              )}
              <button 
                onClick={onClose} 
                className="bg-zinc-800 hover:bg-zinc-700 py-4 rounded-2xl text-zinc-300 font-black text-sm uppercase tracking-widest transition-all"
              >
                {t.next}
              </button>
            </div>
          </div>
        </div>
    );
};

export const AltarResultModal: React.FC<{
  effect: AltarEffect,
  language?: Language,
  onClose: () => void
}> = ({ effect, language = 'PT', onClose }) => {
  const t = TRANSLATIONS[language];
  const isBlessing = effect.type === 'BLESSING';

  return (
    <div className="fixed inset-0 bg-black/98 flex items-center justify-center z-[60] p-6 backdrop-blur-2xl">
      <div className={`bg-zinc-900 border-2 ${isBlessing ? 'border-yellow-500/50 shadow-yellow-500/20' : 'border-purple-600/50 shadow-purple-600/20'} p-12 rounded-[3.5rem] max-w-md w-full text-center space-y-8 shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-500`}>
        <div className={`absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-64 ${isBlessing ? 'bg-yellow-500/10' : 'bg-purple-600/15'} blur-[100px] pointer-events-none`} />
        
        <div className={`flex justify-center scale-[3] mb-6 ${isBlessing ? 'text-yellow-400 animate-pulse' : 'text-purple-600 animate-glitch'}`}>
          <Icon.Altar />
        </div>

        <div className="space-y-4">
          <div className={`inline-block px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${isBlessing ? 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20' : 'bg-purple-600/10 text-purple-400 border border-purple-600/20'}`}>
            {isBlessing ? 'BÊNÇÃO RECEBIDA' : 'MALDIÇÃO LANÇADA'}
          </div>
          <h3 className={`text-3xl font-black uppercase tracking-tighter ${isBlessing ? 'text-white' : 'text-purple-200'}`}>
            {t[effect.nameKey]}
          </h3>
          <p className="text-zinc-400 text-sm leading-relaxed px-4">
            {t[effect.descKey]}
          </p>
        </div>

        <button 
          onClick={onClose} 
          className={`w-full py-5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all transform active:scale-95 ${isBlessing ? 'bg-yellow-600 hover:bg-yellow-500 text-black shadow-[0_0_30px_rgba(234,179,8,0.3)]' : 'bg-purple-900 hover:bg-purple-800 text-purple-100 border border-purple-700/50 shadow-[0_0_30px_rgba(168,85,247,0.2)]'}`}
        >
          {t.next}
        </button>
      </div>
    </div>
  );
};

export const MerchantShopModal: React.FC<{gold: number, level: number, hasPet: boolean, language?: Language, discount?: boolean, onBuyItem: (item: ItemEntity) => void, onBuyPotion: (pot: PotionEntity, choice: 'use' | 'store') => void, onRentTron: () => void, onBuyPet: (type: 'LOBO' | 'PUMA' | 'CORUJA') => void, onClose: () => void}> = ({ gold, level, hasPet, language = 'PT', discount, onBuyItem, onBuyPotion, onRentTron, onBuyPet, onClose }) => {
  const [selectedPotion, setSelectedPotion] = useState<PotionEntity | null>(null);
  const potions = [{ id: 'p1', percent: 20, price: 10, x: 0, y: 0 }, { id: 'p2', percent: 40, price: 20, x: 0, y: 0 }, { id: 'p3', percent: 70, price: 35, x: 0, y: 0 }];
  const [offeredItems, setOfferedItems] = useState<ItemEntity[]>([]);
  const t = TRANSLATIONS[language];

  useEffect(() => {
    const shuffled = [...ITEM_POOL].sort(() => 0.5 - Math.random());
    setOfferedItems(shuffled.slice(0, 4).map((item, idx) => {
        let price = Math.floor(item.basePrice * (1 + level * 0.05));
        if (discount) price = Math.floor(price * 0.7); // 30% Altar Discount
        return { ...item, id: `item-${level}-${idx}`, price, x: 0, y: 0 };
    }) as ItemEntity[]);
  }, [level, discount]);

  if (selectedPotion) {
    return (
      <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-[100] p-6 backdrop-blur-xl">
        <div className="bg-zinc-900 border border-pink-500/30 p-8 rounded-3xl max-w-xs w-full text-center space-y-6">
          <div className="text-pink-400 flex justify-center scale-150 mb-2"><Icon.Potion /></div>
          <h3 className="text-white font-black uppercase text-sm">Poção de Cura (+{selectedPotion.percent}%)</h3>
          <div className="flex flex-col gap-3">
            <button onClick={() => { onBuyPotion(selectedPotion, 'use'); setSelectedPotion(null); }} className="bg-pink-600 py-3 rounded-xl text-white font-black text-xs uppercase">{t.use}</button>
            <button onClick={() => { onBuyPotion(selectedPotion, 'store'); setSelectedPotion(null); }} className="bg-zinc-800 py-3 rounded-xl text-zinc-300 font-black text-xs uppercase">{t.store}</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-6 backdrop-blur-xl">
      <div className="bg-zinc-900 border border-indigo-500/30 max-w-lg w-full p-6 rounded-[2rem] shadow-2xl overflow-y-auto max-h-[95vh] space-y-6">
        <div className="flex justify-between items-center">
            <h2 className="text-xl font-black text-indigo-400 uppercase tracking-tighter">{t.merchant_title}</h2>
            <div className="bg-zinc-800 px-3 py-1 rounded-full flex items-center gap-2 border border-zinc-700">
                <Icon.Gold /><span className="text-sm font-bold text-yellow-500">{gold}</span>
            </div>
        </div>
        {!hasPet && (
          <div className="grid grid-cols-3 gap-3">
            <button disabled={gold < 10} onClick={() => onBuyPet('LOBO')} className="flex flex-col items-center p-3 bg-zinc-800 rounded-xl border border-zinc-700 hover:border-orange-500 transition-all disabled:opacity-50"><Icon.Wolf /><span className="text-[10px] font-bold text-white mt-1 uppercase">{t.pet_lobo}</span><span className="text-[9px] text-yellow-500">10G</span></button>
            <button disabled={gold < 10} onClick={() => onBuyPet('PUMA')} className="flex flex-col items-center p-3 bg-zinc-800 rounded-xl border border-zinc-700 hover:border-orange-500 transition-all disabled:opacity-50"><Icon.Puma /><span className="text-[10px] font-bold text-white mt-1 uppercase">{t.pet_puma}</span><span className="text-[9px] text-yellow-500">10G</span></button>
            <button disabled={gold < 12} onClick={() => onBuyPet('CORUJA')} className="flex flex-col items-center p-3 bg-zinc-800 rounded-xl border border-zinc-700 hover:border-orange-500 transition-all disabled:opacity-50"><Icon.Owl /><span className="text-[10px] font-bold text-white mt-1 uppercase">{t.pet_coruja}</span><span className="text-[9px] text-yellow-500">12G</span></button>
          </div>
        )}
        <button disabled={gold < 25} onClick={onRentTron} className="w-full flex items-center justify-between p-4 bg-zinc-800 rounded-xl border border-cyan-500/30 hover:border-cyan-400 transition-all disabled:opacity-50">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-cyan-500/10 rounded-lg text-cyan-400 animate-pulse"><Icon.Horse /></div>
            <div className="text-left">
              <p className="text-xs font-black text-white">{t.buy_horse}</p>
              <p className="text-[9px] text-zinc-500 uppercase">15s • {t.pet_cavalo}</p>
            </div>
          </div>
          <p className="text-xs font-bold text-yellow-500">25G</p>
        </button>
        <div className="grid grid-cols-3 gap-2">
            {potions.map(p => {
                let pPrice = p.price!;
                if (discount) pPrice = Math.floor(pPrice * 0.7);
                return (<button key={p.id} disabled={gold < pPrice} onClick={() => setSelectedPotion({...p, price: pPrice})} className="bg-zinc-800 p-3 rounded-xl border border-zinc-700 hover:border-pink-500 disabled:opacity-50 transition-colors"><div className="text-pink-500 mb-1 flex justify-center"><Icon.Potion /></div><div className="text-[9px] font-bold text-white text-center">+{p.percent}% {t.hp}</div><div className="text-[9px] text-yellow-500 font-bold text-center">{pPrice}G</div></button>)
            })}
        </div>
        <div className="space-y-2">
            {offeredItems.map(i => (<button key={i.id} disabled={gold < i.price!} onClick={() => onBuyItem(i)} className="w-full flex justify-between items-center p-3 bg-zinc-800 rounded-xl border border-zinc-700 hover:border-indigo-500 disabled:opacity-50 transition-colors"><div className="flex items-center gap-3"><span className="text-indigo-400">{i.iconType === 'sword' ? <Icon.Sword /> : i.iconType === 'shield' ? <Icon.Shield /> : i.iconType === 'heart' ? <Icon.Heart /> : <Icon.Boot />}</span><div className="text-left"><div className="text-[10px] font-bold text-white uppercase">{i.name}</div><div className="text-[8px] text-green-400">+{i.value} {(i.stat.replace('max', '')).toUpperCase()}</div></div></div><div className="text-[10px] font-bold text-yellow-500">{i.price}G</div></button>))}
        </div>
        <button onClick={onClose} className="w-full py-3 bg-zinc-100 text-black font-black rounded-xl uppercase text-[10px] tracking-widest">{t.close_deal}</button>
      </div>
    </div>
  );
};

export const PotionPickupModal: React.FC<{potion: PotionEntity, language?: Language, onChoice: (choice: 'use' | 'store') => void}> = ({ potion, language = 'PT', onChoice }) => {
  const t = TRANSLATIONS[language];
  return (
    <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-[100] p-6 backdrop-blur-xl">
      <div className="bg-zinc-900 border border-pink-500/40 p-10 rounded-[3rem] max-sm w-full text-center space-y-8 shadow-2xl">
        <div className="text-pink-400 flex justify-center scale-[2] animate-bounce"><Icon.Potion /></div>
        <div className="space-y-2">
          <h3 className="text-white font-black uppercase text-base">Poção Encontrada!</h3>
          <p className="text-zinc-500 text-xs font-bold">Restaura {potion.percent}% da vida máxima.</p>
        </div>
        <div className="grid grid-cols-1 gap-4">
          <button onClick={() => onChoice('use')} className="bg-pink-600 hover:bg-pink-500 py-4 rounded-2xl text-white font-black text-sm uppercase tracking-widest transition-all transform active:scale-95">{t.use}</button>
          <button onClick={() => onChoice('store')} className="bg-zinc-800 hover:bg-zinc-700 py-4 rounded-2xl text-zinc-300 font-black text-sm uppercase tracking-widest transition-all transform active:scale-95">{t.store}</button>
        </div>
      </div>
    </div>
  );
};

export const RelicSelectionModal: React.FC<{options: Relic[], language?: Language, onSelect: (relic: Relic) => void}> = ({ options, language = 'PT', onSelect }) => {
  const t = TRANSLATIONS[language];
  return (
    <div className="fixed inset-0 bg-black/98 flex items-center justify-center z-[110] p-6 backdrop-blur-2xl">
      <div className="max-w-xl w-full text-center space-y-8">
        <h2 className="text-3xl font-black text-purple-400 tracking-tighter uppercase italic drop-shadow-[0_0_15px_rgba(168,85,247,0.5)]">{t.relic_choice}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {options.map(relic => (
            <button key={relic.id} onClick={() => onSelect(relic)} className="group bg-zinc-900/50 border-2 border-zinc-800 hover:border-purple-500 p-6 rounded-[2rem] flex flex-col items-center gap-4 transition-all hover:scale-105 hover:bg-purple-950/10">
              <div className="p-4 bg-zinc-800 rounded-2xl text-purple-400 group-hover:text-purple-300 transition-colors group-hover:animate-pulse">
                {React.createElement((Icon as any)[relic.icon])}
              </div>
              <div className="space-y-1">
                <p className="text-xs font-black text-white uppercase tracking-tight">{relic.name}</p>
                <p className="text-[10px] text-zinc-500 leading-tight h-10 flex items-center justify-center">{relic.description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export const ChestModal: React.FC<{onChoice: (choice: StatChoice) => void, language?: Language, doubleBonus?: boolean}> = ({ onChoice, language = 'PT', doubleBonus }) => {
    const t = TRANSLATIONS[language];
    const multiplier = doubleBonus ? 2 : 1;
    return (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-6">
          <div className="bg-zinc-900 border border-blue-500/20 max-w-md w-full p-8 rounded-3xl text-center shadow-2xl relative">
            {doubleBonus && <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-yellow-500 text-black px-4 py-1 rounded-full text-[10px] font-black uppercase shadow-[0_0_15px_rgba(234,179,8,0.5)]">BÔNUS CONSAGRADO ATIVO!</div>}
            <h2 className="text-2xl font-black text-white mb-6 uppercase tracking-tighter">{t.chest_title}</h2>
            <div className="grid gap-3 font-mono">
              <button onClick={() => onChoice('Ataque')} className="p-5 bg-zinc-950 border border-zinc-800 rounded-xl flex justify-between items-center text-xs text-white hover:border-green-500 transition-all uppercase"><span className="flex items-center gap-2"><Icon.Sword /> {t.atk}</span><span className="text-green-500 font-bold">+{5 * multiplier}</span></button>
              <button onClick={() => onChoice('Armadura')} className="p-5 bg-zinc-950 border border-zinc-800 rounded-xl flex justify-between items-center text-xs text-white hover:border-blue-500 transition-all uppercase"><span className="flex items-center gap-2"><Icon.Shield /> {t.armor}</span><span className="text-green-500 font-bold">+{3 * multiplier}</span></button>
              <button onClick={() => onChoice('Velocidade')} className="p-5 bg-zinc-950 border border-zinc-800 rounded-xl flex justify-between items-center text-xs text-white hover:border-yellow-500 transition-all uppercase"><span className="flex items-center gap-2"><Icon.Boot /> {t.vel}</span><span className="text-green-500 font-bold">+{4 * multiplier}</span></button>
            </div>
          </div>
        </div>
    );
};

export const TutorialModal: React.FC<{onFinish: () => void, language?: Language}> = ({ onFinish, language = 'PT' }) => {
  const [step, setStep] = useState(0);
  const t = TRANSLATIONS[language];
  const slides = (language === 'EN' ? [
    { title: "THE DEEP ABYSS", icon: <Icon.Stairs />, desc: "Welcome, hero. Your mission is to explore the depths of this infinite abyss. Progress is automatically saved at the start of each level." },
    { title: "COMBAT & STATS", icon: <Icon.Sword />, desc: "Battles are automatic. The fastest attacks first. ATTACK defines your damage, SPEED your turn, and ARMOR absorbs damage." },
    { title: "EXIT CONDITIONS", icon: <Icon.Key />, desc: "The stairs to the next level are blocked! To pass, you must find the KEY and prove your strength by defeating at least one enemy." },
  ] : language === 'ES' ? [
    { title: "EL ABISMO PROFUNDO", icon: <Icon.Stairs />, desc: "Bienvenido, héroe. Tu misión es explorar las profundidades de este abismo infinito. El progreso se guarda automáticamente al inicio de cada nivel." },
    { title: "COMBATE Y ESTADÍSTICAS", icon: <Icon.Sword />, desc: "Las batallas son automáticas. El más rápido ataca primero. ATAQUE define tu daño, VELOCIDAD tu turno y ARMADURA absorbe daño." },
    { title: "CONDICIONES DE SALIDA", icon: <Icon.Key />, desc: "¡Las escaleras al siguiente nivel están bloqueadas! Debes encontrar la LLAVE y demostrar tu fuerza derrotando al menos a un enemigo." },
  ] : [
    { title: "O ABISMO PROFUNDO", icon: <Icon.Stairs />, desc: "Bem-vindo, herói. Sua missão é desbravar as profundezas deste abismo infinito. Seu progresso é salvo automaticamente ao iniciar cada nível." },
    { title: "COMBATE E ATRIBUTOS", icon: <Icon.Sword />, desc: "As batalhas são automáticas. O mais rápido ataca primeiro. O ATAQUE define seu dano, a VELOCIDADE sua vez, e o ESCUDO absorve dano." },
    { title: "CONDIÇÕES DE SAÍDA", icon: <Icon.Key />, desc: "A escada para o próximo nível está bloqueada! Para passar, você deve encontrar a CHAVE do abismo e provar sua força eliminando ao menos um inimigo." },
  ]);
  const current = slides[step];
  return (
    <div className="fixed inset-0 bg-black/98 flex items-center justify-center z-[100] p-6 backdrop-blur-xl">
      <div className="bg-zinc-900 border-2 border-zinc-800 max-sm w-full p-8 rounded-[2.5rem] text-center shadow-2xl flex flex-col items-center">
        <div className="w-20 h-20 bg-zinc-800 rounded-full flex items-center justify-center text-red-500 mb-6 border-2 border-zinc-700 animate-pulse">{current.icon}</div>
        <h2 className="text-xl font-black text-white mb-4 uppercase tracking-tighter">{current.title}</h2>
        <p className="text-zinc-400 text-xs leading-relaxed mb-10 h-24 flex items-center justify-center">{current.desc}</p>
        <button onClick={() => step < slides.length - 1 ? setStep(step + 1) : onFinish()} className="w-full py-4 bg-red-600 hover:bg-red-500 text-white font-black rounded-xl uppercase text-xs tracking-widest transition-all">
          {step < slides.length - 1 ? t.next : t.start_journey}
        </button>
      </div>
    </div>
  );
};
