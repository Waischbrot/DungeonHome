import type {
    Category,
    ChallengeType,
    ClassDef,
    Decoration,
    Door,
    JournalEntry,
    Npc,
    Quest,
    QuestState,
    Renown,
    Room,
    RoomShape,
    Side,
} from './types';
import {
    CHALLENGE_TO_CATEGORY,
    CLASSES,
    DOOR_TIER_REQ,
    LORE_FRAGMENTS,
    LORE_PER_XP_TRADE,
    NPC_BY_CATEGORY,
    NPC_TEMPLATES,
    QUEST_CATALOG,
    RENOWN_PER_TIER,
    RENOWN_XP_TO_NEXT,
    ROOM_GAP,
    ROOM_HEIGHT,
    SHAPE_BY_CATEGORY,
    SHAPE_DOORS,
    SHAPE_WIDTH,
    SMITH_COIN_COST,
    SMITH_XP_GAIN,
    VARIANTS_BY_TYPE,
} from './constants';

// The widest shape — used as a conservative "fits anywhere" predictor
const MAX_W = Math.max(...Object.values(SHAPE_WIDTH));
const SLOT_BUFFER = 8;          // extra clearance around predicted slots

// ─── Live state ────────────────────────────────────────────────
export const rooms  = new Map<string, Room>();
export const player = { x: 0, y: 0, room: '', clazz: CLASSES[0] };
export const camera = { x: 0, y: 0, shake: 0 };

export const wallet = { coins: 0 };
export const renown: Renown = { level: 1, xp: 0, xpToNext: 30 };

export const stats = {
    doorsOpened: 0,
    rooms: 1,
    trialsByType: { combat: 0, puzzle: 0, parkour: 0, economy: 0 } as Record<ChallengeType, number>,
    doorsByTier:  { 1: 0, 2: 0, 3: 0 } as Record<number, number>,
};

export const journal: JournalEntry[] = [];

// current is null until the Architect explicitly hands over the next task
export const questState: QuestState = { current: null, completed: 0, available: [] };

let nextId = 1;
const uid = (p: string) => `${p}_${nextId++}`;
export function setClass(c: ClassDef) { player.clazz = c; }

// ─── Shape selection ──────────────────────────────────────────
function pickShape(category: Category): RoomShape {
    const dist = SHAPE_BY_CATEGORY[category];
    const r = Math.random();
    let acc = 0;
    for (const [shape, weight] of Object.entries(dist) as [RoomShape, number][]) {
        acc += weight;
        if (r <= acc) return shape;
    }
    return 'chamber';
}

// ─── Depth-based tier ─────────────────────────────────────────
// doorParentDepth = depth of the room the door is ON.
// childDepth     = depth of the room the door would open into.
function tierForDoor(doorParentDepth: number): number {
    const childDepth = doorParentDepth + 1;
    const base = Math.max(1, Math.min(3, Math.floor((childDepth + 1) / 2)));
    const r = Math.random();
    if (r < 0.7) return base;
    if (r < 0.9 && base > 1) return base - 1;
    return Math.min(3, base + 1);
}

// ─── Construction primitives ──────────────────────────────────
export function createRoom(
    x: number, y: number, category: Category,
    fromDoor: string | null = null,
    forcedShape?: RoomShape,
    depth: number = 0,
): Room {
    const shape = forcedShape ?? pickShape(category);
    const w = SHAPE_WIDTH[shape];
    const h = ROOM_HEIGHT;
    const room: Room = {
        id: uid('room'), x, y, w, h, shape,
        category, depth, fromDoor, doors: [],
        decorations: [], npc: null,
    };
    rooms.set(room.id, room);
    return room;
}

export function createDoor(parent: Room, side: Side, challenge?: ChallengeType, tier = 1): Door {
    const all: ChallengeType[] = ['combat', 'puzzle', 'parkour', 'economy'];
    const ch = challenge ?? all[Math.floor(Math.random() * 4)];
    const variants = VARIANTS_BY_TYPE[ch];
    const variant  = variants[Math.floor(Math.random() * variants.length)];
    const door: Door = {
        id: uid('door'), parent: parent.id, side,
        seal: { challenge: ch, tier, variant },
        opened: false, linked: null,
    };
    parent.doors.push(door);
    return door;
}

const oppositeSide = (s: Side): Side => (({ n: 's', s: 'n', e: 'w', w: 'e' } as const)[s]);

export function doorPos(room: Room, door: Door) {
    switch (door.side) {
        case 'n': return { x: room.x + room.w / 2, y: room.y };
        case 's': return { x: room.x + room.w / 2, y: room.y + room.h };
        case 'e': return { x: room.x + room.w,     y: room.y + room.h / 2 };
        case 'w': return { x: room.x,              y: room.y + room.h / 2 };
    }
}

// ─── Placement helpers (variable size, aligned doors) ─────────
function slotForSide(parent: Room, side: Side, childW: number, childH: number) {
    switch (side) {
        case 'n': return { x: parent.x + parent.w / 2 - childW / 2, y: parent.y - ROOM_GAP - childH };
        case 's': return { x: parent.x + parent.w / 2 - childW / 2, y: parent.y + parent.h + ROOM_GAP };
        case 'e': return { x: parent.x + parent.w + ROOM_GAP,        y: parent.y + parent.h / 2 - childH / 2 };
        case 'w': return { x: parent.x - ROOM_GAP - childW,          y: parent.y + parent.h / 2 - childH / 2 };
    }
}
function slotOccupied(nx: number, ny: number, nw: number, nh: number): Room | null {
    for (const r of rooms.values()) {
        if (!(nx + nw <= r.x || nx >= r.x + r.w || ny + nh <= r.y || ny >= r.y + r.h)) return r;
    }
    return null;
}

// Conservative check: would the LARGEST possible future room fit cleanly on this side?
function sideHasRoomForFuture(parent: Room, side: Side): boolean {
    const slot = slotForSide(parent, side, MAX_W, ROOM_HEIGHT);
    return slotOccupied(
        slot.x - SLOT_BUFFER, slot.y - SLOT_BUFFER,
        MAX_W + 2 * SLOT_BUFFER, ROOM_HEIGHT + 2 * SLOT_BUFFER,
    ) === null;
}

// ─── Layout per shape (uses dynamic w/h) ──────────────────────
const add = (r: Room, kind: Decoration['kind'], x: number, y: number) =>
    r.decorations.push({ kind, x, y });

function layoutByShape(r: Room) {
    const { w, h, category, shape } = r;
    if (shape === 'junction') {
        add(r, 'rune-circle', w / 2, h / 2);
        add(r, 'brazier', 40, 40);
        add(r, 'brazier', w - 40, h - 40);
        return;
    }
    if (shape === 'grand') {
        if (category === 'sanctum') {
            add(r, 'training-dummy', w / 2, h / 2);
            add(r, 'banner', w / 2 - 90, 24); add(r, 'banner', w / 2 + 90, 24);
            add(r, 'brazier', 50, 50); add(r, 'brazier', w - 50, 50);
            add(r, 'pillar', 80, h - 60); add(r, 'pillar', w - 80, h - 60);
        } else if (category === 'vault') {
            add(r, 'chest', w / 2 - 80, h / 2 - 30); add(r, 'chest', w / 2, h / 2 - 30); add(r, 'chest', w / 2 + 80, h / 2 - 30);
            add(r, 'rug', w / 2, h / 2 + 50);
            add(r, 'candle', 50, h / 2); add(r, 'candle', w - 50, h / 2);
        } else if (category === 'well') {
            add(r, 'fountain', w / 2, h / 2);
            add(r, 'plant', 50, 50); add(r, 'plant', w - 50, 50);
            add(r, 'plant', 50, h - 50); add(r, 'plant', w - 50, h - 50);
        } else {
            add(r, 'rune-circle', w / 2, h / 2);
            add(r, 'brazier', 50, 50); add(r, 'brazier', w - 50, 50);
            add(r, 'brazier', 50, h - 50); add(r, 'brazier', w - 50, h - 50);
        }
        return;
    }
    if (shape === 'hall') {
        if (category === 'workshop') {
            add(r, 'anvil', w / 2 - 60, h / 2);
            add(r, 'crate', 60, h / 2); add(r, 'crate', 90, h / 2 + 30);
            add(r, 'weapon-rack', w / 2 + 80, 30);
            add(r, 'brazier', w - 50, h - 50);
        } else if (category === 'vault') {
            add(r, 'chest', 80, h / 2); add(r, 'chest', w - 80, h / 2);
            add(r, 'crate', w / 2 - 30, h / 2); add(r, 'crate', w / 2 + 30, h / 2);
        } else {
            add(r, 'pillar', w / 4, 60); add(r, 'pillar', w * 3 / 4, 60);
            add(r, 'pillar', w / 4, h - 60); add(r, 'pillar', w * 3 / 4, h - 60);
            add(r, 'rug', w / 2, h / 2);
        }
        return;
    }
    // CHAMBER (default)
    switch (category) {
        case 'seed':
            add(r, 'rune-circle', w / 2, h / 2);
            add(r, 'brazier', 50, 50); add(r, 'brazier', w - 50, 50);
            add(r, 'brazier', 50, h - 50); add(r, 'brazier', w - 50, h - 50);
            add(r, 'banner', 28, h / 2 - 70); add(r, 'banner', w - 28, h / 2 - 70);
            break;
        case 'sanctum':
            add(r, 'training-dummy', w / 2 - 60, h / 2);
            add(r, 'weapon-rack', w / 2 + 70, 34);
            add(r, 'banner', w / 2 - 30, 24);
            add(r, 'brazier', 44, 44); add(r, 'brazier', w - 44, h - 44);
            break;
        case 'chamber':
            add(r, 'rug', w / 2, h / 2 + 10);
            add(r, 'table', w / 2, h / 2 + 10);
            add(r, 'bookshelf', 60, 34); add(r, 'bookshelf', w - 60, 34);
            add(r, 'bookshelf', 60, h - 34); add(r, 'bookshelf', w - 60, h - 34);
            add(r, 'candle', 32, h / 2); add(r, 'candle', w - 32, h / 2);
            break;
        case 'workshop':
            add(r, 'anvil', w / 2 - 30, h / 2);
            add(r, 'crate', 54, 50); add(r, 'crate', 86, 70); add(r, 'crate', w - 60, h - 50);
            add(r, 'brazier', w - 50, 50);
            add(r, 'weapon-rack', w / 2 + 80, 34);
            break;
        case 'vault':
            add(r, 'chest', 60, 42); add(r, 'chest', w / 2 - 40, 42); add(r, 'chest', w - 60, 42);
            add(r, 'chest', 60, h - 42); add(r, 'crate', w - 70, h - 50);
            add(r, 'rug', w / 2, h / 2 + 30);
            add(r, 'candle', 32, h / 2); add(r, 'candle', w - 32, h / 2);
            break;
        case 'well':
            add(r, 'well-stone', w / 2, h / 2);
            add(r, 'plant', 50, 50); add(r, 'plant', w - 50, 50);
            add(r, 'plant', 50, h - 50); add(r, 'plant', w - 50, h - 50);
            add(r, 'pillar', w / 2 - 120, h / 2); add(r, 'pillar', w / 2 + 120, h / 2);
            break;
    }
}

// ─── NPC spawn (sparse, role-based) ───────────────────────────
function maybeSpawnNpc(room: Room) {
    const cfg = NPC_BY_CATEGORY[room.category];
    if (!cfg.role || Math.random() > cfg.chance) return;
    const t = NPC_TEMPLATES[cfg.role];
    room.npc = {
        id: 'npc_' + room.id,
        role: cfg.role,
        title: t.title,
        x: room.w / 2 + 70,
        y: room.h / 2 + 20,
        color: t.color,
        lines: [...t.lines],
    };
}

type Rect = { x: number; y: number; w: number; h: number };

function placeFreshRoom(
    door: Door, parent: Room, cat: Category,
    shape: RoomShape, slot: { x: number; y: number },
): Room {
    const newRoom = createRoom(slot.x, slot.y, cat, door.id, shape, parent.depth + 1);
    const back = createDoor(newRoom, oppositeSide(door.side));
    back.opened = true; back.linked = parent.id;

    const candidates = (['n','s','e','w'] as Side[])
        .filter(s => s !== oppositeSide(door.side))
        .filter(s => sideHasRoomForFuture(newRoom, s));
    const [minD, maxD] = SHAPE_DOORS[shape];
    const want = Math.floor(Math.random() * (maxD - minD + 1)) + minD;
    const num  = Math.min(candidates.length, want);
    for (let i = 0; i < num; i++) {
        const idx = Math.floor(Math.random() * candidates.length);
        const s   = candidates.splice(idx, 1)[0];
        const tier = tierForDoor(newRoom.depth);
        createDoor(newRoom, s, undefined, tier);
    }
    layoutByShape(newRoom);
    maybeSpawnNpc(newRoom);
    door.linked = newRoom.id;
    return newRoom;
}

function linkToExisting(door: Door, parent: Room, existing: Room): Room {
    door.linked = existing.id;
    const oppSide = oppositeSide(door.side);
    let back = existing.doors.find(d => d.side === oppSide);
    if (!back) back = createDoor(existing, oppSide);
    back.opened = true; back.linked = parent.id;

    const dpA = doorPos(parent, door);
    const dpB = doorPos(existing, back);

    // Share one path between both doors — otherwise the back door
    // falls back to its own default 64×64 stub and renders alongside
    // the real corridor, looking like a second parallel path.
    const path = computePath(dpA, dpB, door.side);
    door.corridorPath = path;
    back.corridorPath = path;
    return existing;
}

function computePath(
    dpA: { x: number; y: number },
    dpB: { x: number; y: number },
    sideA: Side,
): Rect[] {
    const W = 64, half = W / 2;

    // ── Vertical-running door (N or S) ──────────────────────────
    if (sideA === 'n' || sideA === 's') {
        // Aligned in X → a single straight vertical corridor of any length
        if (Math.abs(dpA.x - dpB.x) < 6) {
            const minY = Math.min(dpA.y, dpB.y);
            const maxY = Math.max(dpA.y, dpB.y);
            return [{ x: dpA.x - half, y: minY, w: W, h: Math.max(1, maxY - minY) }];
        }
        // Not aligned → L-shape (vertical · horizontal · vertical)
        const midY = (dpA.y + dpB.y) / 2;
        const minX = Math.min(dpA.x, dpB.x) - half;
        const maxX = Math.max(dpA.x, dpB.x) + half;
        return [
            { x: dpA.x - half, y: Math.min(dpA.y, midY), w: W, h: Math.abs(midY - dpA.y) || 1 },
            { x: minX,         y: midY - half,           w: maxX - minX, h: W },
            { x: dpB.x - half, y: Math.min(dpB.y, midY), w: W, h: Math.abs(midY - dpB.y) || 1 },
        ];
    }

    // ── Horizontal-running door (E or W) ────────────────────────
    if (Math.abs(dpA.y - dpB.y) < 6) {
        // Aligned in Y → single straight horizontal corridor of any length
        const minX = Math.min(dpA.x, dpB.x);
        const maxX = Math.max(dpA.x, dpB.x);
        return [{ x: minX, y: dpA.y - half, w: Math.max(1, maxX - minX), h: W }];
    }
    // Not aligned → L-shape (horizontal · vertical · horizontal)
    const midX = (dpA.x + dpB.x) / 2;
    const minY = Math.min(dpA.y, dpB.y) - half;
    const maxY = Math.max(dpA.y, dpB.y) + half;
    return [
        { x: Math.min(dpA.x, midX), y: dpA.y - half, w: Math.abs(midX - dpA.x) || 1, h: W },
        { x: midX - half,           y: minY,         w: W, h: maxY - minY },
        { x: Math.min(dpB.x, midX), y: dpB.y - half, w: Math.abs(midX - dpB.x) || 1, h: W },
    ];
}

export function addRoomBehindDoor(door: Door): Room {
    const parent = rooms.get(door.parent)!;
    const cat    = CHALLENGE_TO_CATEGORY[door.seal.challenge];

    // Try the originally chosen shape first
    const chosenShape = pickShape(cat);
    const chosenSlot  = slotForSide(parent, door.side, SHAPE_WIDTH[chosenShape], ROOM_HEIGHT);
    if (!slotOccupied(chosenSlot.x, chosenSlot.y, SHAPE_WIDTH[chosenShape], ROOM_HEIGHT)) {
        return placeFreshRoom(door, parent, cat, chosenShape, chosenSlot);
    }

    // Try smaller shapes (chamber, then junction) — maybe they fit
    for (const tryShape of ['chamber', 'junction'] as RoomShape[]) {
        if (tryShape === chosenShape) continue;
        const tslot = slotForSide(parent, door.side, SHAPE_WIDTH[tryShape], ROOM_HEIGHT);
        if (!slotOccupied(tslot.x, tslot.y, SHAPE_WIDTH[tryShape], ROOM_HEIGHT)) {
            return placeFreshRoom(door, parent, cat, tryShape, tslot);
        }
    }

    // Truly blocked — link to whatever's there with a bent corridor
    const blocker = slotOccupied(chosenSlot.x, chosenSlot.y, SHAPE_WIDTH[chosenShape], ROOM_HEIGHT)!;
    return linkToExisting(door, parent, blocker);
}

// ─── Renown ────────────────────────────────────────────────────
export function gainXP(amount: number): { leveledUp: boolean; newLevel: number } {
    renown.xp += amount;
    let leveledUp = false;
    while (renown.xp >= renown.xpToNext) {
        renown.xp -= renown.xpToNext;
        renown.level++;
        renown.xpToNext = RENOWN_XP_TO_NEXT(renown.level);
        leveledUp = true;
    }
    return { leveledUp, newLevel: renown.level };
}
export function canOpenDoor(door: Door): boolean {
    return renown.level >= DOOR_TIER_REQ(door.seal.tier);
}
export function rewardForTrial(challenge: ChallengeType, tier: number) {
    let coins = 10 + tier * 5;
    if (player.clazz.id === 'artisan' && challenge === 'economy') coins += 5;
    let xp = RENOWN_PER_TIER(tier);
    if (player.clazz.id === 'delver' && challenge === 'combat') xp += 5;
    wallet.coins = Math.min(9999, wallet.coins + coins);
    stats.trialsByType[challenge]++;
    stats.doorsByTier[tier] = (stats.doorsByTier[tier] || 0) + 1;
    const { leveledUp, newLevel } = gainXP(xp);
    return { coins, xp, leveledUp, newLevel };
}
export function maybeUnlockLore(): JournalEntry | null {
    if (Math.random() > 0.55) return null;
    const have = new Set(journal.map(j => j.id));
    const pool = LORE_FRAGMENTS.filter(l => !have.has(l.id));
    if (!pool.length) return null;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    const entry: JournalEntry = { ...pick, unlockedAt: Date.now() };
    journal.push(entry);
    return entry;
}

// ─── Quest system (explicit acceptance) ───────────────────────
function questProgress(q: Quest): number {
    switch (q.kind) {
        case 'open-doors':      return stats.doorsOpened;
        case 'open-type':       return q.challenge ? stats.trialsByType[q.challenge] : 0;
        case 'open-tier': {
            const t = q.tier ?? 2;
            let c = 0;
            for (const k of Object.keys(stats.doorsByTier)) if (+k >= t) c += stats.doorsByTier[+k];
            return c;
        }
        case 'collect-lore':    return journal.length;
        case 'all-trial-types': {
            const types: ChallengeType[] = ['combat','puzzle','parkour','economy'];
            return types.filter(t => stats.trialsByType[t] > 0).length;
        }
    }
}
export function questIsComplete(q: Quest): boolean { return questProgress(q) >= q.target; }
export function getQuestProgress(): { current: number; target: number } | null {
    if (!questState.current) return null;
    return { current: questProgress(questState.current), target: questState.current.target };
}

export function nextOfferableQuest(): Quest | null {
    return questState.available[0] ?? null;
}

export function acceptNextQuest(): Quest | null {
    if (questState.current) return null;
    if (questState.available.length === 0) return null;
    questState.current = questState.available.shift()!;
    return questState.current;
}

export function claimCurrentQuest() {
    if (!questState.current || !questIsComplete(questState.current)) return null;
    const q = questState.current;
    wallet.coins = Math.min(9999, wallet.coins + q.rewardCoins);
    const r = gainXP(q.rewardXp);
    questState.completed++;
    questState.current = null;   // NO auto-advance — Architect must offer the next one
    return { coins: q.rewardCoins, xp: q.rewardXp, leveledUp: r.leveledUp, newLevel: r.newLevel };
}

// ─── Trades ───────────────────────────────────────────────────
export function tradeLoreForXp() {
    if (journal.length === 0) return null;
    journal.pop();
    const r = gainXP(LORE_PER_XP_TRADE);
    return { xp: LORE_PER_XP_TRADE, leveledUp: r.leveledUp, newLevel: r.newLevel };
}
export function tradeCoinsForXp() {
    if (wallet.coins < SMITH_COIN_COST) return null;
    wallet.coins -= SMITH_COIN_COST;
    const r = gainXP(SMITH_XP_GAIN);
    return { xp: SMITH_XP_GAIN, leveledUp: r.leveledUp, newLevel: r.newLevel };
}

// ─── Reset ────────────────────────────────────────────────────
export function resetGame() {
    rooms.clear(); journal.length = 0;
    wallet.coins = 0;
    renown.level = 1; renown.xp = 0; renown.xpToNext = RENOWN_XP_TO_NEXT(1);
    stats.doorsOpened = 0; stats.rooms = 1;
    stats.trialsByType = { combat: 0, puzzle: 0, parkour: 0, economy: 0 };
    stats.doorsByTier  = { 1: 0, 2: 0, 3: 0 };
    nextId = 1;

    // All quests start in the queue — Architect hands them out one at a time
    questState.available = [...QUEST_CATALOG];
    questState.current   = null;
    questState.completed = 0;

    const seed = createRoom(0, 0, 'seed', null, 'chamber', 0);
    // Seed doors stay easy & always doable
    createDoor(seed, 'n', 'puzzle',  1);
    createDoor(seed, 'e', 'combat',  1);
    createDoor(seed, 's', 'economy', 2);
    createDoor(seed, 'w', 'parkour', 1);
    layoutByShape(seed);
    maybeSpawnNpc(seed);    // Architect always spawns here (chance 1.0)

    player.x = seed.x + seed.w / 2;
    player.y = seed.y + seed.h / 2;
    player.room = seed.id;
    camera.x = player.x; camera.y = player.y;
}

// ─── Queries used by hub / main ───────────────────────────────
export function findNearestNpc(): { npc: Npc; room: Room; dist: number } | null {
    let best: { npc: Npc; room: Room; dist: number } | null = null;
    for (const r of rooms.values()) {
        if (!r.npc) continue;
        const wx = r.x + r.npc.x;
        const wy = r.y + r.npc.y;
        const d = Math.hypot(wx - player.x, wy - player.y);
        if (d < 56 && (!best || d < best.dist)) best = { npc: r.npc, room: r, dist: d };
    }
    return best;
}