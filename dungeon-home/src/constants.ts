import type {
    ChallengeType, Category, ClassDef, TrialVariant, DecorationKind,
    RoomShape, NpcRole, Quest,
} from './types';

// ─── Canvas / room sizing ───────────────────────────────────────
export const CANVAS_W   = 1280;
export const CANVAS_H   = 720;
export const ROOM_HEIGHT = 288;        // all rooms share this so E/W corridors line up
export const ROOM_GAP    = 64;
export const PLAYER_SPEED = 3.8;

// Width per shape — height stays constant
export const SHAPE_WIDTH: Record<RoomShape, number> = {
    chamber: 384,    // standard
    hall:    480,    // wide
    junction: 288,   // small crossroads
    grand:    480,   // large open
};

// [min, max] forward doors a shape spawns (excluding the back-door)
export const SHAPE_DOORS: Record<RoomShape, [number, number]> = {
    chamber:  [1, 2],
    hall:     [1, 2],
    junction: [2, 3],   // crossroads — more branches
    grand:    [0, 1],   // often a dead-end
};

// Per-category shape distribution (weights MUST sum to 1)
export const SHAPE_BY_CATEGORY: Record<Category, Partial<Record<RoomShape, number>>> = {
    seed:     { chamber: 1 },
    chamber:  { chamber: 0.6, grand: 0.25, junction: 0.15 },
    workshop: { chamber: 0.6, hall: 0.4 },
    vault:    { chamber: 0.4, grand: 0.6 },
    well:     { chamber: 0.5, junction: 0.5 },
    sanctum:  { chamber: 0.5, grand: 0.3, junction: 0.2 },
};

// ─── Palette ────────────────────────────────────────────────────
export const COLORS = {
    bg:           '#1a1410',
    bgDark:       '#0d0907',
    panel:        'rgba(28, 22, 18, 0.94)',
    panelDark:    'rgba(15, 12, 9, 0.96)',
    border:       'rgba(180, 140, 90, 0.45)',
    borderBright: '#b48c5a',
    text:         '#e8dcc0',
    textDim:      '#8a7d6a',
    textFaded:    '#5a5045',
    accent:       '#c89b5a',
    accentRed:    '#a14040',
    accentGreen:  '#6f8a52',
    accentPurple: '#6a5a8a',
    gold:         '#d4a851',
    stone:        '#4a4238',
    stoneDark:    '#2e2a24',
    wood:         '#6e4a2e',
    woodDark:     '#3e2818',
    parchment:    '#d8c9a0',
    skin:         '#d8b890',
};

export const SEAL_COLORS: Record<ChallengeType, string> = {
    combat:  '#a14040', puzzle:  '#6a5a8a', parkour: '#6f8a52', economy: '#c89b5a',
};
export const SEAL_ICONS: Record<ChallengeType, string> = {
    combat: '⚔', puzzle: '◉', parkour: '⚙', economy: '◆',
};
export const CHALLENGE_NAMES: Record<ChallengeType, string> = {
    combat: 'Combat', puzzle: 'Puzzle', parkour: 'Parkour', economy: 'Economy',
};
export const CATEGORY_COLORS: Record<Category, string> = {
    seed:     '#2a261e', chamber:  '#2e2530', workshop: '#312820',
    vault:    '#252a30', well:     '#28302a', sanctum:  '#2e2222',
};
export const CATEGORY_NAMES: Record<Category, string> = {
    seed: 'Seed Hall', chamber: 'Chamber', workshop: 'Workshop',
    vault: 'Vault', well: 'Well', sanctum: 'Sanctum',
};
export const CHALLENGE_TO_CATEGORY: Record<ChallengeType, Category> = {
    combat: 'sanctum', puzzle: 'chamber', parkour: 'well', economy: 'workshop',
};

// ─── Renown / level curve ───────────────────────────────────────
export const RENOWN_PER_TIER  = (tier: number) => 10 + tier * 10;
export const RENOWN_XP_TO_NEXT = (level: number) => level * 30;
export const DOOR_TIER_REQ    = (tier: number) => tier;

// ─── Trial variants per challenge type ──────────────────────────
export const VARIANTS_BY_TYPE: Record<ChallengeType, TrialVariant[]> = {
    combat:  ['shadow-hunt',  'boss-duel',     'wave-defense',  'rolling-stones'],
    puzzle:  ['memory-seal',  'pattern-match', 'rune-cipher',   'lights-out', 'mirror-beam'],
    parkour: ['moving-walls', 'spike-floor',   'pendulum-path', 'falling-floor', 'maze'],
    economy: ['coin-rush',    'greed-gauntlet','coin-press'],
};

// ─── Classes ────────────────────────────────────────────────────
export const CLASSES: ClassDef[] = [
    { id: 'delver',   name: 'Delver',   icon: '⚔', color: '#a14040',
        tagline: 'THE BLADE',
        perk: 'Combat trials: +5 Renown · shadows flee slower',
        description: 'A warrior who tames Sanctums. Bears the burden of every party\'s safety.' },
    { id: 'scholar',  name: 'Scholar',  icon: '◉', color: '#6a5a8a',
        tagline: 'THE SAGE',
        perk: 'Puzzle sequences shown twice before input',
        description: 'Reader of seals. Where others see a door, the Scholar sees a riddle.' },
    { id: 'artisan',  name: 'Artisan',  icon: '◆', color: '#c89b5a',
        tagline: 'THE BUILDER',
        perk: 'Economy trials spawn +1 coin · +5 coin reward',
        description: 'Patron of Wells and Workshops. Their dungeons hum with gentle industry.' },
    { id: 'wayfarer', name: 'Wayfarer', icon: '⚙', color: '#6f8a52',
        tagline: 'THE SWIFT',
        perk: 'Move 15% faster · parkour hazards move slower',
        description: 'Reads the rhythm of moving stones. First through every door.' },
];

// ─── Procedural names ──────────────────────────────────────────
export const ROOM_NAMES = [
    'Aethel', 'Vesper', 'Cinder', 'Marrow', 'Quartz', 'Loom', 'Veil',
    'Hollow', 'Ember', 'Glass', 'Iron', 'Silt', 'Hymn', 'Mote', 'Pyre',
];
export const NPC_NAMES = ['Mira', 'Fenn', 'Lys', 'Veska', 'Roen', 'Cael', 'Yara', 'Pell'];

// ─── Decorations (kept for type compat) ─────────────────────────
export const DECORATIONS_BY_CATEGORY: Record<Category, DecorationKind[]> = {
    seed: [], sanctum: [], chamber: [], workshop: [], vault: [], well: [],
};

// ─── NPC ROLES (only 3 now, each with a real service) ──────────
// chance = probability of spawning when a room of this category is generated
export const NPC_BY_CATEGORY: Record<Category, { chance: number; role: NpcRole | null }> = {
    seed:     { chance: 1.0, role: 'architect'  },
    chamber:  { chance: 0.4, role: 'loremaster' },
    workshop: { chance: 0.4, role: 'smith'      },
    vault:    { chance: 0,   role: null         },
    well:     { chance: 0,   role: null         },
    sanctum:  { chance: 0,   role: null         },
};

export const NPC_TEMPLATES: Record<NpcRole, { title: string; color: string; lines: string[] }> = {
    architect: {
        title: 'The First',
        color: '#d4a851',
        lines: [
            '"You woke in this hall. I am still here, between waking and sleep."',
            '"The dungeon makes requests of those who shape it. I keep its list."',
        ],
    },
    loremaster: {
        title: 'Loremaster',
        color: '#6a5a8a',
        lines: [
            '"Words gather here like dust. I sweep them into knowing."',
            '"Trade me a fragment from your journal — I will fold its meaning into your name."',
        ],
    },
    smith: {
        title: 'The Smith',
        color: '#c89b5a',
        lines: [
            '"Hammer, anvil, fire. Coin warms the steel as well as flame."',
            '"Renown is not bought. It is forged from what you have already earned."',
        ],
    },
};

// ─── Trade rates ──────────────────────────────────────────────
export const LORE_PER_XP_TRADE = 20;
export const SMITH_COIN_COST   = 50;
export const SMITH_XP_GAIN     = 10;

// ─── Quest catalog (the Architect issues these in order) ──────
export const QUEST_CATALOG: Quest[] = [
    { id: 'q1', kind: 'open-doors',      target: 2,
        description: 'Open any 2 sealed doors.',
        rewardCoins: 25, rewardXp: 20 },
    { id: 'q2', kind: 'open-type', challenge: 'combat', target: 1,
        description: 'Clear a Combat trial.',
        rewardCoins: 20, rewardXp: 15 },
    { id: 'q3', kind: 'open-tier', tier: 2, target: 1,
        description: 'Open a door of tier 2 or higher.',
        rewardCoins: 50, rewardXp: 30 },
    { id: 'q4', kind: 'collect-lore',    target: 2,
        description: 'Collect 2 lore fragments.',
        rewardCoins: 30, rewardXp: 25 },
    { id: 'q5', kind: 'all-trial-types', target: 4,
        description: 'Clear at least one of each: combat, puzzle, parkour, economy.',
        rewardCoins: 100, rewardXp: 60 },
    { id: 'q6', kind: 'open-doors',      target: 8,
        description: 'Open 8 sealed doors in total.',
        rewardCoins: 80, rewardXp: 50 },
];

// ─── Lore ─────────────────────────────────────────────────────
export const LORE_FRAGMENTS = [
    { id: 'l1',  title: 'On Doors',     text: 'The first Architect built doors before he built walls. The rooms followed, ashamed they had been late.' },
    { id: 'l2',  title: 'On Wells',     text: 'A Well does not give. It remembers — and what it remembers, it shares slowly.' },
    { id: 'l3',  title: 'On Seals',     text: 'Every seal is a promise. Every promise, once kept, becomes a hallway.' },
    { id: 'l4',  title: 'On Renown',    text: 'No one is born known to the dungeon. You earn its attention door by door.' },
    { id: 'l5',  title: 'On Sanctums',  text: 'Combat is what we call the conversation between two who refuse to translate.' },
    { id: 'l6',  title: 'On Workshops', text: 'A Workshop is a vow that today, something will be made better than yesterday.' },
    { id: 'l7',  title: 'On Vaults',    text: 'A Vault grows because it knows: you will return for what you left behind.' },
    { id: 'l8',  title: 'On Chambers',  text: 'The Chamber is the only room with no purpose but your own. Use it well.' },
    { id: 'l9',  title: 'On the Seed',  text: 'You did not enter the Seed Hall. You woke inside it. There is a difference.' },
    { id: 'l10', title: 'On Architects',text: 'They left no portraits. They left only doors. Look long enough and you will see a face.' },
    { id: 'l11', title: 'On Tiers',     text: 'A higher tier seal is not stronger. It is just more honest about what it asks of you.' },
    { id: 'l12', title: 'On the Hub',   text: 'There is a town outside every dungeon. Some never visit. Some never leave.' },
];

// ─── Codex pages (pause menu) ─────────────────────────────────
// ─── Codex pages (pause menu) ─────────────────────────────────
export const PILLAR_TEXT = {
    concept: `DUNGEON HOME is a Minecraft server concept where every door is a level — and every cleared level becomes a room you own.

You wake in a Seed Hall with four sealed doors. Each seal tells you what waits beyond: a combat trial, a memory puzzle, a parkour gauntlet, an economy challenge.

Clear the trial — the door opens forever. A new room joins your dungeon, with its own sealed doors leading deeper. Sometimes a Keeper takes up residence inside.

Your base IS your progress. Your progress IS your base.

There is no open world. Only the dungeon you are building, one door at a time.`,

    pillars: `THE SEAL SYSTEM
Color = challenge · dots = tier. Plan with your party.

ROOM SHAPES
Chambers, halls, junctions, grand vaults — some dead-ends, some crossroads.

MEANINGFUL ROOMS
Combat → Sanctum · Puzzle → Chamber · Parkour → Well · Economy → Workshop.

KEEPERS
Architect issues quests. Loremaster trades lore for renown. Smith trades coins for renown.

RENOWN
One stat. Earned, not bought. Tier N doors require Renown level N.`,

    economy: `COINS, LORE, RENOWN — THREE HONEST SYSTEMS

COINS    Drop from every trial. Trade them to the Smith for renown,
         or save them for cosmetics. Hard cap: 9,999.

LORE     Fragments dropped after some trials. Read them in the Journal
         (J key), or trade them to the Loremaster — 1 fragment = 20 renown xp.

RENOWN   Your level. Rises with every cleared trial.
         Doors of tier N require Renown level N to open.
         It is earned, never bought — and it cannot be traded.

QUESTS   The Architect waits in the Seed Hall. He hands out one task
         at a time, and pays in coins + renown when you return to claim it.

NO DAILY QUESTS · NO FOMO · NO LOOT BOXES · NO POWER CREEP`,

    roadmap: `WHAT'S IN THE GAME

4 classes — each easier at one trial type
11 trial variants across 4 challenge types
5 room categories × 4 layout shapes
3 NPC roles with real services
Quest chain handed out by the Architect
12 lore fragments to collect
Depth-scaled door tiers
Minimap with pathways · scrollable journal`,
};