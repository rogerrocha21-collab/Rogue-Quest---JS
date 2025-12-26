
import { MAP_WIDTH, MAP_HEIGHT, MAX_LEVELS, ENEMY_TYPES } from '../constants';
import { TileType, Enemy, Chest, EntityStats, PotionEntity, LevelTheme, Position } from '../types';

const BIOME_ORDER: LevelTheme[] = [
  'CAVE', 'FOREST', 'SNOW', 'DESERT', 'RUINS', 'CATACOMBS', 
  'OSSUARY', 'MECHANICAL', 'CORRUPTED', 'INFERNO', 'ASTRAL', 'MATRIX', 'VOID'
];

export function generateDungeon(level: number) {
  const currentWidth = Math.min(31 + Math.floor(level / 2) * 2, 81); // Dimensões ímpares para o algoritmo de maze
  const currentHeight = Math.min(25 + Math.floor(level / 3) * 2, 61);
  const targetEnemies = 10 + Math.floor(level / 2);

  const map: TileType[][] = Array(MAP_HEIGHT).fill(0).map(() => Array(MAP_WIDTH).fill('WALL'));

  // Algoritmo de Labirinto (Recursive Backtracker)
  const maze: boolean[][] = Array(currentHeight).fill(0).map(() => Array(currentWidth).fill(false));
  const stack: [number, number][] = [];
  const startMazeX = 1, startMazeY = 1;
  
  maze[startMazeY][startMazeX] = true;
  stack.push([startMazeX, startMazeY]);

  while (stack.length > 0) {
    const [cx, cy] = stack[stack.length - 1];
    const neighbors: [number, number, number, number][] = [];

    // Direções: [nx, ny, mx, my] (alvo e ponto médio)
    if (cx + 2 < currentWidth - 1 && !maze[cy][cx + 2]) neighbors.push([cx + 2, cy, cx + 1, cy]);
    if (cx - 2 > 0 && !maze[cy][cx - 2]) neighbors.push([cx - 2, cy, cx - 1, cy]);
    if (cy + 2 < currentHeight - 1 && !maze[cy + 2][cx]) neighbors.push([cx, cy + 2, cx, cy + 1]);
    if (cy - 2 > 0 && !maze[cy - 2][cx]) neighbors.push([cx, cy - 2, cx, cy - 1]);

    if (neighbors.length > 0) {
      const [nx, ny, mx, my] = neighbors[Math.floor(Math.random() * neighbors.length)];
      maze[ny][nx] = true;
      maze[my][mx] = true;
      stack.push([nx, ny]);
    } else {
      stack.pop();
    }
  }

  // Converter labirinto booleano para o mapa do jogo e criar "atalhos"
  for (let y = 0; y < currentHeight; y++) {
    for (let x = 0; x < currentWidth; x++) {
      if (maze[y][x]) {
        map[y][x] = 'FLOOR';
      } else if (x > 0 && x < currentWidth - 1 && y > 0 && y < currentHeight - 1) {
        if (Math.random() < 0.08) map[y][x] = 'FLOOR';
      }
    }
  }

  // Seleção aleatória de tema para cada nível
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
