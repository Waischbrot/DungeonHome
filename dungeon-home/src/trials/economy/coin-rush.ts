import type { Trial } from '../../types';
import { COLORS } from '../../constants';
import { player } from '../../state';
import { spawnBurst } from '../../particles';
import { SFX } from '../../audio';
import { move, drawArena } from '../shared';

export function makeCoinRush(b: any, p: any, tier: number): Trial {
    const count = 5 + tier + (player.clazz.id === 'artisan' ? 1 : 0);
    const coins: any[] = [];
    for (let i = 0; i < count; i++) coins.push({
        x: b.x + 60 + Math.random() * (b.w - 120),
        y: b.y + 60 + Math.random() * (b.h - 120),
        vx: (Math.random() - 0.5) * 1.8, vy: (Math.random() - 0.5) * 1.8,
        got: false, phase: Math.random() * Math.PI * 2,
    });
    return {
        type: 'economy', variant: 'coin-rush', player: p, bounds: b,
        title: `◆  COIN RUSH · TIER ${tier}`,
        hint: `Collect all ${count} coins`,
        update() {
            move(p, b);
            for (const c of coins) {
                if (c.got) continue;
                c.phase += 0.06;
                c.x += c.vx; c.y += c.vy;
                if (c.x < b.x + 14 || c.x > b.x + b.w - 14) c.vx *= -1;
                if (c.y < b.y + 14 || c.y > b.y + b.h - 14) c.vy *= -1;
                if (Math.hypot(c.x - p.x, c.y - p.y) < 18) {
                    c.got = true; SFX.coin(coins.filter(x => x.got).length);
                    spawnBurst(c.x, c.y, '#c89b5a', 12);
                }
            }
        },
        draw(ctx) {
            drawArena(ctx, b, '#c89b5a');
            for (const c of coins) {
                if (c.got) continue;
                const r = 11 + Math.sin(c.phase) * 2;
                ctx.fillStyle = '#c89b5a'; ctx.strokeStyle = '#d8c9a0'; ctx.lineWidth = 2;
                ctx.shadowColor = '#c89b5a'; ctx.shadowBlur = 6;
                ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
                ctx.shadowBlur = 0;
            }
            const got = coins.filter(c => c.got).length;
            ctx.fillStyle = COLORS.text;
            ctx.font = 'bold 16px "JetBrains Mono", monospace';
            ctx.textAlign = 'center';
            ctx.fillText(`${got} / ${coins.length}`, b.x + b.w / 2, b.y + 36);
        },
        isComplete() { return coins.every(c => c.got); },
    };
}