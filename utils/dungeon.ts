
import { MAP_WIDTH, MAP_HEIGHT, MAX_LEVELS, ENEMY_TYPES } from '../constants';
import { TileType, Enemy, Chest, EntityStats, PotionEntity, ItemEntity, LevelTheme, Position } from '../types';

const BIOME_ORDER: LevelTheme[] = [
  'CAVE',        // 1-12
  'FOREST',      // 13-24
  'SNOW',        // 25-36
  'DESERT',      // 37-48
  'RUINS',       // 49-60
  'CATACOMBS',   // 61-72
  'OSSUARY',     // 73-84
  'MECHANICAL',  // 85-96
  'CORRUPTED',   // 97-108
  'INFERNO',     // 109-120
  'ASTRAL',      // 121-132
  'MATRIX',      // 133-144
  'VOID'         // 145-150
];

export function generateDungeon(level: number) {
  const map: TileType[][] = Array(MAP_HEIGHT).fill(0).map(() => Array(MAP_WIDTH).fill('WALL'));
  const rooms: {x: number, y: number, w: number, h: number}[] = [];
  
  const biomeIndex = Math.min(Math.floor((level - 1) / 12), BIOME_ORDER.length - 1);
  const theme = BIOME_ORDER[biomeIndex];
  
  let layoutType: 'rooms' | 'labyrinth' | 'open' = 'rooms';
  if (['MATRIX', 'MECHANICAL', 'CATACOMBS'].includes(theme)) layoutType = 'labyrinth';
  if (['ASTRAL', 'VOID', 'DESERT'].includes(theme)) layoutType = 'open';

  const numRoomsTarget = Math.min(8 + Math.floor(level / 12), 22);

  if (layoutType === 'rooms') {
    for (let i = 0; i < 250 && rooms.length < numRoomsTarget; i++) {
      const w = Math.floor(Math.random() * 5) + 3;
      const h = Math.floor(Math.random() * 5) + 3;
      const x = Math.floor(Math.random() * (MAP_WIDTH - w - 2)) + 1;
      const y = Math.floor(Math.random() * (MAP_HEIGHT - h - 2)) + 1;
      
      const overlap = rooms.some(r => x < r.x + r.w + 1 && x + w + 1 > r.x && y < r.y + r.h + 1 && y + h + 1 > r.y);
      if (!overlap) {
        rooms.push({x, y, w, h});
        for (let ry = y; ry < y + h; ry++) for (let rx = x; rx < x + w; rx++) map[ry][rx] = 'FLOOR';
      }
    }
    for (let i = 0; i < rooms.length - 1; i++) {
      let currX = Math.floor(rooms[i].x + rooms[i].w / 2), currY = Math.floor(rooms[i].y + rooms[i].h / 2);
      const targetX = Math.floor(rooms[i+1].x + rooms[i+1].w / 2), targetY = Math.floor(rooms[i+1].y + rooms[i+1].h / 2);
      while (currX !== targetX) { map[currY][currX] = 'FLOOR'; currX += currX < targetX ? 1 : -1; }
      while (currY !== targetY) { map[currY][currX] = 'FLOOR'; currY += currY < targetY ? 1 : -1; }
    }
  } else if (layoutType === 'labyrinth') {
    for (let y = 1; y < MAP_HEIGHT - 1; y += 2) {
      for (let x = 1; x < MAP_WIDTH - 1; x += 2) {
        map[y][x] = 'FLOOR';
        if (x < MAP_WIDTH - 3 && Math.random() > 0.5) map[y][x + 1] = 'FLOOR';
        if (y < MAP_HEIGHT - 3 && Math.random() > 0.5) map[y + 1][x] = 'FLOOR';
      }
    }
    rooms.push({x: 1, y: 1, w: 1, h: 1}); 
    rooms.push({x: MAP_WIDTH - 2, y: MAP_HEIGHT - 2, w: 1, h: 1});
  } else {
    for (let y = 1; y < MAP_HEIGHT - 1; y++) {
      for (let x = 1; x < MAP_WIDTH - 1; x++) {
        if (Math.random() > 0.12) map[y][x] = 'FLOOR';
      }
    }
    rooms.push({x: 2, y: 2, w: 1, h: 1});
    rooms.push({x: MAP_WIDTH - 3, y: MAP_HEIGHT - 3, w: 1, h: 1});
  }

  const playerPos = { x: rooms[0].x, y: rooms[0].y };
  const lastRoom = rooms[rooms.length - 1];
  const stairsPos = { x: lastRoom.x, y: lastRoom.y };

  const enemies: Enemy[] = [];
  const chests: Chest[] = [];
  const potions: PotionEntity[] = [];

  const keyRoom = rooms[Math.floor(Math.random() * (rooms.length - 1)) + 1];
  const keyPos = { x: keyRoom.x, y: keyRoom.y };

  const altarRoom = rooms[Math.floor(Math.random() * rooms.length)];
  const altarPos = { x: altarRoom.x, y: altarRoom.y };

  let merchantPos: Position | undefined;
  if (level % 3 === 0 || level < 10) {
    const mRoom = rooms[Math.floor(Math.random() * rooms.length)];
    merchantPos = { x: mRoom.x, y: mRoom.y };
  }

  let targetEnemies = 2 + Math.floor(level / 10);
  if (level > 30) targetEnemies += 2;
  if (level > 70) targetEnemies += 4;
  if (level > 121) targetEnemies += 6; 

  let placed = 0;
  let attempts = 0;
  while (placed < targetEnemies && attempts < 1000) {
    attempts++;
    const rx = Math.floor(Math.random() * MAP_WIDTH);
    const ry = Math.floor(MAP_HEIGHT * Math.random());
    if (map[ry] && map[ry][rx] === 'FLOOR' && !(rx === playerPos.x && ry === playerPos.y) && !(rx === stairsPos.x && ry === stairsPos.y)) {
      const types = ENEMY_TYPES.filter(t => t.minLevel <= level);
      const type = types[Math.floor(Math.random() * types.length)].name;
      const isElite = level > 120 && Math.random() > 0.7;
      enemies.push({
        id: `e-${level}-${placed}`,
        x: rx, y: ry,
        type: isElite ? `ELITE ${type}` : type,
        stats: generateEnemyStats(level, isElite),
        isBoss: isElite
      });
      placed++;
    }
  }

  const numChests = Math.random() > 0.7 ? 2 : 1;
  for(let i=0; i<numChests; i++) {
    const cRoom = rooms[Math.floor(Math.random() * rooms.length)];
    chests.push({ id: `c-${level}-${i}`, x: cRoom.x, y: cRoom.y });
  }

  return { map, theme, playerPos, stairsPos, enemies, chests, potions, keyPos, merchantPos, altarPos };
}

function generateEnemyStats(level: number, isElite: boolean): EntityStats {
  const eliteMult = isElite ? 1.8 : 1.0;
  const hp = Math.floor((40 + (level * 10)) * eliteMult);
  const atk = Math.floor((6 + (level * 2.5)) * eliteMult);
  const arm = Math.floor((2 + (level * 1.8)) * eliteMult);
  const spd = 8 + (level / 8) + (isElite ? 5 : 0);
  return { hp, maxHp: hp, attack: atk, armor: arm, maxArmor: arm, speed: spd };
}

/**
 * Real Pathfinding (BFS) que respeita paredes e inimigos.
 */
export function findDungeonPath(start: Position, end: Position, map: TileType[][], enemies: Enemy[]): Position[] | null {
  if (start.x === end.x && start.y === end.y) return null;

  const queue: { pos: Position; path: Position[] }[] = [{ pos: start, path: [] }];
  const visited = new Set<string>();
  visited.add(`${start.x},${start.y}`);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const { pos, path } = current;

    if (pos.x === end.x && pos.y === end.y) {
      return path;
    }

    const neighbors = [[0, 1], [0, -1], [1, 0], [-1, 0]];
    for (const [dx, dy] of neighbors) {
      const nx = pos.x + dx;
      const ny = pos.y + dy;
      const key = `${nx},${ny}`;

      if (nx >= 0 && nx < MAP_WIDTH && ny >= 0 && ny < MAP_HEIGHT && map[ny] && !visited.has(key)) {
        const isWall = map[ny][nx] === 'WALL';
        // Inimigos bloqueiam o caminho, exceto se forem o destino final do clique
        const hasEnemy = enemies.some(e => e.x === nx && e.y === ny);
        const isDestination = nx === end.x && ny === end.y;

        if (!isWall && (!hasEnemy || isDestination)) {
          visited.add(key);
          queue.push({ 
            pos: { x: nx, y: ny }, 
            path: [...path, { x: nx, y: ny }] 
          });
        }
      }
    }
  }
  return null;
}
