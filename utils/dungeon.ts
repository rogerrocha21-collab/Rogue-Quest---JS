
import { MAP_WIDTH, MAP_HEIGHT, MAX_LEVELS, ENEMY_TYPES } from '../constants';
import { TileType, Enemy, Chest, EntityStats, PotionEntity, LevelTheme, Position } from '../types';

const BIOME_ORDER: LevelTheme[] = [
  'CAVE', 'FOREST', 'SNOW', 'DESERT', 'RUINS', 'CATACOMBS', 
  'OSSUARY', 'MECHANICAL', 'CORRUPTED', 'INFERNO', 'ASTRAL', 'MATRIX', 'VOID'
];

export function generateDungeon(level: number) {
  let currentWidth = 30;
  let currentHeight = 25;
  let targetEnemies = 15;

  if (level <= 30) {
    currentWidth = 35; currentHeight = 25; targetEnemies = 15;
  } else if (level <= 70) {
    currentWidth = 50; currentHeight = 35; targetEnemies = 30;
  } else if (level <= 120) {
    currentWidth = 75; currentHeight = 45; targetEnemies = 45;
  } else {
    currentWidth = 90; currentHeight = 55; targetEnemies = 60;
  }

  const map: TileType[][] = Array(MAP_HEIGHT).fill(0).map(() => Array(MAP_WIDTH).fill('WALL'));
  const rooms: {x: number, y: number, w: number, h: number}[] = [];
  
  const biomeIdx = Math.floor((level - 1) / 12) % BIOME_ORDER.length;
  const theme = BIOME_ORDER[biomeIdx];
  
  let layoutType: 'rooms' | 'labyrinth' | 'open' = 'rooms';
  if (['MATRIX', 'MECHANICAL', 'CATACOMBS'].includes(theme)) layoutType = 'labyrinth';
  if (['ASTRAL', 'VOID', 'DESERT'].includes(theme)) layoutType = 'open';

  const numRoomsTarget = Math.min(6 + Math.floor(level / 8), 20);

  // Escavar áreas andáveis
  if (layoutType === 'rooms') {
    for (let i = 0; i < 400 && rooms.length < numRoomsTarget; i++) {
      const w = Math.floor(Math.random() * 6) + 5;
      const h = Math.floor(Math.random() * 6) + 5;
      const x = Math.floor(Math.random() * (currentWidth - w - 4)) + 2;
      const y = Math.floor(Math.random() * (currentHeight - h - 4)) + 2;
      
      const overlap = rooms.some(r => x < r.x + r.w + 2 && x + w + 2 > r.x && y < r.y + r.h + 2 && y + h + 2 > r.y);
      if (!overlap) {
        rooms.push({x, y, w, h});
        for (let ry = y; ry < y + h; ry++) for (let rx = x; rx < x + w; rx++) map[ry][rx] = 'FLOOR';
      }
    }
    // Corredores
    for (let i = 0; i < rooms.length - 1; i++) {
      let currX = Math.floor(rooms[i].x + rooms[i].w / 2), currY = Math.floor(rooms[i].y + rooms[i].h / 2);
      const targetX = Math.floor(rooms[i+1].x + rooms[i+1].w / 2), targetY = Math.floor(rooms[i+1].y + rooms[i+1].h / 2);
      while (currX !== targetX) { map[currY][currX] = 'FLOOR'; currX += currX < targetX ? 1 : -1; }
      while (currY !== targetY) { map[currY][currX] = 'FLOOR'; currY += currY < targetY ? 1 : -1; }
    }
  } else if (layoutType === 'labyrinth') {
    for (let y = 2; y < currentHeight - 2; y += 2) {
      for (let x = 2; x < currentWidth - 2; x += 2) {
        map[y][x] = 'FLOOR';
        if (Math.random() > 0.4) map[y][x + 1] = 'FLOOR';
        if (Math.random() > 0.4) map[y + 1][x] = 'FLOOR';
      }
    }
    rooms.push({x: 2, y: 2, w: 1, h: 1});
  } else {
    for (let y = 2; y < currentHeight - 2; y++) {
      for (let x = 2; x < currentWidth - 2; x++) {
        if (Math.random() > 0.15) map[y][x] = 'FLOOR';
      }
    }
    rooms.push({x: 3, y: 3, w: 1, h: 1});
  }

  const occupied = new Set<string>();
  const getFreeTile = () => {
    for(let i=0; i<2000; i++) {
      const rx = Math.floor(Math.random() * (currentWidth - 4)) + 2;
      const ry = Math.floor(Math.random() * (currentHeight - 4)) + 2;
      if (map[ry][rx] === 'FLOOR' && !occupied.has(`${rx},${ry}`)) {
        occupied.add(`${rx},${ry}`);
        return {x: rx, y: ry};
      }
    }
    // Fallback: procura exaustivamente o primeiro tile de chão
    for(let y=0; y<currentHeight; y++) {
      for(let x=0; x<currentWidth; x++) {
        if(map[y][x] === 'FLOOR' && !occupied.has(`${x},${y}`)) {
           occupied.add(`${x},${y}`);
           return {x, y};
        }
      }
    }
    return {x: 5, y: 5}; // Último caso
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
  for(let i=0; i<numChests; i++) {
    const pos = getFreeTile();
    chests.push({ id: `c-${level}-${i}`, x: pos.x, y: pos.y });
  }

  let altarPos = getFreeTile();
  let merchantPos = (level % 5 === 0 || level === 1) ? getFreeTile() : undefined;

  return { map, theme, playerPos, stairsPos, enemies, chests, potions: [], keyPos, merchantPos, altarPos };
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
        const hasEnemy = enemies.some(e => e.x === nx && e.y === ny);
        if (!hasEnemy || (nx === end.x && ny === end.y)) {
          visited.add(key);
          queue.push({ pos: { x: nx, y: ny }, path: [...path, { x: nx, y: ny }] });
        }
      }
    }
  }
  return null;
}
