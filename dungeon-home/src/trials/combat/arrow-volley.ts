import type { Trial } from '../../types';
import { COLORS } from '../../constants';
import { player } from '../../state';
import { spawnBurst } from '../../particles';
import { beep, SFX } from '../../audio';
import { move, drawArena } from '../shared';

type Arrow   = { x: number; y: number; vx: number; alive: boolean };
type Pattern = 'stream' | 'comb' | 'sweep-down' | 'sweep-up' | 'aimed';

export function makeArrowVolley(b: any, p: any, tier: number): Trial {
    p.x = b.x + b.w - 30;
    p.y = b.y + b.h / 2;
    const goal = { x: b.x + 40, y: b.y + b.h / 2, r: 26 };

    // Lanes — 7 across all tiers (safe-zone between is ~40 px)
    const numLanes = 7;
    const lanes: number[] = [];
    for (let i = 0; i < numLanes; i++) {
        lanes.push(b.y + (b.h * (i + 1)) / (numLanes + 1));
    }

    // Arrows fly meaningfully faster than the player at every tier.
    const wayfarerEase = player.clazz.id === 'wayfarer' ? 0.85 : 1;
    const arrowSpeed   = (5 + tier * 1.3) * wayfarerEase;   // T1=6.3 · T2=7.6 · T3=8.9
    const HIT_RADIUS   = 14;

    const arrows: Arrow[] = [];
    let hitFlash = 0;
    let won = false;

    function fire(lane: number, offsetX = 0) {
        arrows.push({ x: b.x + 8 - offsetX, y: lanes[lane], vx: arrowSpeed, alive: true });
    }

    // ── Pattern scheduler ──────────────────────────────────────
    // Stream is repeated in the bag so the game always has rolling pressure,
    // and bigger set-pieces (comb/sweep/aimed) cycle in between.
    const PATTERN_BAG: Pattern[] = [
        'stream', 'stream', 'sweep-down', 'stream',
        'comb',   'stream', 'sweep-up',   'stream', 'aimed',
    ];
    let bagIdx       = 0;
    let pattern: Pattern = 'stream';
    let patternTimer = 90;
    let patternStep  = 0;
    let nextFire     = 15;

    function pickPattern() {
        pattern      = PATTERN_BAG[bagIdx % PATTERN_BAG.length];
        bagIdx++;
        patternTimer = 90 + Math.floor(Math.random() * 60);   // 1.5–2.5 s of this pattern
        patternStep  = 0;
        nextFire     = 6;
    }

    // ── Lane warning markers — flash on a lane right before a comb fires
    const warnings: { lane: number; t: number }[] = [];
    function warn(lane: number) { warnings.push({ lane, t: 18 }); }

    return {
        type: 'combat', variant: 'arrow-volley', player: p, bounds: b,
        title: `⚔  ARROW VOLLEY · TIER ${tier}`,
        hint: 'Dodge through the volleys to reach the green pad',

        update() {
            if (!won) move(p, b);
            if (hitFlash > 0) hitFlash--;

            // Pattern lifecycle
            patternTimer--;
            if (patternTimer <= 0) pickPattern();

            // Decay warning markers
            for (const w of warnings) w.t--;
            for (let i = warnings.length - 1; i >= 0; i--) if (warnings[i].t <= 0) warnings.splice(i, 1);

            // Fire control
            nextFire--;
            if (nextFire <= 0) {
                switch (pattern) {
                    case 'stream': {
                        fire(Math.floor(Math.random() * numLanes));
                        nextFire = Math.max(7, 18 - tier * 2);              // T1 16 · T2 14 · T3 12 frames
                        break;
                    }
                    case 'sweep-down': {
                        if (patternStep < numLanes) {
                            fire(patternStep);
                            patternStep++;
                            nextFire = 9;
                        } else {
                            nextFire = 24;
                            pattern = 'stream';                                // dissolve into stream
                        }
                        break;
                    }
                    case 'sweep-up': {
                        if (patternStep < numLanes) {
                            fire(numLanes - 1 - patternStep);
                            patternStep++;
                            nextFire = 9;
                        } else {
                            nextFire = 24;
                            pattern = 'stream';
                        }
                        break;
                    }
                    case 'comb': {
                        // Telegraph: highlight which lanes are about to fire (everyone except 'safe')
                        const safe = Math.floor(Math.random() * numLanes);
                        if (patternStep === 0) {
                            for (let i = 0; i < numLanes; i++) if (i !== safe) warn(i);
                            patternStep = 1;
                            nextFire = 22;                                     // warn-window before salvo
                        } else {
                            for (let i = 0; i < numLanes; i++) if (i !== safe) fire(i);
                            SFX.fail();                                        // soft "whoosh" via existing fail beep
                            nextFire = 60;                                     // breather after the salvo
                            patternStep = 0;
                            pattern = 'stream';
                        }
                        break;
                    }
                    case 'aimed': {
                        // Three arrows centred on the player's current lane
                        let closest = 0, best = Infinity;
                        for (let i = 0; i < numLanes; i++) {
                            const d = Math.abs(lanes[i] - p.y);
                            if (d < best) { best = d; closest = i; }
                        }
                        warn(closest);
                        if (patternStep === 0) {
                            patternStep = 1; nextFire = 16;                    // brief warn before the volley
                        } else {
                            fire(Math.max(0, closest - 1));
                            fire(closest);
                            fire(Math.min(numLanes - 1, closest + 1));
                            patternStep = 0;
                            nextFire = 70;
                            pattern = 'stream';
                        }
                        break;
                    }
                }
            }

            // Move + check arrows
            for (const a of arrows) {
                if (!a.alive) continue;
                a.x += a.vx;
                if (a.x > b.x + b.w + 20) { a.alive = false; continue; }
                if (!won &&
                    Math.abs(a.y - p.y) < HIT_RADIUS &&
                    Math.abs(a.x - p.x) < HIT_RADIUS) {
                    p.x = b.x + b.w - 30; p.y = b.y + b.h / 2;
                    hitFlash = 24; SFX.fail();
                    // Sweep the field so you don't respawn straight into the salvo
                    for (const a2 of arrows) a2.alive = false;
                    break;
                }
            }
            for (let i = arrows.length - 1; i >= 0; i--) if (!arrows[i].alive) arrows.splice(i, 1);

            // Win check
            if (!won && Math.hypot(p.x - goal.x, p.y - goal.y) < goal.r) {
                won = true;
                beep(800, 0.25, 'sine');
                spawnBurst(goal.x, goal.y, '#6f8a52', 35);
            }
        },

        draw(ctx) {
            drawArena(ctx, b, '#a14040');

            // Lane guides — visible enough to read at a glance
            ctx.strokeStyle = 'rgba(161,64,64,0.30)';
            ctx.lineWidth = 1;
            ctx.setLineDash([6, 6]);
            for (const ly of lanes) {
                ctx.beginPath(); ctx.moveTo(b.x + 8, ly); ctx.lineTo(b.x + b.w - 8, ly); ctx.stroke();
            }
            ctx.setLineDash([]);

            // Quivers on the left wall — flash brighter on lanes about to fire
            for (let i = 0; i < numLanes; i++) {
                const ly = lanes[i];
                const warning = warnings.find(w => w.lane === i);
                if (warning) {
                    const pulse = 0.6 + Math.sin(Date.now() / 50) * 0.4;
                    ctx.fillStyle = `rgba(201, 80, 80, ${pulse})`;
                    ctx.fillRect(b.x - 6, ly - 12, 10, 24);
                }
                ctx.fillStyle = '#3a2410';
                ctx.fillRect(b.x - 2, ly - 8, 6, 16);
                ctx.fillStyle = '#c89b5a';
                ctx.fillRect(b.x,     ly - 6, 2, 12);
            }

            // Start pad (right) — where you respawn
            ctx.strokeStyle = 'rgba(200,155,90,0.4)';
            ctx.strokeRect(b.x + b.w - 42, b.y + b.h / 2 - 24, 24, 48);

            // Goal pad (left)
            ctx.fillStyle = won ? '#6f8a52' : '#1a3520';
            ctx.strokeStyle = '#6f8a52'; ctx.lineWidth = 2;
            ctx.shadowColor = '#6f8a52'; ctx.shadowBlur = 12;
            ctx.beginPath(); ctx.arc(goal.x, goal.y, goal.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            ctx.shadowBlur = 0;

            // Arrows
            for (const a of arrows) {
                if (!a.alive) continue;
                // shaft
                ctx.fillStyle = '#c89b5a';
                ctx.fillRect(a.x - 8, a.y - 1, 14, 2);
                // arrowhead
                ctx.fillStyle = '#9090a0';
                ctx.beginPath();
                ctx.moveTo(a.x + 6, a.y - 4);
                ctx.lineTo(a.x + 12, a.y);
                ctx.lineTo(a.x + 6, a.y + 4);
                ctx.closePath();
                ctx.fill();
                // fletching
                ctx.fillStyle = '#7a2828';
                ctx.beginPath();
                ctx.moveTo(a.x - 8, a.y - 3);
                ctx.lineTo(a.x - 12, a.y);
                ctx.lineTo(a.x - 8, a.y + 3);
                ctx.closePath();
                ctx.fill();
            }

            ctx.fillStyle = COLORS.text;
            ctx.font = 'bold 14px "JetBrains Mono", monospace';
            ctx.textAlign = 'center';
            ctx.fillText('REACH THE GOAL', b.x + b.w / 2, b.y + 36);

            if (hitFlash > 0) {
                ctx.fillStyle = `rgba(161,64,64,${hitFlash / 40})`;
                ctx.fillRect(b.x, b.y, b.w, b.h);
            }
        },

        isComplete() { return won; },
    };
}