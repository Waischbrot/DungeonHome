import type { Trial } from '../../types';
import { COLORS } from '../../constants';
import { spawnBurst } from '../../particles';
import { beep, SFX } from '../../audio';
import { move, drawArena } from '../shared';

export function makeBossDuel(b: any, p: any, tier: number): Trial {
    const hpMax = 3 + Math.floor(tier / 2);
    const boss = {
        x: b.x + b.w / 2, y: b.y + b.h / 2,
        hp: hpMax, hpMax,
        phase: 'idle' as 'idle' | 'wind' | 'dash' | 'stun',
        timer: 80, dashDx: 0, dashDy: 0, stunCD: 0,
    };
    let hitFlash = 0;
    return {
        type: 'combat', variant: 'boss-duel', player: p, bounds: b,
        title: `⚔  BOSS DUEL · TIER ${tier}`,
        hint: `Dodge the dash → strike during STUN. ${hpMax} HP.`,
        update() {
            move(p, b);
            if (boss.phase === 'idle') {
                boss.timer--;
                if (boss.timer <= 0) {
                    boss.phase = 'wind'; boss.timer = 55;
                    const dx = p.x - boss.x, dy = p.y - boss.y;
                    const d = Math.hypot(dx, dy) || 1;
                    boss.dashDx = dx / d; boss.dashDy = dy / d;
                }
            } else if (boss.phase === 'wind') {
                boss.timer--;
                if (boss.timer <= 0) { boss.phase = 'dash'; boss.timer = 28; beep(180, 0.15, 'sawtooth'); }
            } else if (boss.phase === 'dash') {
                boss.x += boss.dashDx * 13; boss.y += boss.dashDy * 13;
                if (boss.x < b.x + 30 || boss.x > b.x + b.w - 30) boss.dashDx *= -1;
                if (boss.y < b.y + 30 || boss.y > b.y + b.h - 30) boss.dashDy *= -1;
                boss.x = Math.max(b.x + 30, Math.min(b.x + b.w - 30, boss.x));
                boss.y = Math.max(b.y + 30, Math.min(b.y + b.h - 30, boss.y));
                if (boss.hp > 0 && Math.hypot(boss.x - p.x, boss.y - p.y) < 30 && boss.stunCD <= 0) {
                    p.x = b.x + 30; p.y = b.y + b.h - 30;
                    hitFlash = 25; SFX.fail();
                }
                boss.timer--;
                if (boss.timer <= 0) { boss.phase = 'stun'; boss.timer = 55; }
            } else if (boss.phase === 'stun') {
                boss.timer--;
                if (Math.hypot(boss.x - p.x, boss.y - p.y) < 30) {
                    boss.hp--; spawnBurst(boss.x, boss.y, '#a14040', 26); beep(700, 0.1, 'sine');
                    boss.stunCD = 30;
                    const dx = p.x - boss.x, dy = p.y - boss.y;
                    const d = Math.hypot(dx, dy) || 1;
                    p.x += (dx / d) * 40; p.y += (dy / d) * 40;
                    boss.phase = 'idle'; boss.timer = 80;
                }
                if (boss.timer <= 0) { boss.phase = 'idle'; boss.timer = 60; }
            }
            if (boss.stunCD > 0) boss.stunCD--;
            if (hitFlash > 0)   hitFlash--;
        },
        draw(ctx) {
            drawArena(ctx, b, '#a14040');
            if (boss.hp > 0) {
                let bossColor = '#a14040';
                if (boss.phase === 'wind') {
                    bossColor = '#d05050';
                    ctx.strokeStyle = 'rgba(208,80,80,0.55)'; ctx.lineWidth = 4;
                    ctx.setLineDash([8, 8]);
                    ctx.beginPath();
                    ctx.moveTo(boss.x, boss.y);
                    ctx.lineTo(boss.x + boss.dashDx * 160, boss.y + boss.dashDy * 160);
                    ctx.stroke();
                    ctx.setLineDash([]);
                } else if (boss.phase === 'stun') bossColor = '#704040';
                ctx.fillStyle = bossColor;
                ctx.shadowColor = bossColor; ctx.shadowBlur = 10;
                ctx.beginPath(); ctx.arc(boss.x, boss.y, 28, 0, Math.PI * 2); ctx.fill();
                ctx.shadowBlur = 0;
                ctx.fillStyle = '#e8dcc0';
                ctx.beginPath(); ctx.arc(boss.x - 7, boss.y - 5, 3, 0, Math.PI * 2); ctx.fill();
                ctx.beginPath(); ctx.arc(boss.x + 7, boss.y - 5, 3, 0, Math.PI * 2); ctx.fill();
                ctx.strokeStyle = '#e8dcc0'; ctx.lineWidth = 2;
                ctx.beginPath();
                if (boss.phase === 'stun') ctx.arc(boss.x, boss.y + 8, 5, 0, Math.PI);
                else { ctx.moveTo(boss.x - 7, boss.y + 9); ctx.lineTo(boss.x + 7, boss.y + 9); }
                ctx.stroke();
            }
            const bw = 220, bh = 12;
            const bx = b.x + b.w / 2 - bw / 2;
            const by = b.y + b.h - 32;
            ctx.fillStyle = '#1a1410'; ctx.fillRect(bx - 2, by - 2, bw + 4, bh + 4);
            ctx.fillStyle = '#4a4238'; ctx.fillRect(bx, by, bw, bh);
            ctx.fillStyle = '#a14040'; ctx.fillRect(bx, by, bw * (boss.hp / boss.hpMax), bh);
            ctx.strokeStyle = '#e8dcc0'; ctx.lineWidth = 1; ctx.strokeRect(bx, by, bw, bh);
            ctx.fillStyle = COLORS.text;
            ctx.font = 'bold 11px "JetBrains Mono", monospace';
            ctx.textAlign = 'center';
            ctx.fillText(`${boss.hp} / ${boss.hpMax}`, b.x + b.w / 2, by - 8);
            ctx.font = 'bold 16px "JetBrains Mono", monospace';
            ctx.fillText(
                boss.phase === 'wind' ? '⚠  WINDING UP' :
                    boss.phase === 'dash' ? '⚡  DASHING' :
                        boss.phase === 'stun' ? '★  STRIKE NOW' :
                            '…  waiting',
                b.x + b.w / 2, b.y + 36,
            );
            if (hitFlash > 0) {
                ctx.fillStyle = `rgba(161,64,64,${hitFlash / 50})`;
                ctx.fillRect(b.x, b.y, b.w, b.h);
            }
        },
        isComplete() { return boss.hp <= 0; },
    };
}