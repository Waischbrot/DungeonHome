// ─── Enums & ids ───────────────────────────────────────────────
export type Side          = 'n' | 's' | 'e' | 'w';
export type Category      = 'seed' | 'chamber' | 'workshop' | 'vault' | 'well' | 'sanctum';
export type ChallengeType = 'combat' | 'puzzle' | 'parkour' | 'economy';
export type ClassId       = 'delver' | 'scholar' | 'artisan' | 'wayfarer';

export type TrialVariant =
    // combat
    | 'shadow-hunt' | 'boss-duel' | 'wave-defense' | 'arrow-volley'
    // puzzle
    | 'memory-seal' | 'pattern-match' | 'rune-cipher' | 'lights-out' | 'mirror-beam'
    // parkour
    | 'moving-walls' | 'spike-floor' | 'pendulum-path' | 'falling-floor' | 'maze'
    // economy
    | 'coin-rush' | 'greed-gauntlet' | 'coin-press';

export type Screen =
    | 'title' | 'class-select' | 'hub' | 'trial' | 'pause' | 'journal' | 'dialog';

export type RoomShape = 'chamber' | 'hall' | 'junction' | 'grand';
export type NpcRole   = 'architect' | 'loremaster' | 'smith';

// ─── World structures ─────────────────────────────────────────
export interface Seal {
    challenge: ChallengeType;
    tier: number;
    variant: TrialVariant;   // ← NEW: fixed at door creation
}

export interface Door {
    id: string;
    parent: string;
    side: Side;
    seal: Seal;
    opened: boolean;
    linked: string | null;
    corridorPath?: { x: number; y: number; w: number; h: number }[];  // ← NEW
}

export type DecorationKind =
    | 'pillar' | 'bookshelf' | 'anvil' | 'chest' | 'well-stone' | 'rug'
    | 'training-dummy' | 'weapon-rack' | 'banner' | 'table'
    | 'rune-circle' | 'fountain' | 'crate' | 'brazier' | 'plant' | 'candle';

export interface Decoration {
    kind: DecorationKind;
    x: number; y: number;
}

export interface Npc {
    id: string;
    role: NpcRole;
    name: string;
    title: string;
    x: number; y: number;
    color: string;
    lines: string[];
}

export interface Room {
    id: string;
    x: number; y: number;
    w: number; h: number;
    shape: RoomShape;
    category: Category;
    depth: number;            // NEW — distance in rooms from the Seed Hall (0 = seed)
    doors: Door[];
    fromDoor: string | null;
    decorations: Decoration[];
    npc: Npc | null;
}

// ─── Engine bits ──────────────────────────────────────────────
export interface Particle {
    x: number; y: number; vx: number; vy: number;
    life: number; maxLife: number; color: string; size: number;
}

export interface Trial {
    type: ChallengeType;
    variant: TrialVariant;
    player: { x: number; y: number };
    bounds: { x: number; y: number; w: number; h: number };
    title: string;
    hint: string;
    update(): void;
    draw(ctx: CanvasRenderingContext2D): void;
    isComplete(): boolean;
}

export interface ClassDef {
    id: ClassId;
    name: string;
    icon: string;
    color: string;
    tagline: string;
    perk: string;
    description: string;
}

export interface JournalEntry { id: string; title: string; text: string; unlockedAt: number; }

export interface Renown { level: number; xp: number; xpToNext: number; }

// ─── Quests ───────────────────────────────────────────────────
export type QuestKind =
    | 'open-doors'
    | 'open-type'
    | 'open-tier'
    | 'collect-lore'
    | 'all-trial-types';

export interface Quest {
    id: string;
    kind: QuestKind;
    target: number;
    description: string;
    rewardCoins: number;
    rewardXp: number;
    challenge?: ChallengeType;
    tier?: number;
}

// `current` is ONLY set when the Architect explicitly hands the quest over (F-key).
// `available` is the queue of pending tasks the Architect will offer one at a time.
export interface QuestState {
    current: Quest | null;
    completed: number;
    available: Quest[];
}