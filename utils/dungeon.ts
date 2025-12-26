
import { MAP_WIDTH, MAP_HEIGHT, MAX_LEVELS, ENEMY_TYPES } from '../constants';
import { TileType, Enemy, Chest, EntityStats, PotionEntity, LevelTheme, Position } from '../types';

const BIOME_ORDER: LevelTheme[] = [
  'CAVE', 'FOREST', 'SNOW', 'DESERT', 'RUINS', 'CATACOMBS', 
  'OSSUARY', 'MECHANICAL', 'CORRUPTED', 'INFERNO', 'ASTRAL', 'MATRIX', 'VOID'
];

export function generateDungeon(level: number) {
  const currentWidth = Math.min(45 + Math.floor(level / 2), 85);
  const currentHeight = Math.min(35 + Math.floor(level / 3), 55);
  const targetEnemies = 10 + Math.floor(level / 2);

  const map: TileType[][] = Array(MAP_HEIGHT).fill(0).map(() => Array(MAP_WIDTH).fill('WALL'));

  // Procedural Room Generation
  const rooms: { x: number, y: number, w: number, h: number }[] = [];
  const numRooms = 8 + Math.floor(level / 5);

  for (let i = 0; i < numRooms; i++) {
    const w = Math.floor(Math.random() * 6) + 4;
    const h = Math.floor(Math.random() * 6) + 4;
    const x = Math.floor(Math.random() * (currentWidth - w - 2)) + 1;
    const y = Math.floor(Math.random() * (currentHeight - h - 2)) + 1;

    // Check overlap
    const overlap = rooms.some(r => x < r.x + r.w + 1 && x + w + 1 > r.x && y < r.y + r.h + 1 && y + h + 1 > r.y);
    if (!overlap) {
      rooms.push({ x, y, w, h });
      for (let ry = y; ry < y + h; ry++) {
        for (let rx = x; rx < x + w; rx++) {
          map[ry][rx] = 'FLOOR';
        }
      }
    }
  }

  // Connect Rooms with Tunnels
  for (let i = 0; i < rooms.length - 1; i++) {
    let start = rooms[i];
    let end = rooms[i + 1];
    let cx = Math.floor(start.x + start.w / 2);
    let cy = Math.floor(start.y + start.h / 2);
    let tx = Math.floor(end.x + end.w / 2);
    let ty = Math.floor(end.y + end.h / 2);

    while (cx !== tx) {
      map[cy][cx] = 'FLOOR';
      cx += cx < tx ? 1 : -1;
    }
    while (cy !== ty) {
      map[cy][cx] = 'FLOOR';
      cy += cy < ty ? 1 : -1;
    }
  }

  // Random Biome
  const theme = BIOME_ORDER[Math.floor(Math.random() * BIOME_ORDER.length)];

  const occupied = new Set<string>();
  const getFreeTile = () => {
    for (let i = 0; i < 5000; i++) {
      const rx = Math.floor(Math.random() * (currentWidth - 2)) + 1;
      const ry = Math.floor(Math.random() * (currentHeight - 2)) + 1;
      if (map[ry][rx] === 'FLOOR' && !occupied.has(`${rx},${ry}`)) {
        occupied.add(`${rx},${ry}`);
        return { x: rx, y: ry };
      }
    }
    // Fallback if needed
    if (rooms.length > 0) {
        return { x: rooms[0].x, y: rooms[0].y };
    }
    return { x: 1, y: 1 };
  };

  const playerPos = getFreeTile();
  const stairsPos = getFreeTile();
  const keyPos = getFreeTile();
  
  const enemies: Enemy[] = [];
  for (let i = 0; i < targetEnemies; i++) {
    const pos = getFreeTile();
    const types = ENEMY_TYPES.filter(t => t.minLevel <= level);
    const type = types[Math.floor(Math.random() * types.length)].name;
    enemies.push({
      id: `e-${level}-${i}`,
      x: pos.x, y: pos.y,
      type: type,
      stats: generateEnemyStats(level, level > 120),
      isBoss: level % 10 === 0 && i === 0
    });
  }

  const chests: Chest[] = [];
  const numChests = Math.random() > 0.6 ? 2 : 1;
  for (let i = 0; i < numChests; i++) {
    const pos = getFreeTile();
    chests.push({ id: `c-${level}-${i}`, x: pos.x, y: pos.y });
  }

  const potions: PotionEntity[] = [];
  const numPotions = Math.floor(Math.random() * 2) + 2; 
  for (let i = 0; i < numPotions; i++) {
    const pos = getFreeTile();
    potions.push({
      id: `p-${level}-${i}`,
      x: pos.x,
      y: pos.y,
      percent: Math.random() > 0.8 ? 50 : 25
    });
  }

  const altarPos = getFreeTile();
  let merchantPos = (level % 5 === 0 || level === 1) ? getFreeTile() : undefined;

  return { map, theme, playerPos, stairsPos, enemies, chests, potions, keyPos, merchantPos, altarPos };
}

function generateEnemyStats(level: number, isElite: boolean): EntityStats {
  const eliteMult = isElite ? 2.2 : 1.0;
  const hp = Math.floor((50 + (level * 15)) * eliteMult);
  const atk = Math.floor((8 + (level * 3.5)) * eliteMult);
  const arm = Math.floor((3 + (level * 2.2)) * eliteMult);
  const spd = 8 + (level / 9) + (isElite ? 6 : 0);
  return { hp, maxHp: hp, attack: atk, armor: arm, maxArmor: arm, speed: spd };
}

export function findDungeonPath(start: Position, end: Position, map: TileType[][], enemies: Enemy[]): Position[] | null {
  if (start.x === end.x && start.y === end.y) return null;
  const queue: { pos: Position; path: Position[] }[] = [{ pos: start, path: [] }];
  const visited = new Set<string>();
  visited.add(`${start.x},${start.y}`);
  const directions = [[0, 1], [0, -1], [1, 0], [-1, 0]];

  while (queue.length > 0) {
    const { pos, path } = queue.shift()!;
    if (pos.x === end.x && pos.y === end.y) return path;

    for (const [dx, dy] of directions) {
      const nx = pos.x + dx;
      const ny = pos.y + dy;
      const key = `${nx},${ny}`;
      if (nx >= 0 && nx < MAP_WIDTH && ny >= 0 && ny < MAP_HEIGHT && map[ny][nx] === 'FLOOR' && !visited.has(key)) {
        visited.add(key);
        queue.push({ pos: { x: nx, y: ny }, path: [...path, { x: nx, y: ny }] });
      }
    }
  }
  return null;
}
