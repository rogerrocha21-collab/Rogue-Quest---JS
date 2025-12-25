
import { LevelTheme } from './types';

export const MAP_WIDTH = 45; 
export const MAP_HEIGHT = 25;
export const MAX_LEVELS = 150;

export const INITIAL_PLAYER_STATS = {
  hp: 120,
  maxHp: 120,
  attack: 12,
  armor: 8,
  maxArmor: 8,
  speed: 12,
};

export const THEME_CONFIG: Record<LevelTheme, { name: string, wall: string, floor: string, char: string, wallChar: string }> = {
  FOREST: { name: 'Floresta Sombria', wall: 'text-green-800', floor: 'text-green-950', char: '♣', wallChar: 'T' },
  DESERT: { name: 'Dunas de Sangue', wall: 'text-orange-700', floor: 'text-yellow-900', char: '≈', wallChar: '▒' },
  SNOW: { name: 'Pico Congelado', wall: 'text-cyan-100', floor: 'text-blue-900', char: '·', wallChar: '❄' },
  CAVE: { name: 'Gruta Profunda', wall: 'text-zinc-600', floor: 'text-zinc-900', char: '°', wallChar: '▓' },
  MATRIX: { name: 'Terminal Matrix', wall: 'text-emerald-500', floor: 'text-black', char: '1', wallChar: '0' },
  INFERNO: { name: 'Abismo Infernal', wall: 'text-red-600', floor: 'text-red-950', char: '″', wallChar: '▲' },
  VOID: { name: 'O Vazio', wall: 'text-purple-900', floor: 'text-black', char: ' ', wallChar: '?' },
};

export const TILE_COLORS: Record<string, string> = {
  WALL: 'text-zinc-700',
  FLOOR: 'text-zinc-900',
  PLAYER: 'text-yellow-400',
  ENEMY: 'text-red-500',
  CHEST: 'text-blue-400',
  STAIRS: 'text-green-500',
  KEY: 'text-yellow-500',
  POTION: 'text-pink-400',
  ITEM: 'text-purple-400',
  MERCHANT: 'text-indigo-400',
  TRON: 'text-cyan-400',
  PET: 'text-orange-400'
};

export const ENEMY_TYPES = [
  { name: 'Rastejante', minLevel: 1 },
  { name: 'Vigia Escuro', minLevel: 1 },
  { name: 'Guerreiro Caído', minLevel: 3 },
  { name: 'Espectro', minLevel: 5 },
  { name: 'Bruto de Elite', minLevel: 8 },
  { name: 'Assassino das Sombras', minLevel: 10 },
  { name: 'Colosso Arcano', minLevel: 12 },
  { name: 'Soberano do Abismo', minLevel: 14 },
];

export const ITEM_POOL = [
  { name: 'Daga Curva', stat: 'attack', value: 5, iconType: 'sword', basePrice: 20 },
  { name: 'Couraça Reforçada', stat: 'maxArmor', value: 4, iconType: 'shield', basePrice: 18 },
  { name: 'Botas de Mercúrio', stat: 'speed', value: 6, iconType: 'boot', basePrice: 25 },
  { name: 'Amuleto de Sangue', stat: 'maxHp', value: 30, iconType: 'heart', basePrice: 40 },
  { name: 'Espada de Ébano', stat: 'attack', value: 12, iconType: 'sword', basePrice: 60 },
  { name: 'Capa das Sombras', stat: 'speed', value: 10, iconType: 'boot', basePrice: 50 },
  { name: 'Manto de Ferro', stat: 'maxArmor', value: 8, iconType: 'shield', basePrice: 55 },
  { name: 'Essência Vital', stat: 'maxHp', value: 50, iconType: 'heart', basePrice: 80 },
];
