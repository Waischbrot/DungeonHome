import type { Trial } from '../../types';
import { COLORS } from '../../constants';
import { spawnBurst } from '../../particles';
import { beep } from '../../audio';
import { move, drawArena } from '../shared';

export function makeLightsOut(b: any, p: any, tier: number): Trial {
    // Board grows with tier: tier 1 = 4×3, tier 2 = 5×3, tier 3 = 5×4
    const cols    = 4 + Math.min(2, tier - 1);
    const rows    = tier >= 3 ? 4 : 3;
    const cellW   = 88;
    const cellH   = 88;
    const gridW   = cols * cellW;
    const gridH   = rows * cellH;
    const startX  = b.x + (b.w - gridW) / 2;
    const startY  = b.y + (b.h - gridH) / 2 + 20;

    // True = lit, false = dark. We start fully lit, then "unsolve" with N random presses.
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

    // Scramble — guaranteed solvable because we only used presses.
    const shuffleCount = 3 + tier * 2;
    for (let i = 0; i < shuffleCount; i++) {
        press(Math.floor(Math.random() * rows), Math.floor(Math.random() * cols));
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
        hint: 'Light every tile. Stepping on a tile toggles it AND its neighbours.',

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
                    // Tiny sparkle on the pressed tile
                    const tx = startX + cx * cellW + cellW / 2;
                    const ty = startY + cy * cellH + cellH / 2;
                    spawnBurst(tx, ty, '#c89b5a', 6);
                }
            } else {
                lastTouchedKey = '';
            }

            // Win check
            let allLit = true;
            for (let r = 0; r < rows && allLit; r++) for (let c = 0; c < cols && allLit; c++) {
                if (!tiles[r][c]) allLit = false;
            }
            if (allLit) {
                won = true;
                beep(660, 0.18, 'sine');
                setTimeout(() => beep(880, 0.25, 'sine'), 80);
                spawnBurst(b.x + b.w / 2, b.y + b.h / 2, '#c89b5a', 40);
            }
        },

        draw(ctx) {
            drawArena(ctx, b, '#6a5a8a');

            // Optional thin grid behind the tiles
            ctx.strokeStyle = 'rgba(106,90,138,0.3)'; ctx.lineWidth = 1;
            ctx.strokeRect(startX - 2, startY - 2, gridW + 4, gridH + 4);

            // Tiles
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    const tx = startX + c * cellW;
                    const ty = startY + r * cellH;
                    const lit = tiles[r][c];

                    // tile body
                    ctx.fillStyle = lit ? '#c89b5a' : '#1f1a2a';
                    if (lit) { ctx.shadowColor = '#c89b5a'; ctx.shadowBlur = 10; }
                    ctx.fillRect(tx + 4, ty + 4, cellW - 8, cellH - 8);
                    ctx.shadowBlur = 0;

                    // border
                    ctx.strokeStyle = lit ? '#fff5ba' : '#6a5a8a';
                    ctx.lineWidth = 2;
                    ctx.strokeRect(tx + 4, ty + 4, cellW - 8, cellH - 8);

                    // inner pulse
                    if (lit) {
                        const wave = 0.55 + 0.25 * Math.sin(pulseT / 10 + c * 0.4 + r * 0.7);
                        ctx.fillStyle = `rgba(255, 245, 186, ${wave})`;
                        ctx.beginPath();
                        ctx.arc(tx + cellW / 2, ty + cellH / 2, 12, 0, Math.PI * 2);
                        ctx.fill();
                    } else {
                        // subtle "dead" mark
                        ctx.fillStyle = 'rgba(106,90,138,0.5)';
                        ctx.beginPath();
                        ctx.arc(tx + cellW / 2, ty + cellH / 2, 5, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }
            }

            // Header
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