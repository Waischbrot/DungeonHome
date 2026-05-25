import type { Trial } from '../../types';
import { player } from '../../state';
import { spawnBurst } from '../../particles';
import { beep, SFX } from '../../audio';
import { move, drawArena } from '../shared';

export function makeSpikeFloor(b: any, p: any, tier: number): Trial {
    p.x = b.x + 30; p.y = b.y + b.h / 2;
    const goal = { x: b.x + b.w - 40, y: b.y + b.h / 2, r: 24 };
    const cellSize = 60;
    const cols = Math.floor(b.w / cellSize);
    const rows = Math.floor(b.h / cellSize);
    const slow = player.clazz.id === 'wayfarer' ? 1.5 : 1;
    type Tile = { col: number; row: number; phase: 'idle' | 'warn' | 'spike'; timer: number };
    const tiles: Tile[] = [];
    for (let c = 1; c < cols - 1; c++) {
        for (let r = 1; r < rows - 1; r++) {
            if (Math.random() < 0.35) tiles.push({
                col: c, row: r, phase: 'idle',
                timer: 40 + Math.floor(Math.random() * 120),
            });
        }
    }
    let hitFlash = 0, won = false;
    return {
        type: 'parkour', variant: 'spike-floor', player: p, bounds: b,
        title: `⚙  SPIKE FLOOR · TIER ${tier}`,
        hint: 'Reach the goal — red tiles will spike a moment later',
        update() {
            if (!won) move(p, b);
            for (const t of tiles) {
                t.timer--;
                if (t.timer <= 0) {
                    if      (t.phase === 'idle')  { t.phase = 'warn';  t.timer = Math.round(60 / slow); }
                    else if (t.phase === 'warn')  { t.phase = 'spike'; t.timer = 40; }
                    else                          { t.phase = 'idle';  t.timer = 60 + Math.floor(Math.random() * 90); }
                }
            }
            if (!won) {
                for (const t of tiles) {
                    if (t.phase !== 'spike') continue;
                    const tx = b.x + t.col * cellSize, ty = b.y + t.row * cellSize;
                    if (p.x > tx && p.x < tx + cellSize && p.y > ty && p.y < ty + cellSize) {
                        p.x = b.x + 30; p.y = b.y + b.h / 2;
                        hitFlash = 20; SFX.fail(); break;
                    }
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
            ctx.strokeStyle = 'rgba(110,74,46,0.15)'; ctx.lineWidth = 1;
            for (let c = 1; c < cols; c++) {
                ctx.beginPath(); ctx.moveTo(b.x + c * cellSize, b.y); ctx.lineTo(b.x + c * cellSize, b.y + b.h); ctx.stroke();
            }
            for (let r = 1; r < rows; r++) {
                ctx.beginPath(); ctx.moveTo(b.x, b.y + r * cellSize); ctx.lineTo(b.x + b.w, b.y + r * cellSize); ctx.stroke();
            }
            for (const t of tiles) {
                const tx = b.x + t.col * cellSize, ty = b.y + t.row * cellSize;
                if (t.phase === 'warn') {
                    const pulse = 0.4 + Math.sin(Date.now() / 80) * 0.3;
                    ctx.fillStyle = `rgba(161,64,64,${pulse})`;
                    ctx.fillRect(tx + 2, ty + 2, cellSize - 4, cellSize - 4);
                    ctx.strokeStyle = '#a14040'; ctx.lineWidth = 2;
                    ctx.strokeRect(tx + 2, ty + 2, cellSize - 4, cellSize - 4);
                } else if (t.phase === 'spike') {
                    ctx.fillStyle = '#7a2828';
                    ctx.fillRect(tx + 2, ty + 2, cellSize - 4, cellSize - 4);
                    ctx.fillStyle = '#c8c8c0';
                    ctx.strokeStyle = '#4a4238'; ctx.lineWidth = 1;
                    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
                        const sx = tx + 12 + i * 16, sy = ty + 12 + j * 16;
                        ctx.beginPath();
                        ctx.moveTo(sx, sy + 10);
                        ctx.lineTo(sx + 4, sy);
                        ctx.lineTo(sx + 8, sy + 10);
                        ctx.closePath();
                        ctx.fill(); ctx.stroke();
                    }
                } else {
                    ctx.fillStyle = 'rgba(40,30,20,0.4)';
                    ctx.fillRect(tx + 4, ty + 4, cellSize - 8, cellSize - 8);
                }
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