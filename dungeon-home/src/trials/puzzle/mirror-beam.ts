import type { Trial } from '../../types';
import { COLORS } from '../../constants';
import { spawnBurst } from '../../particles';
import { beep } from '../../audio';
import { move, drawArena } from '../shared';

type Mirror = { col: number; row: number; orient: '/' | '\\' };

type Layout = {
    cols: number;
    rows: number;
    sourceCol: number; sourceRow: number;     // source is outside the grid (col = -1 or col = cols, etc.)
    targetCol: number; targetRow: number;     // same — target sits one cell outside
    mirrors: { col: number; row: number }[];
};

// Hand-designed layouts — each one HAS a solution if mirrors are rotated correctly.
const LAYOUTS: Layout[] = [
    // ── tier 1: simple Z (2 mirrors, both must be \) ──
    {
        cols: 8, rows: 5,
        sourceCol: -1, sourceRow: 1,
        targetCol:  8, targetRow: 3,
        mirrors: [{ col: 3, row: 1 }, { col: 3, row: 3 }],
    },
    // ── tier 2: hook to the top edge (3 mirrors) ──
    {
        cols: 7, rows: 5,
        sourceCol: -1, sourceRow: 2,
        targetCol:  4, targetRow: -1,            // exits on the TOP
        mirrors: [{ col: 1, row: 2 }, { col: 1, row: 4 }, { col: 4, row: 4 }],
    },
    // ── tier 3: rectangular S (4 mirrors) ──
    {
        cols: 8, rows: 4,
        sourceCol: -1, sourceRow: 0,
        targetCol:  8, targetRow: 0,
        mirrors: [
            { col: 1, row: 0 }, { col: 1, row: 3 },
            { col: 4, row: 3 }, { col: 4, row: 0 },
        ],
    },
];

export function makeMirrorBeam(b: any, p: any, tier: number): Trial {
    const layout = LAYOUTS[Math.min(tier - 1, LAYOUTS.length - 1)];
    const { cols, rows, sourceCol, sourceRow, targetCol, targetRow } = layout;

    // Mirrors with random initial orientation
    const mirrors: Mirror[] = layout.mirrors.map(m => ({
        ...m, orient: Math.random() < 0.5 ? '/' : '\\',
    }));

    // Trace the beam through cells, bouncing off any mirror it meets.
    // Returns the polyline (in cell coords) plus whether the target was reached.
    function computeBeam() {
        const path: { col: number; row: number }[] = [{ col: sourceCol, row: sourceRow }];
        let col = sourceCol, row = sourceRow;
        let dx = 1, dy = 0;   // source always fires to the right
        const maxSteps = (cols + 2) * (rows + 2) * 4;
        let steps = 0, hits = false;
        while (steps++ < maxSteps) {
            col += dx; row += dy;
            path.push({ col, row });
            if (col === targetCol && row === targetRow) { hits = true; break; }
            if (col < -1 || col > cols || row < -1 || row > rows) break;
            const m = mirrors.find(mm => mm.col === col && mm.row === row);
            if (m) {
                if (m.orient === '/') { [dx, dy] = [-dy, -dx]; }   // r↔u, l↔d
                else                  { [dx, dy] = [ dy,  dx]; }   // r↔d, l↔u
            }
        }
        return { path, hits };
    }

    // Re-randomize until the puzzle isn't already solved
    let scrambleTries = 0;
    while (scrambleTries++ < 30 && computeBeam().hits) {
        for (const m of mirrors) m.orient = Math.random() < 0.5 ? '/' : '\\';
    }

    // Sizing — fit the grid + a 1-cell halo (for the source/target) inside the arena
    const CELL = Math.min(
        80,
        Math.floor(Math.min(b.w * 0.85 / (cols + 2), b.h * 0.7 / (rows + 2))),
    );
    const gridPx = { w: cols * CELL, h: rows * CELL };
    const ox = b.x + (b.w - gridPx.w) / 2;
    const oy = b.y + (b.h - gridPx.h) / 2 + 14;

    const wx = (c: number) => ox + c * CELL + CELL / 2;
    const wy = (r: number) => oy + r * CELL + CELL / 2;

    // Spawn the player near the centre of the grid
    p.x = ox + gridPx.w / 2;
    p.y = oy + gridPx.h / 2;

    let lastTouchedKey = '';
    let won = false;
    let pulseT = 0;

    return {
        type: 'puzzle', variant: 'mirror-beam', player: p, bounds: b,
        title: `◉  MIRROR BEAM · TIER ${tier}`,
        hint: 'Step on a mirror to rotate it — guide the beam to the target',

        update() {
            pulseT++;
            if (won) return;
            move(p, b);

            // Which grid cell is the player on?
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
                ctx.moveTo(ox,             oy + r * CELL);
                ctx.lineTo(ox + gridPx.w,  oy + r * CELL);
                ctx.stroke();
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

            // Source orb (gold sun)
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
                // tile base
                ctx.fillStyle = 'rgba(40, 30, 50, 0.75)';
                ctx.fillRect(cx - CELL / 2 + 6, cy - CELL / 2 + 6, CELL - 12, CELL - 12);
                ctx.strokeStyle = '#6a5a8a'; ctx.lineWidth = 1;
                ctx.strokeRect(cx - CELL / 2 + 6, cy - CELL / 2 + 6, CELL - 12, CELL - 12);
                // mirror line
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
                // subtle dust under the mirror so it has weight
                ctx.fillStyle = 'rgba(0,0,0,0.4)';
                ctx.fillRect(cx - CELL / 2 + 6, cy + CELL / 2 - 4, CELL - 12, 2);
            }

            // Header
            ctx.fillStyle = COLORS.text;
            ctx.font = 'bold 14px "JetBrains Mono", monospace';
            ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
            ctx.fillText(
                won ? 'BEAM LOCKED ✦' : 'STEP ON A MIRROR TO ROTATE',
                b.x + b.w / 2, b.y + 36,
            );
        },

        isComplete() { return won; },
    };
}