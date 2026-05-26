import type { Trial } from '../../types';
import { COLORS } from '../../constants';
import { spawnBurst } from '../../particles';
import { beep } from '../../audio';
import { move, drawArena, time } from '../shared';

export function makeLightsOut(b: any, p: any, tier: number): Trial {
    // ── Board sizing (was 6×4 on tier 3 due to an off-by-one in cols) ──
    const cols    = Math.min(5, 3 + tier);      // T1=4 · T2=5 · T3=5
    const rows    = tier >= 3 ? 4 : 3;          // T1=3 · T2=3 · T3=4
    const cellW   = 88;
    const cellH   = 88;
    const gridW   = cols * cellW;
    const gridH   = rows * cellH;
    const startX  = b.x + (b.w - gridW) / 2;
    const startY  = b.y + (b.h - gridH) / 2 + 20;

    // True = lit, false = dark
    const tiles: boolean[][] = [];
    for (let r = 0; r < rows; r++) {
        const row: boolean[] = [];
        for (let c = 0; c < cols; c++) row.push(true);
        tiles.push(row);
    }

    const toggle = (r: number, c: number) => {
        if (r < 0 || r >= rows || c < 0 || c >= cols) return;
        tiles[r][c] = !tiles[r][c];
    };
    const press = (r: number, c: number) => {
        toggle(r, c);
        toggle(r - 1, c); toggle(r + 1, c);
        toggle(r, c - 1); toggle(r, c + 1);
    };

    // ── Chase-the-lights verifier ──
    // Simulates the technique on a copy of the board and checks whether
    // the bottom row ends up fully lit. If yes, this puzzle is
    // directly chaseable (no opener table needed).
    function isChaseSolvable(): boolean {
        const work = tiles.map(r => [...r]);
        const pressW = (r: number, c: number) => {
            if (r < 0 || r >= rows || c < 0 || c >= cols) return;
            work[r][c] = !work[r][c];
            if (r > 0)        work[r - 1][c] = !work[r - 1][c];
            if (r < rows - 1) work[r + 1][c] = !work[r + 1][c];
            if (c > 0)        work[r][c - 1] = !work[r][c - 1];
            if (c < cols - 1) work[r][c + 1] = !work[r][c + 1];
        };
        // Chase: for every unlit tile in rows 0…rows-2, press the tile directly below it.
        for (let r = 0; r < rows - 1; r++) {
            for (let c = 0; c < cols; c++) {
                if (!work[r][c]) pressW(r + 1, c);
            }
        }
        // Bottom row must be fully lit afterwards
        for (let c = 0; c < cols; c++) if (!work[rows - 1][c]) return false;
        return true;
    }

    // ── Scramble + regenerate until chase-friendly ──
    const shuffleCount = 1 + tier * 2;          // T1=3 · T2=5 · T3=7
    let attempts = 0;
    while (attempts++ < 40) {
        // reset to fully lit
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) tiles[r][c] = true;
        // apply random presses
        for (let i = 0; i < shuffleCount; i++) {
            press(Math.floor(Math.random() * rows), Math.floor(Math.random() * cols));
        }
        // accept if (a) not pre-solved and (b) chase technique will solve it
        let allLit = true;
        for (let r = 0; r < rows && allLit; r++)
            for (let c = 0; c < cols && allLit; c++)
                if (!tiles[r][c]) allLit = false;
        if (!allLit && isChaseSolvable()) break;
    }

    let lastTouchedKey = '';
    let pulseT = 0;
    let won = false;

    function countLit(): number {
        let n = 0;
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (tiles[r][c]) n++;
        return n;
    }

    return {
        type: 'puzzle', variant: 'lights-out', player: p, bounds: b,
        title: `◉  LIGHTS OUT · TIER ${tier}`,
        hint: 'Press the tile BELOW each unlit one, row by row top→bottom',

        update() {
            pulseT++;
            if (won) return;
            move(p, b);

            // Which cell is the player standing in?
            const cx = Math.floor((p.x - startX) / cellW);
            const cy = Math.floor((p.y - startY) / cellH);
            if (cx >= 0 && cx < cols && cy >= 0 && cy < rows) {
                const key = `${cy}-${cx}`;
                if (key !== lastTouchedKey) {
                    lastTouchedKey = key;
                    press(cy, cx);
                    beep(440 + cx * 30 + cy * 20, 0.1, 'sine');
                    const tx = startX + cx * cellW + cellW / 2;
                    const ty = startY + cy * cellH + cellH / 2;
                    spawnBurst(tx, ty, '#c89b5a', 6);
                }
            } else {
                lastTouchedKey = '';
            }

            // Win check
            let allLit = true;
            for (let r = 0; r < rows && allLit; r++)
                for (let c = 0; c < cols && allLit; c++)
                    if (!tiles[r][c]) allLit = false;
            if (allLit) {
                won = true;
                beep(660, 0.18, 'sine');
                setTimeout(() => beep(880, 0.25, 'sine'), 80);
                spawnBurst(b.x + b.w / 2, b.y + b.h / 2, '#c89b5a', 40);
            }
        },

        draw(ctx) {
            drawArena(ctx, b, '#6a5a8a');

            // Thin frame around the grid
            ctx.strokeStyle = 'rgba(106,90,138,0.3)'; ctx.lineWidth = 1;
            ctx.strokeRect(startX - 2, startY - 2, gridW + 4, gridH + 4);

            // Tiles
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    const tx = startX + c * cellW;
                    const ty = startY + r * cellH;
                    const lit = tiles[r][c];

                    ctx.fillStyle = lit ? '#c89b5a' : '#1f1a2a';
                    if (lit) { ctx.shadowColor = '#c89b5a'; ctx.shadowBlur = 10; }
                    ctx.fillRect(tx + 4, ty + 4, cellW - 8, cellH - 8);
                    ctx.shadowBlur = 0;

                    ctx.strokeStyle = lit ? '#fff5ba' : '#6a5a8a';
                    ctx.lineWidth = 2;
                    ctx.strokeRect(tx + 4, ty + 4, cellW - 8, cellH - 8);

                    if (lit) {
                        const wave = 0.55 + 0.25 * Math.sin(pulseT / 10 + c * 0.4 + r * 0.7);
                        ctx.fillStyle = `rgba(255, 245, 186, ${wave})`;
                        ctx.beginPath();
                        ctx.arc(tx + cellW / 2, ty + cellH / 2, 12, 0, Math.PI * 2);
                        ctx.fill();
                    } else {
                        ctx.fillStyle = 'rgba(106,90,138,0.5)';
                        ctx.beginPath();
                        ctx.arc(tx + cellW / 2, ty + cellH / 2, 5, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }
            }

            const lit = countLit();
            const total = rows * cols;
            ctx.fillStyle = COLORS.text;
            ctx.font = 'bold 16px "JetBrains Mono", monospace';
            ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
            ctx.fillText(`LIT  ${lit} / ${total}`, b.x + b.w / 2, b.y + 36);
        },

        isComplete() { return won; },
    };
}