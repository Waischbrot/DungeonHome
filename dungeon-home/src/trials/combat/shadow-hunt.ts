import type { Trial } from '../../types';
import { COLORS } from '../../constants';
import { spawnBurst } from '../../particles';
import { SFX } from '../../audio';
import { move, drawArena, time } from '../shared';

type Shadow = {
    x: number;
    y: number;
    vx: number;
    vy: number;
    caught: boolean;
    wobble: number;
};

export function makeShadowHunt(b: any, p: any, tier: number): Trial {
    const count = 3 + tier;

    const PLAYER_SPEED_MULT = 1.26;

    const fleeRange = 154 + tier * 7;
    const fleeAccel = 0.30 + tier * 0.03;
    const wallMargin = 64;
    const wallRepel = 0.50;
    const maxSpeed = 2.9 + tier * 0.21;

    const enemies: Shadow[] = [];

    for (let i = 0; i < count; i++) {
        enemies.push({
            x: b.x + 90 + Math.random() * (b.w - 180),
            y: b.y + 90 + Math.random() * (b.h - 180),
            vx: 0,
            vy: 0,
            caught: false,
            wobble: Math.random() * Math.PI * 2,
        });
    }

    function clampSpeed(e: Shadow) {
        const s = Math.hypot(e.vx, e.vy);
        if (s > maxSpeed) {
            e.vx = (e.vx / s) * maxSpeed;
            e.vy = (e.vy / s) * maxSpeed;
        }
    }

    return {
        type: 'combat',
        variant: 'shadow-hunt',
        player: p,
        bounds: b,
        title: `⚔  SHADOW HUNT · TIER ${tier}`,
        hint: `Catch all ${count} shadows — they flee and dodge corners`,

        update() {
            move(p, b, PLAYER_SPEED_MULT);

            for (const e of enemies) {
                if (e.caught) continue;

                // ── Flee from player ─────────────────────────────
                const awayX = e.x - p.x;
                const awayY = e.y - p.y;
                const dist = Math.hypot(awayX, awayY) || 1;

                let steerX = 0;
                let steerY = 0;

                if (dist < fleeRange) {
                    const pressure = 1 - dist / fleeRange;
                    steerX += (awayX / dist) * fleeAccel * (0.65 + pressure);
                    steerY += (awayY / dist) * fleeAccel * (0.65 + pressure);
                }

                // ── Wall avoidance BEFORE touching walls ─────────
                const leftDist = e.x - b.x;
                const rightDist = b.x + b.w - e.x;
                const topDist = e.y - b.y;
                const bottomDist = b.y + b.h - e.y;

                const nearLeft = leftDist < wallMargin;
                const nearRight = rightDist < wallMargin;
                const nearTop = topDist < wallMargin;
                const nearBottom = bottomDist < wallMargin;

                if (nearLeft)  steerX += ((wallMargin - leftDist) / wallMargin) * wallRepel;
                if (nearRight) steerX -= ((wallMargin - rightDist) / wallMargin) * wallRepel;
                if (nearTop)   steerY += ((wallMargin - topDist) / wallMargin) * wallRepel;
                if (nearBottom)steerY -= ((wallMargin - bottomDist) / wallMargin) * wallRepel;

                // ── Wall slide / corner escape ───────────────────
                // If a shadow is near a vertical wall, add vertical movement away
                // from the player. If near horizontal wall, add horizontal movement.
                // This makes them escape corners instead of waiting there.
                if (nearLeft || nearRight) {
                    steerY += Math.sign(e.y - p.y || Math.random() - 0.5) * 0.36;
                }
                if (nearTop || nearBottom) {
                    steerX += Math.sign(e.x - p.x || Math.random() - 0.5) * 0.36;
                }

                // If actually in a corner zone, add a stronger shove toward arena centre.
                const cornered = (nearLeft || nearRight) && (nearTop || nearBottom);
                if (cornered) {
                    const cx = b.x + b.w / 2;
                    const cy = b.y + b.h / 2;
                    const toCx = cx - e.x;
                    const toCy = cy - e.y;
                    const cd = Math.hypot(toCx, toCy) || 1;
                    steerX += (toCx / cd) * 0.55;
                    steerY += (toCy / cd) * 0.55;
                }

                // Small organic wobble so movement doesn't look robotic.
                e.wobble += 0.055 * time.dt;
                steerX += Math.cos(e.wobble) * 0.025;
                steerY += Math.sin(e.wobble) * 0.025;

                e.vx += steerX * time.dt;
                e.vy += steerY * time.dt;

                const damp = Math.pow(0.925, time.dt);
                e.vx *= damp;
                e.vy *= damp;

                clampSpeed(e);

                e.x += e.vx * time.dt;
                e.y += e.vy * time.dt;

                // Hard wall collision with inward bounce.
                if (e.x < b.x + 12) {
                    e.x = b.x + 12;
                    e.vx = Math.abs(e.vx) + 0.55;
                    e.vy += (Math.random() - 0.5) * 1.2;
                }
                if (e.x > b.x + b.w - 12) {
                    e.x = b.x + b.w - 12;
                    e.vx = -Math.abs(e.vx) - 0.55;
                    e.vy += (Math.random() - 0.5) * 1.2;
                }
                if (e.y < b.y + 12) {
                    e.y = b.y + 12;
                    e.vy = Math.abs(e.vy) + 0.55;
                    e.vx += (Math.random() - 0.5) * 1.2;
                }
                if (e.y > b.y + b.h - 12) {
                    e.y = b.y + b.h - 12;
                    e.vy = -Math.abs(e.vy) - 0.55;
                    e.vx += (Math.random() - 0.5) * 1.2;
                }

                clampSpeed(e);

                const catchDist = Math.hypot(e.x - p.x, e.y - p.y);
                if (catchDist < 17) {
                    e.caught = true;
                    SFX.hit();
                    spawnBurst(e.x, e.y, '#a14040', 18);
                }
            }
        },

        draw(ctx) {
            drawArena(ctx, b, '#a14040');

            for (const e of enemies) {
                if (e.caught) continue;

                // Motion tail
                ctx.strokeStyle = 'rgba(161,64,64,0.28)';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(e.x, e.y);
                ctx.lineTo(e.x - e.vx * 4, e.y - e.vy * 4);
                ctx.stroke();

                // Body
                ctx.fillStyle = '#a14040';
                ctx.shadowColor = '#a14040';
                ctx.shadowBlur = 8;
                ctx.beginPath();
                ctx.arc(e.x, e.y, 12, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;

                // Eyes
                ctx.fillStyle = 'rgba(232,220,192,0.9)';
                ctx.beginPath();
                ctx.arc(e.x - 3, e.y - 2, 1.6, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.arc(e.x + 3, e.y - 2, 1.6, 0, Math.PI * 2);
                ctx.fill();
            }

            const caught = enemies.filter(e => e.caught).length;
            ctx.fillStyle = COLORS.text;
            ctx.font = 'bold 16px "JetBrains Mono", monospace';
            ctx.textAlign = 'center';
            ctx.fillText(`${caught} / ${enemies.length}`, b.x + b.w / 2, b.y + 36);
        },

        isComplete() {
            return enemies.every(e => e.caught);
        },
    };
}