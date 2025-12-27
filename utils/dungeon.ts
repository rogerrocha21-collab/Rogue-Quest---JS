
import { MAP_WIDTH, MAP_HEIGHT, MAX_LEVELS, BIOME_ENEMIES } from '../constants';
import { TileType, Enemy, Chest, EntityStats, PotionEntity, LevelTheme, Position } from '../types';

const BIOMES: LevelTheme[] = [
  'CAVE', 'FOREST', 'SNOW', 'DESERT', 'RUINS', 'CATACOMBS', 
  'OSSUARY', 'MECHANICAL', 'CORRUPTED', 'INFERNO', 'ASTRAL', 'MATRIX', 'VOID'
];

export function generateDungeon(level: number) {
  const currentWidth = Math.min(30 + Math.floor(level / 2), 80);
  const currentHeight = Math.min(25 + Math.floor(level / 3), 55);
  const map: TileType[][] = Array(MAP_HEIGHT).fill(0).map(() => Array(MAP_WIDTH).fill('WALL'));

  const layoutType = ['ABERTO', 'LABIRINTO', 'SALAS', 'CORREDORES', 'SIMÉTRICO', 'CAÓTICO'][Math.floor(Math.random() * 6)];

  switch (layoutType) {
    case 'ABERTO':
      for (let y = 2; y < currentHeight - 2; y++) {
        for (let x = 2; x < currentWidth - 2; x++) {
          map[y][x] = 'FLOOR';
        }
      }
      break;

    case 'LABIRINTO':
      for (let y = 1; y < currentHeight - 1; y++) {
        for (let x = 1; x < currentWidth - 1; x++) {
          if (x % 2 === 0 || y % 2 === 0) map[y][x] = (Math.random() > 0.4 ? 'FLOOR' : 'WALL');
          else map[y][x] = 'FLOOR';
        }
      }
      break;

    case 'SALAS':
      generateRoomLayout(map, currentWidth, currentHeight, 8 + Math.floor(level / 10), 3, 7);
      break;

    case 'CORREDORES':
      const vertical = Math.random() > 0.5;
      if (vertical) {
        for (let x = 2; x < currentWidth - 2; x += 4) {
          for (let y = 2; y < currentHeight - 2; y++) {
            map[y][x] = 'FLOOR';
            map[y][x+1] = 'FLOOR';
          }
          if (x + 4 < currentWidth - 2) {
            const connectY = Math.floor(Math.random() * (currentHeight - 4)) + 2;
            map[connectY][x+2] = 'FLOOR';
            map[connectY][x+3] = 'FLOOR';
          }
        }
      } else {
        for (let y = 2; y < currentHeight - 2; y += 4) {
          for (let x = 2; x < currentWidth - 2; x++) {
            map[y][x] = 'FLOOR';
            map[y+1][x] = 'FLOOR';
          }
          if (y + 4 < currentHeight - 2) {
            const connectX = Math.floor(Math.random() * (currentWidth - 4)) + 2;
            map[y+2][connectX] = 'FLOOR';
            map[y+3][connectX] = 'FLOOR';
          }
        }
      }
      break;

    case 'SIMÉTRICO':
      const mid = Math.floor(currentWidth / 2);
      generateRoomLayout(map, mid, currentHeight, 5, 3, 6);
      for (let y = 0; y < currentHeight; y++) {
        for (let x = 0; x < mid; x++) {
          map[y][currentWidth - x - 1] = map[y][x];
        }
      }
      for (let y = Math.floor(currentHeight / 2 - 2); y < Math.floor(currentHeight / 2 + 2); y++) {
        map[y][mid] = 'FLOOR';
        map[y][mid-1] = 'FLOOR';
      }
      break;

    case 'CAÓTICO':
      for (let y = 2; y < currentHeight - 2; y++) {
        for (let x = 2; x < currentWidth - 2; x++) {
          map[y][x] = Math.random() > 0.45 ? 'FLOOR' : 'WALL';
        }
      }
      break;

    default:
      generateRoomLayout(map, currentWidth, currentHeight, 6, 4, 8);
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
    const rx = Math.floor(Math.random() * (currentWidth - 2)) + 1;
    const ry = Math.floor(Math.random() * (currentHeight - 2)) + 1;
    map[ry][rx] = 'FLOOR';
    return { x: rx, y: ry };
  };

  const playerPos = getFreeTile();
  const stairsPos = getFreeTile();
  const keyPos = getFreeTile();
  
  const targetEnemies = 4 + Math.floor(level / 2);
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

  const numChests = Math.random() > 0.5 ? 2 : 1;
  const chests: Chest[] = [];
  for (let i = 0; i < numChests; i++) {
    const pos = getFreeTile();
    chests.push({ id: `c-${level}-${i}`, x: pos.x, y: pos.y });
  }

  const numPotions = Math.floor(Math.random() * 2) + 1; 
  const potions: PotionEntity[] = [];
  for (let i = 0; i < numPotions; i++) {
    const pos = getFreeTile();
    potions.push({
      id: `p-${level}-${i}`,
      x: pos.x, y: pos.y,
      percent: Math.random() > 0.8 ? 75 : Math.random() > 0.5 ? 50 : 25
    });
  }

  const altarPos = getFreeTile();
  let merchantPos = (level % 5 === 0 || level === 1 || Math.random() > 0.9) ? getFreeTile() : undefined;

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
  const eliteMult = isElite ? 2.2 : 1.0;
  const hp = Math.floor((30 + (level * 10)) * eliteMult);
  const atk = Math.floor((5 + (level * 2.5)) * eliteMult);
  const arm = Math.floor((1 + (level * 1.8)) * eliteMult);
  const spd = 6 + (level / 12) + (isElite ? 4 : 0);
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
