import type { Trial } from '../../types';
import { COLORS } from '../../constants';
import { spawnBurst } from '../../particles';
import { beep } from '../../audio';
import { move, drawArena } from '../shared';

type Plate = { x: number; y: number; warmth: number };

export function makeCoinPress(b: any, p: any, tier: number): Trial {
    // ── Layout ──────────────────────────────────────────────────
    const numPlates = 3 + tier;                                   // T1=4 · T2=5 · T3=6
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2 + 14;
    // Radius shrinks at higher tiers → less travel time per hop, helps balance the extra plate
    const radiusFactor = 0.24 - tier * 0.02;                      // T1=.22 · T2=.20 · T3=.18
    const radius = Math.min(b.w, b.h) * radiusFactor;

    const plates: Plate[] = [];
    for (let i = 0; i < numPlates; i++) {
        const a = (i / numPlates) * Math.PI * 2 - Math.PI / 2;      // start at top, clockwise
        plates.push({ x: cx + Math.cos(a) * radius, y: cy + Math.sin(a) * radius, warmth: 0 });
    }

    // Spawn in the centre — every plate is one short hop away
    p.x = cx; p.y = cy;

    // ── Tuning — equilibrium-safe even at tier 3 ────────────────
    const MAX_WARMTH  = 100;
    const THRESHOLD   = 25;                                       // counts as "warm"
    const LOW_WARN    = 50;                                       // amber halo below this
    const DECAY_RATE  = 0.12 + tier * 0.04;                       // T1 .16 · T2 .20 · T3 .24
    const HEAT_RATE   = 12;                                       // 0→100 in ~9 frames
    const HOLD_TARGET = 60 * (3 + tier);                          // 4 / 5 / 6 seconds

    let holdProgress = 0;
    let pulseT = 0;
    let lastBeepBucket = -1;
    let won = false;

    return {
        type: 'economy', variant: 'coin-press', player: p, bounds: b,
        title: `◆  COIN PRESS · TIER ${tier}`,
        hint: `Warm all ${numPlates} plates, then keep them warm for ${3 + tier}s`,

        update() {
            pulseT++;
            if (won) return;
            move(p, b);

            // Decay every plate
            for (const pl of plates) pl.warmth = Math.max(0, pl.warmth - DECAY_RATE);

            // Heat the plate the player is touching
            for (const pl of plates) {
                if (Math.hypot(p.x - pl.x, p.y - pl.y) < 30) {
                    pl.warmth = Math.min(MAX_WARMTH, pl.warmth + HEAT_RATE);
                    break;
                }
            }

            const allWarm = plates.every(pl => pl.warmth >= THRESHOLD);
            if (allWarm) {
                holdProgress++;
                // Audible tick every half-second so you feel the progress
                const bucket = Math.floor(holdProgress / 30);
                if (bucket !== lastBeepBucket) {
                    lastBeepBucket = bucket;
                    beep(500 + bucket * 40, 0.05, 'sine', 0.02);
                    spawnBurst(cx, cy, '#c89b5a', 3);
                }
            } else {
                holdProgress = Math.max(0, holdProgress - 0.5);          // forgiving drain
                lastBeepBucket = -1;
            }

            if (holdProgress >= HOLD_TARGET) {
                won = true;
                beep(800, 0.25, 'sine');
                spawnBurst(cx, cy, '#c89b5a', 40);
            }
        },

        draw(ctx) {
            drawArena(ctx, b, '#c89b5a');

            // Anchor ring at the press centre
            ctx.strokeStyle = 'rgba(200,155,90,0.25)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(cx, cy, radius - 30, 0, Math.PI * 2);
            ctx.stroke();

            // Plates
            for (const pl of plates) {
                const ratio  = pl.warmth / MAX_WARMTH;
                const isWarm = pl.warmth >= THRESHOLD;
                const isLow  = isWarm && pl.warmth < LOW_WARN;

                // outer dark ring
                ctx.fillStyle = '#3a2a18';
                ctx.beginPath(); ctx.arc(pl.x, pl.y, 32, 0, Math.PI * 2); ctx.fill();

                // base disc
                ctx.fillStyle = isWarm ? '#c89b5a' : '#2a2218';
                if (isWarm) { ctx.shadowColor = '#c89b5a'; ctx.shadowBlur = 8 + 12 * ratio; }
                ctx.beginPath(); ctx.arc(pl.x, pl.y, 28, 0, Math.PI * 2); ctx.fill();
                ctx.shadowBlur = 0;

                // warmth gauge — clockwise from 12 o'clock
                ctx.strokeStyle = isWarm ? '#fff5ba' : '#5a4030';
                ctx.lineWidth   = 4;
                ctx.beginPath();
                ctx.arc(pl.x, pl.y, 24, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ratio);
                ctx.stroke();

                // coin glyph — slight pulse when warm
                const pulse = isWarm ? (1 + Math.sin(pulseT / 6) * 0.08) : 1;
                ctx.fillStyle = isWarm ? '#3a2410' : '#5a4030';
                ctx.font = `bold ${Math.round(24 * pulse)}px serif`;
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText('◆', pl.x, pl.y + 1);

                // Cold border — bright urgent red
                if (!isWarm) {
                    const wave = 0.5 + Math.sin(pulseT / 7) * 0.3;
                    ctx.strokeStyle = `rgba(161,64,64,${wave})`;
                    ctx.lineWidth = 3;
                    ctx.beginPath(); ctx.arc(pl.x, pl.y, 33, 0, Math.PI * 2); ctx.stroke();
                }
                // Cooling-soon border — gentle amber
                else if (isLow) {
                    const wave = 0.4 + Math.sin(pulseT / 12) * 0.3;
                    ctx.strokeStyle = `rgba(212,168,81,${wave})`;
                    ctx.lineWidth = 2;
                    ctx.beginPath(); ctx.arc(pl.x, pl.y, 33, 0, Math.PI * 2); ctx.stroke();
                }
            }

            // Hold progress bar
            const pbW = 320, pbH = 14;
            const pbX = b.x + b.w / 2 - pbW / 2;
            const pbY = b.y + b.h - 38;
            ctx.fillStyle = '#1a1410'; ctx.fillRect(pbX - 2, pbY - 2, pbW + 4, pbH + 4);
            ctx.fillStyle = '#4a4238'; ctx.fillRect(pbX, pbY, pbW, pbH);
            ctx.fillStyle = '#c89b5a';
            ctx.fillRect(pbX, pbY, pbW * Math.min(1, holdProgress / HOLD_TARGET), pbH);
            ctx.strokeStyle = '#e8dcc0'; ctx.lineWidth = 1;
            ctx.strokeRect(pbX, pbY, pbW, pbH);

            // Live countdown / call-to-action above the bar
            const warm = plates.filter(pl => pl.warmth >= THRESHOLD).length;
            const remaining = Math.max(0, (HOLD_TARGET - holdProgress) / 60);
            ctx.fillStyle = COLORS.text;
            ctx.font = 'bold 14px "JetBrains Mono", monospace';
            ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
            if (warm < plates.length) {
                ctx.fillText('WARM ALL PLATES TO START', b.x + b.w / 2, pbY - 6);
            } else {
                ctx.fillText(`HOLD  ${remaining.toFixed(1)}s  LEFT`, b.x + b.w / 2, pbY - 6);
            }

            // Header status
            ctx.font = 'bold 16px "JetBrains Mono", monospace';
            ctx.fillText(`${warm} / ${plates.length}  WARM`, b.x + b.w / 2, b.y + 36);
        },

        isComplete() { return won; },
    };
}