import type { Trial, ChallengeType, TrialVariant } from '../types';
import { I_X, I_Y, I_W, I_H } from './shared';

// ── Combat ──
import { makeShadowHunt }  from './combat/shadow-hunt';
import { makeBossDuel }    from './combat/boss-duel';
import { makeWaveDefense } from './combat/wave-defense';
import { makeArrowVolley } from './combat/arrow-volley';

// ── Puzzle ──
import { makeMemorySeal }   from './puzzle/memory-seal';
import { makePatternMatch } from './puzzle/pattern-match';
import { makeRuneCipher }   from './puzzle/rune-cipher';
import { makeLightsOut }    from './puzzle/lights-out';
import { makeMirrorBeam }   from './puzzle/mirror-beam';

// ── Parkour ──
import { makeMovingWalls }   from './parkour/moving-walls';
import { makeSpikeFloor }    from './parkour/spike-floor';
import { makePendulumPath }  from './parkour/pendulum-path';
import { makeFallingFloor }  from './parkour/falling-floor';
import { makeMaze } from './parkour/maze';

// ── Economy ──
import { makeCoinRush }      from './economy/coin-rush';
import { makeGreedGauntlet } from './economy/greed-gauntlet';
import { makeCoinPress }     from './economy/coin-press';

const MAKERS: Record<TrialVariant, (b: any, p: any, tier: number) => Trial> = {
    'shadow-hunt':    makeShadowHunt,
    'boss-duel':      makeBossDuel,
    'wave-defense':   makeWaveDefense,
    'arrow-volley':   makeArrowVolley,
    'memory-seal':    makeMemorySeal,
    'pattern-match':  makePatternMatch,
    'rune-cipher':    makeRuneCipher,
    'lights-out':     makeLightsOut,
    'mirror-beam':    makeMirrorBeam,
    'maze': makeMaze,
    'moving-walls':   makeMovingWalls,
    'spike-floor':    makeSpikeFloor,
    'pendulum-path':  makePendulumPath,
    'falling-floor':  makeFallingFloor,
    'coin-rush':      makeCoinRush,
    'greed-gauntlet': makeGreedGauntlet,
    'coin-press':     makeCoinPress,
};

// Variant is now passed in from the door's seal so re-entries
// always produce the same kind of trial.
export function createTrial(_type: ChallengeType, tier: number, variant: TrialVariant): Trial {
    const bounds = { x: I_X, y: I_Y, w: I_W, h: I_H };
    const ply    = { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h - 40 };
    return MAKERS[variant](bounds, ply, tier);
}