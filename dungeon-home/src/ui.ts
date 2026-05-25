import {
    CANVAS_W, CANVAS_H, COLORS,
    SEAL_COLORS, SEAL_ICONS, CHALLENGE_NAMES,
    CATEGORY_COLORS, CATEGORY_NAMES, CHALLENGE_TO_CATEGORY,
} from './constants';
import { rooms, player, wallet, renown, journal, questState, getQuestProgress } from './state';
import type { Door, Npc } from './types';

export const toast = { msg: '', t: 0, color: COLORS.accent };
export function showToast(msg: string, color = COLORS.accent) { toast.msg = msg; toast.t = 240; toast.color = color; }
export function updateToast() { if (toast.t > 0) toast.t--; }

// Action descriptor for NPC dialog
export interface DialogAction {
    label: string;
    enabled: boolean;
    perform: () => void;
}

// ─── Panel helper ─────────────────────────────────────────────
export function drawPanel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color = COLORS.borderBright) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x + 3, y + 3, w, h);
    ctx.fillStyle = COLORS.panel;       ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 1;
    ctx.strokeRect(x + 2.5, y + 2.5, w - 5, h - 5);
    const c = 8;
    ctx.strokeStyle = color; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y + c); ctx.lineTo(x, y); ctx.lineTo(x + c, y);
    ctx.moveTo(x + w - c, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + c);
    ctx.moveTo(x + w, y + h - c); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w - c, y + h);
    ctx.moveTo(x + c, y + h); ctx.lineTo(x, y + h); ctx.lineTo(x, y + h - c);
    ctx.stroke();
}

// ─── Top HUD: class · renown · coins · lore (NO quest line) ──
export function drawHUD(ctx: CanvasRenderingContext2D) {
    drawPanel(ctx, 16, 16, 660, 64);
    const c = player.clazz;

    // class orb
    ctx.fillStyle = c.color;
    ctx.shadowColor = c.color; ctx.shadowBlur = 6;
    ctx.beginPath(); ctx.arc(54, 50, 22, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = COLORS.bgDark;
    ctx.font = 'bold 22px "JetBrains Mono", monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(c.icon, 54, 51);

    // name + tagline
    ctx.fillStyle = c.color;
    ctx.font = 'bold 14px Cinzel, serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText(c.name.toUpperCase(), 86, 26);
    ctx.fillStyle = COLORS.textDim;
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillText(c.tagline, 86, 44);

    // divider
    ctx.strokeStyle = COLORS.border; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(212, 28); ctx.lineTo(212, 56); ctx.stroke();

    // Renown
    ctx.fillStyle = COLORS.accent;
    ctx.font = 'bold 10px "JetBrains Mono", monospace';
    ctx.fillText('RENOWN', 224, 24);
    ctx.fillStyle = COLORS.text;
    ctx.font = 'bold 18px Cinzel, serif';
    ctx.fillText(`Lv ${renown.level}`, 224, 36);

    // XP bar
    const barX = 290, barY = 32, barW = 150, barH = 12;
    ctx.fillStyle = COLORS.stoneDark; ctx.fillRect(barX, barY, barW, barH);
    const pct = Math.min(1, renown.xp / renown.xpToNext);
    ctx.fillStyle = COLORS.accent; ctx.fillRect(barX, barY, barW * pct, barH);
    ctx.strokeStyle = COLORS.borderBright; ctx.lineWidth = 1;
    ctx.strokeRect(barX + 0.5, barY + 0.5, barW - 1, barH - 1);
    ctx.fillStyle = COLORS.textDim;
    ctx.font = '9px "JetBrains Mono", monospace';
    ctx.fillText(`${renown.xp} / ${renown.xpToNext} xp`, barX, barY + 16);

    // coins
    ctx.fillStyle = COLORS.gold;
    ctx.font = 'bold 18px serif';
    ctx.fillText('◆', 464, 28);
    ctx.fillStyle = COLORS.text;
    ctx.font = 'bold 18px "JetBrains Mono", monospace';
    ctx.fillText(String(wallet.coins).padStart(4, '0'), 486, 28);
    ctx.fillStyle = COLORS.textDim; ctx.font = '9px "JetBrains Mono", monospace';
    ctx.fillText('COINS', 486, 49);

    // lore
    ctx.fillStyle = COLORS.accentPurple;
    ctx.font = 'bold 18px serif';
    ctx.fillText('✎', 580, 28);
    ctx.fillStyle = COLORS.text;
    ctx.font = 'bold 18px "JetBrains Mono", monospace';
    ctx.fillText(String(journal.length).padStart(2, '0'), 602, 28);
    ctx.fillStyle = COLORS.textDim; ctx.font = '9px "JetBrains Mono", monospace';
    ctx.fillText('LORE', 602, 49);
}

// ─── QUEST PANEL — bottom-right corner ────────────────────────
export function drawQuestPanel(ctx: CanvasRenderingContext2D) {
    const w = 320, h = 96;
    const x = CANVAS_W - w - 16, y = CANVAS_H - h - 16;

    if (!questState.current) {
        // No active quest — gentle hint
        const color = questState.available.length > 0 ? COLORS.accent : COLORS.textFaded;
        drawPanel(ctx, x, y, w, h, color);

        ctx.fillStyle = color; ctx.font = 'bold 10px "JetBrains Mono", monospace';
        ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        ctx.fillText('▸ QUEST', x + 14, y + 12);

        ctx.fillStyle = COLORS.text; ctx.font = 'italic 13px Cinzel, serif';
        if (questState.available.length > 0) {
            wrapInPanel(ctx, 'The Architect has a new task. Visit the Seed Hall.', x + 14, y + 32, w - 28, 18);
        } else {
            wrapInPanel(ctx, 'All tasks completed. Walk the dungeon at your leisure.', x + 14, y + 32, w - 28, 18);
        }

        ctx.fillStyle = COLORS.textDim; ctx.font = '10px "JetBrains Mono", monospace';
        ctx.textAlign = 'right';
        ctx.fillText(`completed: ${questState.completed}`, x + w - 14, y + h - 14);
        return;
    }

    const q = questState.current;
    const p = getQuestProgress();
    const done = !!(p && p.current >= p.target);
    const color = done ? COLORS.accentGreen : COLORS.accent;
    drawPanel(ctx, x, y, w, h, color);

    // Header
    ctx.fillStyle = color; ctx.font = 'bold 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText(done ? '▸ QUEST  ✦  COMPLETE' : '▸ QUEST', x + 14, y + 12);

    // Description
    ctx.fillStyle = COLORS.text; ctx.font = 'italic 13px Cinzel, serif';
    wrapInPanel(ctx, q.description, x + 14, y + 30, w - 28, 18);

    // Progress bar + ratio
    const barX = x + 14, barY = y + h - 26, barW = w - 28 - 80, barH = 8;
    ctx.fillStyle = COLORS.stoneDark; ctx.fillRect(barX, barY, barW, barH);
    const pct = p ? Math.min(1, p.current / p.target) : 0;
    ctx.fillStyle = color; ctx.fillRect(barX, barY, barW * pct, barH);
    ctx.strokeStyle = COLORS.border; ctx.lineWidth = 1;
    ctx.strokeRect(barX + 0.5, barY + 0.5, barW - 1, barH - 1);

    ctx.fillStyle = color; ctx.font = 'bold 12px "JetBrains Mono", monospace';
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.fillText(`${p?.current ?? 0} / ${p?.target ?? 0}`, x + w - 14, barY + barH / 2);

    // Hint when done
    if (done) {
        ctx.fillStyle = COLORS.accentGreen; ctx.font = 'bold 10px "JetBrains Mono", monospace';
        ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
        ctx.fillText('▸ return to the Architect', x + 14, y + h - 32);
    }
}

function wrapInPanel(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lh: number) {
    const words = text.split(' ');
    let line = '', cy = y;
    for (const w of words) {
        const test = line + w + ' ';
        if (ctx.measureText(test).width > maxW && line) {
            ctx.fillText(line.trim(), x, cy);
            line = w + ' '; cy += lh;
            if (cy > y + lh * 2) break;   // max 3 lines in this panel
        } else line = test;
    }
    if (line && cy <= y + lh * 2) ctx.fillText(line.trim(), x, cy);
}

// ─── Minimap with pathways ────────────────────────────────────
export function drawMinimap(ctx: CanvasRenderingContext2D) {
    const w = 240, h = 200;
    const x = CANVAS_W - w - 16, y = 16;
    drawPanel(ctx, x, y, w, h);

    ctx.fillStyle = COLORS.accent; ctx.font = 'bold 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText('▸ DUNGEON MAP', x + 12, y + 10);

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const r of rooms.values()) {
        minX = Math.min(minX, r.x); minY = Math.min(minY, r.y);
        maxX = Math.max(maxX, r.x + r.w); maxY = Math.max(maxY, r.y + r.h);
    }
    const pad = 80;
    minX -= pad; minY -= pad; maxX += pad; maxY += pad;
    const ww = maxX - minX, hh = maxY - minY;
    const scale = Math.min((w - 24) / ww, (h - 36) / hh);
    const ox = x + 12 + ((w - 24) - ww * scale) / 2;
    const oy = y + 28 + ((h - 36) - hh * scale) / 2;

    // PATHWAYS first (under rooms)
    ctx.strokeStyle = 'rgba(212, 168, 81, 0.55)';
    ctx.lineWidth = 1.5;
    const drawn = new Set<string>();
    for (const r of rooms.values()) {
        for (const d of r.doors) {
            if (!d.opened || !d.linked) continue;
            const linked = rooms.get(d.linked);
            if (!linked) continue;
            const key = r.id < linked.id ? `${r.id}-${linked.id}` : `${linked.id}-${r.id}`;
            if (drawn.has(key)) continue;
            drawn.add(key);
            const cx1 = ox + (r.x - minX + r.w / 2) * scale;
            const cy1 = oy + (r.y - minY + r.h / 2) * scale;
            const cx2 = ox + (linked.x - minX + linked.w / 2) * scale;
            const cy2 = oy + (linked.y - minY + linked.h / 2) * scale;
            ctx.beginPath(); ctx.moveTo(cx1, cy1); ctx.lineTo(cx2, cy2); ctx.stroke();
        }
    }

    // rooms
    for (const r of rooms.values()) {
        const rx = ox + (r.x - minX) * scale;
        const ry = oy + (r.y - minY) * scale;
        const rw = r.w * scale, rh = r.h * scale;
        ctx.fillStyle = CATEGORY_COLORS[r.category];
        ctx.fillRect(rx, ry, rw, rh);
        ctx.strokeStyle = 'rgba(180,140,90,0.55)'; ctx.lineWidth = 1;
        ctx.strokeRect(rx, ry, rw, rh);
        if (r.npc) {
            ctx.fillStyle = r.npc.color;
            ctx.shadowColor = r.npc.color; ctx.shadowBlur = 4;
            ctx.beginPath(); ctx.arc(rx + rw / 2, ry + rh / 2, 2.5, 0, Math.PI * 2); ctx.fill();
            ctx.shadowBlur = 0;
        }
        for (const d of r.doors) {
            if (d.opened) continue;
            ctx.fillStyle = SEAL_COLORS[d.seal.challenge];
            let dx = 0, dy = 0;
            if (d.side === 'n') { dx = rw / 2; }
            if (d.side === 's') { dx = rw / 2; dy = rh; }
            if (d.side === 'e') { dx = rw; dy = rh / 2; }
            if (d.side === 'w') { dy = rh / 2; }
            ctx.beginPath(); ctx.arc(rx + dx, ry + dy, 2.5, 0, Math.PI * 2); ctx.fill();
        }
    }
    // player ping
    const px = ox + (player.x - minX) * scale;
    const py = oy + (player.y - minY) * scale;
    const pulse = 3 + Math.sin(Date.now() / 200) * 1.3;
    ctx.fillStyle = COLORS.accent;
    ctx.shadowColor = COLORS.accent; ctx.shadowBlur = 6;
    ctx.beginPath(); ctx.arc(px, py, pulse, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
}

// ─── Door info card ───────────────────────────────────────────
export function drawDoorInfo(ctx: CanvasRenderingContext2D, door: Door | null, locked: boolean) {
    if (!door) return;
    if (door.opened) return;   // no popup for already-opened doorways
    const w = 440, h = 110;
    const x = CANVAS_W / 2 - w / 2, y = CANVAS_H - 130;
    const c = door.opened ? COLORS.accentGreen
        : locked ? COLORS.textDim
            : SEAL_COLORS[door.seal.challenge];
    drawPanel(ctx, x, y, w, h, c);

    const ch = door.seal.challenge;
    ctx.fillStyle = c; ctx.font = 'bold 17px Cinzel, serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText(`${SEAL_ICONS[ch]}  ${CHALLENGE_NAMES[ch].toUpperCase()} SEAL`, x + 18, y + 14);
    ctx.fillStyle = COLORS.textDim; ctx.font = '11px "JetBrains Mono", monospace';
    ctx.fillText(`TIER ${door.seal.tier}`, x + 18, y + 36);
    ctx.fillStyle = COLORS.accent; ctx.font = '12px "JetBrains Mono", monospace';
    ctx.fillText(`▸ reward: ${CATEGORY_NAMES[CHALLENGE_TO_CATEGORY[ch]]}`, x + 18, y + 54);
    for (let i = 0; i < door.seal.tier; i++) {
        ctx.fillStyle = c;
        ctx.beginPath(); ctx.arc(x + 90 + i * 12, y + 40, 4, 0, Math.PI * 2); ctx.fill();
    }
    if (locked) {
        ctx.fillStyle = COLORS.accentRed; ctx.font = 'bold 12px "JetBrains Mono", monospace';
        ctx.fillText(`✖  REQUIRES RENOWN LV ${door.seal.tier}`, x + 18, y + 74);
        ctx.textAlign = 'right';
        ctx.fillStyle = COLORS.textDim; ctx.font = '10px "JetBrains Mono", monospace';
        ctx.fillText('clear lower tiers first', x + w - 20, y + 64);
    } else {
        ctx.textAlign = 'right';
        ctx.fillStyle = c; ctx.font = 'bold 22px Cinzel, serif';
        ctx.fillText('[ E ]', x + w - 20, y + 26);
        ctx.fillStyle = COLORS.textDim; ctx.font = '10px "JetBrains Mono", monospace';
        ctx.fillText('enter the trial', x + w - 20, y + 56);
    }
    ctx.textAlign = 'left';
}

// ─── NPC prompt ───────────────────────────────────────────────
export function drawNpcPrompt(ctx: CanvasRenderingContext2D, npc: Npc) {
    const w = 360, h = 70;
    const x = CANVAS_W / 2 - w / 2, y = CANVAS_H - 90;
    drawPanel(ctx, x, y, w, h, npc.color);
    ctx.fillStyle = npc.color; ctx.font = 'bold 16px Cinzel, serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText(npc.name, x + 18, y + 14);
    ctx.fillStyle = COLORS.textDim; ctx.font = 'italic 11px Cinzel, serif';
    ctx.fillText(npc.title, x + 18, y + 36);
    ctx.textAlign = 'right';
    ctx.fillStyle = npc.color; ctx.font = 'bold 18px Cinzel, serif';
    ctx.fillText('[ E ]  speak', x + w - 18, y + 26);
}

// ─── Location bar (bottom-left, small) ────────────────────────
export function drawLocationBar(ctx: CanvasRenderingContext2D) {
    const r = rooms.get(player.room);
    if (!r) return;
    drawPanel(ctx, 16, CANVAS_H - 60, 220, 44);
    ctx.fillStyle = COLORS.textDim; ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText('▸ LOCATION', 30, CANVAS_H - 52);
    ctx.fillStyle = COLORS.text; ctx.font = 'bold 16px Cinzel, serif';
    ctx.fillText(CATEGORY_NAMES[r.category], 30, CANVAS_H - 36);
}

// ─── Toast ────────────────────────────────────────────────────
export function drawToast(ctx: CanvasRenderingContext2D) {
    if (toast.t <= 0) return;
    const alpha = toast.t > 30 ? 1 : toast.t / 30;
    const slide = toast.t > 210 ? (240 - toast.t) * 2 : 0;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = 'bold 15px "JetBrains Mono", monospace';
    const msgW = ctx.measureText(toast.msg).width + 60;
    const w = Math.max(msgW, 420);
    const x = CANVAS_W / 2 - w / 2, y = 96 + slide;
    drawPanel(ctx, x, y, w, 56, toast.color);
    ctx.fillStyle = toast.color;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = toast.color; ctx.shadowBlur = 8;
    ctx.fillText(toast.msg, x + w / 2, y + 28);
    ctx.shadowBlur = 0;
    ctx.restore();
}

// ─── Dialog box (with action button) ──────────────────────────
function wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lh: number) {
    const words = text.split(' '); let line = '', cy = y;
    for (const w of words) {
        const test = line + w + ' ';
        if (ctx.measureText(test).width > maxW && line) {
            ctx.fillText(line.trim(), x, cy); line = w + ' '; cy += lh;
        } else line = test;
    }
    if (line) ctx.fillText(line.trim(), x, cy);
}

export function drawDialog(ctx: CanvasRenderingContext2D, npc: Npc, lineIdx: number, lines: string[], action: DialogAction | null) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    const w = 820, h = 260;
    const x = CANVAS_W / 2 - w / 2, y = CANVAS_H - h - 40;
    drawPanel(ctx, x, y, w, h, npc.color);

    // portrait orb
    ctx.fillStyle = npc.color;
    ctx.shadowColor = npc.color; ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.arc(x + 64, y + 86, 48, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    // hood
    ctx.fillStyle = COLORS.bgDark;
    ctx.beginPath(); ctx.arc(x + 64, y + 74, 38, Math.PI, 0); ctx.fill();
    // face
    ctx.fillStyle = COLORS.skin;
    ctx.beginPath(); ctx.arc(x + 64, y + 84, 22, 0, Math.PI * 2); ctx.fill();
    // eyes
    ctx.fillStyle = COLORS.bgDark;
    ctx.beginPath(); ctx.arc(x + 56, y + 82, 2.4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + 72, y + 82, 2.4, 0, Math.PI * 2); ctx.fill();

    // name + title
    ctx.fillStyle = npc.color; ctx.font = 'bold 22px Cinzel, serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText(npc.name, x + 134, y + 24);
    ctx.fillStyle = COLORS.textDim; ctx.font = 'italic 13px Cinzel, serif';
    ctx.fillText(npc.title, x + 134, y + 54);

    ctx.strokeStyle = COLORS.border; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x + 134, y + 78); ctx.lineTo(x + w - 24, y + 78); ctx.stroke();

    // current line
    const line = lines[lineIdx] || '';
    ctx.fillStyle = COLORS.parchment;
    ctx.font = '16px Cinzel, serif';
    wrap(ctx, line, x + 134, y + 96, w - 164, 24);

    // action button (only on the last line)
    const onLastLine = lineIdx === lines.length - 1;
    if (action && onLastLine) {
        const btnW = w - 268, btnH = 36;
        const bx = x + 134, by = y + h - 76;
        ctx.fillStyle = action.enabled ? npc.color : 'rgba(80,70,60,0.5)';
        ctx.fillRect(bx, by, btnW, btnH);
        ctx.strokeStyle = action.enabled ? COLORS.gold : COLORS.textDim;
        ctx.lineWidth = 1;
        ctx.strokeRect(bx + 0.5, by + 0.5, btnW - 1, btnH - 1);
        ctx.fillStyle = action.enabled ? COLORS.bgDark : COLORS.textDim;
        ctx.font = 'bold 13px "JetBrains Mono", monospace';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(action.label, bx + btnW / 2, by + btnH / 2);
    }

    // line counter + hint
    ctx.fillStyle = COLORS.textDim; ctx.font = '11px "JetBrains Mono", monospace';
    ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(`${lineIdx + 1} / ${lines.length}`, x + w - 22, y + h - 18);

    ctx.textAlign = 'left';
    ctx.fillStyle = COLORS.accent; ctx.font = 'bold 11px "JetBrains Mono", monospace';
    const hint = lineIdx + 1 < lines.length
        ? 'E  continue       ESC  leave'
        : (action && action.enabled ? 'F  do it     E  close     ESC  leave' : 'E  close          ESC  leave');
    ctx.fillText(hint, x + 22, y + h - 18);
}