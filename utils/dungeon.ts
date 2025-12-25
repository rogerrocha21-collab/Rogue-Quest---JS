
import { MAP_WIDTH, MAP_HEIGHT, MAX_LEVELS, ENEMY_TYPES } from '../constants';
import { TileType, Enemy, Chest, EntityStats, PotionEntity, ItemEntity, LevelTheme } from '../types';

const THEMES: LevelTheme[] = ['FOREST', 'DESERT', 'SNOW', 'CAVE', 'MATRIX', 'INFERNO'];

export function generateDungeon(level: number) {
  const map: TileType[][] = Array(MAP_HEIGHT).fill(0).map(() => Array(MAP_WIDTH).fill('WALL'));
  const rooms: {x: number, y: number, w: number, h: number}[] = [];
  
  const theme = THEMES[Math.floor(Math.random() * THEMES.length)];
  const numRoomsTarget = 12 + Math.floor(Math.random() * 8);

  for (let i = 0; i < 200 && rooms.length < numRoomsTarget; i++) {
    const w = Math.floor(Math.random() * 4) + 3;
    const h = Math.floor(Math.random() * 4) + 3;
    const x = Math.floor(Math.random() * (MAP_WIDTH - w - 2)) + 1;
    const y = Math.floor(Math.random() * (MAP_HEIGHT - h - 2)) + 1;
    
    const overlap = rooms.some(r => x < r.x + r.w + 2 && x + w + 2 > r.x && y < r.y + r.h + 2 && y + h + 2 > r.y);
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

  const playerPos = { x: Math.floor(rooms[0].x + rooms[0].w / 2), y: Math.floor(rooms[0].y + rooms[0].h / 2) };
  const lastRoom = rooms[rooms.length - 1];
  const stairsPos = { x: Math.floor(lastRoom.x + lastRoom.w / 2), y: Math.floor(lastRoom.y + lastRoom.h / 2) };

  const enemies: Enemy[] = [];
  const chests: Chest[] = [];
  const potions: PotionEntity[] = [];

  // Chave
  const keyRoom = rooms[Math.floor(Math.random() * (rooms.length - 1)) + 1];
  const keyPos = { x: keyRoom.x + 1, y: keyRoom.y + 1 };

  // Mercador (Mercante)
  const merchantRoom = rooms[Math.floor(Math.random() * (rooms.length - 1)) + 1];
  const merchantPos = { x: merchantRoom.x + merchantRoom.w - 2, y: merchantRoom.y + 1 };

  // Inimigos
  let enemiesPlaced = 0;
  const targetEnemies = 10 + Math.floor(Math.random() * 9); 

  let attempts = 0;
  while (enemiesPlaced < targetEnemies && attempts < 2000) {
    attempts++;
    const ex = Math.floor(Math.random() * MAP_WIDTH);
    const ey = Math.floor(Math.random() * MAP_HEIGHT);
    
    const isStairs = ex === stairsPos.x && ey === stairsPos.y;
    const isKey = ex === keyPos.x && ey === keyPos.y;
    const isPlayer = ex === playerPos.x && ey === playerPos.y;
    const isMerchant = merchantPos && ex === merchantPos.x && ey === merchantPos.y;
    
    if (map[ey][ex] === 'FLOOR' && 
        !isPlayer && 
        !isStairs && 
        !isKey && 
        !isMerchant &&
        !enemies.some(e => e.x === ex && e.y === ey)) {
          const availableEnemies = ENEMY_TYPES.filter(e => e.minLevel <= level);
          const template = availableEnemies[Math.floor(Math.random() * availableEnemies.length)];
          enemies.push({
            id: `e-${level}-${enemiesPlaced}-${Math.random()}`,
            x: ex, y: ey,
            type: template.name,
            stats: generateEnemyStats(level, false)
          });
          enemiesPlaced++;
    }
  }

  const numChests = Math.floor(Math.random() * 2) + 1;
  for(let c = 0; c < numChests; c++) {
    const room = rooms[Math.floor(Math.random() * (rooms.length - 1)) + 1];
    chests.push({ id: `c-${level}-${c}-${Math.random()}`, x: room.x + Math.floor(room.w/2), y: room.y + Math.floor(room.h/2) });
  }

  rooms.forEach((room, idx) => {
    if (idx > 0 && idx % 5 === 0) {
      potions.push({ id: `p-${level}-${idx}-${Math.random()}`, percent: 30, x: room.x + room.w - 1, y: room.y + room.h - 1 });
    }
  });

  return { map, theme, playerPos, stairsPos, enemies, chests, potions, keyPos, merchantPos };
}

function generateEnemyStats(level: number, isBoss: boolean): EntityStats {
  const m = isBoss ? 5 : 1;
  const hp = (50 + (level * 15)) * m;
  const atk = (8 + (level * 3)) * m;
  const arm = (4 + (level * 2)) * m;
  const spd = 10 + level;
  return { hp, maxHp: hp, attack: atk, armor: arm, maxArmor: arm, speed: spd };
}
