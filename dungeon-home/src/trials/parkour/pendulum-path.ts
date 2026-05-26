import type { Trial } from '../../types';
import { player } from '../../state';
import { spawnBurst } from '../../particles';
import { beep, SFX } from '../../audio';
import { move, drawArena, distToSegment, time } from '../shared';

type Pend = {
    ax: number; ay: number; len: number;
    amplitude: number;          // max swing in radians
    period: number;             // frames per full cycle
    phaseOffset: number;        // initial phase (radians)
    t: number;                  // frame counter
    bx: number; by: number;     // current ball position
    prevX: number; prevY: number; // previous frame (for continuous collision)
};

export function makePendulumPath(b: any, p: any, tier: number): Trial {
    p.x = b.x + 30;
    p.y = b.y + b.h / 2;
    const goal = { x: b.x + b.w - 40, y: b.y + b.h / 2, r: 26 };

    // Wayfarer perk: slower / more forgiving timing.  Larger period → slower swing.
    const periodScale = player.clazz.id === 'wayfarer' ? 1.4 : 1.0;
    const count = 2 + tier;
    const pends: Pend[] = [];

    for (let i = 0; i < count; i++) {
        const ax          = b.x + b.w * (i + 1) / (count + 1);
        const ay          = b.y + 16;
        const len         = b.h - 36;
        const amplitude   = (Math.PI / 2) * (0.78 + Math.random() * 0.10); // ~70°-79°
        const period      = (90 + Math.random() * 40) * periodScale;        // 90-130 frames
        const phaseOffset = Math.random() * Math.PI * 2;
        const t           = 0;

        const a   = amplitude * Math.sin(phaseOffset);
        const bx  = ax + Math.sin(a) * len;
        const by  = ay + Math.cos(a) * len;
        pends.push({ ax, ay, len, amplitude, period, phaseOffset, t, bx, by, prevX: bx, prevY: by });
    }

    let hitFlash = 0;
    let won = false;

    return {
        type: 'parkour', variant: 'pendulum-path', player: p, bounds: b,
        title: `⚙  PENDULUM PATH · TIER ${tier}`,
        hint: 'Cross the room — time your steps between the swinging weights',

        update() {
            if (!won) move(p, b);

            // Advance every pendulum via pure harmonic motion. No thresholds, no flips.
            for (const pe of pends) {
                pe.prevX = pe.bx;
                pe.prevY = pe.by;
                pe.t += 1;
                const a = pe.amplitude * Math.sin((pe.t / pe.period) * Math.PI * 2 + pe.phaseOffset);
                pe.bx = pe.ax + Math.sin(a) * pe.len;
                pe.by = pe.ay + Math.cos(a) * pe.len;
            }

            // Continuous collision: distance from player to (prev → current) segment
            // means even a fast-moving ball can't teleport past you between frames.
            if (!won) {
                for (const pe of pends) {
                    if (distToSegment(p.x, p.y, pe.prevX, pe.prevY, pe.bx, pe.by) < 22) {
                        p.x = b.x + 30; p.y = b.y + b.h / 2;
                        hitFlash = 20; SFX.fail();
                        break;
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

            for (const pe of pends) {
                // Motion-blur trail along the segment the ball travelled this frame
                ctx.strokeStyle = 'rgba(74,66,56,0.22)';
                ctx.lineWidth = 30;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(pe.prevX, pe.prevY);
                ctx.lineTo(pe.bx, pe.by);
                ctx.stroke();
                ctx.lineCap = 'butt';

                // Chain from ceiling to ball
                ctx.strokeStyle = '#6e4a2e'; ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(pe.ax, pe.ay);
                ctx.lineTo(pe.bx, pe.by);
                ctx.stroke();

                // Chain anchor block at the ceiling
                ctx.fillStyle   = '#4a4238';
                ctx.fillRect(pe.ax - 8, pe.ay - 8, 16, 16);
                ctx.strokeStyle = '#2e2a24'; ctx.lineWidth = 1;
                ctx.strokeRect(pe.ax - 8, pe.ay - 8, 16, 16);

                // Spiked ball
                ctx.fillStyle   = '#4a4238';
                ctx.shadowColor = '#4a4238'; ctx.shadowBlur = 6;
                ctx.beginPath(); ctx.arc(pe.bx, pe.by, 16, 0, Math.PI * 2); ctx.fill();
                ctx.shadowBlur = 0;
                ctx.fillStyle   = '#c0bca8';
                for (let i = 0; i < 8; i++) {
                    const a = (i / 8) * Math.PI * 2;
                    ctx.beginPath();
                    ctx.moveTo(pe.bx + Math.cos(a)         * 14, pe.by + Math.sin(a)         * 14);
                    ctx.lineTo(pe.bx + Math.cos(a)         * 22, pe.by + Math.sin(a)         * 22);
                    ctx.lineTo(pe.bx + Math.cos(a + 0.3)   * 14, pe.by + Math.sin(a + 0.3)   * 14);
                    ctx.closePath();
                    ctx.fill();
                }
            }

            // Goal pad
            ctx.fillStyle   = won ? '#6f8a52' : '#1a3520';
            ctx.strokeStyle = '#6f8a52'; ctx.lineWidth = 2;
            ctx.shadowColor = '#6f8a52'; ctx.shadowBlur = 12;
            ctx.beginPath(); ctx.arc(goal.x, goal.y, goal.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            ctx.shadowBlur = 0;

            // Start pad
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