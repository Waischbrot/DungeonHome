import {CANVAS_H, CANVAS_W, CATEGORY_COLORS, COLORS, PLAYER_SPEED, SEAL_COLORS, SEAL_ICONS,} from './constants';
import {camera, canOpenDoor, doorPos, player, rooms} from './state';
import {keys} from './input';
import {drawParticles} from './particles';
import type {ClassId, Decoration, Door, Npc, NpcRole, Room} from './types';
import {time} from './trials/shared';

type Rect = { x: number; y: number; w: number; h: number };

// ─── Collision ────────────────────────────────────────────────
function isInRoom(px: number, py: number, r: Room) {
    return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}
function canStand(x: number, y: number) {
    for (const r of rooms.values()) if (isInRoom(x, y, r)) return true;
    return isInCorridor(x, y);
}

export function findNearestDoor(): { door: Door; dist: number } | null {
    let best: { door: Door; dist: number } | null = null;
    for (const r of rooms.values()) for (const d of r.doors) {
        const dp = doorPos(r, d);
        const dist = Math.hypot(dp.x - player.x, dp.y - player.y);
        if (dist < 48 && (!best || dist < best.dist)) best = { door: d, dist };
    }
    return best;
}

export function updateHub() {
    let dx = 0, dy = 0;
    if (keys.has('w') || keys.has('arrowup'))    dy -= 1;
    if (keys.has('s') || keys.has('arrowdown'))  dy += 1;
    if (keys.has('a') || keys.has('arrowleft'))  dx -= 1;
    if (keys.has('d') || keys.has('arrowright')) dx += 1;
    if (dx && dy) { dx *= 0.707; dy *= 0.707; }
    const speedBase = player.clazz.id === 'wayfarer' ? PLAYER_SPEED * 1.15 : PLAYER_SPEED;
    const sp = speedBase * time.dt;                              // ← dt-scaled
    const nx = player.x + dx * sp, ny = player.y + dy * sp;
    if (canStand(nx, ny)) { player.x = nx; player.y = ny; }
    else if (canStand(nx, player.y)) player.x = nx;
    else if (canStand(player.x, ny)) player.y = ny;

    // Camera smoothing — dt-aware exponential follow.
    // 0.12 is the per-60fps-frame catch-up factor; we scale it by dt.
    const camLerp = 1 - Math.pow(1 - 0.12, time.dt);
    camera.x += (player.x - camera.x) * camLerp;
    camera.y += (player.y - camera.y) * camLerp;
    if (camera.shake > 0) camera.shake *= Math.pow(0.85, time.dt);

    for (const r of rooms.values()) if (isInRoom(player.x, player.y, r)) { player.room = r.id; break; }
}

// ─── Main draw ────────────────────────────────────────────────
export function drawHub(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = COLORS.bgDark;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    ctx.save();
    const shakeX = (Math.random() - 0.5) * camera.shake;
    const shakeY = (Math.random() - 0.5) * camera.shake;
    ctx.translate(CANVAS_W / 2 - camera.x + shakeX, CANVAS_H / 2 - camera.y + shakeY);

    // subtle background grid
    ctx.strokeStyle = 'rgba(180,140,90,0.03)'; ctx.lineWidth = 1;
    const gs = 48;
    const sx = Math.floor((camera.x - CANVAS_W / 2 - 200) / gs) * gs;
    const sy = Math.floor((camera.y - CANVAS_H / 2 - 200) / gs) * gs;
    for (let x = sx; x < camera.x + CANVAS_W / 2 + 200; x += gs) {
        ctx.beginPath(); ctx.moveTo(x, camera.y - CANVAS_H); ctx.lineTo(x, camera.y + CANVAS_H); ctx.stroke();
    }
    for (let y = sy; y < camera.y + CANVAS_H / 2 + 200; y += gs) {
        ctx.beginPath(); ctx.moveTo(camera.x - CANVAS_W, y); ctx.lineTo(camera.x + CANVAS_W, y); ctx.stroke();
    }

    // corridors first, walls overlap them
    for (const r of rooms.values()) for (const d of r.doors) {
        if (d.opened && d.linked) drawCorridor(ctx, r, d);
    }
    // rooms: floor → decorations → walls → NPC  (NO room title anymore)
    for (const r of rooms.values()) {
        drawRoomFloor(ctx, r);
        drawRoomDecorations(ctx, r);
        drawRoomWalls(ctx, r);
        if (r.npc) drawNpc(ctx, r, r.npc);
    }
    // doors
    for (const r of rooms.values()) for (const d of r.doors) {
        const dp = doorPos(r, d);
        drawDoor(ctx, dp.x, dp.y, d);
    }
    drawPlayer(ctx);
    drawParticles(ctx);
    ctx.restore();
    drawVignette(ctx);
}

function drawCorridorFloor(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
    ctx.fillStyle = COLORS.stoneDark;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    for (let yy = y; yy < y + h; yy += 16) {
        const off = ((yy / 16) % 2) * 8;
        for (let xx = x + off; xx < x + w; xx += 16) ctx.fillRect(xx, yy, 14, 14);
    }
}

function drawCorridor(ctx: CanvasRenderingContext2D, r: Room, d: Door) {
    if (d.corridorPath) {
        // ── Resolve both door endpoints so we can skip frame edges at room walls ──
        const dpA = doorPos(r, d);
        let dpB: { x: number; y: number } | null = null;
        if (d.linked) {
            const linkedRoom = rooms.get(d.linked);
            if (linkedRoom) {
                const back = linkedRoom.doors.find(bd => bd.linked === r.id);
                if (back) dpB = doorPos(linkedRoom, back);
            }
        }

        // helpers: is this rect's edge sitting exactly at a door opening?
        const inRangeX = (px: number, rect: Rect) => px >= rect.x && px <= rect.x + rect.w;
        const inRangeY = (py: number, rect: Rect) => py >= rect.y && py <= rect.y + rect.h;
        const atDoorTop    = (rect: Rect) =>
            (!!dpA && Math.abs(dpA.y - rect.y)             < 2 && inRangeX(dpA.x, rect)) ||
            (!!dpB && Math.abs(dpB.y - rect.y)             < 2 && inRangeX(dpB.x, rect));
        const atDoorBot    = (rect: Rect) =>
            (!!dpA && Math.abs(dpA.y - (rect.y + rect.h))  < 2 && inRangeX(dpA.x, rect)) ||
            (!!dpB && Math.abs(dpB.y - (rect.y + rect.h))  < 2 && inRangeX(dpB.x, rect));
        const atDoorLeft   = (rect: Rect) =>
            (!!dpA && Math.abs(dpA.x - rect.x)             < 2 && inRangeY(dpA.y, rect)) ||
            (!!dpB && Math.abs(dpB.x - rect.x)             < 2 && inRangeY(dpB.y, rect));
        const atDoorRight  = (rect: Rect) =>
            (!!dpA && Math.abs(dpA.x - (rect.x + rect.w))  < 2 && inRangeY(dpA.y, rect)) ||
            (!!dpB && Math.abs(dpB.x - (rect.x + rect.w))  < 2 && inRangeY(dpB.y, rect));

        // ── Step 1: stone frame around each rect, but skip edges that sit at a door ──
        ctx.fillStyle = COLORS.stone;
        for (const rect of d.corridorPath) {
            if (!atDoorTop(rect))   ctx.fillRect(rect.x,            rect.y - 4,         rect.w, 4);
            if (!atDoorBot(rect))   ctx.fillRect(rect.x,            rect.y + rect.h,    rect.w, 4);
            if (!atDoorLeft(rect))  ctx.fillRect(rect.x - 4,        rect.y,             4,      rect.h);
            if (!atDoorRight(rect)) ctx.fillRect(rect.x + rect.w,   rect.y,             4,      rect.h);
        }

        // ── Step 2: floor over every rect — overdraws any frame pieces that
        //           ended up inside another rect (the interior of the corridor union)
        for (const rect of d.corridorPath) drawCorridorFloor(ctx, rect.x, rect.y, rect.w, rect.h);

        return;
    }

    // ── Default straight 64×64 stub (unchanged) ──
    const dp = doorPos(r, d);
    let cx: number, cy: number, cw: number, ch: number;
    if (d.side === 'n' || d.side === 's') {
        cw = 64; ch = 64;
        cx = dp.x - 32; cy = d.side === 'n' ? dp.y - 64 : dp.y;
    } else {
        cw = 64; ch = 64;
        cy = dp.y - 32; cx = d.side === 'w' ? dp.x - 64 : dp.x;
    }
    drawCorridorFloor(ctx, cx, cy, cw, ch);
    ctx.fillStyle = COLORS.stone;
    if (d.side === 'n' || d.side === 's') {
        ctx.fillRect(cx - 4, cy, 4, ch);
        ctx.fillRect(cx + cw, cy, 4, ch);
    } else {
        ctx.fillRect(cx, cy - 4, cw, 4);
        ctx.fillRect(cx, cy + ch, cw, 4);
    }
    drawCorridorTorches(ctx, d, cx, cy, cw, ch);
}

function isInCorridor(px: number, py: number) {
    for (const r of rooms.values()) {
        for (const d of r.doors) {
            if (!d.opened || !d.linked) continue;

            // Custom corridor path
            if (d.corridorPath) {
                for (const rect of d.corridorPath) {
                    if (px >= rect.x && px <= rect.x + rect.w && py >= rect.y && py <= rect.y + rect.h) return true;
                }
                continue;
            }

            // Default straight stub
            const dp = doorPos(r, d);
            if (d.side === 'n' || d.side === 's') {
                const x1 = dp.x - 32, x2 = dp.x + 32;
                const y1 = d.side === 'n' ? dp.y - 64 : dp.y;
                const y2 = y1 + 64;
                if (px >= x1 && px <= x2 && py >= y1 && py <= y2) return true;
            } else {
                const y1 = dp.y - 32, y2 = dp.y + 32;
                const x1 = d.side === 'w' ? dp.x - 64 : dp.x;
                const x2 = x1 + 64;
                if (px >= x1 && px <= x2 && py >= y1 && py <= y2) return true;
            }
        }
    }
    return false;
}
function drawCorridorTorches(ctx: CanvasRenderingContext2D, d: Door, cx: number, cy: number, cw: number, ch: number) {
    const t = Date.now() / 100;
    const positions: { x: number; y: number }[] = [];
    if (d.side === 'n' || d.side === 's') {
        positions.push({ x: cx - 7, y: cy + ch * 0.5 });
        positions.push({ x: cx + cw + 3, y: cy + ch * 0.5 });
    } else {
        positions.push({ x: cx + cw * 0.5, y: cy - 7 });
        positions.push({ x: cx + cw * 0.5, y: cy + ch + 3 });
    }
    for (const p of positions) {
        ctx.fillStyle = '#5a3a1a'; ctx.fillRect(p.x, p.y, 4, 4);
        const flicker = 0.8 + Math.sin(t + p.x * 0.1) * 0.2;
        ctx.fillStyle = `rgba(212,168,81,${0.7 + flicker * 0.3})`;
        ctx.shadowColor = '#d4a851'; ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.ellipse(p.x + 2, p.y - 2, 2 * flicker, 4 * flicker, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    }
}

// ─── Room floor / walls ───────────────────────────────────────
function drawRoomFloor(ctx: CanvasRenderingContext2D, r: Room) {
    ctx.fillStyle = CATEGORY_COLORS[r.category];
    ctx.fillRect(r.x, r.y, r.w, r.h);
    for (let x = r.x; x < r.x + r.w; x += 32) {
        for (let y = r.y; y < r.y + r.h; y += 32) {
            const checker = ((x / 32) + (y / 32)) % 2;
            ctx.fillStyle = checker === 0 ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.025)';
            ctx.fillRect(x, y, 32, 32);
        }
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1;
    for (let x = r.x + 32; x < r.x + r.w; x += 32) {
        ctx.beginPath(); ctx.moveTo(x, r.y); ctx.lineTo(x, r.y + r.h); ctx.stroke();
    }
    for (let y = r.y + 32; y < r.y + r.h; y += 32) {
        ctx.beginPath(); ctx.moveTo(r.x, y); ctx.lineTo(r.x + r.w, y); ctx.stroke();
    }
}

function drawRoomWalls(ctx: CanvasRenderingContext2D, r: Room) {
    const wallW = 6;
    ctx.fillStyle = COLORS.stone;
    ctx.fillRect(r.x - wallW, r.y - wallW, r.w + 2 * wallW, wallW);
    ctx.fillRect(r.x - wallW, r.y + r.h,   r.w + 2 * wallW, wallW);
    ctx.fillRect(r.x - wallW, r.y - wallW, wallW, r.h + 2 * wallW);
    ctx.fillRect(r.x + r.w,   r.y - wallW, wallW, r.h + 2 * wallW);

    ctx.strokeStyle = COLORS.stoneDark; ctx.lineWidth = 1;
    for (let x = r.x - wallW; x < r.x + r.w + wallW; x += 24) {
        ctx.beginPath(); ctx.moveTo(x, r.y - wallW); ctx.lineTo(x, r.y); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x, r.y + r.h); ctx.lineTo(x, r.y + r.h + wallW); ctx.stroke();
    }
    for (let y = r.y - wallW; y < r.y + r.h + wallW; y += 24) {
        ctx.beginPath(); ctx.moveTo(r.x - wallW, y); ctx.lineTo(r.x, y); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(r.x + r.w, y); ctx.lineTo(r.x + r.w + wallW, y); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(180,140,90,0.3)'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(r.x - wallW, r.y - wallW); ctx.lineTo(r.x + r.w + wallW, r.y - wallW);
    ctx.stroke();

    // cut wall openings for opened doors
    for (const d of r.doors) {
        if (!d.opened || !d.linked) continue;
        const dp = doorPos(r, d);
        ctx.fillStyle = COLORS.stoneDark;
        if (d.side === 'n')      ctx.fillRect(dp.x - 32, r.y - wallW, 64, wallW);
        else if (d.side === 's') ctx.fillRect(dp.x - 32, r.y + r.h,   64, wallW);
        else if (d.side === 'w') ctx.fillRect(r.x - wallW, dp.y - 32, wallW, 64);
        else                     ctx.fillRect(r.x + r.w,   dp.y - 32, wallW, 64);
    }
}

// ─── Decorations dispatch (sprites unchanged from prior file) ─
function drawRoomDecorations(ctx: CanvasRenderingContext2D, r: Room) {
    for (const d of r.decorations) drawDecoration(ctx, r.x + d.x, r.y + d.y, d.kind);
}
function drawDecoration(ctx: CanvasRenderingContext2D, x: number, y: number, kind: Decoration['kind']) {
    switch (kind) {
        case 'pillar':         drawPillar(ctx, x, y); break;
        case 'bookshelf':      drawBookshelf(ctx, x, y); break;
        case 'anvil':          drawAnvil(ctx, x, y); break;
        case 'chest':          drawChest(ctx, x, y); break;
        case 'well-stone':     drawWellStone(ctx, x, y); break;
        case 'rug':            drawRug(ctx, x, y); break;
        case 'training-dummy': drawDummy(ctx, x, y); break;
        case 'weapon-rack':    drawWeaponRack(ctx, x, y); break;
        case 'banner':         drawBanner(ctx, x, y); break;
        case 'table':          drawTable(ctx, x, y); break;
        case 'rune-circle':    drawRuneCircle(ctx, x, y); break;
        case 'fountain':       drawFountain(ctx, x, y); break;
        case 'crate':          drawCrate(ctx, x, y); break;
        case 'brazier':        drawBrazier(ctx, x, y); break;
        case 'plant':          drawPlant(ctx, x, y); break;
        case 'candle':         drawCandle(ctx, x, y); break;
    }
}

function drawPillar(ctx: CanvasRenderingContext2D, x: number, y: number) {
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath(); ctx.ellipse(x, y + 18, 14, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = COLORS.stone;        ctx.fillRect(x - 14, y + 8,  28, 8);
    ctx.fillStyle = COLORS.stoneDark;    ctx.fillRect(x - 10, y - 14, 20, 22);
    ctx.fillStyle = COLORS.stone;        ctx.fillRect(x - 8,  y - 14, 4, 22);
    ctx.fillStyle = COLORS.stone;        ctx.fillRect(x - 14, y - 18, 28, 6);
}
function drawBookshelf(ctx: CanvasRenderingContext2D, x: number, y: number) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(x - 24, y + 14, 50, 4);
    ctx.fillStyle = COLORS.woodDark;    ctx.fillRect(x - 24, y - 18, 48, 36);
    const bookCols = ['#a14040', '#6a5a8a', '#6f8a52', '#c89b5a', '#5fb8b0', '#7a6a4a'];
    for (const sy of [y - 14, y - 2, y + 10]) {
        ctx.fillStyle = COLORS.wood; ctx.fillRect(x - 22, sy, 44, 1);
        let bx = x - 21;
        while (bx < x + 21) {
            const bw = 3 + Math.floor(Math.abs(Math.sin(bx * 1.3)) * 4);
            ctx.fillStyle = bookCols[Math.floor(Math.abs(Math.sin(bx)) * bookCols.length)];
            ctx.fillRect(bx, sy - 9, bw, 9);
            bx += bw + 1;
        }
    }
}
function drawAnvil(ctx: CanvasRenderingContext2D, x: number, y: number) {
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath(); ctx.ellipse(x, y + 14, 18, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = COLORS.woodDark; ctx.fillRect(x - 10, y + 4, 20, 10);
    ctx.fillStyle = '#2a2a2e';       ctx.fillRect(x - 16, y - 4, 32, 12);
    ctx.fillStyle = '#3a3a40';       ctx.fillRect(x - 16, y - 4, 32, 3);
    ctx.fillStyle = '#2a2a2e';
    ctx.beginPath(); ctx.moveTo(x - 16, y - 1); ctx.lineTo(x - 22, y); ctx.lineTo(x - 16, y + 4); ctx.closePath(); ctx.fill();
}
function drawChest(ctx: CanvasRenderingContext2D, x: number, y: number) {
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(x - 16, y + 14, 32, 3);
    ctx.fillStyle = COLORS.wood;     ctx.fillRect(x - 14, y - 4,  28, 18);
    ctx.fillStyle = COLORS.woodDark; ctx.fillRect(x - 14, y - 10, 28, 6);
    ctx.fillStyle = '#3a3328';
    ctx.fillRect(x - 14, y - 4, 28, 2); ctx.fillRect(x - 14, y + 4, 28, 2);
    ctx.fillStyle = COLORS.gold;     ctx.fillRect(x - 2, y - 3, 4, 6);
}
function drawWellStone(ctx: CanvasRenderingContext2D, x: number, y: number) {
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath(); ctx.ellipse(x, y + 22, 28, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = COLORS.stoneDark; ctx.beginPath(); ctx.ellipse(x, y + 16, 28, 10, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = COLORS.stone;     ctx.beginPath(); ctx.ellipse(x, y + 14, 28, 10, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2a4a5a';        ctx.beginPath(); ctx.ellipse(x, y + 12, 22, 7, 0, 0, Math.PI * 2); ctx.fill();
    const t = Date.now() / 800;
    ctx.fillStyle = 'rgba(120,180,200,0.4)';
    ctx.beginPath(); ctx.ellipse(x - 6 + Math.sin(t) * 4, y + 10, 8, 2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = COLORS.wood;     ctx.fillRect(x - 16, y - 20, 3, 30); ctx.fillRect(x + 13, y - 20, 3, 30);
    ctx.fillStyle = COLORS.woodDark;
    ctx.beginPath(); ctx.moveTo(x - 22, y - 18); ctx.lineTo(x + 22, y - 18); ctx.lineTo(x, y - 28); ctx.closePath(); ctx.fill();
    ctx.fillStyle = COLORS.wood;     ctx.fillRect(x - 16, y - 14, 32, 2);
    ctx.fillStyle = COLORS.woodDark; ctx.fillRect(x - 3,  y - 8,  6, 5);
}
function drawRug(ctx: CanvasRenderingContext2D, x: number, y: number) {
    ctx.fillStyle = '#6a3a3a'; ctx.fillRect(x - 40, y - 24, 80, 48);
    ctx.strokeStyle = COLORS.gold; ctx.lineWidth = 2; ctx.strokeRect(x - 36, y - 20, 72, 40);
    ctx.fillStyle = COLORS.gold;
    ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
}
function drawDummy(ctx: CanvasRenderingContext2D, x: number, y: number) {
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath(); ctx.ellipse(x, y + 18, 10, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = COLORS.wood;     ctx.fillRect(x - 8, y + 14, 16, 4);
    ctx.fillStyle = COLORS.woodDark; ctx.fillRect(x - 2, y - 10, 4, 24);
    ctx.fillStyle = '#7a6048';
    ctx.beginPath(); ctx.ellipse(x, y, 12, 16, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = COLORS.woodDark; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x - 12, y - 4); ctx.lineTo(x + 12, y - 4);
    ctx.moveTo(x - 12, y + 4); ctx.lineTo(x + 12, y + 4); ctx.stroke();
    ctx.fillStyle = COLORS.accentRed;
    ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
}
function drawWeaponRack(ctx: CanvasRenderingContext2D, x: number, y: number) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(x - 14, y + 14, 28, 3);
    ctx.fillStyle = COLORS.woodDark;
    ctx.fillRect(x - 16, y - 18, 32, 4); ctx.fillRect(x - 16, y + 10, 32, 4);
    ctx.fillRect(x - 16, y - 18, 4, 32); ctx.fillRect(x + 12, y - 18, 4, 32);
    for (let i = 0; i < 3; i++) {
        const sx = x - 10 + i * 9;
        ctx.fillStyle = '#a8a8b0'; ctx.fillRect(sx, y - 12, 2, 18);
        ctx.fillStyle = COLORS.woodDark; ctx.fillRect(sx - 2, y + 4, 6, 3);
        ctx.fillStyle = COLORS.gold;    ctx.fillRect(sx, y + 7, 2, 2);
    }
}
function drawBanner(ctx: CanvasRenderingContext2D, x: number, y: number) {
    ctx.fillStyle = COLORS.accentRed;
    ctx.beginPath();
    ctx.moveTo(x - 10, y - 20); ctx.lineTo(x + 10, y - 20);
    ctx.lineTo(x + 10, y + 24); ctx.lineTo(x, y + 18); ctx.lineTo(x - 10, y + 24);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = COLORS.gold; ctx.fillRect(x - 10, y - 20, 20, 2);
    ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
}
function drawTable(ctx: CanvasRenderingContext2D, x: number, y: number) {
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath(); ctx.ellipse(x, y + 16, 26, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = COLORS.woodDark;
    ctx.fillRect(x - 22, y, 4, 14); ctx.fillRect(x + 18, y, 4, 14);
    ctx.fillStyle = COLORS.wood;     ctx.fillRect(x - 26, y - 6, 52, 8);
    ctx.fillStyle = COLORS.woodDark; ctx.fillRect(x - 26, y + 1, 52, 2);
    ctx.fillStyle = COLORS.accentPurple; ctx.fillRect(x - 6, y - 9, 10, 3);
    ctx.fillStyle = COLORS.parchment;    ctx.fillRect(x + 10, y - 11, 3, 5);
    const flicker = 0.85 + Math.sin(Date.now() / 80) * 0.15;
    ctx.fillStyle = '#d4a851';
    ctx.beginPath(); ctx.arc(x + 11, y - 12, 1.5 * flicker, 0, Math.PI * 2); ctx.fill();
}
function drawRuneCircle(ctx: CanvasRenderingContext2D, x: number, y: number) {
    ctx.strokeStyle = COLORS.gold; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, 40, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(212,168,81,0.4)';
    ctx.beginPath(); ctx.arc(x, y, 32, 0, Math.PI * 2); ctx.stroke();
    const runes = ['Ϛ','Ψ','Ω','Ϟ','Ϡ','Ϟ','Ψ','Ϛ'];
    ctx.fillStyle = COLORS.gold;
    ctx.font = 'bold 14px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let i = 0; i < runes.length; i++) {
        const a = (i / runes.length) * Math.PI * 2;
        ctx.fillText(runes[i], x + Math.cos(a) * 36, y + Math.sin(a) * 36);
    }
    const pulse = 0.8 + Math.sin(Date.now() / 400) * 0.2;
    ctx.fillStyle = `rgba(212,168,81,${pulse})`;
    ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill();
    ctx.textBaseline = 'alphabetic';
}
function drawFountain(ctx: CanvasRenderingContext2D, x: number, y: number) {
    ctx.fillStyle = COLORS.stoneDark;
    ctx.beginPath(); ctx.ellipse(x, y + 8, 22, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = COLORS.stone;
    ctx.beginPath(); ctx.ellipse(x, y + 6, 22, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2a5a6a';
    ctx.beginPath(); ctx.ellipse(x, y + 4, 16, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = COLORS.stoneDark; ctx.fillRect(x - 4, y - 8, 8, 12);
    const t = Date.now() / 100;
    for (let i = 0; i < 4; i++) {
        const py = y - 16 + ((t + i * 8) % 24);
        ctx.fillStyle = 'rgba(120,180,200,0.8)'; ctx.fillRect(x - 1, py, 2, 3);
    }
}
function drawCrate(ctx: CanvasRenderingContext2D, x: number, y: number) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(x - 12, y + 12, 24, 3);
    ctx.fillStyle = COLORS.wood;     ctx.fillRect(x - 12, y - 10, 24, 22);
    ctx.fillStyle = COLORS.woodDark;
    ctx.fillRect(x - 12, y - 10, 24, 2); ctx.fillRect(x - 12, y + 10, 24, 2);
    ctx.strokeStyle = COLORS.woodDark; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - 12, y - 10); ctx.lineTo(x + 12, y + 12);
    ctx.moveTo(x + 12, y - 10); ctx.lineTo(x - 12, y + 12);
    ctx.stroke();
}
function drawBrazier(ctx: CanvasRenderingContext2D, x: number, y: number) {
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath(); ctx.ellipse(x, y + 16, 12, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#3a3328'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 10, y + 14); ctx.lineTo(x, y);
    ctx.moveTo(x + 10, y + 14); ctx.lineTo(x, y);
    ctx.moveTo(x, y + 14);      ctx.lineTo(x, y);
    ctx.stroke();
    ctx.fillStyle = '#3a3328';
    ctx.beginPath(); ctx.ellipse(x, y, 11, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#a14040'; ctx.fillRect(x - 6, y - 2, 12, 3);
    const t = Date.now() / 80;
    for (let i = -2; i <= 2; i++) {
        const flicker = 0.7 + Math.sin(t + i) * 0.3;
        const fh = 8 * flicker;
        ctx.fillStyle = `rgba(212,168,81,${0.5 + flicker * 0.5})`;
        ctx.shadowColor = '#d4a851'; ctx.shadowBlur = 4;
        ctx.beginPath();
        ctx.ellipse(x + i * 3, y - 4 - fh / 2, 2, fh, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    }
    ctx.fillStyle = '#fff5ba';
    ctx.beginPath(); ctx.ellipse(x, y - 3, 5, 2, 0, 0, Math.PI * 2); ctx.fill();
}
function drawPlant(ctx: CanvasRenderingContext2D, x: number, y: number) {
    ctx.fillStyle = COLORS.woodDark;
    ctx.beginPath();
    ctx.moveTo(x - 8, y + 4); ctx.lineTo(x + 8, y + 4);
    ctx.lineTo(x + 6, y + 12); ctx.lineTo(x - 6, y + 12);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = COLORS.wood; ctx.fillRect(x - 8, y + 4, 16, 2);
    ctx.fillStyle = '#4a6a3a';
    for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i - 2) * 0.5;
        ctx.beginPath();
        ctx.ellipse(x + Math.cos(a) * 8, y + 4 + Math.sin(a) * 8, 3, 6, a, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.fillStyle = '#6f8a52';
    for (let i = 0; i < 3; i++) {
        const a = -Math.PI / 2 + (i - 1) * 0.5;
        ctx.beginPath();
        ctx.ellipse(x + Math.cos(a) * 5, y + 2 + Math.sin(a) * 5, 2, 4, a, 0, Math.PI * 2);
        ctx.fill();
    }
}
function drawCandle(ctx: CanvasRenderingContext2D, x: number, y: number) {
    ctx.fillStyle = '#3a3328';        ctx.fillRect(x - 4, y + 6, 8, 3);
    ctx.fillStyle = COLORS.parchment; ctx.fillRect(x - 2, y - 4, 4, 10);
    const flicker = 0.85 + Math.sin(Date.now() / 90) * 0.15;
    ctx.fillStyle = `rgba(212,168,81,${flicker})`;
    ctx.shadowColor = '#d4a851'; ctx.shadowBlur = 4;
    ctx.beginPath(); ctx.ellipse(x, y - 8, 2 * flicker, 4 * flicker, 0, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff5ba';
    ctx.beginPath(); ctx.arc(x, y - 7, 0.8, 0, Math.PI * 2); ctx.fill();
}

// ─── HUMANOID SPRITE (shared for player + NPCs) ───────────────
type Weapon = 'sword' | 'book' | 'hammer' | 'staff';
type Headpiece = 'crown';

interface HumanoidOpts {
    bodyColor: string;
    hoodColor?: string;       // if set, hood; else hair
    hairColor?: string;
    weapon?: Weapon;
    headpiece?: Headpiece;
    bob?: number;
}

function drawHumanoid(ctx: CanvasRenderingContext2D, x: number, y: number, opts: HumanoidOpts) {
    const bob = opts.bob || 0;
    const skin = COLORS.skin;

    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath(); ctx.ellipse(x, y + 13, 11, 3.5, 0, 0, Math.PI * 2); ctx.fill();

    // boots
    ctx.fillStyle = '#1a0f08';
    ctx.fillRect(x - 6, y + 11, 5, 3);
    ctx.fillRect(x + 1, y + 11, 5, 3);

    // legs (dark trousers)
    ctx.fillStyle = '#2a1810';
    ctx.fillRect(x - 5, y + 4, 4, 8);
    ctx.fillRect(x + 1, y + 4, 4, 8);

    // body / cloak — trapezoid
    ctx.fillStyle = opts.bodyColor;
    ctx.beginPath();
    ctx.moveTo(x - 8, y + 6);
    ctx.lineTo(x + 8, y + 6);
    ctx.lineTo(x + 7, y - 8 + bob);
    ctx.lineTo(x - 7, y - 8 + bob);
    ctx.closePath(); ctx.fill();
    // shading on right half
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.moveTo(x, y - 8 + bob);
    ctx.lineTo(x + 7, y - 8 + bob);
    ctx.lineTo(x + 8, y + 6);
    ctx.lineTo(x, y + 6);
    ctx.closePath(); ctx.fill();
    // highlight on left edge
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(x - 7, y - 7 + bob, 1, 13);

    // belt
    ctx.fillStyle = '#3a2410';
    ctx.fillRect(x - 7, y + 2, 14, 2);
    // belt buckle
    ctx.fillStyle = COLORS.gold;
    ctx.fillRect(x - 1, y + 2, 2, 2);

    // neck / collar
    ctx.fillStyle = skin;
    ctx.fillRect(x - 1, y - 9 + bob, 2, 2);

    // head
    ctx.fillStyle = skin;
    ctx.beginPath(); ctx.arc(x, y - 13 + bob, 5, 0, Math.PI * 2); ctx.fill();
    // chin shadow
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath(); ctx.ellipse(x, y - 9 + bob, 4, 1.2, 0, 0, Math.PI * 2); ctx.fill();

    // hair OR hood
    if (opts.hoodColor) {
        // hood top
        ctx.fillStyle = opts.hoodColor;
        ctx.beginPath();
        ctx.arc(x, y - 14 + bob, 6, Math.PI, 0);
        ctx.fill();
        // hood sides drape down
        ctx.beginPath();
        ctx.moveTo(x - 6, y - 14 + bob);
        ctx.lineTo(x - 7, y - 7 + bob);
        ctx.lineTo(x - 4, y - 7 + bob);
        ctx.lineTo(x - 4, y - 13 + bob);
        ctx.closePath(); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(x + 6, y - 14 + bob);
        ctx.lineTo(x + 7, y - 7 + bob);
        ctx.lineTo(x + 4, y - 7 + bob);
        ctx.lineTo(x + 4, y - 13 + bob);
        ctx.closePath(); ctx.fill();
    } else {
        ctx.fillStyle = opts.hairColor || '#2a1810';
        ctx.beginPath();
        ctx.arc(x, y - 14 + bob, 5, Math.PI, 0);
        ctx.fill();
        // forelock
        ctx.fillRect(x - 4, y - 14 + bob, 8, 2);
    }

    // eyes
    ctx.fillStyle = '#1a1410';
    ctx.beginPath(); ctx.arc(x - 1.8, y - 13 + bob, 0.9, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + 1.8, y - 13 + bob, 0.9, 0, Math.PI * 2); ctx.fill();

    // headpiece (crown) sits on top
    if (opts.headpiece === 'crown') {
        ctx.fillStyle = COLORS.gold;
        ctx.beginPath();
        ctx.moveTo(x - 6, y - 17 + bob);
        ctx.lineTo(x - 5, y - 21 + bob);
        ctx.lineTo(x - 3, y - 18 + bob);
        ctx.lineTo(x - 1, y - 22 + bob);
        ctx.lineTo(x + 1, y - 18 + bob);
        ctx.lineTo(x + 3, y - 22 + bob);
        ctx.lineTo(x + 5, y - 18 + bob);
        ctx.lineTo(x + 6, y - 21 + bob);
        ctx.lineTo(x + 6, y - 17 + bob);
        ctx.closePath(); ctx.fill();
        // gem
        ctx.fillStyle = COLORS.accentRed;
        ctx.beginPath(); ctx.arc(x, y - 18 + bob, 1.2, 0, Math.PI * 2); ctx.fill();
    }

    // weapon in right hand (visually on the right of the sprite)
    switch (opts.weapon) {
        case 'sword': {
            // crossguard
            ctx.fillStyle = COLORS.gold;
            ctx.fillRect(x + 6, y - 2 + bob, 5, 1);
            // hilt
            ctx.fillStyle = '#3a2410';
            ctx.fillRect(x + 7, y - 1 + bob, 2, 4);
            // pommel
            ctx.fillStyle = COLORS.gold;
            ctx.beginPath(); ctx.arc(x + 8, y + 3 + bob, 1, 0, Math.PI * 2); ctx.fill();
            // blade
            ctx.fillStyle = '#c4c4cc';
            ctx.fillRect(x + 7.5, y - 14 + bob, 1, 12);
            ctx.fillStyle = '#9090a0';
            ctx.fillRect(x + 8,   y - 14 + bob, 0.5, 12);
            // tip
            ctx.beginPath();
            ctx.moveTo(x + 7, y - 14 + bob);
            ctx.lineTo(x + 9, y - 14 + bob);
            ctx.lineTo(x + 8, y - 16 + bob);
            ctx.closePath();
            ctx.fillStyle = '#c4c4cc'; ctx.fill();
            break;
        }
        case 'book': {
            // tome cover
            ctx.fillStyle = '#3a1a4a';
            ctx.fillRect(x + 6, y - 4 + bob, 6, 8);
            ctx.fillStyle = '#5a3a6a';
            ctx.fillRect(x + 7, y - 3 + bob, 4, 6);
            // pages
            ctx.fillStyle = COLORS.parchment;
            ctx.fillRect(x + 7, y - 3 + bob, 4, 1);
            ctx.fillRect(x + 7, y + 3 + bob, 4, 1);
            // gold clasp
            ctx.fillStyle = COLORS.gold;
            ctx.fillRect(x + 8.5, y + bob, 1, 2);
            break;
        }
        case 'hammer': {
            // handle
            ctx.fillStyle = '#5a3a1a';
            ctx.fillRect(x + 7, y - 7 + bob, 1.5, 13);
            // head
            ctx.fillStyle = '#3a3a40';
            ctx.fillRect(x + 5, y - 10 + bob, 6, 5);
            ctx.fillStyle = '#5a5a60';
            ctx.fillRect(x + 5, y - 10 + bob, 6, 1);
            ctx.fillStyle = '#2a2a30';
            ctx.fillRect(x + 5, y - 6 + bob, 6, 1);
            break;
        }
        case 'staff': {
            // wood
            ctx.fillStyle = '#5a3a1a';
            ctx.fillRect(x + 7, y - 16 + bob, 2, 22);
            ctx.fillStyle = '#3a2410';
            ctx.fillRect(x + 7, y - 16 + bob, 1, 22);
            // orb
            ctx.fillStyle = COLORS.gold;
            ctx.shadowColor = COLORS.gold; ctx.shadowBlur = 6;
            ctx.beginPath(); ctx.arc(x + 8, y - 17 + bob, 2.5, 0, Math.PI * 2); ctx.fill();
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#fff5ba';
            ctx.beginPath(); ctx.arc(x + 7.5, y - 17.5 + bob, 0.8, 0, Math.PI * 2); ctx.fill();
            break;
        }
    }
}

// ─── Player ───────────────────────────────────────────────────
const WEAPON_BY_CLASS: Record<ClassId, Weapon> = {
    delver: 'sword', scholar: 'book', artisan: 'hammer', wayfarer: 'staff',
};
function drawPlayer(ctx: CanvasRenderingContext2D) {
    const bob = Math.sin(Date.now() / 200) * 1.5;
    const id = player.clazz.id;
    drawHumanoid(ctx, player.x, player.y, {
        bodyColor: player.clazz.color,
        hoodColor: id === 'scholar' || id === 'wayfarer' ? player.clazz.color : undefined,
        weapon: WEAPON_BY_CLASS[id],
        bob,
    });
}

// ─── NPC ──────────────────────────────────────────────────────
const NPC_VISUAL: Record<NpcRole, { weapon?: Weapon; headpiece?: Headpiece; hooded: boolean }> = {
    architect:  { weapon: 'staff',  headpiece: 'crown', hooded: true  },
    loremaster: { weapon: 'book',                       hooded: true  },
    smith:      { weapon: 'hammer',                     hooded: false },
};
function drawNpc(ctx: CanvasRenderingContext2D, r: Room, npc: Npc) {
    const wx = r.x + npc.x;
    const wy = r.y + npc.y;
    const bob = Math.sin(Date.now() / 400 + wx * 0.01) * 1.4;
    const v = NPC_VISUAL[npc.role];

    drawHumanoid(ctx, wx, wy, {
        bodyColor: npc.color,
        hoodColor: v.hooded ? npc.color : undefined,
        weapon: v.weapon,
        headpiece: v.headpiece,
        bob,
    });

    // floating name plate when player is nearby
    const dist = Math.hypot(wx - player.x, wy - player.y);
    if (dist < 100) {
        const py = wy - 36 + Math.sin(Date.now() / 300) * 2;
        ctx.font = 'bold 11px Cinzel, serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const text = npc.title
        const textW = ctx.measureText(text).width;
        ctx.fillStyle = 'rgba(28, 22, 18, 0.94)';
        ctx.fillRect(wx - textW / 2 - 10, py - 9, textW + 20, 18);
        ctx.strokeStyle = npc.color; ctx.lineWidth = 1;
        ctx.strokeRect(wx - textW / 2 - 10, py - 9, textW + 20, 18);
        ctx.fillStyle = npc.color;
        ctx.fillText(text, wx, py);
    }
}

// ─── Doors (with tier-lock padlock) ───────────────────────────
function drawDoor(ctx: CanvasRenderingContext2D, x: number, y: number, d: Door) {
    const vertical = d.side === 'e' || d.side === 'w';

    if (d.opened) {
        ctx.strokeStyle = COLORS.borderBright; ctx.lineWidth = 2;
        if (vertical) {
            ctx.beginPath();
            ctx.moveTo(x, y - 30); ctx.lineTo(x, y - 8);
            ctx.moveTo(x, y + 8);  ctx.lineTo(x, y + 30);
            ctx.stroke();
        } else {
            ctx.beginPath();
            ctx.moveTo(x - 30, y); ctx.lineTo(x - 8, y);
            ctx.moveTo(x + 8, y);  ctx.lineTo(x + 30, y);
            ctx.stroke();
        }
        return;
    }

    const color = SEAL_COLORS[d.seal.challenge];
    const dw = vertical ? 14 : 50;
    const dh = vertical ? 50 : 14;

    ctx.fillStyle = COLORS.woodDark; ctx.fillRect(x - dw / 2 - 1, y - dh / 2 - 1, dw + 2, dh + 2);
    ctx.fillStyle = COLORS.wood;     ctx.fillRect(x - dw / 2,     y - dh / 2,     dw,     dh);
    ctx.strokeStyle = COLORS.woodDark; ctx.lineWidth = 1;
    ctx.beginPath();
    if (vertical) { ctx.moveTo(x, y - dh / 2); ctx.lineTo(x, y + dh / 2); }
    else          { ctx.moveTo(x - dw / 2, y); ctx.lineTo(x + dw / 2, y); }
    ctx.stroke();
    ctx.fillStyle = '#3a3328';
    if (vertical) {
        ctx.fillRect(x - dw / 2, y - 16, dw, 2);
        ctx.fillRect(x - dw / 2, y + 14, dw, 2);
    } else {
        ctx.fillRect(x - 16, y - dh / 2, 2, dh);
        ctx.fillRect(x + 14, y - dh / 2, 2, dh);
    }

    let sx = x, sy = y;
    const off = 30;
    if (d.side === 'n') sy -= off;
    if (d.side === 's') sy += off;
    if (d.side === 'e') sx += off;
    if (d.side === 'w') sx -= off;

    const locked = !canOpenDoor(d);

    ctx.fillStyle = COLORS.stoneDark;
    ctx.beginPath(); ctx.arc(sx, sy, 17, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = COLORS.stone; ctx.lineWidth = 2; ctx.stroke();

    const pulse = 1 + Math.sin(Date.now() / 400) * 0.06;
    if (locked) {
        ctx.fillStyle = COLORS.textFaded;
        ctx.beginPath(); ctx.arc(sx, sy, 11 * pulse, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = COLORS.textDim;
        ctx.fillRect(sx - 4, sy - 1, 8, 7);
        ctx.strokeStyle = COLORS.textDim; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(sx, sy - 1, 3, Math.PI, 0); ctx.stroke();
    } else {
        ctx.fillStyle = color;
        ctx.shadowColor = color; ctx.shadowBlur = 5;
        ctx.beginPath(); ctx.arc(sx, sy, 11 * pulse, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = COLORS.bgDark;
        ctx.font = 'bold 13px "JetBrains Mono", monospace';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(SEAL_ICONS[d.seal.challenge], sx, sy + 1);
    }

    for (let i = 0; i < d.seal.tier; i++) {
        let dx2 = 0, dy2 = 0;
        if (d.side === 'n' || d.side === 's') {
            dx2 = (i - (d.seal.tier - 1) / 2) * 8;
            dy2 = d.side === 'n' ? -34 : 34;
        } else {
            dy2 = (i - (d.seal.tier - 1) / 2) * 8;
            dx2 = d.side === 'w' ? -34 : 34;
        }
        ctx.fillStyle = locked ? COLORS.textFaded : color;
        ctx.beginPath(); ctx.arc(sx + dx2, sy + dy2, 2.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.textBaseline = 'alphabetic';
}

function drawVignette(ctx: CanvasRenderingContext2D) {
    const grad = ctx.createRadialGradient(
        CANVAS_W / 2, CANVAS_H / 2, CANVAS_H * 0.3,
        CANVAS_W / 2, CANVAS_H / 2, CANVAS_H * 0.9,
    );
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.7)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
}