
import React from 'react';
import { TileType, Position, Enemy, Chest, PotionEntity, ItemEntity, LevelTheme, Pet } from '../types';
import { TILE_COLORS, MAP_WIDTH, MAP_HEIGHT, THEME_CONFIG } from '../constants';
import { Icon } from './Icons';

interface GameMapProps {
  map: TileType[][];
  theme: LevelTheme;
  playerPos: Position;
  enemies: Enemy[];
  chests: Chest[];
  potions: PotionEntity[];
  items: ItemEntity[];
  keyPos?: Position;
  merchantPos?: Position;
  altarPos?: Position;
  hasKey: boolean;
  stairsPos: Position;
  tronModeActive?: boolean;
  tronTrail?: Position[];
  activePet?: Pet;
  ritualDarkness?: boolean;
  keyPath?: Position[];
  onTileClick: (x: number, y: number) => void;
}

const VIEW_W = 11;
const VIEW_H = 13;

const GameMap: React.FC<GameMapProps> = ({ 
  map, theme, playerPos, enemies, chests, potions, items, 
  keyPos, merchantPos, altarPos, hasKey, stairsPos, 
  tronModeActive, tronTrail = [], activePet, 
  ritualDarkness, keyPath = [], onTileClick 
}) => {
  const config = THEME_CONFIG[theme] || THEME_CONFIG.VOID;

  if (!map || map.length === 0) return null;

  let startX = Math.max(0, playerPos.x - Math.floor(VIEW_W / 2));
  let startY = Math.max(0, playerPos.y - Math.floor(VIEW_H / 2));

  if (startX + VIEW_W > MAP_WIDTH) startX = MAP_WIDTH - VIEW_W;
  if (startY + VIEW_H > MAP_HEIGHT) startY = MAP_HEIGHT - VIEW_H;

  const renderTile = (y: number, x: number) => {
    if (!map[y] || map[y][x] === undefined) return null;

    const isPlayer = x === playerPos.x && y === playerPos.y;
    const isPet = activePet && x === activePet.pos.x && y === activePet.pos.y && !isPlayer;
    const enemy = enemies.find(e => e.x === x && e.y === y);
    const chest = chests.find(c => c.x === x && c.y === y);
    const potion = potions.find(p => p.x === x && p.y === y);
    const isKey = keyPos && x === keyPos.x && y === keyPos.y && !hasKey;
    const isMerchant = merchantPos && x === merchantPos.x && y === merchantPos.y;
    const isAltar = altarPos && x === altarPos.x && y === altarPos.y;
    const isStairs = x === stairsPos.x && y === stairsPos.y;
    const isTrail = tronModeActive && tronTrail.some(tp => tp.x === x && tp.y === y);
    const isKeyPath = !hasKey && keyPath.some(kp => kp.x === x && kp.y === y);

    let fogOpacity = "opacity-100";
    if (ritualDarkness) {
        const dist = Math.sqrt(Math.pow(x - playerPos.x, 2) + Math.pow(y - playerPos.y, 2));
        if (dist > 3) fogOpacity = "opacity-0 pointer-events-none";
        else if (dist > 2) fogOpacity = "opacity-20";
        else if (dist > 1) fogOpacity = "opacity-50";
    }

    return (
      <div 
        key={`${x}-${y}`} 
        onClick={() => onTileClick(x, y)}
        className={`w-8 h-8 md:w-12 md:h-12 flex-shrink-0 flex items-center justify-center relative border-[0.5px] border-zinc-900/10 cursor-pointer active:bg-zinc-700/30 transition-all duration-300 ${fogOpacity} ${map[y][x] === 'WALL' ? 'bg-zinc-900/20' : 'bg-transparent'}`}
      >
        {isPlayer ? (
          <span className={`${tronModeActive ? 'text-cyan-400 animate-tron-pulse scale-150' : TILE_COLORS.PLAYER} drop-shadow-[0_0_15px_rgba(250,204,21,1)] animate-player-bounce z-20`}>
            {tronModeActive ? <Icon.Horse /> : <Icon.Player />}
          </span>
        ) : isPet ? (
          <span className={`${TILE_COLORS.PET} animate-pet-wiggle z-10 scale-90`}>
            {activePet.type === 'LOBO' ? <Icon.Wolf /> : activePet.type === 'PUMA' ? <Icon.Puma /> : <Icon.Corvo />}
          </span>
        ) : enemy ? (
          <span className={`${TILE_COLORS.ENEMY} drop-shadow-[0_0_8px_rgba(239,68,68,0.6)] z-10`}><Icon.Enemy /></span>
        ) : isKey ? (
          <span className={`${TILE_COLORS.KEY} animate-bounce drop-shadow-[0_0_12px_rgba(234,179,8,1)] z-10`}><Icon.Key /></span>
        ) : isMerchant ? (
          <span className={`${TILE_COLORS.MERCHANT} drop-shadow-[0_0_10px_rgba(129,140,248,0.6)] animate-pulse z-10`}><Icon.Merchant /></span>
        ) : isAltar ? (
          <span className={`${TILE_COLORS.ALTAR} drop-shadow-[0_0_12px_rgba(168,85,247,0.7)] animate-pulse z-10`}><Icon.Altar /></span>
        ) : potion ? (
          <span className={`${TILE_COLORS.POTION} animate-potion-sparkle z-10`}><Icon.Potion /></span>
        ) : chest ? (
          <span className={`${TILE_COLORS.CHEST} drop-shadow-[0_0_8px_rgba(96,165,250,0.5)] z-10`}><Icon.Chest /></span>
        ) : isStairs ? (
          <span className={`${TILE_COLORS.STAIRS} animate-pulse scale-110 z-10`}><Icon.Stairs /></span>
        ) : isKeyPath ? (
           <div className="w-1 h-1 bg-yellow-400 rounded-full animate-pulse shadow-[0_0_5px_yellow]" />
        ) : isTrail ? (
          <div className="w-full h-full bg-cyan-400/20 animate-pulse flex items-center justify-center">
            <div className="w-full h-full border border-cyan-400/30 shadow-[0_0_10px_#22d3ee]" />
          </div>
        ) : map[y][x] === 'WALL' ? (
          <span className={`${config.wall} font-bold opacity-60 text-lg`}>{config.wallChar}</span>
        ) : (
          <span className={`${config.floor} opacity-20 font-mono`}>{config.char}</span>
        )}
      </div>
    );
  };

  const rows = [];
  for (let y = startY; y < startY + VIEW_H; y++) {
    const tiles = [];
    for (let x = startX; x < startX + VIEW_W; x++) {
      const tile = renderTile(y, x);
      if (tile) tiles.push(tile);
    }
    rows.push(<div key={y} className="flex">{tiles}</div>);
  }

  return (
    <div className="bg-black/40 p-2 rounded-2xl border-4 border-zinc-800 shadow-[0_0_40px_rgba(0,0,0,0.8)] overflow-hidden relative mx-auto touch-none">
      {tronModeActive && <div className="absolute inset-0 border-2 border-cyan-500/50 animate-pulse pointer-events-none z-30" />}
      <div className="bg-black inline-block rounded-lg overflow-hidden shadow-inner">
        {rows}
      </div>
    </div>
  );
};

export default GameMap;
