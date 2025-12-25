
import React, { useEffect, useState } from 'react';
import { Enemy, EntityStats, StatChoice, PotionEntity, ItemEntity, Pet } from '../types';
import { Icon } from './Icons';
import { ITEM_POOL } from '../constants';

interface CombatModalProps {
  playerStats: EntityStats;
  enemy: Enemy;
  activePet?: Pet;
  onAttackSound?: (attacker: 'player' | 'enemy') => void;
  onFinish: (newPlayerStats: EntityStats, win: boolean, goldEarned: number, petHp?: number) => void;
}

export const CombatModal: React.FC<CombatModalProps> = ({ playerStats, enemy, activePet, onAttackSound, onFinish }) => {
  const [currentPStats, setCurrentPStats] = useState({ ...playerStats });
  const [currentEStats, setCurrentEStats] = useState({ ...enemy.stats });
  const [petHp, setPetHp] = useState(activePet?.hp || 0);
  const [combatLog, setCombatLog] = useState<string[]>(["Combate iniciado!"]);
  const [isDone, setIsDone] = useState(false);
  const [lastAttacker, setLastAttacker] = useState<'player' | 'enemy' | 'pet' | null>(null);
  const [isTakingDamage, setIsTakingDamage] = useState<'player' | 'enemy' | 'pet' | null>(null);

  useEffect(() => {
    let p = { ...currentPStats };
    let e = { ...currentEStats };
    let curPetHp = petHp;
    let logs = [...combatLog];
    
    const resolveTurn = () => {
      if (p.hp <= 0 || e.hp <= 0) { setIsDone(true); return; }
      
      const executeSequence = async () => {
        if (activePet && curPetHp > 0) {
            setLastAttacker('pet');
            setIsTakingDamage('enemy');
            if (onAttackSound) onAttackSound('player'); // Som de ataque rápido do pet (usa o do player por enquanto)
            const petAtk = Math.max(1, Math.floor(p.attack / 2));
            e.hp -= petAtk;
            if (e.hp < 0) e.hp = 0;
            logs.push(`${activePet.name} ataca primeiro e causa ${petAtk} de dano!`);
            setCurrentEStats({ ...e });
            setCombatLog([...logs]);
            await new Promise(r => setTimeout(r, 400));
            setIsTakingDamage(null);
            if (e.hp <= 0) { setIsDone(true); return; }
        }

        const playersTurn = p.speed >= e.speed;
        const turnOrder = playersTurn ? ['player', 'enemy'] : ['enemy', 'player'];

        const processSide = async (side: 'player' | 'enemy') => {
            if (p.hp <= 0 || e.hp <= 0) return;
            let attackerName = side === 'player' ? 'Você' : enemy.type;
            let atkValue = side === 'player' ? p.attack : e.attack;
            
            setLastAttacker(side);
            setIsTakingDamage(side === 'player' ? 'enemy' : 'player');
            if (onAttackSound) onAttackSound(side);
            
            setTimeout(() => setIsTakingDamage(null), 200);

            let defender = side === 'player' ? e : p;
            let damage = atkValue;
            if (defender.armor > 0) {
              const absorbed = Math.min(defender.armor, damage);
              defender.armor -= absorbed;
              damage -= absorbed;
            }
            if (damage > 0) defender.hp -= damage;
            if (defender.hp < 0) defender.hp = 0;
            logs.push(`${attackerName} golpeia.`);
            
            setCurrentPStats({ ...p }); 
            setCurrentEStats({ ...e }); 
            setCombatLog([...logs]);
        };

        await processSide(turnOrder[0] as any);
        if (p.hp > 0 && e.hp > 0) {
          setTimeout(async () => {
            await processSide(turnOrder[1] as any);
            if (p.hp <= 0 || e.hp <= 0) setIsDone(true);
            else setTimeout(resolveTurn, 400);
          }, 400);
        } else {
          setIsDone(true);
        }
      };

      executeSequence();
    };
    
    setTimeout(resolveTurn, 800);
  }, []);

  return (
    <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-50 p-6 backdrop-blur-md">
      <div className="bg-zinc-900 border-2 border-zinc-800 max-w-xl w-full p-8 rounded-3xl shadow-2xl flex flex-col gap-8">
        <div className="grid grid-cols-2 gap-12 font-mono">
          <div className={`text-center space-y-4 transition-all duration-200 ${lastAttacker === 'player' ? 'scale-110' : ''} ${isTakingDamage === 'player' ? 'animate-shake' : ''}`}>
            <div className={`p-6 rounded-2xl border-2 transition-colors relative ${isTakingDamage === 'player' ? 'bg-red-900 border-red-500' : 'bg-zinc-800 border-zinc-700'}`}>
              <span className="text-yellow-400"><Icon.Player /></span>
              {activePet && petHp > 0 && (
                <div className="absolute -bottom-2 -right-2 bg-orange-500 rounded-full p-1 border-2 border-zinc-900">
                    {activePet.type === 'LOBO' ? <Icon.Wolf /> : <Icon.Puma />}
                </div>
              )}
            </div>
            <div className="h-2 bg-zinc-800 rounded-full overflow-hidden border border-zinc-700">
                <div className="h-full bg-red-500 transition-all" style={{ width: `${(currentPStats.hp / currentPStats.maxHp) * 100}%` }} />
            </div>
            <p className="text-[10px] text-zinc-500 font-bold uppercase">Vida: {currentPStats.hp} Escudo: {currentPStats.armor}</p>
          </div>
          <div className={`text-center space-y-4 transition-all duration-200 ${lastAttacker === 'enemy' ? 'scale-110' : ''} ${isTakingDamage === 'enemy' ? 'animate-shake' : ''}`}>
            <div className={`p-6 rounded-2xl border-2 transition-colors ${enemy.isBoss ? 'bg-red-950 border-red-800' : isTakingDamage === 'enemy' ? 'bg-red-900 border-red-500' : 'bg-zinc-800 border-zinc-700'}`}>
              <span className={enemy.isBoss ? 'text-red-500' : 'text-zinc-300'}><Icon.Enemy isBoss={enemy.isBoss} /></span>
            </div>
            <div className="h-2 bg-zinc-800 rounded-full overflow-hidden border border-zinc-700">
                <div className="h-full bg-red-700 transition-all" style={{ width: `${(currentEStats.hp / currentEStats.maxHp) * 100}%` }} />
            </div>
            <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">{enemy.type}</p>
          </div>
        </div>
        <div className="bg-black/40 border border-zinc-800 p-4 h-32 overflow-y-auto rounded-xl font-mono text-[10px] text-zinc-400 space-y-1">
          {combatLog.slice(-5).map((log, i) => <p key={i}>&gt; {log}</p>)}
        </div>
        {isDone && (
          <button onClick={() => onFinish(currentPStats, currentPStats.hp > 0, Math.floor(Math.random() * 10) + 10, petHp)} className={`w-full font-black py-4 rounded-xl transition-all uppercase text-sm ${currentPStats.hp > 0 ? "bg-green-600 hover:bg-green-500" : "bg-red-700 hover:bg-red-600"}`}>
            {currentPStats.hp > 0 ? "COLETAR RECOMPENSA" : "SUCUMBIR AO ABISMO"}
          </button>
        )}
      </div>
    </div>
  );
};

interface MerchantShopModalProps {
  gold: number;
  level: number;
  hasPet: boolean;
  onBuyItem: (item: ItemEntity) => void;
  onBuyPotion: (pot: PotionEntity) => void;
  onRentTron: () => void;
  onBuyPet: (type: 'LOBO' | 'PUMA') => void;
  onClose: () => void;
}

export const MerchantShopModal: React.FC<MerchantShopModalProps> = ({ gold, level, hasPet, onBuyItem, onBuyPotion, onRentTron, onBuyPet, onClose }) => {
  const potions: PotionEntity[] = [
    { id: 'p1', percent: 20, price: 10, x: 0, y: 0 },
    { id: 'p2', percent: 40, price: 20, x: 0, y: 0 },
    { id: 'p3', percent: 70, price: 35, x: 0, y: 0 },
  ];

  const [offeredItems, setOfferedItems] = useState<ItemEntity[]>([]);

  useEffect(() => {
    const shuffled = [...ITEM_POOL].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, 4).map((item, idx) => ({
      ...item,
      id: `item-${level}-${idx}`,
      price: Math.floor(item.basePrice * (1 + level * 0.05)),
      x: 0, y: 0
    })) as ItemEntity[];
    setOfferedItems(selected);
  }, [level]);

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-6 backdrop-blur-xl">
      <div className="bg-zinc-900 border border-indigo-500/30 max-w-lg w-full p-6 rounded-[2rem] shadow-2xl overflow-y-auto max-h-[95vh] space-y-6">
        <div className="flex justify-between items-center">
            <h2 className="text-xl font-black text-indigo-400 uppercase tracking-tighter">Mercador Errante</h2>
            <div className="bg-zinc-800 px-3 py-1 rounded-full flex items-center gap-2 border border-zinc-700">
                <Icon.Gold /><span className="text-sm font-bold text-yellow-500">{gold}</span>
            </div>
        </div>

        {!hasPet && (
          <div className="space-y-3">
            <h3 className="text-[10px] text-zinc-500 font-bold tracking-widest uppercase">MASCOTES (Iniciativa no Combate)</h3>
            <div className="grid grid-cols-2 gap-3">
              <button disabled={gold < 10} onClick={() => onBuyPet('LOBO')} className="flex flex-col items-center p-3 bg-zinc-800 rounded-xl border border-zinc-700 hover:border-orange-500 disabled:opacity-50 transition-all">
                <span className="text-orange-400 mb-1"><Icon.Wolf /></span>
                <span className="text-[10px] font-bold text-white">LOBO</span>
                <span className="text-[9px] text-yellow-500">10 MOEDAS</span>
              </button>
              <button disabled={gold < 10} onClick={() => onBuyPet('PUMA')} className="flex flex-col items-center p-3 bg-zinc-800 rounded-xl border border-zinc-700 hover:border-orange-500 disabled:opacity-50 transition-all">
                <span className="text-orange-400 mb-1"><Icon.Puma /></span>
                <span className="text-[10px] font-bold text-white">PUMA</span>
                <span className="text-[9px] text-yellow-500">10 MOEDAS</span>
              </button>
            </div>
          </div>
        )}

        <div className="space-y-3">
            <h3 className="text-[10px] text-zinc-500 font-bold tracking-widest uppercase">ESPECIAL</h3>
            <button 
              disabled={gold < 25} 
              onClick={onRentTron}
              className="w-full flex justify-between items-center p-4 bg-cyan-950/30 border-2 border-cyan-500/30 rounded-xl hover:border-cyan-400 transition-all group disabled:opacity-50"
            >
              <div className="flex items-center gap-3">
                <span className="text-cyan-400 animate-pulse"><Icon.Boot /></span>
                <div className="text-left">
                  <div className="text-[11px] font-black text-white uppercase">MOTO TRON (10s)</div>
                  <div className="text-[8px] text-cyan-300">Atropela tudo e coleta o ouro!</div>
                </div>
              </div>
              <div className="text-xs font-black text-yellow-500">25G</div>
            </button>
        </div>

        <div className="space-y-3">
            <h3 className="text-[10px] text-zinc-500 font-bold tracking-widest uppercase">POÇÕES</h3>
            <div className="grid grid-cols-3 gap-2">
                {potions.map(p => (
                    <button key={p.id} disabled={gold < p.price!} onClick={() => onBuyPotion(p)} className="bg-zinc-800 p-3 rounded-xl border border-zinc-700 hover:border-pink-500 transition-colors disabled:opacity-50">
                        <div className="text-pink-500 mb-1 flex justify-center"><Icon.Potion /></div>
                        <div className="text-[9px] font-bold text-white text-center">CURA {p.percent}%</div>
                        <div className="text-[9px] text-yellow-500 font-bold text-center">{p.price}G</div>
                    </button>
                ))}
            </div>
        </div>

        <div className="space-y-3">
            <h3 className="text-[10px] text-zinc-500 font-bold tracking-widest uppercase">EQUIPAMENTOS</h3>
            <div className="space-y-2">
                {offeredItems.map(i => (
                    <button key={i.id} disabled={gold < i.price!} onClick={() => onBuyItem(i)} className="w-full flex justify-between items-center p-3 bg-zinc-800 rounded-xl border border-zinc-700 hover:border-indigo-500 transition-colors disabled:opacity-50">
                        <div className="flex items-center gap-3">
                            <span className="text-indigo-400">
                                {i.iconType === 'sword' ? <Icon.Sword /> : i.iconType === 'shield' ? <Icon.Shield /> : i.iconType === 'heart' ? <Icon.Heart /> : <Icon.Boot />}
                            </span>
                            <div className="text-left">
                                <div className="text-[10px] font-bold text-white uppercase">{i.name}</div>
                                <div className="text-[8px] text-green-400">+{i.value} {(i.stat.replace('max', '')).toUpperCase()}</div>
                            </div>
                        </div>
                        <div className="text-[10px] font-bold text-yellow-500">{i.price}G</div>
                    </button>
                ))}
            </div>
        </div>

        <button onClick={onClose} className="w-full py-3 bg-zinc-100 text-black font-black rounded-xl uppercase text-[10px] tracking-widest">Fechar Negócio</button>
      </div>
    </div>
  );
};

export const ChestModal: React.FC<{onChoice: (choice: StatChoice) => void}> = ({ onChoice }) => (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-6">
      <div className="bg-zinc-900 border border-blue-500/20 max-w-md w-full p-8 rounded-3xl text-center shadow-2xl">
        <h2 className="text-2xl font-black text-white mb-6 uppercase tracking-tighter">Bênção do Baú</h2>
        <div className="grid gap-3 font-mono">
          <button onClick={() => onChoice('Ataque')} className="p-5 bg-zinc-950 border border-zinc-800 rounded-xl flex justify-between items-center text-xs text-white hover:border-green-500 transition-all uppercase">
            <span className="flex items-center gap-2"><Icon.Sword /> ATAQUE</span>
            <span className="text-green-500 font-bold">+5</span>
          </button>
          <button onClick={() => onChoice('Armadura')} className="p-5 bg-zinc-950 border border-zinc-800 rounded-xl flex justify-between items-center text-xs text-white hover:border-blue-500 transition-all uppercase">
            <span className="flex items-center gap-2"><Icon.Shield /> ESCUDO</span>
            <span className="text-green-500 font-bold">+3</span>
          </button>
          <button onClick={() => onChoice('Velocidade')} className="p-5 bg-zinc-950 border border-zinc-800 rounded-xl flex justify-between items-center text-xs text-white hover:border-yellow-500 transition-all uppercase">
            <span className="flex items-center gap-2"><Icon.Boot /> VELOCIDADE</span>
            <span className="text-green-500 font-bold">+4</span>
          </button>
        </div>
      </div>
    </div>
);

export const TutorialModal: React.FC<{onFinish: () => void}> = ({ onFinish }) => {
  const [step, setStep] = useState(0);
  const slides = [
    {
      title: "O ABISMO PROFUNDO",
      icon: <Icon.Stairs />,
      desc: "Bem-vindo, herói. Sua missão é desbravar as profundezas deste abismo infinito. Seu progresso é salvo automaticamente ao iniciar cada nível."
    },
    {
      title: "COMBATE E ATRIBUTOS",
      icon: <Icon.Sword />,
      desc: "As batalhas são automáticas. O mais rápido ataca primeiro. O ATAQUE define seu dano, a VELOCIDADE sua vez, e o ESCUDO absorve dano (ele se recupera totalmente após cada luta)."
    },
    {
      title: "CONDIÇÕES DE SAÍDA",
      icon: <Icon.Key />,
      desc: "A escada para o próximo nível está bloqueada! Para passar, você deve encontrar a CHAVE do abismo e provar sua força eliminando ao menos um inimigo."
    },
    {
      title: "EQUIPAMENTOS E ALIADOS",
      icon: <Icon.Boot />,
      desc: "Procure o Mercador para alugar a MOTO TRON (atropela e coleta ouro!) ou comprar PETS leais (Lobo ou Puma) que atacam sempre com prioridade total."
    }
  ];

  const current = slides[step];

  return (
    <div className="fixed inset-0 bg-black/98 flex items-center justify-center z-[100] p-6 backdrop-blur-xl">
      <div className="bg-zinc-900 border-2 border-zinc-800 max-w-sm w-full p-8 rounded-[2.5rem] text-center shadow-2xl flex flex-col items-center">
        <div className="w-20 h-20 bg-zinc-800 rounded-full flex items-center justify-center text-red-500 mb-6 border-2 border-zinc-700 animate-pulse">
            {current.icon}
        </div>
        <h2 className="text-xl font-black text-white mb-4 uppercase tracking-tighter">{current.title}</h2>
        <p className="text-zinc-400 text-xs leading-relaxed mb-10 h-24 flex items-center justify-center">{current.desc}</p>
        
        <div className="flex gap-2 mb-8">
            {slides.map((_, i) => (
                <div key={i} className={`h-1.5 rounded-full transition-all ${i === step ? 'w-8 bg-red-600' : 'w-2 bg-zinc-800'}`} />
            ))}
        </div>

        <button 
            onClick={() => step < slides.length - 1 ? setStep(step + 1) : onFinish()}
            className="w-full py-4 bg-red-600 hover:bg-red-500 text-white font-black rounded-xl uppercase text-xs tracking-widest transition-all shadow-[0_4px_20px_rgba(220,38,38,0.3)]"
        >
            {step < slides.length - 1 ? "PRÓXIMO" : "COMEÇAR JORNADA"}
        </button>
      </div>
    </div>
  );
};
