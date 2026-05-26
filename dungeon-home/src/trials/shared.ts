import { CANVAS_W, CANVAS_H, COLORS } from '../constants';
import { keys } from '../input';
import { player } from '../state';

export const I_W = 900;
export const I_H = 540;
export const I_X = (CANVAS_W - I_W) / 2;
export const I_Y = (CANVAS_H - I_H) / 2 + 20;

// ── Shared frame-time scaler.
// main.ts updates `time.dt` each animation frame.
// 1.0 = one 60fps frame worth of time.
// Do NOT use this for global balancing. It is only for device-normalized timing.
export const time = { dt: 1 };

export function speed() {
    return player.clazz.id === 'wayfarer' ? 4.2 : 3.6;
}

/**
 * Shared trial movement.
 *
 * `speedMultiplier` lets individual trials tune their local feel without
 * corrupting global time. Example: combat trials can use 1.25 while puzzles
 * can stay at 1.0.
 */
export function move(p: { x: number, y: number }, b: any, speedMultiplier = 1) {
    let dx = 0, dy = 0;

    if (keys.has('w') || keys.has('arrowup'))    dy -= 1;
    if (keys.has('s') || keys.has('arrowdown'))  dy += 1;
    if (keys.has('a') || keys.has('arrowleft'))  dx -= 1;
    if (keys.has('d') || keys.has('arrowright')) dx += 1;

    if (dx && dy) {
        dx *= 0.707;
        dy *= 0.707;
    }

    const s = speed() * speedMultiplier * time.dt;

    p.x = Math.max(b.x + 10, Math.min(b.x + b.w - 10, p.x + dx * s));
    p.y = Math.max(b.y + 10, Math.min(b.y + b.h - 10, p.y + dy * s));
}

export function drawArena(ctx: CanvasRenderingContext2D, b: any, color: string) {
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    ctx.fillStyle = '#1f1a14';
    ctx.fillRect(b.x, b.y, b.w, b.h);

    // stone tile pattern
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    for (let yy = b.y; yy < b.y + b.h; yy += 32) {
        const off = ((yy / 32) % 2) * 16;
        for (let xx = b.x + off; xx < b.x + b.w; xx += 32) {
            ctx.fillRect(xx, yy, 30, 30);
        }
    }

    // outer border
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    ctx.shadowBlur = 0;

    // corner brackets
    const c = 20;
    ctx.lineWidth = 3;
    for (const [cx, cy, dx, dy] of [
        [b.x, b.y, 1, 1],
        [b.x + b.w, b.y, -1, 1],
        [b.x, b.y + b.h, 1, -1],
        [b.x + b.w, b.y + b.h, -1, -1],
    ] as const) {
        ctx.beginPath();
        ctx.moveTo(cx + dx * c, cy);
        ctx.lineTo(cx, cy);
        ctx.lineTo(cx, cy + dy * c);
        ctx.stroke();
    }
}

// Distance from a point to a line segment.
// Used for continuous collision, e.g. pendulums or fast-moving hazards.
export function distToSegment(
    px: number,
    py: number,
    ax: number,
    ay: number,
    bx: number,
    by: number,
): number {
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;

    if (len2 < 0.0001) return Math.hypot(px - ax, py - ay);

    let t = ((px - ax) * dx + (py - ay) * dy) / len2;
    t = Math.max(0, Math.min(1, t));

    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}