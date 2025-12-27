
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Enemy, EntityStats, StatChoice, PotionEntity, ItemEntity, Pet, Language, Relic, AltarEffect } from '../types';
import { Icon } from './Icons';
import { ITEM_POOL, TRANSLATIONS, RELICS_POOL } from '../constants';

interface CombatLogEntry {
  msg: string;
  type: 'player' | 'enemy' | 'pet' | 'info';
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
  onFinish: (newPlayerStats: EntityStats, win: boolean, goldEarned: number, petHp?: number) => void;
}

export const CombatModal: React.FC<CombatModalProps> = ({ 
  playerStats, enemy, activePet, language = 'PT', altarEffect, relic, inventory = [], onAttackSound, onUsePotion, onFinish 
}) => {
  const [currentPStats, setCurrentPStats] = useState({ ...playerStats });
  const [currentEStats, setCurrentEStats] = useState({ ...enemy.stats });
  const [petHp, setPetHp] = useState(activePet?.hp || 0);
  const [isDone, setIsDone] = useState(false);
  const [lastAttacker, setLastAttacker] = useState<'player' | 'enemy' | 'pet' | null>(null);
  const [isTakingDamage, setIsTakingDamage] = useState<'player' | 'enemy' | 'pet' | null>(null);
  const [combatLogs, setCombatLogs] = useState<CombatLogEntry[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pRef = useRef({ ...playerStats }); 
  const t = TRANSLATIONS[language];

  const addLog = (msg: string, type: 'player' | 'enemy' | 'pet' | 'info') => { 
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
    
    const resolveTurn = () => {
      if (pRef.current.hp <= 0 || e.hp <= 0) { setIsDone(true); return; }
      const executeSequence = async () => {
        turnCount++;
        
        // Mascote sempre ataca PRIMEIRO (Iniciativa)
        if (activePet && curPetHp > 0) {
            setLastAttacker('pet'); 
            setIsTakingDamage('enemy');
            if (onAttackSound) onAttackSound('player');
            let petAtk = Math.max(1, Math.floor(pRef.current.attack / 2));
            if (relic?.id === 'collar') petAtk += 10;
            e.hp -= petAtk; if (e.hp < 0) e.hp = 0;
            addLog(`Mascote atacou causando ${petAtk} de dano`, 'pet');
            setCurrentEStats({ ...e });
            await new Promise(r => setTimeout(r, 600)); 
            setIsTakingDamage(null);
            if (e.hp <= 0) { setIsDone(true); return; }
        }

        const enemiesFirst = altarEffect?.id === 'slow_reflexes';
        const playersTurn = !enemiesFirst && (pRef.current.speed >= e.speed);
        const turnOrder = playersTurn ? ['player', 'enemy'] : ['enemy', 'player'];

        const processSide = async (side: 'player' | 'enemy') => {
            if (pRef.current.hp <= 0 || e.hp <= 0) return;
            
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
                if (relic?.id === 'power' && isFirstPlayerHitInCombat) {
                    atkValue = Math.floor(atkValue * 1.1);
                    isFirstPlayerHitInCombat = false;
                }
                if (relic?.id === 'crit' && Math.random() < 0.05) {
                    atkValue *= 2;
                    addLog(`GOLPE CRÍTICO!`, 'player');
                }
                if (altarEffect?.id === 'contained_fury' && pRef.current.hp < (pRef.current.maxHp / 2)) {
                    atkValue = Math.floor(atkValue * 1.15);
                }
            }

            setLastAttacker(side); setIsTakingDamage(side === 'player' ? 'enemy' : 'player');
            if (onAttackSound) onAttackSound(side);
            
            let defender = side === 'player' ? e : pRef.current;
            let originalAtk = atkValue;
            
            if (side === 'enemy' && relic?.id === 'defense') originalAtk = Math.max(1, originalAtk - 1);
            if (side === 'enemy' && altarEffect?.id === 'fragile_blood') originalAtk = Math.floor(originalAtk * 1.1);

            let currentAtkForCalculation = originalAtk;
            if (defender.armor > 0) {
              let absorbed = Math.min(defender.armor, currentAtkForCalculation);
              defender.armor = Math.max(0, defender.armor - absorbed);
              currentAtkForCalculation -= absorbed;
            }
            if (currentAtkForCalculation > 0) defender.hp -= currentAtkForCalculation;
            
            if (defender.hp < 0) defender.hp = 0;
            if (side === 'player') lastPlayerAttackTurn = turnCount;

            const msg = side === 'player' ? `Você atacou o inimigo causando ${originalAtk} de dano` : `O inimigo atacou causando ${originalAtk} de dano`;
            addLog(msg, side === 'player' ? 'player' : 'enemy');
            setCurrentPStats({ ...pRef.current }); setCurrentEStats({ ...e }); 

            await new Promise(r => setTimeout(r, 650)); 
            setIsTakingDamage(null);
        };

        await processSide(turnOrder[0] as any);
        if (pRef.current.hp > 0 && e.hp > 0) {
            await new Promise(r => setTimeout(r, 200)); 
            await processSide(turnOrder[1] as any);
            if (pRef.current.hp > 0 && e.hp > 0) setTimeout(resolveTurn, 500);
            else setIsDone(true);
        } else { setIsDone(true); }
      };
      executeSequence();
    };
    setTimeout(resolveTurn, 600);
  }, []);

  const handleUsePotion = (idx: number) => {
    if (isDone) return;
    const pot = inventory![idx];
    const potName = pot.percent <= 25 ? 'Poção Pequena' : pot.percent <= 50 ? 'Poção Média' : 'Poção Grande';
    if (onUsePotion(idx)) { 
      setCurrentPStats({ ...pRef.current }); 
      addLog(`Você usou uma ${potName} e recuperou ${pot.percent}% da Vida`, 'player'); 
    }
  };

  return (
    <div className="fixed inset-0 bg-black/98 flex items-center justify-center z-50 p-4 backdrop-blur-xl">
      <div className="bg-[#0a0a0a] border border-[#222] max-w-lg w-full p-6 rounded-[2.5rem] shadow-2xl flex flex-col gap-6">
        
        <div className="flex gap-4 items-stretch">
          <div className={`flex-1 flex flex-col items-center gap-4 p-5 rounded-[1.5rem] bg-[#111] border border-[#333] transition-all ${isTakingDamage === 'player' ? 'animate-shake border-red-900' : ''}`}>
             <div className="flex items-center justify-center gap-4">
                <span className="text-yellow-400 drop-shadow-[0_0_10px_rgba(234,179,8,0.4)]"><Icon.Player width={40} height={40} /></span>
                {activePet && petHp > 0 && (
                   <div className="flex flex-col items-center border-l border-[#333] pl-4">
                      <span className="text-orange-500 animate-pet-wiggle"><Icon.Wolf width={30} height={30} /></span>
                   </div>
                )}
             </div>
             <div className="w-full h-2 bg-black rounded-full overflow-hidden border border-[#222]">
                <div className="h-full bg-red-600 transition-all duration-500" style={{ width: `${(currentPStats.hp / currentPStats.maxHp) * 100}%` }} />
             </div>
          </div>

          <div className="flex items-center justify-center opacity-20"><span className="text-zinc-600 text-xl font-black">VS</span></div>

          <div className={`flex-1 flex flex-col items-center gap-4 p-5 rounded-[1.5rem] bg-[#111] border border-[#333] transition-all ${isTakingDamage === 'enemy' ? 'animate-shake border-red-900' : ''}`}>
             <span className={enemy.isBoss ? 'text-red-600' : 'text-zinc-500'}>
                <Icon.Enemy isBoss={enemy.isBoss} width={40} height={40} />
             </span>
             <div className="w-full h-2 bg-black rounded-full overflow-hidden border border-[#222]">
                <div className="h-full bg-zinc-700 transition-all duration-500" style={{ width: `${(currentEStats.hp / currentEStats.maxHp) * 100}%` }} />
             </div>
             <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest leading-none">{enemy.type}</span>
          </div>
        </div>

        <div className="bg-[#050505] border border-[#222] rounded-2xl p-5 h-44 overflow-hidden shadow-inner flex flex-col">
          <p className="text-[8px] font-black text-zinc-700 uppercase tracking-widest mb-2 border-b border-[#111] pb-1">Histórico de Combate</p>
          <div ref={scrollRef} className="overflow-y-auto h-full space-y-2 no-scrollbar font-mono">
            {combatLogs.map((log, i) => (
              <p key={i} className={`text-[11px] leading-tight font-bold ${
                log.type === 'player' ? 'text-cyan-400' : 
                log.type === 'enemy' ? 'text-red-400' : 
                log.type === 'pet' ? 'text-orange-400' : 'text-zinc-600'
              }`}>
                {log.msg}
              </p>
            ))}
          </div>
        </div>

        {!isDone && inventory && inventory.length > 0 && (
          <div className="flex justify-center flex-wrap gap-2 p-3 bg-[#111] rounded-2xl border border-[#222]">
            {inventory.map((pot, i) => {
               const potName = pot.percent <= 25 ? 'Poção Pequena' : pot.percent <= 50 ? 'Poção Média' : 'Poção Grande';
               return (
                <button key={i} onClick={() => handleUsePotion(i)} className="flex items-center gap-2 px-4 py-2 bg-pink-950/10 border border-pink-500/20 rounded-xl text-pink-500 hover:bg-pink-900/20 active:scale-95 transition-all group overflow-hidden">
                  <Icon.Potion width={14} height={14} />
                  <div className="flex flex-col items-start leading-none">
                    <span className="text-[9px] font-black uppercase whitespace-nowrap">{potName}</span>
                    <span className="text-[7px] font-bold opacity-60">Regenera {pot.percent}%</span>
                  </div>
                </button>
               )
            })}
          </div>
        )}

        {isDone && (
          <button onClick={() => onFinish(currentPStats, currentPStats.hp > 0, Math.floor(Math.random() * 10) + 10, petHp)} className={`w-full font-black py-5 rounded-2xl uppercase text-[12px] tracking-[0.2em] transition-all transform active:scale-95 shadow-2xl ${currentPStats.hp > 0 ? "bg-[#16a34a] text-white hover:bg-[#15803d]" : "bg-red-800 text-white hover:bg-red-700"}`}>
            {currentPStats.hp > 0 ? t.collect_reward : t.succumb}
          </button>
        )}
      </div>
    </div>
  );
};

export const MerchantShopModal: React.FC<MerchantShopModalProps> = ({
  gold, level, hasPet, language = 'PT', onBuyItem, onBuyPotion, onRentTron, onBuyPet, onClose
}) => {
  const t = TRANSLATIONS[language];
  const shopItems = useMemo(() => {
    return [...ITEM_POOL].sort(() => 0.5 - Math.random()).slice(0, 3).map(item => ({
        ...item, id: `shop-item-${Math.random()}`,
        price: Math.floor(item.basePrice * (1 + level * 0.1)),
        x: 0, y: 0
      })) as ItemEntity[];
  }, [level]);

  const potions = useMemo(() => [
    { id: 'p25', percent: 25, price: 12 },
    { id: 'p50', percent: 50, price: 25 },
    { id: 'p75', percent: 75, price: 40 }
  ], []);

  return (
    <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-50 p-4 backdrop-blur-lg">
      <div className="bg-[#111] border border-[#222] max-w-xl w-full max-h-[85vh] p-4 md:p-6 rounded-[2.5rem] shadow-2xl flex flex-col gap-4 overflow-hidden">
        <div className="flex justify-between items-end border-b border-[#222] pb-4 flex-shrink-0">
          <div>
            <h2 className="text-xl font-black text-white uppercase tracking-tighter">{t.merchant_title}</h2>
            <div className="flex items-center gap-2 text-yellow-500 font-black text-[11px] mt-1">
              <Icon.Gold /> <span>{gold} MOEDAS</span>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white p-2"><Icon.VolumeX /></button>
        </div>

        <div className="flex-1 overflow-y-auto pr-2 space-y-5 no-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {shopItems.map(item => (
              <button key={item.id} disabled={gold < (item.price || 0)} onClick={() => onBuyItem(item)} className="p-4 bg-[#1a1a1a] border border-[#333] rounded-2xl hover:border-indigo-500 disabled:opacity-30 transition-all text-left group">
                <div className="text-indigo-500 mb-3 group-hover:scale-110 transition-transform">
                  {item.iconType === 'sword' ? <Icon.Sword width={20} height={20}/> : item.iconType === 'shield' ? <Icon.Shield width={20} height={20}/> : item.iconType === 'boot' ? <Icon.Boot width={20} height={20}/> : <Icon.Heart width={20} height={20}/>}
                </div>
                <p className="text-[10px] font-black text-zinc-100 uppercase leading-none">{item.name}</p>
                <p className="text-[11px] text-yellow-500 font-black mt-2">{item.price} G</p>
              </button>
            ))}
          </div>

          <div className="space-y-3">
             <p className="text-[10px] font-black text-pink-500 uppercase tracking-widest text-center border-b border-pink-900/20 pb-1">Suprimentos</p>
             <div className="grid grid-cols-3 gap-3">
                {potions.map(p => (
                   <div key={p.id} className="flex flex-col gap-2 bg-pink-900/5 p-3 rounded-2xl border border-pink-900/10">
                      <div className="flex items-center justify-center text-pink-500 text-[11px] font-black">
                        <Icon.Potion width={14} height={14} /> <span className="ml-1">{p.percent}%</span>
                      </div>
                      <div className="flex flex-col gap-1.5 mt-1">
                        <button onClick={() => onBuyPotion(p as any, 'use')} disabled={gold < p.price} className="w-full py-1.5 bg-pink-600/10 text-pink-500 text-[8px] font-black rounded border border-pink-500/20">USAR</button>
                        <button onClick={() => onBuyPotion(p as any, 'store')} disabled={gold < p.price} className="w-full py-1.5 bg-zinc-800 text-zinc-400 text-[8px] font-black rounded">GUARDAR</button>
                      </div>
                      <p className="text-[9px] text-center text-yellow-500 font-black mt-1">{p.price} G</p>
                   </div>
                ))}
             </div>
          </div>

          {!hasPet && (
            <div className="space-y-3">
               <p className="text-[10px] font-black text-orange-500 uppercase tracking-widest text-center border-b border-orange-900/20 pb-1">Companheiros (10 G)</p>
               <div className="grid grid-cols-3 gap-3">
                  {(['LOBO', 'PUMA', 'CORVO'] as Pet['type'][]).map(type => (
                    <button key={type} onClick={() => onBuyPet(type)} disabled={gold < 10} className="flex flex-col items-center gap-2 p-3 bg-orange-900/5 rounded-2xl border border-[#333] hover:border-orange-500 disabled:opacity-30">
                      <span className="text-orange-500">{type === 'LOBO' ? <Icon.Wolf width={20} height={20}/> : type === 'PUMA' ? <Icon.Puma width={20} height={20}/> : <Icon.Corvo width={20} height={20}/>}</span>
                      <span className="text-[9px] font-black text-zinc-400">{type}</span>
                    </button>
                  ))}
               </div>
            </div>
          )}

          <button disabled={gold < 25} onClick={onRentTron} className="w-full p-4 bg-cyan-950/10 border border-cyan-500/20 rounded-2xl flex items-center gap-4 hover:bg-cyan-900/10 transition-all disabled:opacity-30">
            <div className="text-cyan-500"><Icon.Horse width={24} height={24}/></div>
            <div className="flex-1 text-left">
              <p className="text-[10px] font-black text-white uppercase tracking-tight">Cavalo Fantasma (15s)</p>
              <p className="text-[8px] text-cyan-600 font-bold uppercase tracking-widest">Iniciativa Máxima + Rastro</p>
            </div>
            <span className="text-[11px] text-yellow-500 font-black">25 G</span>
          </button>
        </div>

        <button onClick={onClose} className="w-full py-5 bg-white text-black font-black rounded-2xl uppercase text-[11px] tracking-[0.2em] flex-shrink-0 active:scale-95 transition-all">Fechar Negócio</button>
      </div>
    </div>
  );
};

export const TutorialModal: React.FC<TutorialModalProps> = ({ onFinish, language = 'PT' }) => {
  const t = TRANSLATIONS[language];
  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center z-[100] p-6 backdrop-blur-3xl">
      <div className="max-w-md w-full max-h-[90vh] overflow-y-auto no-scrollbar space-y-8 animate-in zoom-in-95 p-4">
        <div className="text-center space-y-6">
          <div className="w-20 h-20 bg-red-950/30 border-2 border-red-600 rounded-[2rem] flex items-center justify-center text-red-500 mx-auto animate-pulse">
            <Icon.Player width={40} height={40} />
          </div>
          <h2 className="text-4xl font-black text-white uppercase tracking-tighter leading-none">BEM-VINDO AO ABISMO</h2>
          <div className="bg-[#111] border border-[#222] p-8 rounded-[2.5rem] text-zinc-400 font-mono text-[11px] leading-relaxed text-left space-y-6 shadow-2xl">
            <p className="text-white border-b border-[#222] pb-3 font-black uppercase tracking-widest">Guia de Sobrevivência:</p>
            <p className="flex gap-3"><span className="text-red-500 font-black">❤️</span> <span><strong className="text-white">VIDA:</strong> Mantenha acima de 0 ou sua run termina.</span></p>
            <p className="flex gap-3"><span className="text-yellow-400 font-black">⚔️</span> <span><strong className="text-white">ATAQUE:</strong> Dano causado por golpe automático.</span></p>
            <p className="flex gap-3"><span className="text-blue-500 font-black">🛡️</span> <span><strong className="text-white">ESCUDO:</strong> Protege sua vida e regenera após cada luta.</span></p>
            <p className="flex gap-3"><span className="text-green-500 font-black">🥾</span> <span><strong className="text-white">VELOCIDADE:</strong> Define quem golpeia primeiro.</span></p>
            <div className="pt-4 border-t border-[#222]">
               <p className="text-orange-500 font-black uppercase text-[10px] mb-2 tracking-widest">🩸 A PROVAÇÃO</p>
               <p className="italic opacity-80">As escadas estão lacradas. Mate ao menos um inimigo e pegue a chave para avançar.</p>
            </div>
          </div>
        </div>
        <button onClick={onFinish} className="w-full py-6 bg-red-600 hover:bg-red-500 text-white font-black rounded-[2.5rem] uppercase tracking-[0.2em] text-xs shadow-2xl transition-all active:scale-95">ESTOU PRONTO</button>
      </div>
    </div>
  );
};

export const ChestModal: React.FC<ChestModalProps> = ({ onChoice, language = 'PT' }) => {
  const t = TRANSLATIONS[language];
  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-6 backdrop-blur-md">
      <div className="bg-[#111] border border-blue-600/50 max-w-sm w-full p-8 rounded-[3rem] text-center space-y-8 animate-in zoom-in-95 shadow-[0_0_50px_rgba(37,99,235,0.2)]">
        <div className="text-blue-500 flex justify-center scale-[3] mb-4"><Icon.Chest /></div>
        <h2 className="text-2xl font-black text-white uppercase tracking-tighter">{t.chest_title}</h2>
        <div className="grid grid-cols-1 gap-3">
          {(['Ataque', 'Armadura', 'Velocidade'] as StatChoice[]).map(choice => (
            <button key={choice} onClick={() => onChoice(choice)} className="py-5 bg-[#1a1a1a] hover:bg-[#222] rounded-2xl border border-[#333] transition-all active:scale-95 group">
              <span className="font-black text-[10px] uppercase tracking-[0.2em] text-white group-hover:text-blue-400">
                {choice} {choice === 'Ataque' ? '+5' : choice === 'Armadura' ? '+3' : '+4'}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export const PotionPickupModal: React.FC<PotionPickupModalProps> = ({ potion, language = 'PT', onChoice }) => {
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

export const RelicSelectionModal: React.FC<RelicSelectionModalProps> = ({ options, language = 'PT', onSelect }) => {
  const t = TRANSLATIONS[language];
  return (
    <div className="fixed inset-0 bg-black z-[130] flex flex-col items-center justify-center p-6 space-y-10 animate-in fade-in">
      <div className="text-center space-y-3">
        <h2 className="text-4xl font-black text-purple-500 tracking-tighter uppercase leading-none">{t.relic_choice}</h2>
        <p className="text-zinc-600 font-bold text-[10px] uppercase tracking-[0.3em]">Escolha o seu legado eterno</p>
      </div>
      <div className="grid grid-cols-1 gap-4 w-full max-w-sm">
        {options.map(relic => (
          <button key={relic.id} onClick={() => onSelect(relic)} className="p-6 bg-[#111] border border-[#222] rounded-[2.5rem] text-left hover:border-purple-500/50 flex items-center gap-6 transition-all active:scale-95 group">
            <div className="text-purple-500 group-hover:scale-110 transition-transform">{React.createElement((Icon as any)[relic.icon], { width: 32, height: 32 })}</div>
            <div className="space-y-1">
              <h4 className="text-[12px] font-black text-white uppercase tracking-tight">{relic.name}</h4>
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
    <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-50 p-6 backdrop-blur-md">
      <div className={`bg-[#111] border p-8 rounded-[3.5rem] max-w-sm w-full text-center space-y-8 animate-in zoom-in-95 transition-all ${active ? 'border-purple-600/50 shadow-[0_0_80px_rgba(147,51,234,0.1)]' : 'border-[#222] opacity-60'}`}>
         <div className={`${active ? 'text-purple-500 animate-pulse' : 'text-zinc-800'} flex justify-center scale-[3.5] mb-6`}><Icon.Altar /></div>
         <div className="space-y-3">
            <h3 className="text-2xl font-black text-white uppercase tracking-tighter leading-none">{t.altar_title}</h3>
            <p className="text-zinc-500 text-[11px] font-bold leading-relaxed">{active ? t.altar_prompt : t.altar_inactive}</p>
         </div>
         <div className="flex flex-col gap-3 pt-4">
            {active && <button onClick={onPray} className="w-full py-5 bg-purple-600 text-white font-black rounded-2xl uppercase text-[11px] tracking-[0.2em] shadow-lg shadow-purple-900/20 active:scale-95 transition-all">ORAR</button>}
            <button onClick={onClose} className="w-full py-4 bg-[#1a1a1a] text-zinc-500 font-black rounded-2xl uppercase text-[10px] border border-[#333] active:scale-95 transition-all">Sair</button>
         </div>
      </div>
    </div>
  );
};

export const AltarResultModal: React.FC<AltarResultModalProps> = ({ effect, language = 'PT', onClose }) => {
  const t = TRANSLATIONS[language];
  const isBlessing = effect.type === 'BLESSING';
  return (
    <div className="fixed inset-0 bg-black/98 flex items-center justify-center z-[140] p-6 backdrop-blur-3xl">
      <div className={`bg-[#111] border-4 p-10 rounded-[4rem] max-w-sm w-full text-center space-y-10 animate-in zoom-in-95 shadow-2xl ${isBlessing ? 'border-yellow-600/50' : 'border-purple-900/50'}`}>
         <div className={`flex justify-center scale-[4] mb-4 ${isBlessing ? 'text-yellow-500' : 'text-purple-600'}`}><Icon.Altar /></div>
         <div className="space-y-4">
            <h3 className="text-3xl font-black text-white uppercase tracking-tighter leading-none">{t[effect.nameKey]}</h3>
            <p className="text-zinc-400 font-mono text-[11px] leading-relaxed italic">{t[effect.descKey]}</p>
         </div>
         <button onClick={onClose} className={`w-full py-6 font-black rounded-[2.5rem] uppercase text-[11px] tracking-[0.3em] active:scale-95 transition-all ${isBlessing ? 'bg-yellow-600 text-black shadow-lg shadow-yellow-900/20' : 'bg-zinc-800 text-zinc-300 shadow-lg shadow-black/50'}`}>PROSSEGUIR</button>
      </div>
    </div>
  );
};

interface MerchantShopModalProps {
  gold: number;
  level: number;
  hasPet: boolean;
  language?: Language;
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
interface ChestModalProps { onChoice: (choice: StatChoice) => void; language?: Language; }
