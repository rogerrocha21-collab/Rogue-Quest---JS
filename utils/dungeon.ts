
import { MAP_WIDTH, MAP_HEIGHT, MAX_LEVELS, ENEMY_TYPES } from '../constants';
import { TileType, Enemy, Chest, EntityStats, PotionEntity, LevelTheme, Position } from '../types';

const BIOME_ORDER: LevelTheme[] = [
  'CAVE', 'FOREST', 'SNOW', 'DESERT', 'RUINS', 'CATACOMBS', 
  'OSSUARY', 'MECHANICAL', 'CORRUPTED', 'INFERNO', 'ASTRAL', 'MATRIX', 'VOID'
];

export function generateDungeon(level: number) {
  let currentWidth = 35;
  let currentHeight = 30;
  let targetEnemies = 15;

  if (level <= 30) {
    currentWidth = 40; currentHeight = 35; targetEnemies = 15;
  } else if (level <= 70) {
    currentWidth = 55; currentHeight = 45; targetEnemies = 30;
  } else if (level <= 120) {
    currentWidth = 75; currentHeight = 55; targetEnemies = 45;
  } else {
    currentWidth = 95; currentHeight = 58; targetEnemies = 60;
  }

  const map: TileType[][] = Array(MAP_HEIGHT).fill(0).map(() => Array(MAP_WIDTH).fill('WALL'));
  
  const biomeIdx = Math.floor((level - 1) / 12) % BIOME_ORDER.length;
  const theme = BIOME_ORDER[biomeIdx];

  // Algoritmo de Labirinto Procedural (Caminhada do Bêbado / Drunkard's Walk + Escavação)
  const excavateLabyrinth = (startX: number, startY: number, steps: number) => {
    let cx = startX;
    let cy = startY;
    for (let i = 0; i < steps; i++) {
      map[cy][cx] = 'FLOOR';
      const dir = Math.floor(Math.random() * 4);
      if (dir === 0 && cx < currentWidth - 3) cx++;
      else if (dir === 1 && cx > 2) cx--;
      else if (dir === 2 && cy < currentHeight - 3) cy++;
      else if (dir === 3 && cy > 2) cy--;
    }
  };

  // Múltiplos túneis para garantir densidade de labirinto
  const iterations = Math.min(15 + Math.floor(level / 5), 40);
  for (let i = 0; i < iterations; i++) {
    const rx = Math.floor(Math.random() * (currentWidth - 6)) + 3;
    const ry = Math.floor(Math.random() * (currentHeight - 6)) + 3;
    excavateLabyrinth(rx, ry, 150 + Math.floor(level * 2));
  }

  // Garantir conectividade com salas pequenas ocasionais
  const numMiniRooms = 5 + Math.floor(level / 10);
  for (let i = 0; i < numMiniRooms; i++) {
    const rw = Math.floor(Math.random() * 3) + 3;
    const rh = Math.floor(Math.random() * 3) + 3;
    const rx = Math.floor(Math.random() * (currentWidth - rw - 4)) + 2;
    const ry = Math.floor(Math.random() * (currentHeight - rh - 4)) + 2;
    for (let y = ry; y < ry + rh; y++) {
      for (let x = rx; x < rx + rw; x++) {
        map[y][x] = 'FLOOR';
      }
    }
  }

  const occupied = new Set<string>();
  const getFreeTile = () => {
    // Procura por um tile de chão que não esteja ocupado
    for (let i = 0; i < 3000; i++) {
      const rx = Math.floor(Math.random() * (currentWidth - 4)) + 2;
      const ry = Math.floor(Math.random() * (currentHeight - 4)) + 2;
      if (map[ry][rx] === 'FLOOR' && !occupied.has(`${rx},${ry}`)) {
        occupied.add(`${rx},${ry}`);
        return { x: rx, y: ry };
      }
    }
    // Fallback: Força a criação de um tile de chão se necessário
    const fx = Math.floor(Math.random() * (currentWidth - 6)) + 3;
    const fy = Math.floor(Math.random() * (currentHeight - 6)) + 3;
    map[fy][fx] = 'FLOOR';
    occupied.add(`${fx},${fy}`);
    return { x: fx, y: fy };
  };

  const playerPos = getFreeTile();
  const stairsPos = getFreeTile();
  const keyPos = getFreeTile();
  
  // Inimigos
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

  // Baús
  const chests: Chest[] = [];
  const numChests = Math.random() > 0.6 ? 2 : 1;
  for (let i = 0; i < numChests; i++) {
    const pos = getFreeTile();
    chests.push({ id: `c-${level}-${i}`, x: pos.x, y: pos.y });
  }

  // Poções espalhadas (2 a 3 por nível como solicitado)
  const potions: PotionEntity[] = [];
  const numPotions = Math.floor(Math.random() * 2) + 2; // 2 ou 3
  for (let i = 0; i < numPotions; i++) {
    const pos = getFreeTile();
    potions.push({
      id: `p-${level}-${i}`,
      x: pos.x,
      y: pos.y,
      percent: Math.random() > 0.8 ? 50 : 25
    });
  }

  let altarPos = getFreeTile();
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
      // Importante: verificar se nx e ny estão dentro dos limites e se é FLOOR
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
