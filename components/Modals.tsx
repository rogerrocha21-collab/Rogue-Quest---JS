
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Enemy, EntityStats, StatChoice, PotionEntity, ItemEntity, Pet, Language, Relic, AltarEffect } from '../types';
import { Icon } from './Icons';
import { ITEM_POOL, TRANSLATIONS, RELICS_POOL, POISONOUS_ENEMIES } from '../constants';

interface CombatLogEntry {
  msg: string;
  type: 'player' | 'enemy' | 'pet' | 'info' | 'heal';
}

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
  onFinish: (newPlayerStats: EntityStats, win: boolean, goldEarned: number, petHp?: number, isPoisoned?: boolean) => void;
}

export const CombatModal: React.FC<CombatModalProps> = ({ 
  playerStats, enemy, activePet, language = 'PT', altarEffect, relic, inventory = [], onAttackSound, onUsePotion, onFinish 
}) => {
  const [currentPStats, setCurrentPStats] = useState({ ...playerStats });
  const [currentEStats, setCurrentEStats] = useState({ ...enemy.stats });
  const [petHp, setPetHp] = useState(activePet?.hp || 0);
  const [isDone, setIsDone] = useState(false);
  const [isHealAnim, setIsHealAnim] = useState(false);
  const [isTakingDamage, setIsTakingDamage] = useState<'player' | 'enemy' | 'pet' | null>(null);
  const [combatLogs, setCombatLogs] = useState<CombatLogEntry[]>([]);
  const [isPoisonedInCombat, setIsPoisonedInCombat] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pRef = useRef({ ...playerStats }); 
  const t = TRANSLATIONS[language];

  const addLog = (msg: string, type: 'player' | 'enemy' | 'pet' | 'info' | 'heal') => { 
    setCombatLogs(prev => [...prev, { msg, type }]); 
  };

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [combatLogs]);

  useEffect(() => {
    let e = { ...currentEStats };
    let curPetHp = petHp;
    let turnCount = 0;
    let lastPlayerAttackTurn = -1;
    let isFirstPlayerHitInCombat = true;
    let poisoned = false;
    let playerParalyzed = false;
    
    const resolveTurn = () => {
      if (pRef.current.hp <= 0 || e.hp <= 0) { 
          // Check death effects
          if (e.hp <= 0 && enemy.type === 'Larva Ígnea') {
              const explosionDmg = Math.floor(pRef.current.maxHp * 0.15);
              pRef.current.hp = Math.max(0, pRef.current.hp - explosionDmg);
              addLog(`Larva explodiu! -${explosionDmg} HP`, 'enemy');
              setCurrentPStats({ ...pRef.current });
          }
          setIsDone(true); 
          return; 
      }

      const executeSequence = async () => {
        turnCount++;
        const enemyHasInitiative = altarEffect?.id === 'slow_reflexes';

        if (!enemyHasInitiative && activePet && curPetHp > 0) {
            let petAtk = Math.max(1, Math.floor(pRef.current.attack / 2));
            if (relic?.id === 'collar') petAtk += 10;
            e.hp -= petAtk; if (e.hp < 0) e.hp = 0;
            addLog(`${t.combat_pet} atacou causando ${petAtk} de dano`, 'pet');
            setCurrentEStats({ ...e });
            setIsTakingDamage('enemy');
            await new Promise(r => setTimeout(r, 600)); 
            setIsTakingDamage(null);
            if (e.hp <= 0) { setIsDone(true); return; }
        }

        const playersTurn = !enemyHasInitiative && (pRef.current.speed >= e.speed);
        const turnOrder = playersTurn ? ['player', 'enemy'] : ['enemy', 'player'];

        const processSide = async (side: 'player' | 'enemy') => {
            if (pRef.current.hp <= 0 || e.hp <= 0) return;
            
            // Lógica de Paralisia (Aranha Tecelã)
            if (side === 'player' && playerParalyzed) {
                addLog(t.paralyzed, 'enemy');
                playerParalyzed = false; // Consome a paralisia
                return;
            }

            if (side === 'player' && altarEffect?.id === 'short_breath' && lastPlayerAttackTurn === turnCount - 1) {
                addLog(`Você recupera o fôlego...`, 'info');
                return;
            }
            if (side === 'player' && altarEffect?.id === 'trembling_hands' && Math.random() < 0.25) {
                addLog(`Você errou o ataque!`, 'player');
                return;
            }

            let atkValue = side === 'player' ? pRef.current.attack : e.attack;
            if (side === 'player') {
                if (altarEffect?.id === 'anxious_strike' && isFirstPlayerHitInCombat) {
                    atkValue *= 2;
                    addLog(`GOLPE ANSIOSO!`, 'player');
                }
                if (altarEffect?.id === 'contained_fury' && pRef.current.hp < (pRef.current.maxHp / 2)) {
                    atkValue = Math.floor(atkValue * 1.15);
                }
                if (relic?.id === 'crit' && Math.random() < 0.05) {
                   atkValue = Math.floor(atkValue * 2);
                   addLog(`CRÍTICO!`, 'player');
                }
                isFirstPlayerHitInCombat = false;
            }

            if (onAttackSound) onAttackSound(side);
            let defender = side === 'player' ? e : pRef.current;
            let originalAtk = atkValue;
            if (side === 'enemy' && altarEffect?.id === 'fragile_blood') originalAtk = Math.floor(originalAtk * 1.1);
            if (side === 'enemy' && relic?.id === 'defense') originalAtk = Math.max(1, originalAtk - 10);

            let currentAtkForCalculation = originalAtk;
            const armorToConsider = (side === 'player' && altarEffect?.id === 'consecrated_fists') 
                ? Math.floor(defender.armor / 2) 
                : defender.armor;

            if (armorToConsider > 0) {
              let absorbed = Math.min(armorToConsider, currentAtkForCalculation);
              if (side === 'player') e.armor = Math.max(0, e.armor - absorbed);
              else pRef.current.armor = Math.max(0, pRef.current.armor - absorbed);
              currentAtkForCalculation -= absorbed;
              addLog(`${side === 'player' ? t.combat_enemy : t.combat_player} ${t.combat_absorbed} ${absorbed} de dano`, 'info');
            }

            if (currentAtkForCalculation > 0) defender.hp -= currentAtkForCalculation;
            if (defender.hp < 0) defender.hp = 0;
            
            // Special Enemy Effects
            if (side === 'enemy') {
                // Súcubo Incandescente (Life Drain)
                if (enemy.type === 'Súcubo Incandescente' && currentAtkForCalculation > 0) {
                    const heal = Math.floor(currentAtkForCalculation * 0.05); // 5% drain
                    e.hp = Math.min(e.maxHp, e.hp + heal);
                    addLog(`Súcubo drenou ${heal} HP!`, 'enemy');
                }

                // Aranha Tecelã (Paralysis)
                if (enemy.type === 'Aranha Tecelã' && Math.random() < 0.25) { // 25% chance
                    playerParalyzed = true;
                }

                // Poison
                if (POISONOUS_ENEMIES.includes(enemy.type) && !poisoned) {
                    if (enemy.type === 'Aberração Putrefata') {
                        // Strong Poison guaranteed
                        poisoned = true;
                        setIsPoisonedInCombat(true);
                        addLog(t.poisoned + " (FORTE)!", 'enemy');
                    } else if (Math.random() < 0.3) {
                        // Standard Poison chance
                        poisoned = true;
                        setIsPoisonedInCombat(true);
                        addLog(t.poisoned + "!", 'enemy');
                    }
                }

                if (altarEffect?.id === 'mark_of_prey') {
                    pRef.current.hp = Math.max(1, pRef.current.hp - 2);
                    addLog(`Você está sangrando! (-2 HP)`, 'enemy');
                }
            }

            if (side === 'player') lastPlayerAttackTurn = turnCount;
            const msg = side === 'player' ? `${t.combat_player} atacou causando ${originalAtk} de dano` : `O inimigo atacou causando ${originalAtk} de dano`;
            addLog(msg, side === 'player' ? 'player' : 'enemy');
            setCurrentPStats({ ...pRef.current }); setCurrentEStats({ ...e }); 
            setIsTakingDamage(side === 'player' ? 'enemy' : 'player');
            await new Promise(r => setTimeout(r, 650)); 
            setIsTakingDamage(null);
        };

        await processSide(turnOrder[0] as any);
        if (pRef.current.hp > 0 && e.hp > 0) {
            await new Promise(r => setTimeout(r, 200)); 
            await processSide(turnOrder[1] as any);
            if (enemyHasInitiative && activePet && curPetHp > 0 && pRef.current.hp > 0 && e.hp > 0) {
                 let petAtk = Math.max(1, Math.floor(pRef.current.attack / 2));
                 if (relic?.id === 'collar') petAtk += 10;
                 e.hp -= petAtk; if (e.hp < 0) e.hp = 0;
                 addLog(`${t.combat_pet} contra-atacou causando ${petAtk} de dano`, 'pet');
                 setCurrentEStats({ ...e });
                 setIsTakingDamage('enemy');
                 await new Promise(r => setTimeout(r, 600)); 
                 setIsTakingDamage(null);
            }
            if (pRef.current.hp > 0 && e.hp > 0) setTimeout(resolveTurn, 500);
            else setIsDone(true);
        } else { setIsDone(true); }
      };
      executeSequence();
    };
    setTimeout(resolveTurn, 600);
  }, [t]);

  const handleUsePotion = (idx: number) => {
    if (isDone) return;
    const pot = inventory![idx];
    if (onUsePotion(idx)) { 
      const stats = { ...pRef.current };
      const heal = Math.floor(stats.maxHp * (pot.percent / 100));
      stats.hp = Math.min(stats.maxHp, stats.hp + heal);
      pRef.current = stats;
      setCurrentPStats({ ...stats }); 
      addLog(`Curou ${pot.percent}% da Vida`, 'heal'); 
      setIsHealAnim(true);
      setTimeout(() => setIsHealAnim(false), 1200);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/98 flex items-center justify-center z-50 p-4 backdrop-blur-xl">
      <div className={`bg-[#0a0a0a] border max-w-lg w-full p-6 rounded-[2.5rem] shadow-2xl flex flex-col gap-6 ${isPoisonedInCombat ? 'border-green-900 shadow-[0_0_30px_rgba(34,197,94,0.1)]' : 'border-[#222]'}`}>
        <div className="flex gap-4 items-stretch">
          <div className={`flex-1 flex flex-col items-center gap-4 p-5 rounded-[1.5rem] bg-[#111] border border-[#333] transition-all relative overflow-hidden ${isTakingDamage === 'player' ? 'animate-shake border-red-900' : ''} ${isHealAnim ? 'ring-4 ring-green-500/50 scale-105' : ''}`}>
             {isHealAnim && <div className="absolute inset-0 bg-green-500/10 animate-pulse pointer-events-none" />}
             {isPoisonedInCombat && <div className="absolute inset-0 bg-green-900/10 pointer-events-none animate-pulse" />}
             <div className="flex items-center justify-center gap-4">
                <span className={`text-yellow-400 drop-shadow-[0_0_10px_rgba(234,179,8,0.4)] ${isHealAnim ? 'text-green-400' : ''} ${isPoisonedInCombat ? 'text-green-500' : ''}`}><Icon.Player width={40} height={40} /></span>
                {activePet && petHp > 0 && (
                   <div className="flex flex-col items-center border-l border-[#333] pl-4">
                      <span className="text-orange-400 animate-pet-wiggle">
                        {activePet.type === 'LOBO' ? <Icon.Wolf width={30} height={30} /> : <Icon.Wolf width={30} height={30} />}
                      </span>
                   </div>
                )}
             </div>
             <div className="w-full h-2 bg-black rounded-full overflow-hidden border border-[#222]">
                <div className={`h-full transition-all duration-[1000ms] ${isHealAnim ? 'bg-green-500' : 'bg-red-600'}`} style={{ width: `${(currentPStats.hp / currentPStats.maxHp) * 100}%` }} />
             </div>
             <span className={`text-[10px] font-black uppercase ${isHealAnim ? 'text-green-400 animate-bounce' : 'text-zinc-500'}`}>{currentPStats.hp} / {currentPStats.maxHp} HP</span>
          </div>
          <div className="flex items-center justify-center opacity-20 font-black">VS</div>
          <div className={`flex-1 flex flex-col items-center gap-4 p-5 rounded-[1.5rem] bg-[#111] border border-[#333] transition-all ${isTakingDamage === 'enemy' ? 'animate-shake border-red-900' : ''}`}>
             <span className={enemy.isBoss ? 'text-red-600' : 'text-zinc-500'}><Icon.Enemy isBoss={enemy.isBoss} width={40} height={40} /></span>
             <div className="w-full h-2 bg-black rounded-full overflow-hidden border border-[#222]">
                <div className="h-full bg-zinc-700 transition-all duration-500" style={{ width: `${(currentEStats.hp / currentEStats.maxHp) * 100}%` }} />
             </div>
             <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest text-center">{enemy.type}</span>
          </div>
        </div>
        <div className="bg-[#050505] border border-[#222] rounded-2xl p-5 h-44 overflow-hidden flex flex-col">
          <p className="text-[8px] font-black text-zinc-700 uppercase tracking-widest mb-2 border-b border-[#111] pb-1">Log de Turnos</p>
          <div ref={scrollRef} className="overflow-y-auto h-full space-y-2 no-scrollbar font-mono text-[11px] font-bold">
            {combatLogs.map((log, i) => (
              <p key={i} className={log.type === 'player' ? 'text-zinc-400' : log.type === 'enemy' ? 'text-red-500' : log.type === 'pet' ? 'text-purple-500' : log.type === 'heal' ? 'text-green-400' : 'text-yellow-600'}>
                {log.msg}
              </p>
            ))}
          </div>
        </div>
        {!isDone && inventory.length > 0 && (
          <div className="flex justify-center gap-2 p-3 bg-[#111] rounded-2xl border border-[#222]">
            {inventory.map((pot, i) => (
              <button key={i} onClick={() => handleUsePotion(i)} className="flex items-center gap-2 px-3 py-1 bg-pink-950/10 border border-pink-500/20 rounded-xl text-pink-500 hover:bg-pink-900/20 transition-all">
                <Icon.Potion width={14} height={14} /> <span className="text-[9px] font-black">{pot.percent}%</span>
              </button>
            ))}
          </div>
        )}
        {isDone && (
          <button onClick={() => onFinish(currentPStats, currentPStats.hp > 0, Math.floor(Math.random() * 21) + 10, petHp, isPoisonedInCombat)} className={`w-full font-black py-5 rounded-2xl uppercase text-[12px] tracking-[0.2em] transition-all ${currentPStats.hp > 0 ? "bg-green-600 text-white hover:bg-green-500" : "bg-red-800 text-white hover:bg-red-700"}`}>
            {currentPStats.hp > 0 ? t.collect_reward : t.succumb}
          </button>
        )}
      </div>
    </div>
  );
};

export const MerchantShopModal: React.FC<{ 
  gold: number, level: number, hasPet: boolean, language: Language, activeAltarEffect?: AltarEffect, 
  onBuyItem: (item: ItemEntity) => void, onBuyPotion: (pot: PotionEntity, choice: 'use' | 'store') => void, 
  onRentTron: () => void, onBuyPet: (type: Pet['type']) => void, onClose: () => void,
  hasCompass?: boolean, hasMap?: boolean, onBuyCompass?: () => void, onBuyMap?: () => void,
  onBuyAntidote: () => void
}> = ({
  gold, level, hasPet, language, activeAltarEffect, onBuyItem, onBuyPotion, onRentTron, onBuyPet, onClose,
  hasCompass, hasMap, onBuyCompass, onBuyMap, onBuyAntidote
}) => {
  const t = TRANSLATIONS[language];
  const discount = activeAltarEffect?.id === 'merchant_blessing' ? 0.8 : 1.0;

  const items = useMemo(() => ITEM_POOL.sort(() => 0.5 - Math.random()).slice(0, 3).map(it => ({
    ...it, id: `it-${Math.random()}`, price: Math.floor(it.basePrice * (1 + level * 0.1) * discount), x: 0, y: 0
  })) as ItemEntity[], [level, discount]);

  const potions: PotionEntity[] = [
    { id: 'p25', percent: 25, price: Math.floor(15 * discount), x: 0, y: 0 }, 
    { id: 'p50', percent: 50, price: Math.floor(30 * discount), x: 0, y: 0 }, 
    { id: 'p75', percent: 75, price: Math.floor(45 * discount), x: 0, y: 0 }
  ];

  return (
    <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-50 p-4 backdrop-blur-lg">
      <div className="bg-[#111] border border-[#222] max-w-xl w-full max-h-[85vh] p-6 rounded-[2.5rem] shadow-2xl flex flex-col gap-5 overflow-hidden">
        <div className="flex justify-between items-end border-b border-[#222] pb-4">
          <div>
            <h2 className="text-xl font-black text-white uppercase tracking-tighter">MERCADOR</h2>
            <div className="flex items-center gap-2 text-yellow-500 font-black text-[11px] mt-1">
              <Icon.Gold /> <span>{gold} MOEDAS</span>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white p-2">SAIR</button>
        </div>
        <div className="flex-1 overflow-y-auto space-y-6 pr-2 no-scrollbar">
          <button disabled={gold < 25} onClick={onRentTron} className="w-full p-4 bg-cyan-950/10 border border-cyan-500/20 rounded-2xl flex items-center gap-4 hover:bg-cyan-900/10 transition-all disabled:opacity-30">
            <div className="text-cyan-500"><Icon.Horse width={24} height={24}/></div>
            <div className="flex-1 text-left">
              <p className="text-[10px] font-black text-white uppercase">Cavalo Fantasma (20s)</p>
              <p className="text-[8px] text-cyan-600 font-bold uppercase">Iniciativa Máxima + Rastro</p>
            </div>
            <span className="text-[11px] text-yellow-500 font-black">25 G</span>
          </button>
          
          <div className="grid grid-cols-2 gap-3">
             <button disabled={gold < 90 || hasCompass} onClick={onBuyCompass} className={`p-4 bg-cyan-950/10 border border-cyan-500/20 rounded-2xl flex items-center gap-3 transition-all ${hasCompass ? 'opacity-50' : 'hover:bg-cyan-900/10'} disabled:opacity-30`}>
                <div className="text-cyan-400"><Icon.Compass width={20} height={20}/></div>
                <div className="flex-1 text-left">
                    <p className="text-[10px] font-black text-white uppercase">{t.compass_name}</p>
                    <p className="text-[8px] text-cyan-600 font-bold uppercase">{t.compass_desc}</p>
                </div>
                {!hasCompass ? <span className="text-[11px] text-yellow-500 font-black">90 G</span> : <span className="text-[8px] text-green-500 font-bold">OK</span>}
             </button>
             <button disabled={gold < 90 || hasMap} onClick={onBuyMap} className={`p-4 bg-emerald-950/10 border border-emerald-500/20 rounded-2xl flex items-center gap-3 transition-all ${hasMap ? 'opacity-50' : 'hover:bg-emerald-900/10'} disabled:opacity-30`}>
                <div className="text-emerald-500"><Icon.Map width={20} height={20}/></div>
                <div className="flex-1 text-left">
                    <p className="text-[10px] font-black text-white uppercase">{t.map_name}</p>
                    <p className="text-[8px] text-emerald-600 font-bold uppercase">{t.map_desc}</p>
                </div>
                {!hasMap ? <span className="text-[11px] text-yellow-500 font-black">90 G</span> : <span className="text-[8px] text-green-500 font-bold">OK</span>}
             </button>
          </div>

          <div className="w-full p-4 bg-green-950/10 border border-green-500/20 rounded-2xl flex items-center gap-4 hover:bg-green-900/10 transition-all">
             <div className="text-green-500"><Icon.Antidote width={24} height={24}/></div>
             <div className="flex-1 text-left">
               <p className="text-[10px] font-black text-white uppercase">{t.antidote_name}</p>
               <p className="text-[8px] text-green-600 font-bold uppercase">{t.antidote_desc}</p>
             </div>
             <button onClick={onBuyAntidote} disabled={gold < 50} className="px-4 py-2 bg-green-700 hover:bg-green-600 text-white font-black text-[10px] rounded-xl uppercase disabled:opacity-30">
               50 G
             </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {items.map(it => (
              <button key={it.id} disabled={gold < it.price!} onClick={() => onBuyItem(it)} className="p-4 bg-[#1a1a1a] border border-[#333] rounded-2xl hover:border-indigo-500 disabled:opacity-30 transition-all text-left">
                <div className="text-indigo-500 mb-2"><Icon.Sword /></div>
                <p className="text-[10px] font-black text-zinc-100 uppercase">{it.name}</p>
                <p className="text-[8px] text-indigo-400 font-bold uppercase">+{it.value} Atributo</p>
                <p className="text-[11px] text-yellow-500 font-black mt-2">{it.price} G</p>
              </button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-3">
            {potions.map(p => (
              <div key={p.id} className="p-3 bg-pink-900/5 rounded-2xl border border-pink-900/10 text-center space-y-2">
                <div className="text-pink-500 text-[11px] font-black flex items-center justify-center gap-1"><Icon.Potion /> {p.percent}%</div>
                <button onClick={() => onBuyPotion(p, 'use')} disabled={gold < p.price!} className="w-full py-1 bg-pink-600 text-white text-[8px] font-black rounded uppercase">USAR</button>
                <button onClick={() => onBuyPotion(p, 'store')} disabled={gold < p.price!} className="w-full py-1 bg-zinc-800 text-zinc-400 text-[8px] font-black rounded uppercase">GUARDAR</button>
                <p className="text-[9px] text-yellow-500 font-black">{p.price} G</p>
              </div>
            ))}
          </div>
          {!hasPet && (
             <div className="grid grid-cols-3 gap-3">
               {(['CACHORRO', 'LOBO', 'URSO'] as Pet['type'][]).map(type => (
                 <button key={type} onClick={() => onBuyPet(type)} disabled={gold < (type === 'URSO' ? 15 : 10)} className="p-3 bg-orange-950/5 border border-[#333] rounded-2xl flex flex-col items-center gap-1">
                   <div className="text-orange-500"><Icon.Wolf /></div>
                   <span className="text-[8px] font-black">{type}</span>
                   <span className="text-[9px] text-yellow-500 font-black">{type === 'URSO' ? 15 : 10} G</span>
                 </button>
               ))}
             </div>
          )}
        </div>
        <button onClick={onClose} className="w-full py-5 bg-white text-black font-black rounded-2xl uppercase text-[11px] tracking-[0.2em] active:scale-95 transition-all">Fechar Negócio</button>
      </div>
    </div>
  );
};

export const ChestModal: React.FC<{ onChoice: (choice: StatChoice, extra: 'gold' | 'potion') => void, language: Language }> = ({ onChoice, language }) => {
  const t = TRANSLATIONS[language];
  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-6 backdrop-blur-md">
      <div className="bg-[#111] border border-blue-600/50 max-w-sm w-full p-8 rounded-[3rem] text-center space-y-8 animate-in zoom-in-95">
        <div className="text-blue-500 flex justify-center scale-[3] mb-4"><Icon.Chest /></div>
        <h2 className="text-2xl font-black text-white uppercase tracking-tighter">{t.chest_title}</h2>
        <div className="grid grid-cols-1 gap-3">
          {(['Ataque', 'Armadura', 'Velocidade'] as StatChoice[]).map(choice => (
            <button key={choice} onClick={() => onChoice(choice, Math.random() > 0.5 ? 'gold' : 'potion')} className="py-5 bg-[#1a1a1a] hover:bg-[#222] rounded-2xl border border-[#333] transition-all">
              <span className="font-black text-[10px] uppercase tracking-[0.2em] text-white">
                {choice} {choice === 'Ataque' ? '+5' : choice === 'Armadura' ? '+3' : '+4'}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export const RelicSelectionModal: React.FC<{ options: Relic[], onSelect: (relic: Relic) => void, language: Language }> = ({ options, onSelect, language }) => {
  const t = TRANSLATIONS[language];
  return (
    <div className="fixed inset-0 bg-black z-[130] flex flex-col items-center justify-center p-6 space-y-10 animate-in fade-in">
      <h2 className="text-4xl font-black text-purple-500 tracking-tighter uppercase">{t.relic_choice}</h2>
      <div className="grid grid-cols-1 gap-4 w-full max-w-sm">
        {options.map(relic => (
          <button key={relic.id} onClick={() => onSelect(relic)} className="p-6 bg-[#111] border border-[#222] rounded-[2.5rem] text-left hover:border-purple-500/50 flex items-center gap-6 transition-all group">
            <div className="text-purple-500 group-hover:scale-110 transition-transform">{React.createElement((Icon as any)[relic.icon], { width: 32, height: 32 })}</div>
            <div className="space-y-1">
              <h4 className="text-[12px] font-black text-white uppercase">{relic.name}</h4>
              <p className="text-[10px] text-zinc-500 font-mono leading-tight">{relic.description}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export const AltarInteractionModal: React.FC<{ active: boolean, onPray: () => void, onClose: () => void, language: Language }> = ({ active, onPray, onClose, language }) => {
  const t = TRANSLATIONS[language];
  return (
    <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-50 p-6 backdrop-blur-md">
      <div className={`bg-[#111] border p-8 rounded-[3.5rem] max-w-sm w-full text-center space-y-8 animate-in zoom-in-95 ${active ? 'border-purple-600/50 shadow-[0_0_80px_rgba(147,51,234,0.1)]' : 'border-[#222]'}`}>
         <div className={`${active ? 'text-purple-500 animate-pulse' : 'text-zinc-800'} flex justify-center scale-[3.5] mb-6`}><Icon.Altar /></div>
         <h3 className="text-2xl font-black text-white uppercase tracking-tighter leading-none">{t.altar_title}</h3>
         <p className="text-zinc-500 text-[11px] font-bold leading-relaxed">{active ? t.altar_prompt : t.altar_inactive}</p>
         <div className="flex flex-col gap-3 pt-4">
            {active && <button onClick={onPray} className="w-full py-5 bg-purple-600 text-white font-black rounded-2xl uppercase text-[11px] tracking-[0.2em]">ORAR</button>}
            <button onClick={onClose} className="w-full py-4 bg-[#1a1a1a] text-zinc-500 font-black rounded-2xl uppercase text-[10px] border border-[#333]">Sair</button>
         </div>
      </div>
    </div>
  );
};

export const AltarResultModal: React.FC<{ effect: AltarEffect, onClose: () => void, language: Language }> = ({ effect, onClose, language }) => {
  const t = TRANSLATIONS[language];
  return (
    <div className="fixed inset-0 bg-black/98 flex items-center justify-center z-[140] p-6 backdrop-blur-3xl">
      <div className={`bg-[#111] border-4 p-10 rounded-[4rem] max-w-sm w-full text-center space-y-10 animate-in zoom-in-95 ${effect.type === 'BLESSING' ? 'border-yellow-600/50' : 'border-purple-900/50'}`}>
         <div className={`flex justify-center scale-[4] mb-4 ${effect.type === 'BLESSING' ? 'text-yellow-500' : 'text-purple-600'}`}><Icon.Altar /></div>
         <h3 className="text-3xl font-black text-white uppercase tracking-tighter">{t[effect.nameKey]}</h3>
         <p className="text-zinc-400 font-mono text-[11px] italic">{t[effect.descKey]}</p>
         <button onClick={onClose} className="w-full py-6 bg-white text-black font-black rounded-[2.5rem] uppercase text-[11px] tracking-[0.3em]">PROSSEGUIR</button>
      </div>
    </div>
  );
};

export const TutorialModal: React.FC<{ onFinish: () => void, language: Language }> = ({ onFinish, language }) => {
  const t = TRANSLATIONS[language];
  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center z-[100] p-6 backdrop-blur-3xl">
      <div className="max-w-md w-full max-h-[90vh] overflow-y-auto no-scrollbar space-y-8 animate-in zoom-in-95 p-4">
        <div className="text-center space-y-6">
          <div className="w-20 h-20 bg-red-950/30 border-2 border-red-600 rounded-[2rem] flex items-center justify-center text-red-500 mx-auto animate-pulse">
            <Icon.Player width={40} height={40} />
          </div>
          <h2 className="text-4xl font-black text-white uppercase tracking-tighter leading-none">{t.tutorial_title}</h2>
          <div className="bg-[#111] border border-[#222] p-8 rounded-[2.5rem] text-zinc-400 font-mono text-[11px] leading-relaxed text-left space-y-6 shadow-2xl">
            <p className="text-white border-b border-[#222] pb-3 font-black uppercase tracking-widest">{t.tutorial_guide_title}</p>
            <p className="flex gap-3"><span className="text-red-500 font-black">❤️</span> <span><strong className="text-white">{t.tutorial_hp}:</strong> {t.tutorial_hp_desc}</span></p>
            <p className="flex gap-3"><span className="text-yellow-400 font-black">⚔️</span> <span><strong className="text-white">{t.tutorial_atk}:</strong> {t.tutorial_atk_desc}</span></p>
            <p className="flex gap-3"><span className="text-blue-500 font-black">🛡️</span> <span><strong className="text-white">{t.tutorial_def}:</strong> {t.tutorial_def_desc}</span></p>
            <p className="flex gap-3"><span className="text-green-500 font-black">🥾</span> <span><strong className="text-white">{t.tutorial_spd}:</strong> {t.tutorial_spd_desc}</span></p>
            <div className="pt-4 border-t border-[#222]">
               <p className="text-orange-500 font-black uppercase text-[10px] mb-2 tracking-widest">🩸 {t.tutorial_trial_title}</p>
               <p className="italic opacity-80">{t.tutorial_trial_desc}</p>
            </div>
          </div>
        </div>
        <button onClick={onFinish} className="w-full py-6 bg-red-600 hover:bg-red-500 text-white font-black rounded-[2.5rem] uppercase tracking-[0.2em] text-xs shadow-2xl transition-all active:scale-95">{t.tutorial_btn}</button>
      </div>
    </div>
  );
};

export const PotionPickupModal: React.FC<{ potion: PotionEntity, onChoice: (mode: 'use' | 'store') => void, language: Language }> = ({ potion, onChoice, language }) => {
  const t = TRANSLATIONS[language];
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-6 backdrop-blur-sm">
      <div className="bg-[#111] border border-pink-500/30 p-8 rounded-[3rem] max-w-xs w-full text-center space-y-6 shadow-2xl">
         <div className="text-pink-500 flex justify-center scale-[3] mb-6"><Icon.Potion /></div>
         <h3 className="text-white font-black uppercase text-lg tracking-tighter">Frasco Encontrado</h3>
         <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Recupera {potion.percent}% da vida</p>
         <div className="grid grid-cols-1 gap-3 pt-4">
           <button onClick={() => onChoice('use')} className="w-full py-4 bg-pink-600 text-white font-black rounded-2xl uppercase text-[10px] tracking-[0.2em] active:scale-95 shadow-lg shadow-pink-900/20">{t.use}</button>
           <button onClick={() => onChoice('store')} className="w-full py-4 bg-[#1a1a1a] text-zinc-400 font-black rounded-2xl uppercase text-[10px] tracking-[0.2em] border border-[#333] active:scale-95">{t.store}</button>
         </div>
      </div>
    </div>
  );
};

export const EggStoryModal: React.FC<{ onAccept: () => void, language: Language }> = ({ onAccept, language }) => {
  const t = TRANSLATIONS[language];
  return (
    <div className="fixed inset-0 bg-black/98 flex items-center justify-center z-[150] p-6 backdrop-blur-3xl">
      <div className="max-w-md w-full bg-[#050505] border border-zinc-800 p-8 rounded-[3rem] text-center space-y-8 animate-in zoom-in-95 shadow-[0_0_50px_rgba(255,255,255,0.1)]">
         <div className="flex justify-center scale-[3] text-white animate-pulse"><Icon.Egg /></div>
         <div className="h-64 overflow-y-auto no-scrollbar border-y border-zinc-900 py-4">
            <p className="text-zinc-400 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">{t.egg_story}</p>
         </div>
         <button onClick={onAccept} className="w-full py-5 bg-white text-black font-black rounded-2xl uppercase text-[11px] tracking-[0.2em] active:scale-95 transition-all">{t.egg_accept}</button>
      </div>
    </div>
  );
};
