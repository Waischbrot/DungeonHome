import type { Trial } from '../../types';
import { player } from '../../state';
import { spawnBurst } from '../../particles';
import { beep, SFX } from '../../audio';
import { move, drawArena } from '../shared';

type Tile = { phase: 'idle' | 'warn' | 'fallen'; timer: number };

export function makeFallingFloor(b: any, p: any, tier: number): Trial {
    p.x = b.x + 30;
    p.y = b.y + b.h / 2;
    const goal = { x: b.x + b.w - 40, y: b.y + b.h / 2, r: 26 };

    const cellSize = 60;
    const cols = Math.floor(b.w / cellSize);
    const rows = Math.floor(b.h / cellSize);

    const slowScale = player.clazz.id === 'wayfarer' ? 1.4 : 1.0;
    const warnDuration = Math.round(36 * slowScale);
    const fallDuration = Math.round(90 * slowScale);
    const baseInterval = Math.max(45, 120 - tier * 18);

    // Build grid
    const grid: Tile[][] = [];
    for (let r = 0; r < rows; r++) {
        const row: Tile[] = [];
        for (let c = 0; c < cols; c++) row.push({ phase: 'idle', timer: 0 });
        grid.push(row);
    }

    // Always keep the two side columns (start + goal) safe
    const isSafeColumn = (c: number) => c === 0 || c === cols - 1;

    function warnTile(r: number, c: number) {
        if (r < 0 || r >= rows || c < 0 || c >= cols) return;
        if (isSafeColumn(c)) return;
        const t = grid[r][c];
        if (t.phase === 'idle') { t.phase = 'warn'; t.timer = warnDuration; }
    }

    function triggerWave() {
        const kind = Math.random();
        if (kind < 0.4) {
            // Vertical column
            const c = 1 + Math.floor(Math.random() * (cols - 2));
            for (let r = 0; r < rows; r++) warnTile(r, c);
        } else if (kind < 0.75) {
            // Horizontal row
            const r = Math.floor(Math.random() * rows);
            for (let c = 0; c < cols; c++) warnTile(r, c);
        } else {
            // Scattered batch
            const count = Math.floor(cols * rows * (0.18 + tier * 0.05));
            for (let i = 0; i < count; i++) {
                warnTile(Math.floor(Math.random() * rows), Math.floor(Math.random() * cols));
            }
        }
        beep(220, 0.08, 'sawtooth', 0.025);
    }

    let waveTimer = 60;
    let hitFlash = 0;
    let won = false;

    return {
        type: 'parkour', variant: 'falling-floor', player: p, bounds: b,
        title: `⚙  FALLING FLOOR · TIER ${tier}`,
        hint: 'Tiles drop in waves — watch for the warning flash',

        update() {
            if (!won) move(p, b);

            // Trigger waves
            waveTimer--;
            if (waveTimer <= 0) {
                triggerWave();
                waveTimer = baseInterval + Math.floor(Math.random() * 50);
            }

            // Advance each tile
            for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
                const t = grid[r][c];
                if (t.phase === 'idle') continue;
                t.timer--;
                if (t.timer <= 0) {
                    if (t.phase === 'warn') { t.phase = 'fallen'; t.timer = fallDuration; }
                    else                    { t.phase = 'idle';   t.timer = 0; }
                }
            }

            // Player on a fallen tile → reset
            if (!won) {
                const cx = Math.floor((p.x - b.x) / cellSize);
                const cy = Math.floor((p.y - b.y) / cellSize);
                if (cx >= 0 && cx < cols && cy >= 0 && cy < rows) {
                    if (grid[cy][cx].phase === 'fallen') {
                        p.x = b.x + 30; p.y = b.y + b.h / 2;
                        hitFlash = 20; SFX.fail();
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

            // Subtle tile grid
            ctx.strokeStyle = 'rgba(110,74,46,0.12)'; ctx.lineWidth = 1;
            for (let c = 1; c < cols; c++) {
                ctx.beginPath(); ctx.moveTo(b.x + c * cellSize, b.y); ctx.lineTo(b.x + c * cellSize, b.y + b.h); ctx.stroke();
            }
            for (let r = 1; r < rows; r++) {
                ctx.beginPath(); ctx.moveTo(b.x, b.y + r * cellSize); ctx.lineTo(b.x + b.w, b.y + r * cellSize); ctx.stroke();
            }

            // Tiles
            for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
                const t = grid[r][c];
                const tx = b.x + c * cellSize;
                const ty = b.y + r * cellSize;

                if (t.phase === 'fallen') {
                    // Void — deep darkness with a few rubble specks at the rim
                    ctx.fillStyle = '#08060a';
                    ctx.fillRect(tx, ty, cellSize, cellSize);
                    ctx.fillStyle = '#1a1410';
                    ctx.fillRect(tx, ty, cellSize, 3);
                    ctx.fillRect(tx, ty + cellSize - 3, cellSize, 3);
                    ctx.fillRect(tx, ty, 3, cellSize);
                    ctx.fillRect(tx + cellSize - 3, ty, 3, cellSize);
                    // small rubble bits
                    ctx.fillStyle = '#3a2410';
                    ctx.fillRect(tx + 10, ty + 8,  4, 4);
                    ctx.fillRect(tx + 38, ty + 22, 3, 3);
                    ctx.fillRect(tx + 18, ty + 44, 5, 3);
                    ctx.fillRect(tx + 46, ty + 50, 3, 4);
                } else if (t.phase === 'warn') {
                    // Pulsing yellow warning, with hairline cracks
                    const pulse = 0.4 + Math.sin(Date.now() / 80) * 0.3;
                    ctx.fillStyle = `rgba(212,168,81,${pulse})`;
                    ctx.fillRect(tx + 2, ty + 2, cellSize - 4, cellSize - 4);
                    ctx.strokeStyle = '#d4a851'; ctx.lineWidth = 2;
                    ctx.strokeRect(tx + 2, ty + 2, cellSize - 4, cellSize - 4);

                    ctx.strokeStyle = 'rgba(58,36,16,0.55)'; ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(tx + 8,            ty + cellSize / 2);
                    ctx.lineTo(tx + cellSize - 8, ty + cellSize / 2);
                    ctx.moveTo(tx + cellSize / 2, ty + 10);
                    ctx.lineTo(tx + cellSize / 2, ty + cellSize - 10);
                    ctx.stroke();
                }
                // idle tiles render nothing — the arena floor shows through
            }

            // Goal
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