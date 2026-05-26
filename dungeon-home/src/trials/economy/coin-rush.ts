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
    phase: number;
    wobble: number;
};

export function makeCoinRush(b: any, p: any, tier: number): Trial {
    const count = 6 + tier * 2 + (player.clazz.id === 'artisan' ? 1 : 0);
    const coins: Coin[] = [];

    const baseSpeed = 2.4 + tier * 0.35;

    for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = baseSpeed * (0.75 + Math.random() * 0.6);

        coins.push({
            x: b.x + 70 + Math.random() * (b.w - 140),
            y: b.y + 70 + Math.random() * (b.h - 140),
            vx: Math.cos(a) * s,
            vy: Math.sin(a) * s,
            got: false,
            phase: Math.random() * Math.PI * 2,
            wobble: Math.random() * Math.PI * 2,
        });
    }

    return {
        type: 'economy',
        variant: 'coin-rush',
        player: p,
        bounds: b,
        title: `◆  COIN RUSH · TIER ${tier}`,
        hint: `Collect all ${count} coins`,

        update() {
            move(p, b, 1.15);

            for (const c of coins) {
                if (c.got) continue;

                c.phase += 0.12 * time.dt;
                c.wobble += 0.035 * time.dt;

                // Coins visibly drift/wander instead of floating lazily.
                c.vx += Math.cos(c.wobble) * 0.025 * time.dt;
                c.vy += Math.sin(c.wobble * 1.17) * 0.025 * time.dt;

                // Very close magnet, not global magnet.
                const dx = p.x - c.x;
                const dy = p.y - c.y;
                const d = Math.hypot(dx, dy) || 1;

                if (d < 55) {
                    c.vx += (dx / d) * 0.16 * time.dt;
                    c.vy += (dy / d) * 0.16 * time.dt;
                }

                // Minimal damping so motion stays alive.
                const damp = Math.pow(0.996, time.dt);
                c.vx *= damp;
                c.vy *= damp;

                // Clamp max speed so magnet does not explode.
                const sp = Math.hypot(c.vx, c.vy);
                const maxSp = 4.2 + tier * 0.35;
                if (sp > maxSp) {
                    c.vx = (c.vx / sp) * maxSp;
                    c.vy = (c.vy / sp) * maxSp;
                }

                c.x += c.vx * time.dt;
                c.y += c.vy * time.dt;

                // Strong bounces.
                if (c.x < b.x + 16) {
                    c.x = b.x + 16;
                    c.vx = Math.abs(c.vx) * 1.03;
                }
                if (c.x > b.x + b.w - 16) {
                    c.x = b.x + b.w - 16;
                    c.vx = -Math.abs(c.vx) * 1.03;
                }
                if (c.y < b.y + 16) {
                    c.y = b.y + 16;
                    c.vy = Math.abs(c.vy) * 1.03;
                }
                if (c.y > b.y + b.h - 16) {
                    c.y = b.y + b.h - 16;
                    c.vy = -Math.abs(c.vy) * 1.03;
                }

                if (Math.hypot(c.x - p.x, c.y - p.y) < 21) {
                    c.got = true;
                    SFX.coin(coins.filter(x => x.got).length);
                    spawnBurst(c.x, c.y, '#c89b5a', 12);
                }
            }
        },

        draw(ctx) {
            drawArena(ctx, b, '#c89b5a');

            for (const c of coins) {
                if (c.got) continue;

                const r = 11 + Math.sin(c.phase) * 2;

                ctx.fillStyle = '#c89b5a';
                ctx.strokeStyle = '#d8c9a0';
                ctx.lineWidth = 2;
                ctx.shadowColor = '#c89b5a';
                ctx.shadowBlur = 8;

                ctx.beginPath();
                ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();

                ctx.shadowBlur = 0;

                ctx.fillStyle = 'rgba(255,245,186,0.75)';
                ctx.beginPath();
                ctx.arc(c.x - 3, c.y - 3, 2, 0, Math.PI * 2);
                ctx.fill();
            }

            const got = coins.filter(c => c.got).length;

            ctx.fillStyle = COLORS.text;
            ctx.font = 'bold 16px "JetBrains Mono", monospace';
            ctx.textAlign = 'center';
            ctx.fillText(`${got} / ${coins.length}`, b.x + b.w / 2, b.y + 36);
        },

        isComplete() {
            return coins.every(c => c.got);
        },
    };
}