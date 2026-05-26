import type { Trial } from '../../types';
import { COLORS } from '../../constants';
import { spawnBurst } from '../../particles';
import { beep, SFX } from '../../audio';
import { move, drawArena, time } from '../shared';

export function makeBossDuel(b: any, p: any, tier: number): Trial {
    const hpMax = 3 + Math.floor(tier / 2);

    const boss = {
        x: b.x + b.w / 2,
        y: b.y + b.h / 2,
        hp: hpMax,
        hpMax,
        phase: 'idle' as 'idle' | 'wind' | 'dash' | 'stun',
        timer: 45,
        dashDx: 0,
        dashDy: 0,
        stunCD: 0,
    };

    let hitFlash = 0;

    function randomPlayerSpawn() {
        const spots = [
            { x: b.x + 45,       y: b.y + 45 },
            { x: b.x + b.w - 45, y: b.y + 45 },
            { x: b.x + 45,       y: b.y + b.h - 45 },
            { x: b.x + b.w - 45, y: b.y + b.h - 45 },
            { x: b.x + b.w / 2,  y: b.y + 45 },
            { x: b.x + b.w / 2,  y: b.y + b.h - 45 },
        ];

        const pick = spots[Math.floor(Math.random() * spots.length)];
        p.x = pick.x;
        p.y = pick.y;
    }

    function resetBossAfterPlayerHit() {
        boss.hp = boss.hpMax;
        boss.phase = 'idle';
        boss.timer = 45;
        boss.stunCD = 28;
        boss.x = b.x + b.w / 2;
        boss.y = b.y + b.h / 2;
        boss.dashDx = 0;
        boss.dashDy = 0;
    }

    return {
        type: 'combat',
        variant: 'boss-duel',
        player: p,
        bounds: b,
        title: `⚔  BOSS DUEL · TIER ${tier}`,
        hint: `Dodge the dash → strike during STUN. Getting hit resets the boss.`,

        update() {
            move(p, b, 1.25);

            if (boss.phase === 'idle') {
                boss.timer -= time.dt;

                if (boss.timer <= 0) {
                    boss.phase = 'wind';
                    boss.timer = 35;

                    const dx = p.x - boss.x;
                    const dy = p.y - boss.y;
                    const d = Math.hypot(dx, dy) || 1;

                    boss.dashDx = dx / d;
                    boss.dashDy = dy / d;
                }
            }

            else if (boss.phase === 'wind') {
                boss.timer -= time.dt;

                if (boss.timer <= 0) {
                    boss.phase = 'dash';
                    boss.timer = 24;
                    beep(180, 0.15, 'sawtooth');
                }
            }

            else if (boss.phase === 'dash') {
                const dashSpeed = 17 + tier * 1.5;

                boss.x += boss.dashDx * dashSpeed * time.dt;
                boss.y += boss.dashDy * dashSpeed * time.dt;

                if (boss.x < b.x + 30 || boss.x > b.x + b.w - 30) boss.dashDx *= -1;
                if (boss.y < b.y + 30 || boss.y > b.y + b.h - 30) boss.dashDy *= -1;

                boss.x = Math.max(b.x + 30, Math.min(b.x + b.w - 30, boss.x));
                boss.y = Math.max(b.y + 30, Math.min(b.y + b.h - 30, boss.y));

                // Boss hits player.
                if (boss.hp > 0 && Math.hypot(boss.x - p.x, boss.y - p.y) < 30 && boss.stunCD <= 0) {
                    randomPlayerSpawn();
                    resetBossAfterPlayerHit();
                    hitFlash = 25;
                    SFX.fail();
                    spawnBurst(boss.x, boss.y, '#a14040', 20);
                }

                boss.timer -= time.dt;

                if (boss.timer <= 0) {
                    boss.phase = 'stun';
                    boss.timer = 55;
                }
            }

            else if (boss.phase === 'stun') {
                boss.timer -= time.dt;

                // Player strikes boss.
                if (Math.hypot(boss.x - p.x, boss.y - p.y) < 30 && boss.stunCD <= 0) {
                    boss.hp--;
                    spawnBurst(boss.x, boss.y, '#a14040', 26);
                    beep(700, 0.1, 'sine');

                    boss.stunCD = 30;

                    const dx = p.x - boss.x;
                    const dy = p.y - boss.y;
                    const d = Math.hypot(dx, dy) || 1;

                    p.x += (dx / d) * 40;
                    p.y += (dy / d) * 40;

                    p.x = Math.max(b.x + 10, Math.min(b.x + b.w - 10, p.x));
                    p.y = Math.max(b.y + 10, Math.min(b.y + b.h - 10, p.y));

                    boss.phase = 'idle';
                    boss.timer = 45;
                }

                if (boss.timer <= 0) {
                    boss.phase = 'idle';
                    boss.timer = 45;
                }
            }

            if (boss.stunCD > 0) boss.stunCD = Math.max(0, boss.stunCD - time.dt);
            if (hitFlash > 0) hitFlash = Math.max(0, hitFlash - time.dt);
        },

        draw(ctx) {
            drawArena(ctx, b, '#a14040');

            if (boss.hp > 0) {
                let bossColor = '#a14040';

                if (boss.phase === 'wind') {
                    bossColor = '#d05050';

                    // Telegraph dash direction.
                    ctx.strokeStyle = 'rgba(208,80,80,0.55)';
                    ctx.lineWidth = 4;
                    ctx.setLineDash([8, 8]);
                    ctx.beginPath();
                    ctx.moveTo(boss.x, boss.y);
                    ctx.lineTo(boss.x + boss.dashDx * 180, boss.y + boss.dashDy * 180);
                    ctx.stroke();
                    ctx.setLineDash([]);
                }

                else if (boss.phase === 'stun') {
                    bossColor = '#704040';
                }

                // Boss body
                ctx.fillStyle = bossColor;
                ctx.shadowColor = bossColor;
                ctx.shadowBlur = 10;
                ctx.beginPath();
                ctx.arc(boss.x, boss.y, 28, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;

                // Eyes
                ctx.fillStyle = '#e8dcc0';
                ctx.beginPath();
                ctx.arc(boss.x - 7, boss.y - 5, 3, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.arc(boss.x + 7, boss.y - 5, 3, 0, Math.PI * 2);
                ctx.fill();

                // Mouth
                ctx.strokeStyle = '#e8dcc0';
                ctx.lineWidth = 2;
                ctx.beginPath();
                if (boss.phase === 'stun') {
                    ctx.arc(boss.x, boss.y + 8, 5, 0, Math.PI);
                } else {
                    ctx.moveTo(boss.x - 7, boss.y + 9);
                    ctx.lineTo(boss.x + 7, boss.y + 9);
                }
                ctx.stroke();
            }

            // HP bar
            const bw = 220, bh = 12;
            const bx = b.x + b.w / 2 - bw / 2;
            const by = b.y + b.h - 32;

            ctx.fillStyle = '#1a1410';
            ctx.fillRect(bx - 2, by - 2, bw + 4, bh + 4);

            ctx.fillStyle = '#4a4238';
            ctx.fillRect(bx, by, bw, bh);

            ctx.fillStyle = '#a14040';
            ctx.fillRect(bx, by, bw * (boss.hp / boss.hpMax), bh);

            ctx.strokeStyle = '#e8dcc0';
            ctx.lineWidth = 1;
            ctx.strokeRect(bx, by, bw, bh);

            ctx.fillStyle = COLORS.text;
            ctx.font = 'bold 11px "JetBrains Mono", monospace';
            ctx.textAlign = 'center';
            ctx.fillText(`${boss.hp} / ${boss.hpMax}`, b.x + b.w / 2, by - 8);

            ctx.font = 'bold 16px "JetBrains Mono", monospace';
            ctx.fillText(
                boss.phase === 'wind' ? '⚠  WINDING UP' :
                    boss.phase === 'dash' ? '⚡  DASHING' :
                        boss.phase === 'stun' ? '★  STRIKE NOW' :
                            '…  circling',
                b.x + b.w / 2,
                b.y + 36,
            );

            if (hitFlash > 0) {
                ctx.fillStyle = `rgba(161,64,64,${hitFlash / 50})`;
                ctx.fillRect(b.x, b.y, b.w, b.h);
            }
        },

        isComplete() {
            return boss.hp <= 0;
        },
    };
}