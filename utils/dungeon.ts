
import { MAP_WIDTH, MAP_HEIGHT, MAX_LEVELS, BIOME_ENEMIES } from '../constants';
import { TileType, Enemy, Chest, EntityStats, PotionEntity, LevelTheme, Position, Trap, TrapType } from '../types';

const BIOMES: LevelTheme[] = [
  'CAVE', 'FOREST', 'SNOW', 'DESERT', 'RUINS', 'CATACOMBS', 
  'OSSUARY', 'MECHANICAL', 'CORRUPTED', 'INFERNO', 'ASTRAL', 'MATRIX', 'VOID',
  'FURNACE', 'SWAMP', 'TEMPLE', 'CHAOS', 'HIVE'
];

/**
 * Valida se existe um caminho contínuo entre dois pontos no mapa.
 */
function checkPath(start: Position, end: Position, map: TileType[][]): boolean {
  if (!start || !end) return false;
  const queue: Position[] = [start];
  const visited = new Set<string>();
  visited.add(`${start.x},${start.y}`);
  
  const dirs = [{x:0,y:1},{x:0,y:-1},{x:1,y:0},{x:-1,y:0}];
  
  while(queue.length > 0) {
    const curr = queue.shift()!;
    if (curr.x === end.x && curr.y === end.y) return true;
    
    for (const d of dirs) {
      const nx = curr.x + d.x;
      const ny = curr.y + d.y;
      const key = `${nx},${ny}`;
      // Consideramos transitável se for FLOOR ou qualquer entidade (que reside no FLOOR)
      if (nx >= 0 && nx < MAP_WIDTH && ny >= 0 && ny < MAP_HEIGHT && map[ny][nx] !== 'WALL' && !visited.has(key)) {
        visited.add(key);
        queue.push({x:nx, y:ny});
      }
    }
  }
  return false;
}

export function generateDungeon(level: number, isCrowUnlocked: boolean = false) {
  let attempt = 0;
  while (attempt < 20) {
    const dungeon = generateRawDungeon(level, isCrowUnlocked);
    // Regra Absoluta: Validar caminho Jogador -> Chave e Chave -> Escada
    if (checkPath(dungeon.playerPos, dungeon.keyPos, dungeon.map) && 
        checkPath(dungeon.keyPos, dungeon.stairsPos, dungeon.map)) {
      return dungeon;
    }
    attempt++;
  }
  // Fallback seguro: gera um layout aberto garantido se falhar muitas vezes
  return generateRawDungeon(level, isCrowUnlocked, true);
}

function generateRawDungeon(level: number, isCrowUnlocked: boolean, forceOpen = false) {
  const currentWidth = Math.min(30 + Math.floor(level / 2), 80);
  const currentHeight = Math.min(25 + Math.floor(level / 3), 55);
  const map: TileType[][] = Array(MAP_HEIGHT).fill(0).map(() => Array(MAP_WIDTH).fill('WALL'));

  const layoutTypes = ['ABERTO', 'LABIRINTO', 'SALAS', 'CORREDORES', 'SIMETRICO', 'CAOTICO'];
  const layout = forceOpen ? 'ABERTO' : layoutTypes[Math.floor(Math.random() * layoutTypes.length)];

  if (layout === 'ABERTO') {
    for (let y = 2; y < currentHeight - 2; y++) {
      for (let x = 2; x < currentWidth - 2; x++) map[y][x] = 'FLOOR';
    }
  } else if (layout === 'LABIRINTO') {
    // Maze simples baseado em grid
    for (let y = 1; y < currentHeight - 1; y++) {
      for (let x = 1; x < currentWidth - 1; x++) {
        if (x % 2 === 1 && y % 2 === 1) map[y][x] = 'FLOOR';
        else if (Math.random() > 0.3) map[y][x] = 'FLOOR';
      }
    }
  } else if (layout === 'SALAS') {
    generateRoomLayout(map, currentWidth, currentHeight, 6 + Math.floor(level/10), 3, 6);
  } else if (layout === 'CORREDORES') {
    for (let y = 3; y < currentHeight - 3; y += 4) {
      for (let x = 2; x < currentWidth - 2; x++) map[y][x] = 'FLOOR';
    }
    for (let x = 3; x < currentWidth - 3; x += 8) {
      for (let y = 1; y < currentHeight - 1; y++) map[y][x] = 'FLOOR';
    }
  } else if (layout === 'SIMETRICO') {
    const half = Math.floor(currentWidth / 2);
    for (let y = 2; y < currentHeight - 2; y++) {
      for (let x = 2; x < half; x++) {
        if (Math.random() > 0.4) {
           map[y][x] = 'FLOOR';
           map[y][currentWidth - x - 1] = 'FLOOR';
        }
      }
    }
    for (let x = 2; x < currentWidth - 2; x++) map[Math.floor(currentHeight/2)][x] = 'FLOOR';
  } else { // CAOTICO
    for (let y = 2; y < currentHeight - 2; y++) {
      for (let x = 2; x < currentWidth - 2; x++) {
        if (Math.random() > 0.45) map[y][x] = 'FLOOR';
      }
    }
  }

  // Biomas extremos mais comuns em níveis altos (Abismo, Zona Infernal, Matrix, Plano Astral)
  let theme: LevelTheme;
  const extremes: LevelTheme[] = ['VOID', 'INFERNO', 'MATRIX', 'ASTRAL', 'CHAOS', 'FURNACE'];
  if (level > 80 && Math.random() > 0.4) {
    theme = extremes[Math.floor(Math.random() * extremes.length)];
  } else {
    theme = BIOMES[Math.floor(Math.random() * BIOMES.length)];
  }

  const occupied = new Set<string>();
  const getFreeTile = () => {
    for (let i = 0; i < 2000; i++) {
      const rx = Math.floor(Math.random() * (currentWidth - 4)) + 2;
      const ry = Math.floor(Math.random() * (currentHeight - 4)) + 2;
      if (map[ry][rx] === 'FLOOR' && !occupied.has(`${rx},${ry}`)) {
        occupied.add(`${rx},${ry}`);
        return { x: rx, y: ry };
      }
    }
    // Se não achar livre, força um
    const fx = Math.floor(currentWidth / 2);
    const fy = Math.floor(currentHeight / 2);
    map[fy][fx] = 'FLOOR';
    return { x: fx, y: fy };
  };

  const playerPos = getFreeTile();
  const stairsPos = getFreeTile();
  const keyPos = getFreeTile();
  
  const targetEnemies = 4 + Math.floor(level / 3);
  const enemies: Enemy[] = [];
  const enemyPool = BIOME_ENEMIES[theme];
  for (let i = 0; i < targetEnemies; i++) {
    const pos = getFreeTile();
    const type = enemyPool[Math.floor(Math.random() * enemyPool.length)];
    enemies.push({
      id: `e-${level}-${i}`, x: pos.x, y: pos.y, type,
      stats: generateEnemyStats(level, Math.random() > 0.95),
      isBoss: level % 10 === 0 && i === 0
    });
  }

  const chests: Chest[] = [];
  const numChests = Math.random() > 0.5 ? 2 : 1;
  for (let i = 0; i < numChests; i++) {
    const pos = getFreeTile();
    chests.push({ id: `c-${level}-${i}`, x: pos.x, y: pos.y });
  }

  const potions: PotionEntity[] = [];
  for (let i = 0; i < 2; i++) {
    const pos = getFreeTile();
    potions.push({ id: `p-${level}-${i}`, x: pos.x, y: pos.y, percent: 25 });
  }

  const altarPos = getFreeTile();
  let merchantPos = (Math.random() > 0.8 || level === 1) ? getFreeTile() : undefined;

  // GERAÇÃO DE ARMADILHAS (Nível 30+)
  const traps: Trap[] = [];
  if (level >= 30) {
      let trapCount = Math.floor(level / 8); // Aumenta com o nível
      
      // Biomas perigosos tem mais armadilhas
      if (['INFERNO', 'VOID', 'MATRIX', 'CORRUPTED', 'MECHANICAL', 'FURNACE', 'CHAOS', 'HIVE'].includes(theme)) {
          trapCount += 3;
      }

      for(let i=0; i<trapCount; i++) {
          const pos = getFreeTile();
          const types: TrapType[] = ['SPIKE', 'POISON', 'ALARM', 'EXPLOSIVE'];
          const type = types[Math.floor(Math.random() * types.length)];
          traps.push({
              id: `t-${level}-${i}`,
              x: pos.x,
              y: pos.y,
              type,
              triggered: false,
              revealed: false
          });
      }
  }

  // GERAÇÃO DO OVO (Nível 30, se corvo não desbloqueado)
  let eggPos: Position | undefined = undefined;
  if (level === 30 && !isCrowUnlocked) {
      eggPos = getFreeTile();
  }

  return { map, theme, playerPos, stairsPos, enemies, chests, potions, keyPos, merchantPos, altarPos, traps, eggPos };
}

function generateRoomLayout(map: TileType[][], w: number, h: number, count: number, minS: number, maxS: number) {
  const rooms: Position[] = [];
  for (let i = 0; i < count; i++) {
    const rw = Math.floor(Math.random() * (maxS - minS)) + minS;
    const rh = Math.floor(Math.random() * (maxS - minS)) + minS;
    const rx = Math.floor(Math.random() * (w - rw - 2)) + 1;
    const ry = Math.floor(Math.random() * (h - rh - 2)) + 1;
    for (let y = ry; y < ry + rh; y++) {
      for (let x = rx; x < rx + rw; x++) map[y][x] = 'FLOOR';
    }
    rooms.push({x: Math.floor(rx + rw/2), y: Math.floor(ry + rh/2)});
  }
  // Conecta salas para garantir transitabilidade
  for (let i = 0; i < rooms.length - 1; i++) {
    let cx = rooms[i].x;
    let cy = rooms[i].y;
    const tx = rooms[i+1].x;
    const ty = rooms[i+1].y;
    while(cx !== tx) { map[cy][cx] = 'FLOOR'; cx += cx < tx ? 1 : -1; }
    while(cy !== ty) { map[cy][cx] = 'FLOOR'; cy += cy < ty ? 1 : -1; }
  }
}

function generateEnemyStats(level: number, isElite: boolean): EntityStats {
  const mult = isElite ? 2.0 : 1.0;
  const hp = Math.floor((40 + level * 15) * mult);
  return {
    hp, maxHp: hp,
    attack: Math.floor((5 + level * 3) * mult),
    armor: Math.floor((2 + level * 1.5) * mult),
    maxArmor: Math.floor((2 + level * 1.5) * mult),
    speed: 8 + level / 10
  };
}

export function findDungeonPath(start: Position, end: Position, map: TileType[][], enemies: Enemy[]): Position[] | null {
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
      // BFS ignora paredes mas permite passar por inimigos/baús etc
      if (nx >= 0 && nx < MAP_WIDTH && ny >= 0 && ny < MAP_HEIGHT && map[ny][nx] !== 'WALL' && !visited.has(key)) {
        visited.add(key);
        queue.push({ pos: { x: nx, y: ny }, path: [...path, { x: nx, y: ny }] });
      }
    }
  }
  return null;
}
