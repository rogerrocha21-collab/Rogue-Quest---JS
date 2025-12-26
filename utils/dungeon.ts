
import { MAP_WIDTH, MAP_HEIGHT, MAX_LEVELS, ENEMY_TYPES } from '../constants';
import { TileType, Enemy, Chest, EntityStats, PotionEntity, ItemEntity, LevelTheme, Position } from '../types';

const BIOME_ORDER: LevelTheme[] = [
  'CAVE', 'FOREST', 'SNOW', 'DESERT', 'RUINS', 'CATACOMBS', 
  'OSSUARY', 'MECHANICAL', 'CORRUPTED', 'INFERNO', 'ASTRAL', 'MATRIX', 'VOID'
];

export function generateDungeon(level: number) {
  // Tamanhos de mapa baseados na progressão
  let currentWidth = 25;
  let currentHeight = 20;
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
  
  // Escolha do bioma baseada no nível (repetindo os 13 biomas ao longo dos 150 níveis)
  const biomeIndex = Math.min(Math.floor((level - 1) / 12), BIOME_ORDER.length - 1);
  const theme = BIOME_ORDER[biomeIndex];
  
  // Layout variado
  let layoutType: 'rooms' | 'labyrinth' | 'open' = 'rooms';
  if (['MATRIX', 'MECHANICAL', 'CATACOMBS'].includes(theme)) layoutType = 'labyrinth';
  if (['ASTRAL', 'VOID', 'DESERT'].includes(theme)) layoutType = 'open';

  // Gerar Salas ou Caminhos dentro dos limites atuais
  const numRoomsTarget = Math.min(8 + Math.floor(level / 12), 22);

  if (layoutType === 'rooms') {
    for (let i = 0; i < 250 && rooms.length < numRoomsTarget; i++) {
      const w = Math.floor(Math.random() * 5) + 3;
      const h = Math.floor(Math.random() * 5) + 3;
      const x = Math.floor(Math.random() * (currentWidth - w - 2)) + 1;
      const y = Math.floor(Math.random() * (currentHeight - h - 2)) + 1;
      
      const overlap = rooms.some(r => x < r.x + r.w + 1 && x + w + 1 > r.x && y < r.y + r.h + 1 && y + h + 1 > r.y);
      if (!overlap) {
        rooms.push({x, y, w, h});
        for (let ry = y; ry < y + h; ry++) for (let rx = x; rx < x + w; rx++) map[ry][rx] = 'FLOOR';
      }
    }
    // Conectar salas
    for (let i = 0; i < rooms.length - 1; i++) {
      let currX = Math.floor(rooms[i].x + rooms[i].w / 2), currY = Math.floor(rooms[i].y + rooms[i].h / 2);
      const targetX = Math.floor(rooms[i+1].x + rooms[i+1].w / 2), targetY = Math.floor(rooms[i+1].y + rooms[i+1].h / 2);
      while (currX !== targetX) { map[currY][currX] = 'FLOOR'; currX += currX < targetX ? 1 : -1; }
      while (currY !== targetY) { map[currY][currX] = 'FLOOR'; currY += currY < targetY ? 1 : -1; }
    }
  } else if (layoutType === 'labyrinth') {
    for (let y = 1; y < currentHeight - 1; y += 2) {
      for (let x = 1; x < currentWidth - 1; x += 2) {
        map[y][x] = 'FLOOR';
        if (x < currentWidth - 3 && Math.random() > 0.5) map[y][x + 1] = 'FLOOR';
        if (y < currentHeight - 3 && Math.random() > 0.5) map[y + 1][x] = 'FLOOR';
      }
    }
    rooms.push({x: 1, y: 1, w: 1, h: 1}); 
    rooms.push({x: currentWidth - 2, y: currentHeight - 2, w: 1, h: 1});
  } else {
    // Open Space com obstáculos
    for (let y = 1; y < currentHeight - 1; y++) {
      for (let x = 1; x < currentWidth - 1; x++) {
        if (Math.random() > 0.12) map[y][x] = 'FLOOR';
      }
    }
    rooms.push({x: 2, y: 2, w: 1, h: 1});
    rooms.push({x: currentWidth - 3, y: currentHeight - 3, w: 1, h: 1});
  }

  const playerPos = { x: rooms[0].x, y: rooms[0].y };
  const lastRoom = rooms[rooms.length - 1];
  const stairsPos = { x: lastRoom.x, y: lastRoom.y };

  const occupied = new Set<string>();
  occupied.add(`${playerPos.x},${playerPos.y}`);
  occupied.add(`${stairsPos.x},${stairsPos.y}`);

  // Chave
  const keyRoom = rooms[Math.floor(Math.random() * (rooms.length - 1)) + 1];
  const keyPos = { x: keyRoom.x, y: keyRoom.y };
  occupied.add(`${keyPos.x},${keyPos.y}`);

  // Inimigos
  const enemies: Enemy[] = [];
  let placedEnemies = 0;
  while (placedEnemies < targetEnemies) {
    const rx = Math.floor(Math.random() * currentWidth);
    const ry = Math.floor(Math.random() * currentHeight);
    if (map[ry][rx] === 'FLOOR' && !occupied.has(`${rx},${ry}`)) {
      const types = ENEMY_TYPES.filter(t => t.minLevel <= level);
      const type = types[Math.floor(Math.random() * types.length)].name;
      enemies.push({
        id: `e-${level}-${placedEnemies}`,
        x: rx, y: ry,
        type: type,
        stats: generateEnemyStats(level, level > 120),
        isBoss: level % 10 === 0 && placedEnemies === 0
      });
      occupied.add(`${rx},${ry}`);
      placedEnemies++;
    }
  }

  // Baús
  const chests: Chest[] = [];
  const numChests = Math.random() > 0.7 ? 2 : 1;
  for(let i=0; i<numChests; i++) {
    const chestRoom = rooms[Math.floor(Math.random() * rooms.length)];
    const cx = chestRoom.x + Math.floor(Math.random() * chestRoom.w);
    const cy = chestRoom.y + Math.floor(Math.random() * chestRoom.h);
    if (!occupied.has(`${cx},${cy}`)) {
      chests.push({ id: `c-${level}-${i}`, x: cx, y: cy });
      occupied.add(`${cx},${cy}`);
    }
  }

  // Altar e Mercador
  let altarPos: Position | undefined;
  if (Math.random() > 0.3) {
    const altarRoom = rooms[Math.floor(Math.random() * rooms.length)];
    altarPos = { x: altarRoom.x, y: altarRoom.y };
  }

  let merchantPos: Position | undefined;
  if (level % 5 === 0) {
    const mRoom = rooms[Math.floor(Math.random() * rooms.length)];
    merchantPos = { x: mRoom.x, y: mRoom.y };
  }

  const potions: PotionEntity[] = [];

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

export function findDungeonPath(start: Position, end: Position, map: TileType[][], enemies: Enemy[]): Position[] | null {
  if (start.x === end.x && start.y === end.y) return null;

  const queue: { pos: Position; path: Position[] }[] = [{ pos: start, path: [] }];
  const visited = new Set<string>();
  visited.add(`${start.x},${start.y}`);

  const directions = [[0, 1], [0, -1], [1, 0], [-1, 0]];

  while (queue.length > 0) {
    const { pos, path } = queue.shift()!;

    if (pos.x === end.x && pos.y === end.y) {
      return path;
    }

    for (const [dx, dy] of directions) {
      const nx = pos.x + dx;
      const ny = pos.y + dy;
      const key = `${nx},${ny}`;

      if (nx >= 0 && nx < MAP_WIDTH && ny >= 0 && ny < MAP_HEIGHT && map[ny][nx] !== 'WALL' && !visited.has(key)) {
        // Ignorar inimigos para o cálculo se o destino for a própria chave/inimigo ou se for o caminho brilhante
        const hasEnemy = enemies.some(e => e.x === nx && e.y === ny);
        const isTarget = nx === end.x && ny === end.y;

        if (!hasEnemy || isTarget) {
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
