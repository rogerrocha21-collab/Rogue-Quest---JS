
export type TileType = 'WALL' | 'FLOOR' | 'PLAYER' | 'ENEMY' | 'CHEST' | 'STAIRS' | 'POTION' | 'ITEM' | 'KEY' | 'MERCHANT' | 'EMPTY';

export type LevelTheme = 'FOREST' | 'DESERT' | 'SNOW' | 'CAVE' | 'MATRIX' | 'INFERNO' | 'VOID';

export type Language = 'PT' | 'EN' | 'ES';

export interface Position {
  x: number;
  y: number;
}

export interface EntityStats {
  hp: number;
  maxHp: number;
  attack: number;
  armor: number;
  maxArmor: number;
  speed: number;
}

export interface Enemy extends Position {
  id: string;
  type: string;
  stats: EntityStats;
  isBoss?: boolean;
}

export interface Chest extends Position {
  id: string;
}

export interface ItemEntity extends Position {
  id: string;
  name: string;
  stat: keyof EntityStats;
  value: number;
  price?: number;
  iconType: 'sword' | 'shield' | 'boot' | 'heart';
}

export interface PotionEntity extends Position {
  id: string;
  percent: number;
  price?: number;
}

export interface Pet {
  type: 'LOBO' | 'PUMA' | 'CORUJA';
  name: string;
  hp: number;
  maxHp: number;
  pos: Position;
}

export interface GameState {
  playerName: string;
  gold: number;
  level: number;
  theme: LevelTheme;
  playerPos: Position;
  playerStats: EntityStats;
  map: TileType[][];
  enemies: Enemy[];
  chests: Chest[];
  potions: PotionEntity[];
  items: ItemEntity[];
  merchantPos?: Position;
  keyPos?: Position;
  hasKey: boolean;
  enemiesKilledInLevel: number;
  stairsPos: Position;
  gameStatus: 'START_SCREEN' | 'TUTORIAL' | 'PLAYING' | 'COMBAT' | 'CHEST_OPEN' | 'MERCHANT_SHOP' | 'WON' | 'LOST' | 'NEXT_LEVEL';
  currentEnemy?: Enemy;
  logs: string[];
  tronModeActive?: boolean;
  tronTimeLeft?: number;
  tronTrail?: Position[];
  activePet?: Pet;
  language?: Language;
}

export type StatChoice = 'Ataque' | 'Armadura' | 'Velocidade';
