import type { Trial } from '../../types';
import { player } from '../../state';
import { spawnBurst } from '../../particles';
import { beep, SFX } from '../../audio';
import { move, drawArena } from '../shared';

export function makeMovingWalls(b: any, p: any, tier: number): Trial {
    p.x = b.x + 30; p.y = b.y + b.h / 2;
    const goal = { x: b.x + b.w - 40, y: b.y + b.h / 2, r: 26 };
    const slow = player.clazz.id === 'wayfarer' ? 0.75 : 1;
    const cols = 2 + tier;
    const walls: any[] = [];
    for (let i = 0; i < cols; i++) {
        const cx = b.x + b.w * (i + 1) / (cols + 1);
        walls.push({ x: cx - 14, y: b.y, w: 28, h: b.h * 0.38, vy: (1.0 + i * 0.4) * slow });
    }
    let hitFlash = 0, won = false;
    return {
        type: 'parkour', variant: 'moving-walls', player: p, bounds: b,
        title: `⚙  MOVING WALLS · TIER ${tier}`,
        hint: 'Reach the green pad — avoid the moving walls',
        update() {
            if (!won) move(p, b);
            for (const w of walls) {
                w.y += w.vy;
                if (w.y < b.y) { w.y = b.y; w.vy *= -1; }
                if (w.y + w.h > b.y + b.h * 0.6) { w.y = b.y + b.h * 0.6 - w.h; w.vy *= -1; }
            }
            if (!won) {
                for (const w of walls) {
                    const botY = w.y + w.h + b.h * 0.2;
                    const botH = b.h - (botY - b.y);
                    const hit =
                        (p.x + 8 > w.x && p.x - 8 < w.x + w.w && p.y + 8 > w.y && p.y - 8 < w.y + w.h) ||
                        (p.x + 8 > w.x && p.x - 8 < w.x + w.w && p.y + 8 > botY && p.y - 8 < botY + botH);
                    if (hit) { p.x = b.x + 30; p.y = b.y + b.h / 2; hitFlash = 20; SFX.fail(); break; }
                }
            }
            if (hitFlash > 0) hitFlash--;
            if (!won && Math.hypot(p.x - goal.x, p.y - goal.y) < goal.r) {
                won = true; beep(800, 0.25, 'sine');
                spawnBurst(goal.x, goal.y, '#6f8a52', 35);
            }
        },
        draw(ctx) {
            drawArena(ctx, b, '#6f8a52');
            for (const w of walls) {
                const botY = w.y + w.h + b.h * 0.2;
                const botH = b.h - (botY - b.y);
                ctx.fillStyle = '#3e2818'; ctx.strokeStyle = '#6e4a2e'; ctx.lineWidth = 2;
                ctx.fillRect(w.x, w.y, w.w, w.h);     ctx.strokeRect(w.x, w.y, w.w, w.h);
                ctx.fillRect(w.x, botY, w.w, botH);   ctx.strokeRect(w.x, botY, w.w, botH);
            }
            ctx.fillStyle = won ? '#6f8a52' : '#1a3520';
            ctx.strokeStyle = '#6f8a52'; ctx.lineWidth = 2;
            ctx.shadowColor = '#6f8a52'; ctx.shadowBlur = 12;
            ctx.beginPath(); ctx.arc(goal.x, goal.y, goal.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            ctx.shadowBlur = 0;
            ctx.strokeStyle = 'rgba(200,155,90,0.4)';
            ctx.strokeRect(b.x + 18, b.y + b.h / 2 - 24, 24, 48);
            if (hitFlash > 0) {
                ctx.fillStyle = `rgba(161,64,64,${hitFlash / 40})`;
                ctx.fillRect(b.x, b.y, b.w, b.h);
            }
        },
        isComplete() { return won; },
    };
}