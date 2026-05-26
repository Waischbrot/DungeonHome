import type { Trial } from '../../types';
import { COLORS } from '../../constants';
import { spawnBurst } from '../../particles';
import { beep } from '../../audio';
import { move, drawArena, time } from '../shared';

type Plate = {
    x: number;
    y: number;
    warmth: number;
};

export function makeCoinPress(b: any, p: any, tier: number): Trial {
    const numPlates = 3 + tier;
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2 + 10;

    const radiusFactor = tier === 1 ? 0.23 : tier === 2 ? 0.205 : 0.18;
    const radius = Math.min(b.w, b.h) * radiusFactor;

    const plates: Plate[] = [];

    for (let i = 0; i < numPlates; i++) {
        const a = (i / numPlates) * Math.PI * 2 - Math.PI / 2;
        plates.push({
            x: cx + Math.cos(a) * radius,
            y: cy + Math.sin(a) * radius,
            warmth: 0,
        });
    }

    p.x = cx;
    p.y = cy;

    const MAX_WARMTH = 100;
    const THRESHOLD = 30;
    const LOW_WARN = 58;

    // Important tuning:
    // These now cool down fast enough that you must keep rotating.
    // But HEAT_RATE is high enough that quick taps still work.
    const DECAY_RATE = 0.23 + tier * 0.075;    // T1 .305 · T2 .38 · T3 .455
    const HEAT_RATE = 18;                      // fast refill

    const HOLD_TARGET = 60 * (2.25 + tier);    // T1 3.25s · T2 4.25s · T3 5.25s

    let holdProgress = 0;
    let pulseT = 0;
    let lastBeepBucket = -1;
    let won = false;

    function warmCount() {
        return plates.filter(pl => pl.warmth >= THRESHOLD).length;
    }

    return {
        type: 'economy',
        variant: 'coin-press',
        player: p,
        bounds: b,
        title: `◆  COIN PRESS · TIER ${tier}`,
        hint: `Warm all ${numPlates} plates, then keep rotating`,

        update() {
            pulseT += time.dt;
            if (won) return;

            move(p, b, 1.12);

            for (const pl of plates) {
                pl.warmth = Math.max(0, pl.warmth - DECAY_RATE * time.dt);
            }

            for (const pl of plates) {
                if (Math.hypot(p.x - pl.x, p.y - pl.y) < 32) {
                    pl.warmth = Math.min(MAX_WARMTH, pl.warmth + HEAT_RATE * time.dt);
                    break;
                }
            }

            const allWarm = plates.every(pl => pl.warmth >= THRESHOLD);

            if (allWarm) {
                holdProgress += time.dt;

                const bucket = Math.floor(holdProgress / 30);
                if (bucket !== lastBeepBucket) {
                    lastBeepBucket = bucket;
                    beep(500 + bucket * 35, 0.05, 'sine', 0.025);
                    spawnBurst(cx, cy, '#c89b5a', 4);
                }
            } else {
                // Losing rhythm should matter.
                holdProgress = Math.max(0, holdProgress - 1.2 * time.dt);
                lastBeepBucket = -1;
            }

            if (holdProgress >= HOLD_TARGET) {
                won = true;
                beep(800, 0.25, 'sine');
                spawnBurst(cx, cy, '#c89b5a', 42);
            }
        },

        draw(ctx) {
            drawArena(ctx, b, '#c89b5a');

            ctx.strokeStyle = 'rgba(200,155,90,0.25)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(cx, cy, Math.max(12, radius - 30), 0, Math.PI * 2);
            ctx.stroke();

            ctx.strokeStyle = 'rgba(200,155,90,0.10)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            for (let i = 0; i < plates.length; i++) {
                const pl = plates[i];
                if (i === 0) ctx.moveTo(pl.x, pl.y);
                else ctx.lineTo(pl.x, pl.y);
            }
            ctx.closePath();
            ctx.stroke();

            for (const pl of plates) {
                const ratio = pl.warmth / MAX_WARMTH;
                const isWarm = pl.warmth >= THRESHOLD;
                const isLow = isWarm && pl.warmth < LOW_WARN;

                ctx.fillStyle = 'rgba(0,0,0,0.42)';
                ctx.beginPath();
                ctx.ellipse(pl.x, pl.y + 30, 28, 7, 0, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = '#3a2a18';
                ctx.beginPath();
                ctx.arc(pl.x, pl.y, 34, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = isWarm ? '#c89b5a' : '#2a2218';
                if (isWarm) {
                    ctx.shadowColor = '#c89b5a';
                    ctx.shadowBlur = 8 + 14 * ratio;
                }
                ctx.beginPath();
                ctx.arc(pl.x, pl.y, 29, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;

                ctx.strokeStyle = isWarm ? '#fff5ba' : '#5a4030';
                ctx.lineWidth = 5;
                ctx.beginPath();
                ctx.arc(pl.x, pl.y, 24, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ratio);
                ctx.stroke();

                const pulse = isWarm ? (1 + Math.sin(pulseT / 6) * 0.08) : 1;
                ctx.fillStyle = isWarm ? '#3a2410' : '#5a4030';
                ctx.font = `bold ${Math.round(24 * pulse)}px serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('◆', pl.x, pl.y + 1);

                if (!isWarm) {
                    const wave = 0.55 + Math.sin(pulseT / 7) * 0.28;
                    ctx.strokeStyle = `rgba(161,64,64,${wave})`;
                    ctx.lineWidth = 3;
                    ctx.beginPath();
                    ctx.arc(pl.x, pl.y, 35, 0, Math.PI * 2);
                    ctx.stroke();
                } else if (isLow) {
                    const wave = 0.35 + Math.sin(pulseT / 12) * 0.25;
                    ctx.strokeStyle = `rgba(212,168,81,${wave})`;
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.arc(pl.x, pl.y, 35, 0, Math.PI * 2);
                    ctx.stroke();
                }
            }

            const pbW = 340;
            const pbH = 14;
            const pbX = b.x + b.w / 2 - pbW / 2;
            const pbY = b.y + b.h - 40;

            ctx.fillStyle = '#1a1410';
            ctx.fillRect(pbX - 2, pbY - 2, pbW + 4, pbH + 4);

            ctx.fillStyle = '#4a4238';
            ctx.fillRect(pbX, pbY, pbW, pbH);

            ctx.fillStyle = '#c89b5a';
            ctx.fillRect(pbX, pbY, pbW * Math.min(1, holdProgress / HOLD_TARGET), pbH);

            ctx.strokeStyle = '#e8dcc0';
            ctx.lineWidth = 1;
            ctx.strokeRect(pbX, pbY, pbW, pbH);

            const warm = warmCount();
            const remaining = Math.max(0, (HOLD_TARGET - holdProgress) / 60);

            ctx.fillStyle = COLORS.text;
            ctx.font = 'bold 14px "JetBrains Mono", monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'alphabetic';

            if (warm < plates.length) {
                ctx.fillText('WARM ALL PLATES TO START THE PRESS', b.x + b.w / 2, pbY - 7);
            } else {
                ctx.fillText(`HOLD THE RHYTHM  ·  ${remaining.toFixed(1)}s`, b.x + b.w / 2, pbY - 7);
            }

            ctx.font = 'bold 16px "JetBrains Mono", monospace';
            ctx.fillText(`${warm} / ${plates.length}  WARM`, b.x + b.w / 2, b.y + 36);
        },

        isComplete() {
            return won;
        },
    };
}