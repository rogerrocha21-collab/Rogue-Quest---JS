
import React, { useState } from 'react';
import { EntityStats, Pet, Language, PotionEntity, Relic, AltarEffect, PoisonStatus } from '../types';
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
  isCrowUnlocked?: boolean;
  language?: Language;
  inventory: PotionEntity[];
  inventorySize: number;
  activeRelic?: Relic;
  activeAltarEffect?: AltarEffect;
  poisonStatus?: PoisonStatus;
  onUsePotion: (idx: number) => void;
  tronModeActive?: boolean;
  tronTimeLeft?: number;
  hasCompass?: boolean;
  hasMap?: boolean;
  enemiesCount?: number;
}

const HUD: React.FC<HUDProps> = ({ 
  level, stats, logs, hasKey, kills, gold, playerName, activePet, isCrowUnlocked, language = 'PT', 
  inventory, inventorySize, activeRelic, activeAltarEffect, poisonStatus, onUsePotion, 
  tronModeActive, tronTimeLeft, hasCompass, hasMap, enemiesCount 
}) => {
  const [showLogs, setShowLogs] = useState(false);
  const [showInventory, setShowInventory] = useState(false);
  const [relicTooltip, setRelicTooltip] = useState(false);
  const [effectTooltip, setEffectTooltip] = useState(false);
  const t = TRANSLATIONS[language];

  const closeTooltips = () => {
    setRelicTooltip(false);
    setEffectTooltip(false);
  };

  return (
    <div className="flex flex-col gap-3 w-full relative">
      {relicTooltip && activeRelic && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm" onClick={closeTooltips}>
          <div className="bg-zinc-900 border-2 border-purple-500 p-6 rounded-[2rem] max-w-xs w-full shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
            <div className="flex justify-center mb-4 text-purple-400">{React.createElement((Icon as any)[activeRelic.icon], { width: 48, height: 48 })}</div>
            <h4 className="text-sm font-black text-purple-400 uppercase text-center mb-2">{activeRelic.name}</h4>
            <p className="text-xs text-zinc-300 text-center leading-relaxed mb-6 font-mono">{activeRelic.description}</p>
            <button onClick={closeTooltips} className="w-full py-3 bg-zinc-800 text-zinc-400 font-bold text-[10px] uppercase rounded-xl border border-zinc-700">FECHAR</button>
          </div>
        </div>
      )}

      {effectTooltip && activeAltarEffect && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm" onClick={closeTooltips}>
          <div className={`bg-zinc-900 border-2 p-6 rounded-[2rem] max-w-xs w-full shadow-2xl animate-in zoom-in-95 ${activeAltarEffect.type === 'BLESSING' ? 'border-yellow-500' : 'border-purple-600'}`} onClick={e => e.stopPropagation()}>
            <div className={`flex justify-center mb-4 ${activeAltarEffect.type === 'BLESSING' ? 'text-yellow-500' : 'text-purple-600'}`}><Icon.Altar width={48} height={48} /></div>
            <h4 className="text-sm font-black uppercase text-center mb-2">{t[activeAltarEffect.nameKey]}</h4>
            <p className="text-xs text-zinc-300 text-center leading-relaxed mb-6 font-mono">{t[activeAltarEffect.descKey]}</p>
            <button onClick={closeTooltips} className="w-full py-3 bg-zinc-800 text-zinc-400 font-bold text-[10px] uppercase rounded-xl border border-zinc-700">FECHAR</button>
          </div>
        </div>
      )}

      {tronModeActive && (
        <div className="absolute -top-12 left-0 right-0 flex justify-center animate-bounce">
            <div className="bg-cyan-900/40 border border-cyan-500/50 px-4 py-1.5 rounded-full flex items-center gap-2 shadow-[0_0_15px_#22d3ee]">
                <Icon.Horse width={14} height={14} className="text-cyan-400" />
                <span className="text-[10px] font-black text-cyan-400 font-mono">{tronTimeLeft}s RESTANTES</span>
            </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div className="bg-zinc-900/80 border border-zinc-800 p-3 rounded-xl flex flex-col justify-between">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <p className="text-sm font-black text-white truncate max-w-[80px]">{playerName || 'Herói'}</p>
            {activePet && (
              <div className="flex items-center gap-1 bg-orange-950/20 px-2 py-0.5 rounded-full border border-orange-500/20 text-orange-400">
                <Icon.Wolf width={12} height={12} /> <span className="text-[9px] font-bold">{activePet.hp}</span>
              </div>
            )}
            {isCrowUnlocked && (
              <div className="flex items-center gap-1 bg-zinc-800/50 px-2 py-0.5 rounded-full border border-zinc-600/30 text-zinc-400" title="Corvo Vigilante">
                <Icon.Corvo width={12} height={12} />
              </div>
            )}
            <div className="flex items-center gap-1 bg-yellow-950/20 px-2 py-0.5 rounded-full border border-yellow-500/20 ml-auto">
              <Icon.Gold /> <span className="text-[10px] font-bold text-yellow-500">{gold}</span>
            </div>
          </div>
          <div className="flex gap-4 border-t border-zinc-800 pt-2 items-center">
            <div className={`flex items-center gap-1.5 ${hasKey ? 'text-yellow-400' : 'text-zinc-700'}`}>
              <Icon.Key width={12} height={12} /><span className="text-[8px] font-bold uppercase">{hasKey ? t.key : '--'}</span>
            </div>
            <div className={`flex items-center gap-1.5 ${kills > 0 ? 'text-red-500' : 'text-zinc-700'}`}>
              <Icon.Enemy width={12} height={12} /><span className="text-[8px] font-bold uppercase">{kills > 0 ? t.blood : '--'}</span>
            </div>
          </div>
        </div>

        <div className="bg-zinc-900/80 border border-zinc-800 p-3 rounded-xl flex flex-col gap-2">
          <div className="flex items-center gap-2 bg-black/40 h-8 rounded-lg border border-zinc-800/50 px-2">
            <button onClick={() => setShowInventory(!showInventory)} className={`p-1 transition-all ${showInventory ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-white'}`}><Icon.Backpack width={14} height={14} /></button>
            <div className="w-[1px] h-4 bg-zinc-800 mx-0.5" />
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
              {activeRelic && <button onClick={() => setRelicTooltip(true)} className="text-purple-400 animate-pulse">{React.createElement((Icon as any)[activeRelic.icon], { width: 14, height: 14 })}</button>}
              {activeAltarEffect && <button onClick={() => setEffectTooltip(true)} className={`transition-transform hover:scale-110 ${activeAltarEffect.type === 'BLESSING' ? 'text-yellow-500' : 'text-purple-600'}`}><Icon.Altar width={14} height={14} /></button>}
              {poisonStatus && (
                <div className="flex items-center gap-1 bg-green-950/40 border border-green-500/30 px-1.5 py-0.5 rounded text-green-400 animate-pulse">
                  <Icon.Droplets width={12} height={12} />
                  <span className="text-[8px] font-bold">{poisonStatus.turnsRemaining}</span>
                </div>
              )}
              {hasCompass && <div className="text-cyan-400 animate-pulse flex items-center gap-1"><Icon.Compass width={14} height={14} /><span className="text-[8px] font-bold">{enemiesCount}</span></div>}
              {hasMap && <div className="text-emerald-500 animate-pulse"><Icon.Map width={14} height={14} /></div>}
              {!activeRelic && !activeAltarEffect && !hasCompass && !hasMap && !poisonStatus && <span className="text-[7px] text-zinc-700 font-bold uppercase">NENHUM EFEITO</span>}
            </div>
          </div>
          <button onClick={() => setShowLogs(!showLogs)} className="w-full py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-[9px] font-bold text-zinc-300 transition-colors uppercase">{showLogs ? t.hide_diary : t.view_diary}</button>
        </div>
      </div>

      {showInventory && (
        <div className="bg-zinc-900 border border-zinc-700 p-3 rounded-xl animate-in slide-in-from-top-2">
          <div className="grid grid-cols-5 gap-2">
            {Array.from({ length: inventorySize }).map((_, i) => (
              <div key={i} className={`h-10 border-2 rounded-lg flex items-center justify-center transition-all ${
                inventory[i] 
                  ? (inventory[i].type === 'ANTIDOTE' ? 'bg-green-900/10 border-green-500/30' : 'bg-pink-900/10 border-pink-500/30') 
                  : 'bg-black/40 border-zinc-800/50 border-dashed'
              }`}>
                {inventory[i] ? (
                  <button onClick={() => onUsePotion(i)} className={`${inventory[i].type === 'ANTIDOTE' ? 'text-green-400' : 'text-pink-400'} hover:scale-110 flex flex-col items-center`}>
                    {inventory[i].type === 'ANTIDOTE' ? <Icon.Antidote width={16} height={16} /> : <Icon.Potion />}
                    <span className="text-[7px] font-bold">{inventory[i].type === 'ANTIDOTE' ? 'CURA' : `+${inventory[i].percent}%`}</span>
                  </button>
                ) : <span className="text-zinc-800 text-[10px]">{i + 1}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-zinc-900/80 border border-zinc-800 p-3 rounded-xl">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div>
              <div className="flex justify-between text-[10px] mb-1 font-bold uppercase"><span className="text-red-400">{t.hp}</span><span className="text-white">{stats.hp}/{stats.maxHp}</span></div>
              <div className="h-2 bg-zinc-800 rounded-full overflow-hidden border border-zinc-950">
                <div className="h-full bg-gradient-to-r from-red-600 to-red-400 transition-all duration-500 shadow-[0_0_10px_rgba(220,38,38,0.5)]" style={{ width: `${(stats.hp / stats.maxHp) * 100}%` }} />
              </div>
            </div>
            <div className="flex items-center gap-2 px-2 py-1 bg-zinc-950 rounded-lg border border-zinc-800"><span className="scale-75 text-yellow-400"><Icon.Sword /></span><span className="text-[10px] text-zinc-400">{t.atk}: <strong className="text-white">{stats.attack}</strong></span></div>
          </div>
          <div className="space-y-2">
            <div>
              <div className="flex justify-between text-[10px] mb-1 font-bold uppercase"><span className="text-blue-400">{t.armor}</span><span className="text-white">{stats.armor}/{stats.maxArmor}</span></div>
              <div className="h-2 bg-zinc-800 rounded-full overflow-hidden border border-zinc-950">
                <div className="h-full bg-gradient-to-r from-blue-600 to-blue-400 transition-all duration-500 shadow-[0_0_10px_rgba(37,99,235,0.5)]" style={{ width: `${(stats.armor / stats.maxArmor) * 100}%` }} />
              </div>
            </div>
            <div className="flex items-center gap-2 px-2 py-1 bg-zinc-950 rounded-lg border border-zinc-800"><span className="scale-75 text-green-400"><Icon.Boot /></span><span className="text-[10px] text-zinc-400">{t.vel}: <strong className="text-white">{stats.speed}</strong></span></div>
          </div>
        </div>
      </div>

      {showLogs && (
        <div className="bg-zinc-950 border border-zinc-800 p-3 rounded-xl h-24 overflow-hidden animate-in slide-in-from-bottom-2">
          <div className="overflow-y-auto h-full font-mono text-[9px] text-zinc-500 space-y-1 no-scrollbar">
            {logs.slice().reverse().map((log, i) => (
              <p key={i} className="leading-tight pl-2 border-l border-zinc-800 flex items-start gap-1"><span>{log}</span></p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default HUD;
