
import React, { useState } from 'react';
import { EntityStats, Pet, Language, PotionEntity, Relic } from '../types';
import { Icon } from './Icons';
import { TRANSLATIONS } from '../constants';

interface HUDProps {
  level: number;
  stats: EntityStats;
  logs: string[];
  hasKey: boolean;
  kills: number;
  gold: number;
  playerName: string;
  activePet?: Pet;
  language?: Language;
  inventory: PotionEntity[];
  inventorySize: number;
  activeRelic?: Relic;
  onUsePotion: (idx: number) => void;
}

const HUD: React.FC<HUDProps> = ({ level, stats, logs, hasKey, kills, gold, playerName, activePet, language = 'PT', inventory, inventorySize, activeRelic, onUsePotion }) => {
  const [showLogs, setShowLogs] = useState(false);
  const [showInventory, setShowInventory] = useState(false);
  const [relicTooltip, setRelicTooltip] = useState(false);
  const t = TRANSLATIONS[language];

  return (
    <div className="flex flex-col gap-3 w-full">
      {/* Container de Status */}
      <div className="grid grid-cols-2 gap-2">
        {/* Personagem Card */}
        <div className="bg-zinc-900/80 border border-zinc-800 p-3 rounded-xl">
          <div className="flex justify-between items-center mb-2">
            <div>
              <p className="text-sm font-black text-white truncate max-w-[120px]">{playerName || 'Herói'}</p>
            </div>
            <div className="flex items-center gap-1 bg-yellow-950/20 px-2 py-0.5 rounded-full border border-yellow-500/20">
              <Icon.Gold />
              <span className="text-[10px] font-bold text-yellow-500">{gold}</span>
            </div>
          </div>
          <div className="flex gap-4 border-t border-zinc-800 pt-2 items-center">
            <div className={`flex items-center gap-1.5 ${hasKey ? 'text-yellow-400' : 'text-zinc-700'}`}>
              <Icon.Key /><span className="text-[8px] font-bold uppercase">{hasKey ? t.key : '--'}</span>
            </div>
            <div className={`flex items-center gap-1.5 ${kills > 0 ? 'text-red-500' : 'text-zinc-700'}`}>
              <Icon.Enemy /><span className="text-[8px] font-bold uppercase">{kills > 0 ? t.blood : '--'}</span>
            </div>
            {activeRelic && (
              <div className="relative">
                <button onClick={() => setRelicTooltip(!relicTooltip)} className="text-purple-400 animate-pulse transition-transform hover:scale-110">
                  {React.createElement((Icon as any)[activeRelic.icon])}
                </button>
                {relicTooltip && (
                  <div className="absolute bottom-full left-0 mb-2 w-48 bg-zinc-900 border border-purple-500/50 p-3 rounded-xl z-[100] shadow-2xl animate-in zoom-in-95">
                    <p className="text-[10px] font-black text-purple-400 uppercase mb-1">{activeRelic.name}</p>
                    <p className="text-[9px] text-zinc-400 leading-tight">{activeRelic.description}</p>
                    <button onClick={(e) => { e.stopPropagation(); setRelicTooltip(false); }} className="mt-2 text-[8px] text-zinc-500 uppercase font-bold">FECHAR</button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Nível e Pet Card */}
        <div className="bg-zinc-900/80 border border-zinc-800 p-3 rounded-xl flex flex-col justify-between">
          <div className="flex justify-between items-center mb-1">
            <h3 className="text-zinc-500 uppercase text-[8px] font-bold tracking-widest text-center">{t.level.toUpperCase()} {level} / ?</h3>
            <div className="flex gap-2 items-center">
              {activePet && (
                <div className="flex items-center gap-1 text-orange-400 animate-pulse">
                  {activePet.type === 'LOBO' ? <Icon.Wolf /> : activePet.type === 'PUMA' ? <Icon.Puma /> : <Icon.Owl />}
                  <span className="text-[8px] font-bold">{activePet.hp}/{activePet.maxHp}</span>
                </div>
              )}
              <button onClick={() => setShowInventory(!showInventory)} className={`p-1.5 rounded-lg border transition-all ${showInventory ? 'bg-zinc-700 border-white text-white' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-white'}`}>
                <Icon.Backpack />
              </button>
            </div>
          </div>
          <button 
            onClick={() => setShowLogs(!showLogs)}
            className="w-full py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-[9px] font-bold text-zinc-300 transition-colors uppercase"
          >
            {showLogs ? t.hide_diary : t.view_diary}
          </button>
        </div>
      </div>

      {/* Inventário Expandido */}
      {showInventory && (
        <div className="bg-zinc-900 border border-zinc-700 p-3 rounded-xl animate-in slide-in-from-top-2">
          <div className="flex justify-between items-center mb-2 border-b border-zinc-800 pb-1">
            <span className="text-[9px] font-black text-zinc-500 uppercase">{t.inventory_title}</span>
            <span className="text-[9px] font-bold text-zinc-600">{inventory.length}/{inventorySize}</span>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {Array.from({ length: inventorySize }).map((_, i) => (
              <div key={i} className={`h-10 border-2 rounded-lg flex items-center justify-center transition-all ${inventory[i] ? 'bg-pink-900/10 border-pink-500/30' : 'bg-black/40 border-zinc-800/50 border-dashed'}`}>
                {inventory[i] ? (
                  <button onClick={() => onUsePotion(i)} className="text-pink-400 hover:scale-110 active:scale-90 transition-transform flex flex-col items-center">
                    <Icon.Potion />
                    <span className="text-[7px] font-bold">+{inventory[i].percent}%</span>
                  </button>
                ) : (
                  <span className="text-zinc-800 text-[10px]">{i + 1}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats e Barras */}
      <div className="bg-zinc-900/80 border border-zinc-800 p-3 rounded-xl">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div>
              <div className="flex justify-between text-[10px] mb-1 font-bold uppercase"><span className="text-red-400">{t.hp}</span><span className="text-white">{stats.hp}/{stats.maxHp}</span></div>
              <div className="h-2 bg-zinc-800 rounded-full overflow-hidden border border-zinc-950">
                <div className="h-full bg-gradient-to-r from-red-600 to-red-400 transition-all duration-500 shadow-[0_0_10px_rgba(220,38,38,0.5)]" style={{ width: `${(stats.hp / stats.maxHp) * 100}%` }} />
              </div>
            </div>
            <div className="flex items-center gap-2 px-2 py-1 bg-zinc-950 rounded-lg border border-zinc-800">
              <span className="scale-75 text-yellow-400"><Icon.Sword /></span>
              <span className="text-[10px] text-zinc-400">{t.atk}: <strong className="text-white">{stats.attack}</strong></span>
            </div>
          </div>
          <div className="space-y-2">
            <div>
              <div className="flex justify-between text-[10px] mb-1 font-bold uppercase"><span className="text-blue-400">{t.armor}</span><span className="text-white">{stats.armor}/{stats.maxArmor}</span></div>
              <div className="h-2 bg-zinc-800 rounded-full overflow-hidden border border-zinc-950">
                <div className="h-full bg-gradient-to-r from-blue-600 to-blue-400 transition-all duration-500 shadow-[0_0_10px_rgba(37,99,235,0.5)]" style={{ width: `${(stats.armor / stats.maxArmor) * 100}%` }} />
              </div>
            </div>
            <div className="flex items-center gap-2 px-2 py-1 bg-zinc-950 rounded-lg border border-zinc-800">
              <span className="scale-75 text-green-400"><Icon.Boot /></span>
              <span className="text-[10px] text-zinc-400">{t.vel}: <strong className="text-white">{stats.speed}</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* Histórico/Logs Toggleable */}
      {showLogs && (
        <div className="bg-zinc-950 border border-zinc-800 p-3 rounded-xl h-24 overflow-hidden animate-in slide-in-from-bottom-2">
          <div className="overflow-y-auto h-full font-mono text-[9px] text-zinc-500 space-y-1">
            {logs.slice().reverse().map((log, i) => (
              <p key={i} className="leading-tight pl-2 border-l border-zinc-800 flex items-start gap-1">
                <span className="opacity-30">&gt;</span>
                <span>{log}</span>
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default HUD;
