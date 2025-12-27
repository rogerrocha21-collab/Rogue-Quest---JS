
import { MAP_WIDTH, MAP_HEIGHT, MAX_LEVELS, BIOME_ENEMIES } from '../constants';
import { TileType, Enemy, Chest, EntityStats, PotionEntity, LevelTheme, Position } from '../types';

const BIOMES: LevelTheme[] = [
  'CAVE', 'FOREST', 'SNOW', 'DESERT', 'RUINS', 'CATACOMBS', 
  'OSSUARY', 'MECHANICAL', 'CORRUPTED', 'INFERNO', 'ASTRAL', 'MATRIX', 'VOID'
];

export function generateDungeon(level: number) {
  const currentWidth = Math.min(40 + Math.floor(level / 3), 90);
  const currentHeight = Math.min(30 + Math.floor(level / 4), 58);
  const targetEnemies = 8 + Math.floor(level / 1.5);

  const map: TileType[][] = Array(MAP_HEIGHT).fill(0).map(() => Array(MAP_WIDTH).fill('WALL'));

  const layoutType = ['ROOMS', 'OPEN', 'MAZE', 'CORRIDORS', 'SYMMETRIC', 'CHAOTIC'][Math.floor(Math.random() * 6)];

  if (layoutType === 'OPEN') {
    for (let y = 5; y < currentHeight - 5; y++) {
      for (let x = 5; x < currentWidth - 5; x++) {
        map[y][x] = 'FLOOR';
      }
    }
  } else if (layoutType === 'MAZE') {
    // Simple cellular automata or recursive backtracker could go here, for now using room-scatter
    generateRoomLayout(map, currentWidth, currentHeight, 20 + level, 2, 4);
  } else {
    // Default ROOMS
    generateRoomLayout(map, currentWidth, currentHeight, 10 + Math.floor(level / 5), 4, 8);
  }

  const theme = BIOMES[Math.floor(Math.random() * BIOMES.length)];

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
    return { x: 1, y: 1 };
  };

  const playerPos = getFreeTile();
  const stairsPos = getFreeTile();
  const keyPos = getFreeTile();
  
  const enemies: Enemy[] = [];
  const enemyPool = BIOME_ENEMIES[theme];
  for (let i = 0; i < targetEnemies; i++) {
    const pos = getFreeTile();
    const type = enemyPool[Math.floor(Math.random() * enemyPool.length)];
    enemies.push({
      id: `e-${level}-${i}`,
      x: pos.x, y: pos.y,
      type: type,
      stats: generateEnemyStats(level, level > 120 || Math.random() > 0.95),
      isBoss: level % 10 === 0 && i === 0
    });
  }

  const chests: Chest[] = [];
  const numChests = Math.random() > 0.4 ? 2 : 1;
  for (let i = 0; i < numChests; i++) {
    const pos = getFreeTile();
    chests.push({ id: `c-${level}-${i}`, x: pos.x, y: pos.y });
  }

  const potions: PotionEntity[] = [];
  const numPotions = Math.floor(Math.random() * 3) + 1; 
  for (let i = 0; i < numPotions; i++) {
    const pos = getFreeTile();
    potions.push({
      id: `p-${level}-${i}`,
      x: pos.x,
      y: pos.y,
      percent: Math.random() > 0.9 ? 75 : Math.random() > 0.7 ? 50 : 25
    });
  }

  const altarPos = getFreeTile();
  let merchantPos = (level % 5 === 0 || level === 1 || Math.random() > 0.85) ? getFreeTile() : undefined;

  return { map, theme, playerPos, stairsPos, enemies, chests, potions, keyPos, merchantPos, altarPos };
}

function generateRoomLayout(map: TileType[][], w: number, h: number, count: number, minS: number, maxS: number) {
    const rooms: { x: number, y: number, w: number, h: number }[] = [];
    for (let i = 0; i < count; i++) {
        const rw = Math.floor(Math.random() * (maxS - minS)) + minS;
        const rh = Math.floor(Math.random() * (maxS - minS)) + minS;
        const rx = Math.floor(Math.random() * (w - rw - 2)) + 1;
        const ry = Math.floor(Math.random() * (h - rh - 2)) + 1;
        const overlap = rooms.some(r => rx < r.x + r.w + 1 && rx + rw + 1 > r.x && ry < r.y + r.h + 1 && ry + rh + 1 > r.y);
        if (!overlap) {
            rooms.push({ x: rx, y: ry, w: rw, h: rh });
            for (let y = ry; y < ry + rh; y++) {
                for (let x = rx; x < rx + rw; x++) {
                    map[y][x] = 'FLOOR';
                }
            }
        }
    }
    for (let i = 0; i < rooms.length - 1; i++) {
        let s = rooms[i];
        let e = rooms[i + 1];
        let cx = Math.floor(s.x + s.w / 2);
        let cy = Math.floor(s.y + s.h / 2);
        let tx = Math.floor(e.x + e.w / 2);
        let ty = Math.floor(e.y + e.h / 2);
        while (cx !== tx) { map[cy][cx] = 'FLOOR'; cx += cx < tx ? 1 : -1; }
        while (cy !== ty) { map[cy][cx] = 'FLOOR'; cy += cy < ty ? 1 : -1; }
    }
}

function generateEnemyStats(level: number, isElite: boolean): EntityStats {
  const eliteMult = isElite ? 2.5 : 1.0;
  const hp = Math.floor((40 + (level * 12)) * eliteMult);
  const atk = Math.floor((6 + (level * 3)) * eliteMult);
  const arm = Math.floor((2 + (level * 2)) * eliteMult);
  const spd = 7 + (level / 10) + (isElite ? 5 : 0);
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
