import type { Trial } from '../../types';
import { COLORS } from '../../constants';
import { player } from '../../state';
import { spawnBurst } from '../../particles';
import { SFX } from '../../audio';
import { move, drawArena, time } from '../shared';

type Coin = {
    x: number;
    y: number;
    vx: number;
    vy: number;
    got: boolean;
    cursed: boolean;
    phase: number;
    wobble: number;
};

export function makeGreedGauntlet(b: any, p: any, tier: number): Trial {
    const need = 4 + tier + (player.clazz.id === 'artisan' ? 1 : 0);
    const total = 9 + tier * 3;

    const coins: Coin[] = [];
    const cursedCount = Math.floor(total * 0.35);

    for (let i = 0; i < total; i++) {
        const cursed = i < cursedCount;
        const a = Math.random() * Math.PI * 2;
        const s = cursed
            ? 1.75 + tier * 0.2
            : 2.7 + tier * 0.35;

        coins.push({
            x: b.x + 70 + Math.random() * (b.w - 140),
            y: b.y + 70 + Math.random() * (b.h - 140),
            vx: Math.cos(a) * s,
            vy: Math.sin(a) * s,
            got: false,
            cursed,
            phase: Math.random() * Math.PI * 2,
            wobble: Math.random() * Math.PI * 2,
        });
    }

    coins.sort(() => Math.random() - 0.5);

    let collected = 0;
    let cursedFlash = 0;

    return {
        type: 'economy',
        variant: 'greed-gauntlet',
        player: p,
        bounds: b,
        title: `◆  GREED GAUNTLET · TIER ${tier}`,
        hint: `Collect ${need} gold coins · cursed coins steal progress`,

        update() {
            move(p, b, 1.12);

            if (cursedFlash > 0) cursedFlash = Math.max(0, cursedFlash - time.dt);

            for (const c of coins) {
                if (c.got) continue;

                c.phase += 0.10 * time.dt;
                c.wobble += (c.cursed ? 0.025 : 0.04) * time.dt;

                // Add life to movement.
                c.vx += Math.cos(c.wobble) * (c.cursed ? 0.014 : 0.025) * time.dt;
                c.vy += Math.sin(c.wobble * 1.21) * (c.cursed ? 0.014 : 0.025) * time.dt;

                c.x += c.vx * time.dt;
                c.y += c.vy * time.dt;

                // Clamp max speed.
                const sp = Math.hypot(c.vx, c.vy);
                const maxSp = c.cursed ? 2.8 + tier * 0.25 : 4.5 + tier * 0.35;
                if (sp > maxSp) {
                    c.vx = (c.vx / sp) * maxSp;
                    c.vy = (c.vy / sp) * maxSp;
                }

                // Bounds.
                if (c.x < b.x + 16) {
                    c.x = b.x + 16;
                    c.vx = Math.abs(c.vx);
                }
                if (c.x > b.x + b.w - 16) {
                    c.x = b.x + b.w - 16;
                    c.vx = -Math.abs(c.vx);
                }
                if (c.y < b.y + 16) {
                    c.y = b.y + 16;
                    c.vy = Math.abs(c.vy);
                }
                if (c.y > b.y + b.h - 16) {
                    c.y = b.y + b.h - 16;
                    c.vy = -Math.abs(c.vy);
                }

                if (Math.hypot(c.x - p.x, c.y - p.y) < 21) {
                    c.got = true;

                    if (c.cursed) {
                        collected = Math.max(0, collected - 1);
                        cursedFlash = 26;
                        SFX.fail();
                        spawnBurst(c.x, c.y, '#a14040', 20);
                    } else {
                        collected++;
                        SFX.coin(collected);
                        spawnBurst(c.x, c.y, '#c89b5a', 12);
                    }
                }
            }
        },

        draw(ctx) {
            drawArena(ctx, b, '#c89b5a');

            for (const c of coins) {
                if (c.got) continue;

                const r = c.cursed
                    ? 12 + Math.sin(c.phase * 0.8) * 1.4
                    : 11 + Math.sin(c.phase) * 2;

                const col = c.cursed ? '#a14040' : '#c89b5a';
                const stroke = c.cursed ? '#702020' : '#d8c9a0';

                ctx.fillStyle = col;
                ctx.strokeStyle = stroke;
                ctx.lineWidth = 2;
                ctx.shadowColor = col;
                ctx.shadowBlur = c.cursed ? 10 : 7;

                ctx.beginPath();
                ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();

                ctx.shadowBlur = 0;

                if (c.cursed) {
                    ctx.strokeStyle = '#2a0808';
                    ctx.lineWidth = 3;
                    ctx.beginPath();
                    ctx.moveTo(c.x - 6, c.y - 6);
                    ctx.lineTo(c.x + 6, c.y + 6);
                    ctx.moveTo(c.x + 6, c.y - 6);
                    ctx.lineTo(c.x - 6, c.y + 6);
                    ctx.stroke();
                } else {
                    ctx.fillStyle = 'rgba(255,245,186,0.75)';
                    ctx.beginPath();
                    ctx.arc(c.x - 3, c.y - 3, 2, 0, Math.PI * 2);
                    ctx.fill();
                }
            }

            ctx.fillStyle = COLORS.text;
            ctx.font = 'bold 16px "JetBrains Mono", monospace';
            ctx.textAlign = 'center';
            ctx.fillText(`${collected} / ${need}  GOLD`, b.x + b.w / 2, b.y + 36);

            if (cursedFlash > 0) {
                ctx.fillStyle = `rgba(161,64,64,${cursedFlash / 52})`;
                ctx.fillRect(b.x, b.y, b.w, b.h);
            }
        },

        isComplete() {
            return collected >= need;
        },
    };
}