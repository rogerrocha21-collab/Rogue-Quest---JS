
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

export const CombatModal: React.FC<CombatModalProps> = ({ 
  playerStats, enemy, activePet, language = 'PT', altarEffect, relic, inventory = [], onAttackSound, onUsePotion, onFinish 
}) => {
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

  const addLog = (msg: string) => { setCombatLogs(prev => [...prev, msg]); };

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
        
        // Pet Turn
        if (activePet && curPetHp > 0) {
            setLastAttacker('pet'); setIsTakingDamage('enemy');
            if (onAttackSound) onAttackSound('player');
            let petAtk = Math.max(1, Math.floor(pRef.current.attack / 2));
            if (relic?.id === 'collar') petAtk += 10;
            e.hp -= petAtk; if (e.hp < 0) e.hp = 0;
            addLog(`${t.combat_pet} ${t.combat_dealt} ${petAtk} ${t.combat_damage}`);
            setCurrentEStats({ ...e });
            await new Promise(r => setTimeout(r, 80)); 
            setIsTakingDamage(null);
            if (e.hp <= 0) { setIsDone(true); return; }
        }

        // Altar: Reflexos Lentos
        const enemiesFirst = altarEffect?.id === 'slow_reflexes';
        const playersTurn = !enemiesFirst && (pRef.current.speed >= e.speed);
        const turnOrder = playersTurn ? ['player', 'enemy'] : ['enemy', 'player'];

        const processSide = async (side: 'player' | 'enemy') => {
            if (pRef.current.hp <= 0 || e.hp <= 0) return;
            
            // Altar: Fôlego Curto
            if (side === 'player' && altarEffect?.id === 'short_breath' && lastPlayerAttackTurn === turnCount - 1) {
                addLog(`Você recupera o fôlego...`);
                return;
            }
            // Altar: Mãos Trêmulas
            if (side === 'player' && altarEffect?.id === 'trembling_hands' && Math.random() < 0.25) {
                addLog(`Você errou o ataque!`);
                return;
            }

            let atkValue = side === 'player' ? pRef.current.attack : e.attack;
            
            // Relíquias e Maldições de Dano
            if (side === 'player') {
                if (relic?.id === 'power' && isFirstPlayerHitInCombat) {
                    atkValue = Math.floor(atkValue * 1.1);
                    isFirstPlayerHitInCombat = false;
                }
                if (relic?.id === 'crit' && Math.random() < 0.05) {
                    atkValue *= 2;
                    addLog(`CRÍTICO!`);
                }
                // Altar: Fúria Contida (+15% dano com <50% vida)
                if (altarEffect?.id === 'contained_fury' && pRef.current.hp < (pRef.current.maxHp / 2)) {
                    atkValue = Math.floor(atkValue * 1.15);
                }
            }

            setLastAttacker(side); setIsTakingDamage(side === 'player' ? 'enemy' : 'player');
            if (onAttackSound) onAttackSound(side);
            
            let defender = side === 'player' ? e : pRef.current;
            let originalAtk = atkValue;
            
            // Relíquia de Defesa
            if (side === 'enemy' && relic?.id === 'defense') originalAtk = Math.max(1, originalAtk - 1);
            // Altar: Sangue Frágil (+10% dano recebido)
            if (side === 'enemy' && altarEffect?.id === 'fragile_blood') originalAtk = Math.floor(originalAtk * 1.1);

            let currentAtkForCalculation = originalAtk;
            let absorbed = 0;
            if (defender.armor > 0) {
              absorbed = Math.min(defender.armor, currentAtkForCalculation);
              defender.armor = Math.max(0, defender.armor - absorbed);
              currentAtkForCalculation -= absorbed;
            }
            if (currentAtkForCalculation > 0) defender.hp -= currentAtkForCalculation;
            
            if (defender.hp < 0) defender.hp = 0;
            if (side === 'player') lastPlayerAttackTurn = turnCount;

            addLog(`${side === 'player' ? t.combat_player : t.combat_enemy} ${t.combat_dealt} ${originalAtk} ${t.combat_damage}`);
            setCurrentPStats({ ...pRef.current }); setCurrentEStats({ ...e }); 

            await new Promise(r => setTimeout(r, 100)); 
            setIsTakingDamage(null);
        };

        await processSide(turnOrder[0] as any);
        if (pRef.current.hp > 0 && e.hp > 0) {
            await new Promise(r => setTimeout(r, 50)); 
            await processSide(turnOrder[1] as any);
            if (pRef.current.hp > 0 && e.hp > 0) setTimeout(resolveTurn, 100);
            else setIsDone(true);
        } else { setIsDone(true); }
      };
      executeSequence();
    };
    setTimeout(resolveTurn, 200);
  }, []);

  const handleUsePotion = (idx: number) => {
    if (isDone) return;
    if (onUsePotion(idx)) { 
      setCurrentPStats({ ...pRef.current }); 
      addLog(`Poção usada!`); 
    }
  };

  return (
    <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-50 p-4 backdrop-blur-md">
      <div className="bg-zinc-900 border-2 border-zinc-800 max-w-xl w-full p-5 rounded-[2.5rem] shadow-2xl flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4 font-mono">
          <div className={`text-center space-y-3 ${isTakingDamage === 'player' ? 'animate-shake' : ''}`}>
            <div className={`p-4 rounded-3xl border-2 ${isTakingDamage === 'player' ? 'bg-red-900/40 border-red-500' : 'bg-zinc-800 border-zinc-700'}`}>
              <span className="text-yellow-400 scale-110 block"><Icon.Player /></span>
            </div>
            <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full bg-red-500 transition-all" style={{ width: `${(currentPStats.hp / currentPStats.maxHp) * 100}%` }} />
            </div>
            <p className="text-[9px] text-zinc-500 font-black uppercase">❤️ {currentPStats.hp}</p>
          </div>
          <div className={`text-center space-y-3 ${isTakingDamage === 'enemy' ? 'animate-shake' : ''}`}>
            <div className={`p-4 rounded-3xl border-2 ${enemy.isBoss ? 'bg-red-950 border-red-800' : isTakingDamage === 'enemy' ? 'bg-red-900/40 border-red-500' : 'bg-zinc-800 border-zinc-700'}`}>
              <span className={enemy.isBoss ? 'text-red-500' : 'text-zinc-300'}><Icon.Enemy isBoss={enemy.isBoss} /></span>
            </div>
            <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full bg-red-700 transition-all" style={{ width: `${(currentEStats.hp / currentEStats.maxHp) * 100}%` }} />
            </div>
            <p className="text-[9px] text-zinc-500 uppercase font-black">{enemy.type}</p>
          </div>
        </div>
        {!isDone && inventory.length > 0 && (
          <div className="flex justify-center gap-2 p-2 bg-black/30 rounded-xl">
            {inventory.map((pot, i) => (
              <button key={i} onClick={() => handleUsePotion(i)} className="p-2 bg-pink-900/10 border border-pink-500/30 rounded-lg text-pink-400">
                <Icon.Potion width={14} height={14} />
              </button>
            ))}
          </div>
        )}
        <div className="bg-black/50 border border-zinc-800 rounded-xl p-3 h-28 overflow-hidden">
          <div ref={scrollRef} className="overflow-y-auto h-full space-y-1 no-scrollbar">
            {combatLogs.map((log, i) => (
              <p key={i} className="text-[9px] font-mono text-zinc-500">[{i+1}] {log}</p>
            ))}
          </div>
        </div>
        {isDone && (
          <button onClick={() => onFinish(currentPStats, currentPStats.hp > 0, Math.floor(Math.random() * 10) + 10, petHp)} className={`w-full font-black py-4 rounded-xl uppercase text-xs ${currentPStats.hp > 0 ? "bg-green-600" : "bg-red-700"}`}>
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
      <div className="bg-zinc-900 border-2 border-indigo-500 max-w-xl w-full max-h-[85vh] p-4 md:p-6 rounded-[2.5rem] shadow-2xl flex flex-col gap-4 overflow-hidden">
        <div className="flex justify-between items-end border-b border-zinc-800 pb-3 flex-shrink-0">
          <div>
            <h2 className="text-xl font-black text-white uppercase tracking-tighter">{t.merchant_title}</h2>
            <div className="flex items-center gap-2 text-yellow-500 font-black text-[11px]">
              <Icon.Gold /> <span>{gold} MOEDAS</span>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white mb-1"><Icon.VolumeX /></button>
        </div>

        <div className="flex-1 overflow-y-auto pr-2 space-y-4 no-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {shopItems.map(item => (
              <button key={item.id} disabled={gold < (item.price || 0)} onClick={() => onBuyItem(item)} className="p-3 bg-zinc-800/30 border border-zinc-800 rounded-2xl hover:border-indigo-500 disabled:opacity-30 transition-all text-left group">
                <div className="text-indigo-400 mb-2 group-hover:scale-110 transition-transform">{item.iconType === 'sword' ? <Icon.Sword width={16} height={16}/> : item.iconType === 'shield' ? <Icon.Shield width={16} height={16}/> : item.iconType === 'boot' ? <Icon.Boot width={16} height={16}/> : <Icon.Heart width={16} height={16}/>}</div>
                <p className="text-[9px] font-black text-zinc-100 uppercase leading-none">{item.name}</p>
                <p className="text-[10px] text-yellow-500 font-black mt-2">{item.price} G</p>
              </button>
            ))}
          </div>

          <div className="space-y-2">
             <p className="text-[9px] font-black text-pink-500 uppercase tracking-widest text-center border-b border-pink-900/30 pb-1">Poções de Cura</p>
             <div className="grid grid-cols-3 gap-2">
                {potions.map(p => (
                   <div key={p.id} className="flex flex-col gap-2 bg-pink-950/10 p-2 rounded-xl border border-pink-900/10">
                      <div className="flex items-center justify-center text-pink-400 text-[10px] font-black">
                        <Icon.Potion width={12} height={12} /> <span className="ml-1">{p.percent}%</span>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => onBuyPotion(p as any, 'use')} disabled={gold < p.price} className="flex-1 py-1 bg-pink-600/10 text-pink-400 text-[7px] font-black rounded border border-pink-500/20">USAR</button>
                        <button onClick={() => onBuyPotion(p as any, 'store')} disabled={gold < p.price} className="flex-1 py-1 bg-zinc-800 text-zinc-400 text-[7px] font-black rounded">GUARDAR</button>
                      </div>
                      <p className="text-[8px] text-center text-yellow-500 font-black">{p.price} G</p>
                   </div>
                ))}
             </div>
          </div>

          {!hasPet && (
            <div className="space-y-2">
               <p className="text-[9px] font-black text-orange-500 uppercase tracking-widest text-center border-b border-orange-900/30 pb-1">Companheiros (10 G)</p>
               <div className="grid grid-cols-3 gap-2">
                  {(['LOBO', 'PUMA', 'CORVO'] as Pet['type'][]).map(type => (
                    <button key={type} onClick={() => onBuyPet(type)} disabled={gold < 10} className="flex flex-col items-center gap-2 p-2 bg-orange-950/5 rounded-xl border border-zinc-800 hover:border-orange-500 disabled:opacity-30">
                      <span className="text-orange-400">{type === 'LOBO' ? <Icon.Wolf width={16} height={16}/> : type === 'PUMA' ? <Icon.Puma width={16} height={16}/> : <Icon.Corvo width={16} height={16}/>}</span>
                      <span className="text-[8px] font-black text-zinc-400">{type}</span>
                    </button>
                  ))}
               </div>
            </div>
          )}

          <button disabled={gold < 25} onClick={onRentTron} className="w-full p-4 bg-cyan-900/10 border border-cyan-500/30 rounded-2xl flex items-center gap-4 hover:bg-cyan-900/20 transition-all disabled:opacity-30">
            <div className="text-cyan-400"><Icon.Horse width={20} height={20}/></div>
            <div className="flex-1 text-left">
              <p className="text-[9px] font-black text-white uppercase">Cavalo Fantasma (15s)</p>
              <p className="text-[7px] text-cyan-600 font-bold uppercase tracking-widest">Velocidade Máxima + Rastro</p>
            </div>
            <span className="text-[10px] text-yellow-500 font-black">25 G</span>
          </button>
        </div>

        <button onClick={onClose} className="w-full py-4 bg-white text-black font-black rounded-xl uppercase text-xs tracking-widest flex-shrink-0 active:scale-95 transition-all">Fechar Negócio</button>
      </div>
    </div>
  );
};

export const TutorialModal: React.FC<TutorialModalProps> = ({ onFinish, language = 'PT' }) => {
  const t = TRANSLATIONS[language];
  return (
    <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-[100] p-4 backdrop-blur-xl">
      <div className="max-w-md w-full max-h-[90vh] overflow-y-auto no-scrollbar space-y-6 animate-in zoom-in-95 p-4">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-red-900/20 border-2 border-red-600 rounded-2xl flex items-center justify-center text-red-500 mx-auto animate-pulse">
            <Icon.Player width={32} height={32} />
          </div>
          <h2 className="text-3xl font-black text-white uppercase tracking-tighter">BEM-VINDO AO ABISMO</h2>
          <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-3xl text-zinc-400 font-mono text-xs leading-relaxed text-left space-y-5 shadow-2xl">
            <p className="text-white border-b border-zinc-800 pb-2 font-black uppercase">O Combate:</p>
            <p>&gt; Batalhas são resolvidas <span className="text-yellow-500 font-black">automaticamente</span> em turnos rápidos.</p>
            <p>&gt; ❤️ <span className="text-red-500">VIDA:</span> Se chegar a 0, você sucumbirá.</p>
            <p>&gt; ⚔️ <span className="text-yellow-400">ATAQUE:</span> O dano que você desfere a cada golpe.</p>
            <p>&gt; 🛡️ <span className="text-blue-400">ARMADURA:</span> Absorve o dano antes da vida. Recupera-se totalmente entre lutas.</p>
            <p>&gt; 🥾 <span className="text-green-500">VELOCIDADE:</span> Determina quem ataca primeiro no turno.</p>
            <p className="pt-2 border-t border-zinc-800 text-red-400 italic font-bold">🩸 Provação de Sangue: As escadas estão trancadas! Você deve derramar o sangue de ao menos um inimigo e possuir a chave para avançar.</p>
          </div>
        </div>
        <button onClick={onFinish} className="w-full py-6 bg-red-800 hover:bg-red-700 text-white font-black rounded-3xl uppercase tracking-widest text-sm shadow-xl transition-all active:scale-95">ESTOU PRONTO</button>
      </div>
    </div>
  );
};

export const ChestModal: React.FC<ChestModalProps> = ({ onChoice, language = 'PT' }) => {
  const t = TRANSLATIONS[language];
  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-6 backdrop-blur-md">
      <div className="bg-zinc-900 border-2 border-blue-500 max-w-sm w-full p-8 rounded-[2.5rem] text-center space-y-8 animate-in zoom-in-95">
        <div className="text-blue-400 flex justify-center scale-[2.5] mb-4"><Icon.Chest /></div>
        <h2 className="text-2xl font-black text-white uppercase tracking-tighter">{t.chest_title}</h2>
        <div className="grid grid-cols-1 gap-3">
          {(['Ataque', 'Armadura', 'Velocidade'] as StatChoice[]).map(choice => (
            <button key={choice} onClick={() => onChoice(choice)} className="py-4 bg-zinc-800 hover:bg-zinc-700 rounded-xl border border-zinc-700 transition-all">
              <span className="font-black text-xs uppercase tracking-widest text-white">
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
      <div className="bg-zinc-900 border-2 border-pink-500 p-8 rounded-[2.5rem] max-w-xs w-full text-center space-y-6">
         <div className="text-pink-400 flex justify-center scale-[2.5] mb-4"><Icon.Potion /></div>
         <h3 className="text-white font-black uppercase text-base tracking-tighter">Frasco Encontrado</h3>
         <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Cura {potion.percent}% da vida</p>
         <div className="grid grid-cols-1 gap-3">
           <button onClick={() => onChoice('use')} className="w-full py-4 bg-pink-600 text-white font-black rounded-xl uppercase text-[10px] tracking-widest">{t.use}</button>
           <button onClick={() => onChoice('store')} className="w-full py-4 bg-zinc-800 text-zinc-300 font-black rounded-xl uppercase text-[10px] tracking-widest border border-zinc-700">{t.store}</button>
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
        <h2 className="text-3xl font-black text-purple-500 tracking-tighter uppercase">{t.relic_choice}</h2>
        <p className="text-zinc-500 font-bold text-[10px] uppercase tracking-widest">Escolha o seu legado</p>
      </div>
      <div className="grid grid-cols-1 gap-4 w-full max-w-sm">
        {options.map(relic => (
          <button key={relic.id} onClick={() => onSelect(relic)} className="p-6 bg-zinc-900 border border-zinc-800 rounded-[2rem] text-left hover:border-purple-500/50 flex items-center gap-6">
            <div className="text-purple-400">{React.createElement((Icon as any)[relic.icon], { width: 32, height: 32 })}</div>
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
      <div className={`bg-zinc-900 border-2 p-8 rounded-[3rem] max-w-sm w-full text-center space-y-8 animate-in zoom-in-95 ${active ? 'border-purple-600 shadow-2xl' : 'border-zinc-800 opacity-80'}`}>
         <div className={`${active ? 'text-purple-500 animate-pulse' : 'text-zinc-700'} flex justify-center scale-[2.5] mb-4`}><Icon.Altar /></div>
         <h3 className="text-white font-black uppercase text-xl tracking-tighter">{t.altar_title}</h3>
         <p className="text-zinc-500 text-[10px] font-bold leading-relaxed">{active ? t.altar_prompt : t.altar_inactive}</p>
         <div className="flex flex-col gap-3">
            {active && <button onClick={onPray} className="w-full py-5 bg-purple-700 text-white font-black rounded-xl uppercase text-xs tracking-widest">ORAR</button>}
            <button onClick={onClose} className="w-full py-4 bg-zinc-800 text-zinc-400 font-black rounded-xl uppercase text-[10px] border border-zinc-700">Fechar Negócio</button>
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
      <div className={`bg-zinc-900 border-4 p-10 rounded-[3.5rem] max-w-sm w-full text-center space-y-8 animate-in zoom-in-95 ${isBlessing ? 'border-yellow-500' : 'border-purple-900'}`}>
         <div className={`flex justify-center scale-[3] mb-8 ${isBlessing ? 'text-yellow-500' : 'text-purple-600'}`}><Icon.Altar /></div>
         <div className="space-y-4">
            <h3 className="text-2xl font-black text-white uppercase tracking-tighter">{t[effect.nameKey]}</h3>
            <p className="text-zinc-400 font-mono text-xs leading-relaxed">{t[effect.descKey]}</p>
         </div>
         <button onClick={onClose} className={`w-full py-5 font-black rounded-xl uppercase text-xs tracking-widest ${isBlessing ? 'bg-yellow-600 text-black' : 'bg-zinc-800 text-zinc-300'}`}>PROSSEGUIR</button>
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
