import type { Trial } from '../../types';
import { COLORS } from '../../constants';
import { spawnBurst } from '../../particles';
import { beep } from '../../audio';
import { move, drawArena, time } from '../shared';

type Mirror = { col: number; row: number; orient: '/' | '\\' };
type Wall   = { col: number; row: number };

type Layout = {
    cols: number;
    rows: number;
    sourceCol: number; sourceRow: number;
    targetCol: number; targetRow: number;
    mirrors: { col: number; row: number }[];
    walls: Wall[];
};

// All three layouts hand-verified solvable.
// If you change them, the brute-force check at startup will warn in the console.
const LAYOUTS: Layout[] = [
    // ── Tier 1: 4 mirrors + 1 wall ──
    // Same row source→target, wall blocks the direct path. Detour via row 3.
    // Solving config: \, \, /, /
    {
        cols: 9, rows: 5,
        sourceCol: -1, sourceRow: 1,
        targetCol:  9, targetRow: 1,
        mirrors: [
            { col: 2, row: 1 }, { col: 2, row: 3 },
            { col: 6, row: 3 }, { col: 6, row: 1 },
        ],
        walls: [{ col: 4, row: 1 }],
    },

    // ── Tier 2: 5 mirrors + 2 walls ──
    // Diagonal corner-to-corner with a stagger that forces an up-bend.
    // Solving config: \, \, /, /, \
    {
        cols: 11, rows: 5,
        sourceCol: -1, sourceRow: 0,
        targetCol: 10, targetRow: 4,
        mirrors: [
            { col: 1, row: 0 }, { col: 1, row: 4 },
            { col: 5, row: 4 }, { col: 5, row: 2 },
            { col: 10, row: 2 },
        ],
        walls: [
            { col: 3, row: 0 },     // blocks direct row-0 dash
            { col: 3, row: 2 },     // blocks a tempting middle shortcut
        ],
    },

    // ── Tier 3: 6 mirrors + 3 walls ──
    // Source + target both on the top row, but a wall forces you all the way
    // down to row 4, across the bottom, then back up the right side.
    // Solving config: \, \, \, \, /, /
    {
        cols: 11, rows: 5,
        sourceCol: -1, sourceRow: 0,
        targetCol: 11, targetRow: 0,
        mirrors: [
            { col: 1, row: 0 }, { col: 1, row: 3 },
            { col: 4, row: 3 }, { col: 4, row: 4 },
            { col: 10, row: 4 }, { col: 10, row: 0 },
        ],
        walls: [
            { col: 3, row: 0 },     // blocks the easy left-side dash
            { col: 5, row: 2 },     // blocks the middle
            { col: 9, row: 0 },     // blocks the easy right-side dash
        ],
    },
];

export function makeMirrorBeam(b: any, p: any, tier: number): Trial {
    const layout = LAYOUTS[Math.min(tier - 1, LAYOUTS.length - 1)];
    const { cols, rows, sourceCol, sourceRow, targetCol, targetRow } = layout;

    const mirrors: Mirror[] = layout.mirrors.map(m => ({
        ...m, orient: Math.random() < 0.5 ? '/' : '\\',
    }));
    const walls: Wall[] = [...layout.walls];

    // Trace the beam through cells. Walls absorb, mirrors reflect.
    function computeBeam() {
        const path: { col: number; row: number }[] = [{ col: sourceCol, row: sourceRow }];
        let col = sourceCol, row = sourceRow;
        let dx = 1, dy = 0;
        const maxSteps = (cols + 2) * (rows + 2) * 4;
        let steps = 0, hits = false;
        while (steps++ < maxSteps) {
            col += dx; row += dy;
            path.push({ col, row });
            if (col === targetCol && row === targetRow) { hits = true; break; }
            if (col < -1 || col > cols || row < -1 || row > rows) break;
            // Wall → beam absorbed
            if (walls.some(w => w.col === col && w.row === row)) break;
            // Mirror → reflect
            const m = mirrors.find(mm => mm.col === col && mm.row === row);
            if (m) {
                if (m.orient === '/') { [dx, dy] = [-dy, -dx]; }
                else                  { [dx, dy] = [ dy,  dx]; }
            }
        }
        return { path, hits };
    }

    // ── Solvability guard ──
    // Brute-force all 2^N orientations. If none reach the target, the layout
    // itself is broken — log to console so we catch it before shipping a bad puzzle.
    function hasAnyValidSolution(): boolean {
        const total = 1 << mirrors.length;          // 2^N combos
        const original = mirrors.map(m => m.orient);
        let found = false;
        for (let bits = 0; bits < total; bits++) {
            for (let i = 0; i < mirrors.length; i++) {
                mirrors[i].orient = (bits & (1 << i)) ? '/' : '\\';
            }
            if (computeBeam().hits) { found = true; break; }
        }
        mirrors.forEach((m, i) => m.orient = original[i]);
        return found;
    }
    if (!hasAnyValidSolution()) {
        console.warn(`MirrorBeam tier ${tier}: layout has NO solving orientation!`);
    }

    // Re-randomize until the puzzle isn't already solved
    let scrambleTries = 0;
    while (scrambleTries++ < 30 && computeBeam().hits) {
        for (const m of mirrors) m.orient = Math.random() < 0.5 ? '/' : '\\';
    }

    // Sizing — fit grid + halo for source/target
    const CELL = Math.min(
        72,
        Math.floor(Math.min(b.w * 0.85 / (cols + 2), b.h * 0.70 / (rows + 2))),
    );
    const gridPx = { w: cols * CELL, h: rows * CELL };
    const ox = b.x + (b.w - gridPx.w) / 2;
    const oy = b.y + (b.h - gridPx.h) / 2 + 14;

    const wx = (c: number) => ox + c * CELL + CELL / 2;
    const wy = (r: number) => oy + r * CELL + CELL / 2;

    p.x = ox + gridPx.w / 2;
    p.y = oy + gridPx.h / 2;

    let lastTouchedKey = '';
    let won = false;
    let pulseT = 0;

    return {
        type: 'puzzle', variant: 'mirror-beam', player: p, bounds: b,
        title: `◉  MIRROR BEAM · TIER ${tier}`,
        hint: 'Step on a mirror to rotate it — guide the beam past the walls to the target',

        update() {
            pulseT++;
            if (won) return;
            move(p, b);

            // Toggle mirrors by stepping (walls aren't toggleable)
            const cc = Math.floor((p.x - ox) / CELL);
            const cr = Math.floor((p.y - oy) / CELL);
            if (cc >= 0 && cc < cols && cr >= 0 && cr < rows) {
                const key = `${cr}-${cc}`;
                if (key !== lastTouchedKey) {
                    lastTouchedKey = key;
                    const m = mirrors.find(mm => mm.col === cc && mm.row === cr);
                    if (m) {
                        m.orient = m.orient === '/' ? '\\' : '/';
                        beep(440 + cc * 30, 0.1, 'sine');
                    }
                }
            } else {
                lastTouchedKey = '';
            }

            if (computeBeam().hits) {
                won = true;
                beep(660, 0.18, 'sine');
                setTimeout(() => beep(880, 0.25, 'sine'), 80);
                spawnBurst(wx(targetCol), wy(targetRow), '#c89b5a', 40);
            }
        },

        draw(ctx) {
            drawArena(ctx, b, '#6a5a8a');

            // Grid plate
            ctx.fillStyle = 'rgba(20, 16, 30, 0.5)';
            ctx.fillRect(ox - 4, oy - 4, gridPx.w + 8, gridPx.h + 8);
            ctx.strokeStyle = 'rgba(106,90,138,0.35)'; ctx.lineWidth = 1;
            for (let c = 0; c <= cols; c++) {
                ctx.beginPath();
                ctx.moveTo(ox + c * CELL, oy);
                ctx.lineTo(ox + c * CELL, oy + gridPx.h);
                ctx.stroke();
            }
            for (let r = 0; r <= rows; r++) {
                ctx.beginPath();
                ctx.moveTo(ox,            oy + r * CELL);
                ctx.lineTo(ox + gridPx.w, oy + r * CELL);
                ctx.stroke();
            }

            // ── Walls (drawn under mirrors/beam) ──
            for (const w of walls) {
                const cx = wx(w.col), cy = wy(w.row);
                ctx.fillStyle = '#2a1f18';
                ctx.fillRect(cx - CELL / 2 + 4, cy - CELL / 2 + 4, CELL - 8, CELL - 8);
                ctx.strokeStyle = '#1a1010'; ctx.lineWidth = 2;
                ctx.strokeRect(cx - CELL / 2 + 4, cy - CELL / 2 + 4, CELL - 8, CELL - 8);
                // brick texture
                ctx.fillStyle = '#1a1010';
                for (let i = 0; i < 3; i++) {
                    const off = (i % 2) * 8;
                    ctx.fillRect(cx - CELL / 2 + 8 + off, cy - CELL / 2 + 10 + i * 12, CELL - 24 - off, 4);
                }
            }

            // Beam
            const beam = computeBeam();
            const beamColor = beam.hits ? '#fff5ba' : '#c89b5a';
            ctx.strokeStyle = beamColor;
            ctx.lineWidth = 4;
            ctx.shadowColor = beamColor; ctx.shadowBlur = 14;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(wx(beam.path[0].col), wy(beam.path[0].row));
            for (let i = 1; i < beam.path.length; i++) {
                ctx.lineTo(wx(beam.path[i].col), wy(beam.path[i].row));
            }
            ctx.stroke();
            ctx.shadowBlur = 0;
            ctx.lineCap = 'butt';

            // Source orb
            const sx = wx(sourceCol), sy = wy(sourceRow);
            ctx.fillStyle = '#c89b5a';
            ctx.shadowColor = '#c89b5a'; ctx.shadowBlur = 14;
            ctx.beginPath(); ctx.arc(sx, sy, 14, 0, Math.PI * 2); ctx.fill();
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#fff5ba';
            ctx.beginPath(); ctx.arc(sx, sy, 6, 0, Math.PI * 2); ctx.fill();

            // Target receiver
            const tx = wx(targetCol), ty = wy(targetRow);
            ctx.fillStyle   = beam.hits ? '#6f8a52' : '#251f30';
            ctx.strokeStyle = beam.hits ? '#fff5ba' : '#7a6048';
            ctx.lineWidth = 3;
            if (beam.hits) { ctx.shadowColor = '#6f8a52'; ctx.shadowBlur = 18; }
            ctx.beginPath(); ctx.arc(tx, ty, 18, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            ctx.shadowBlur = 0;
            ctx.strokeStyle = beam.hits ? '#fff5ba' : '#c89b5a';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(tx - 10, ty); ctx.lineTo(tx + 10, ty);
            ctx.moveTo(tx, ty - 10); ctx.lineTo(tx, ty + 10);
            ctx.stroke();

            // Mirrors
            for (const m of mirrors) {
                const cx = wx(m.col), cy = wy(m.row);
                ctx.fillStyle = 'rgba(40, 30, 50, 0.75)';
                ctx.fillRect(cx - CELL / 2 + 6, cy - CELL / 2 + 6, CELL - 12, CELL - 12);
                ctx.strokeStyle = '#6a5a8a'; ctx.lineWidth = 1;
                ctx.strokeRect(cx - CELL / 2 + 6, cy - CELL / 2 + 6, CELL - 12, CELL - 12);
                ctx.strokeStyle = '#dde0ea'; ctx.lineWidth = 5;
                ctx.shadowColor = '#dde0ea'; ctx.shadowBlur = 4;
                ctx.lineCap = 'round';
                ctx.beginPath();
                if (m.orient === '/') {
                    ctx.moveTo(cx - CELL / 2 + 14, cy + CELL / 2 - 14);
                    ctx.lineTo(cx + CELL / 2 - 14, cy - CELL / 2 + 14);
                } else {
                    ctx.moveTo(cx - CELL / 2 + 14, cy - CELL / 2 + 14);
                    ctx.lineTo(cx + CELL / 2 - 14, cy + CELL / 2 - 14);
                }
                ctx.stroke();
                ctx.shadowBlur = 0;
                ctx.lineCap = 'butt';
            }

            // Header
            ctx.fillStyle = COLORS.text;
            ctx.font = 'bold 14px "JetBrains Mono", monospace';
            ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
            ctx.fillText(
                won ? 'BEAM LOCKED ✦' : 'STEP ON MIRRORS TO ROTATE · DARK BLOCKS ABSORB THE BEAM',
                b.x + b.w / 2, b.y + 36,
            );
        },

        isComplete() { return won; },
    };
}