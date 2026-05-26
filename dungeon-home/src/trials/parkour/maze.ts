import type { Trial } from '../../types';
import { COLORS } from '../../constants';
import { keys } from '../../input';
import { player } from '../../state';
import { spawnBurst } from '../../particles';
import { beep } from '../../audio';
import { drawArena, time } from '../shared';

type Cell = { n: boolean; s: boolean; e: boolean; w: boolean; visited: boolean };
type WallRect = { x: number; y: number; w: number; h: number };

export function makeMaze(b: any, p: any, tier: number): Trial {
    // ── Layout per tier ─────────────────────────────────────────
    const configs = [
        { cols: 11, rows: 6,  cell: 70 },    // T1 — 66 cells
        { cols: 14, rows: 8,  cell: 56 },    // T2 — 112 cells
        { cols: 17, rows: 10, cell: 48 },    // T3 — 170 cells
    ];
    const cfg = configs[Math.min(tier - 1, configs.length - 1)];
    const { cols, rows, cell: CELL } = cfg;

    const gridW = cols * CELL;
    const gridH = rows * CELL;
    const ox = b.x + (b.w - gridW) / 2;
    const oy = b.y + (b.h - gridH) / 2 + 10;

    // ── Generate maze (iterative DFS — no stack overflow on big mazes) ──
    const grid: Cell[][] = [];
    for (let r = 0; r < rows; r++) {
        const row: Cell[] = [];
        for (let c = 0; c < cols; c++) {
            row.push({ n: true, s: true, e: true, w: true, visited: false });
        }
        grid.push(row);
    }

    const stack: { r: number; c: number }[] = [{ r: 0, c: 0 }];
    grid[0][0].visited = true;

    while (stack.length > 0) {
        const top = stack[stack.length - 1];
        type Dir = { dr: number; dc: number; wall: 'n' | 's' | 'e' | 'w'; opp: 'n' | 's' | 'e' | 'w' };
        const dirs: Dir[] = [
            { dr: -1, dc:  0, wall: 'n', opp: 's' },
            { dr:  1, dc:  0, wall: 's', opp: 'n' },
            { dr:  0, dc:  1, wall: 'e', opp: 'w' },
            { dr:  0, dc: -1, wall: 'w', opp: 'e' },
        ];
        const candidates = dirs.filter(d => {
            const nr = top.r + d.dr, nc = top.c + d.dc;
            return nr >= 0 && nr < rows && nc >= 0 && nc < cols && !grid[nr][nc].visited;
        });

        if (candidates.length === 0) { stack.pop(); continue; }

        const d = candidates[Math.floor(Math.random() * candidates.length)];
        const nr = top.r + d.dr, nc = top.c + d.dc;
        grid[top.r][top.c][d.wall] = false;
        grid[nr][nc][d.opp] = false;
        grid[nr][nc].visited = true;
        stack.push({ r: nr, c: nc });
    }

    // ── Build wall rectangles (used by both collision + render) ─
    const walls: WallRect[] = [];
    const T = 4;       // wall thickness
    const H = T / 2;

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const cell = grid[r][c];
            const cx = ox + c * CELL;
            const cy = oy + r * CELL;
            if (cell.n) walls.push({ x: cx - H, y: cy - H, w: CELL + T, h: T });
            if (cell.w) walls.push({ x: cx - H, y: cy - H, w: T, h: CELL + T });
        }
    }
    // Right + bottom boundary walls (since interior cells only emit N + W)
    for (let r = 0; r < rows; r++) {
        walls.push({ x: ox + gridW - H, y: oy + r * CELL - H, w: T, h: CELL + T });
    }
    for (let c = 0; c < cols; c++) {
        walls.push({ x: ox + c * CELL - H, y: oy + gridH - H, w: CELL + T, h: T });
    }

    function hitsWall(px: number, py: number, r: number): boolean {
        for (const w of walls) {
            if (px + r > w.x && px - r < w.x + w.w && py + r > w.y && py - r < w.y + w.h) return true;
        }
        return false;
    }

    // ── Player + goal ───────────────────────────────────────────
    p.x = ox + CELL / 2;                 // top-left cell centre
    p.y = oy + CELL / 2;

    const goal = {
        x: ox + (cols - 0.5) * CELL,        // bottom-right cell centre
        y: oy + (rows - 0.5) * CELL,
        r: Math.min(22, CELL * 0.35),
    };

    const PR    = Math.min(10, CELL * 0.20);
    const SPEED = player.clazz.id === 'wayfarer' ? 4.2 : 3.6;

    function moveMaze() {
        let dx = 0, dy = 0;
        if (keys.has('w') || keys.has('arrowup'))    dy -= 1;
        if (keys.has('s') || keys.has('arrowdown'))  dy += 1;
        if (keys.has('a') || keys.has('arrowleft'))  dx -= 1;
        if (keys.has('d') || keys.has('arrowright')) dx += 1;
        if (dx && dy) { dx *= 0.707; dy *= 0.707; }

        // Resolve each axis separately so we slide along walls cleanly
        const nx = p.x + dx * SPEED;
        if (!hitsWall(nx, p.y, PR)) p.x = nx;
        const ny = p.y + dy * SPEED;
        if (!hitsWall(p.x, ny, PR)) p.y = ny;
    }

    // ── Exploration tracking (visual breadcrumbs) ───────────────
    const visited = new Set<string>();
    const keyOf = (r: number, c: number) => `${r}-${c}`;
    visited.add(keyOf(0, 0));

    const trail: { x: number; y: number; t: number }[] = [];
    let trailTick = 0;

    let won = false;
    let pulseT = 0;

    return {
        type: 'parkour', variant: 'maze', player: p, bounds: b,
        title: `⚙  MAZE · TIER ${tier}`,
        hint: `Find the green pad — ${cols}×${rows} cells`,

        update() {
            pulseT++;
            if (won) return;
            moveMaze();

            // Track visited cells
            const pc = Math.floor((p.x - ox) / CELL);
            const pr = Math.floor((p.y - oy) / CELL);
            if (pc >= 0 && pc < cols && pr >= 0 && pr < rows) {
                visited.add(keyOf(pr, pc));
            }

            // Drop a trail dot every 8 frames; auto-fade
            trailTick++;
            if (trailTick >= 8) {
                trailTick = 0;
                trail.push({ x: p.x, y: p.y, t: 0 });
                if (trail.length > 60) trail.shift();
            }
            for (const dot of trail) dot.t++;

            // Win check
            if (Math.hypot(p.x - goal.x, p.y - goal.y) < goal.r) {
                won = true;
                beep(660, 0.18, 'sine');
                setTimeout(() => beep(880, 0.25, 'sine'), 80);
                spawnBurst(goal.x, goal.y, '#6f8a52', 40);
            }
        },

        draw(ctx) {
            drawArena(ctx, b, '#6f8a52');

            // Maze floor (slightly darker than arena)
            ctx.fillStyle = '#15110d';
            ctx.fillRect(ox - 2, oy - 2, gridW + 4, gridH + 4);

            // Checker tile pattern for depth
            ctx.fillStyle = 'rgba(110,74,46,0.08)';
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    if ((r + c) % 2 === 0) {
                        ctx.fillRect(ox + c * CELL + 1, oy + r * CELL + 1, CELL - 2, CELL - 2);
                    }
                }
            }

            // Visited tint — subtle gold so you can SEE where you've been
            ctx.fillStyle = 'rgba(212,168,81,0.07)';
            for (const k of visited) {
                const [r, c] = k.split('-').map(Number);
                ctx.fillRect(ox + c * CELL + 2, oy + r * CELL + 2, CELL - 4, CELL - 4);
            }

            // Fading trail of where you've recently been
            for (const dot of trail) {
                const alpha = Math.max(0, 1 - dot.t / 90) * 0.45;
                if (alpha <= 0) continue;
                ctx.fillStyle = `rgba(200,155,90,${alpha})`;
                ctx.beginPath();
                ctx.arc(dot.x, dot.y, 3, 0, Math.PI * 2);
                ctx.fill();
            }

            // Start pad indicator (subtle ring at spawn)
            const startX = ox + CELL / 2;
            const startY = oy + CELL / 2;
            ctx.strokeStyle = 'rgba(200,155,90,0.4)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(startX, startY, CELL * 0.32, 0, Math.PI * 2);
            ctx.stroke();

            // Goal pad (pulsing green)
            const pulseGlow = 12 + Math.sin(pulseT / 10) * 5;
            ctx.fillStyle   = won ? '#6f8a52' : '#1a3520';
            ctx.strokeStyle = '#6f8a52';
            ctx.lineWidth   = 2;
            ctx.shadowColor = '#6f8a52'; ctx.shadowBlur = pulseGlow;
            ctx.beginPath(); ctx.arc(goal.x, goal.y, goal.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            ctx.shadowBlur = 0;
            ctx.strokeStyle = won ? '#fff5ba' : '#6f8a52';
            ctx.beginPath();
            ctx.moveTo(goal.x - goal.r * 0.4, goal.y); ctx.lineTo(goal.x + goal.r * 0.4, goal.y);
            ctx.moveTo(goal.x, goal.y - goal.r * 0.4); ctx.lineTo(goal.x, goal.y + goal.r * 0.4);
            ctx.stroke();

            // Walls — stone base + a one-pixel highlight on top/left for a chiselled look
            ctx.fillStyle = '#3a3328';
            for (const w of walls) ctx.fillRect(w.x, w.y, w.w, w.h);
            ctx.fillStyle = 'rgba(180,140,90,0.22)';
            for (const w of walls) {
                if (w.w >= w.h) ctx.fillRect(w.x, w.y, w.w, 1);   // horizontal — top highlight
                else            ctx.fillRect(w.x, w.y, 1, w.h);   // vertical   — left highlight
            }

            // Header
            ctx.fillStyle = COLORS.text;
            ctx.font = 'bold 14px "JetBrains Mono", monospace';
            ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
            const explored = Math.round(100 * visited.size / (cols * rows));
            ctx.fillText(`FIND THE EXIT  ·  ${explored}% explored`, b.x + b.w / 2, b.y + 36);
        },

        isComplete() { return won; },
    };
}