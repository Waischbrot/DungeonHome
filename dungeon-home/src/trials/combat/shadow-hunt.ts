import type { Trial } from '../../types';
import { COLORS } from '../../constants';
import { player } from '../../state';
import { spawnBurst } from '../../particles';
import { SFX } from '../../audio';
import { move, drawArena } from '../shared';

export function makeShadowHunt(b: any, p: any, tier: number): Trial {
    const count = 3 + tier;
    const fleeSpeed = player.clazz.id === 'delver' ? 0.25 : 0.35;
    const enemies: any[] = [];
    for (let i = 0; i < count; i++) enemies.push({
        x: b.x + 80 + Math.random() * (b.w - 160),
        y: b.y + 80 + Math.random() * (b.h - 160),
        vx: 0, vy: 0, caught: false,
    });
    return {
        type: 'combat', variant: 'shadow-hunt', player: p, bounds: b,
        title: `⚔  SHADOW HUNT · TIER ${tier}`,
        hint: `Catch all ${count} shadows — they flee from you`,
        update() {
            move(p, b);
            for (const e of enemies) {
                if (e.caught) continue;
                const dx = e.x - p.x, dy = e.y - p.y;
                const d = Math.hypot(dx, dy) || 1;
                if (d < 130) { e.vx += (dx / d) * fleeSpeed; e.vy += (dy / d) * fleeSpeed; }
                e.vx *= 0.9; e.vy *= 0.9;
                e.x += e.vx; e.y += e.vy;
                if (e.x < b.x + 12) { e.x = b.x + 12; e.vx *= -1; }
                if (e.x > b.x + b.w - 12) { e.x = b.x + b.w - 12; e.vx *= -1; }
                if (e.y < b.y + 12) { e.y = b.y + 12; e.vy *= -1; }
                if (e.y > b.y + b.h - 12) { e.y = b.y + b.h - 12; e.vy *= -1; }
                if (d < 18) { e.caught = true; SFX.hit(); spawnBurst(e.x, e.y, '#a14040', 18); }
            }
        },
        draw(ctx) {
            drawArena(ctx, b, '#a14040');
            for (const e of enemies) {
                if (e.caught) continue;
                ctx.fillStyle = '#a14040'; ctx.shadowColor = '#a14040'; ctx.shadowBlur = 8;
                ctx.beginPath(); ctx.arc(e.x, e.y, 12, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = 'rgba(232,220,192,0.9)';
                ctx.beginPath(); ctx.arc(e.x - 3, e.y - 2, 1.6, 0, Math.PI * 2); ctx.fill();
                ctx.beginPath(); ctx.arc(e.x + 3, e.y - 2, 1.6, 0, Math.PI * 2); ctx.fill();
                ctx.shadowBlur = 0;
            }
            const caught = enemies.filter(e => e.caught).length;
            ctx.fillStyle = COLORS.text;
            ctx.font = 'bold 16px "JetBrains Mono", monospace';
            ctx.textAlign = 'center';
            ctx.fillText(`${caught} / ${enemies.length}`, b.x + b.w / 2, b.y + 36);
        },
        isComplete() { return enemies.every(e => e.caught); },
    };
}