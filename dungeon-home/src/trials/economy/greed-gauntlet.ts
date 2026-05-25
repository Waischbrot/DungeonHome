import type { Trial } from '../../types';
import { COLORS } from '../../constants';
import { player } from '../../state';
import { spawnBurst } from '../../particles';
import { SFX } from '../../audio';
import { move, drawArena } from '../shared';

export function makeGreedGauntlet(b: any, p: any, tier: number): Trial {
    const need = 4 + tier + (player.clazz.id === 'artisan' ? 1 : 0);
    const total = 8 + tier * 2;
    type Coin = { x: number; y: number; vx: number; vy: number; got: boolean; cursed: boolean; phase: number };
    const coins: Coin[] = [];
    for (let i = 0; i < total; i++) coins.push({
        x: b.x + 60 + Math.random() * (b.w - 120),
        y: b.y + 60 + Math.random() * (b.h - 120),
        vx: (Math.random() - 0.5) * 1.5, vy: (Math.random() - 0.5) * 1.5,
        got: false,
        cursed: i < Math.floor(total * 0.4),
        phase: Math.random() * Math.PI * 2,
    });
    coins.sort(() => Math.random() - 0.5);
    let collected = 0, cursedFlash = 0;
    return {
        type: 'economy', variant: 'greed-gauntlet', player: p, bounds: b,
        title: `◆  GREED GAUNTLET · TIER ${tier}`,
        hint: `Collect ${need} GOLD coins · cursed ones cost you 2`,
        update() {
            move(p, b);
            if (cursedFlash > 0) cursedFlash--;
            for (const c of coins) {
                if (c.got) continue;
                c.phase += 0.06;
                c.x += c.vx; c.y += c.vy;
                if (c.x < b.x + 14 || c.x > b.x + b.w - 14) c.vx *= -1;
                if (c.y < b.y + 14 || c.y > b.y + b.h - 14) c.vy *= -1;
                if (Math.hypot(c.x - p.x, c.y - p.y) < 18) {
                    c.got = true;
                    if (c.cursed) {
                        collected = Math.max(0, collected - 2);
                        cursedFlash = 30; SFX.fail();
                        spawnBurst(c.x, c.y, '#a14040', 20);
                    } else {
                        collected++; SFX.coin(collected);
                        spawnBurst(c.x, c.y, '#c89b5a', 12);
                    }
                }
            }
        },
        draw(ctx) {
            drawArena(ctx, b, '#c89b5a');
            for (const c of coins) {
                if (c.got) continue;
                const r = 11 + Math.sin(c.phase) * 2;
                const col    = c.cursed ? '#a14040' : '#c89b5a';
                const stroke = c.cursed ? '#702020' : '#d8c9a0';
                ctx.fillStyle = col; ctx.strokeStyle = stroke; ctx.lineWidth = 2;
                ctx.shadowColor = col; ctx.shadowBlur = 6;
                ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
                ctx.shadowBlur = 0;
                if (c.cursed) {
                    ctx.strokeStyle = '#702020'; ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(c.x - 5, c.y - 5); ctx.lineTo(c.x + 5, c.y + 5);
                    ctx.moveTo(c.x + 5, c.y - 5); ctx.lineTo(c.x - 5, c.y + 5);
                    ctx.stroke();
                }
            }
            ctx.fillStyle = COLORS.text;
            ctx.font = 'bold 16px "JetBrains Mono", monospace';
            ctx.textAlign = 'center';
            ctx.fillText(`${collected} / ${need}  collected`, b.x + b.w / 2, b.y + 36);
            if (cursedFlash > 0) {
                ctx.fillStyle = `rgba(161,64,64,${cursedFlash / 60})`;
                ctx.fillRect(b.x, b.y, b.w, b.h);
            }
        },
        isComplete() { return collected >= need; },
    };
}