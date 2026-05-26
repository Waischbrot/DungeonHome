import { CANVAS_W, CANVAS_H, COLORS, CLASSES, PILLAR_TEXT, LORE_FRAGMENTS } from './constants';
import { keysPressed, mouse, wheel } from './input';
import { player, journal, stats, renown, wallet, setClass } from './state';
import { drawParticles, spawnDrift } from './particles';
import { drawPanel } from './ui';
import { SFX } from './audio';

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lineH: number) {
    const paras = text.split('\n'); let cy = y;
    for (const para of paras) {
        if (!para.trim()) { cy += lineH * 0.6; continue; }
        const words = para.split(' '); let line = '';
        for (const w of words) {
            const test = line + w + ' ';
            if (ctx.measureText(test).width > maxW && line) {
                ctx.fillText(line.trim(), x, cy); line = w + ' '; cy += lineH;
            } else line = test;
        }
        if (line) { ctx.fillText(line.trim(), x, cy); cy += lineH; }
    }
    return cy;
}

// ───── TITLE ─────
let titleAnim = 0;
export function updateTitle(): 'continue' | 'class-select' {
    titleAnim++;
    if (Math.random() < 0.3) spawnDrift(Math.random() * CANVAS_W, CANVAS_H + 10, '#b48c5a', 1);
    if (Math.random() < 0.07) spawnDrift(Math.random() * CANVAS_W, CANVAS_H + 10, '#c89b5a', 1);
    if (keysPressed.has('enter') || keysPressed.has(' ') || mouse.clicked) { SFX.click(); return 'class-select'; }
    return 'continue';
}
export function drawTitle(ctx: CanvasRenderingContext2D) {
    const g = ctx.createRadialGradient(CANVAS_W/2, CANVAS_H/2, 60, CANVAS_W/2, CANVAS_H/2, CANVAS_W);
    g.addColorStop(0, '#241a14'); g.addColorStop(1, '#0a0606');
    ctx.fillStyle = g; ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // drifting silhouettes
    for (let i = 0; i < 12; i++) {
        const dx = (titleAnim * 0.25 + i * 137) % (CANVAS_W + 200) - 100;
        const dy = ((i * 89) % (CANVAS_H - 200)) + 80;
        ctx.save(); ctx.globalAlpha = 0.07;
        ctx.fillStyle = '#6a5a8a'; ctx.fillRect(dx, dy, 28, 56);
        ctx.fillStyle = '#c89b5a';
        ctx.beginPath(); ctx.arc(dx + 14, dy + 18, 5, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }
    drawParticles(ctx);

    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.font = 'bold 140px Cinzel, serif';
    const grad1 = ctx.createLinearGradient(0, 130, 0, 280);
    grad1.addColorStop(0, '#d4a851'); grad1.addColorStop(1, '#a14040');
    ctx.fillStyle = grad1; ctx.shadowColor = '#a14040'; ctx.shadowBlur = 18;
    ctx.fillText('DUNGEON', CANVAS_W / 2, 240);
    ctx.shadowBlur = 0;

    const grad2 = ctx.createLinearGradient(0, 300, 0, 420);
    grad2.addColorStop(0, '#b48c5a'); grad2.addColorStop(1, '#6a5a8a');
    ctx.fillStyle = grad2; ctx.shadowColor = '#6a5a8a'; ctx.shadowBlur = 18;
    ctx.fillText('HOME', CANVAS_W / 2, 400);
    ctx.shadowBlur = 0;

    ctx.font = '20px "JetBrains Mono", monospace';
    ctx.fillStyle = COLORS.textDim;
    ctx.fillText('every door is a promise   ·   every room is yours', CANVAS_W / 2, 470);

    const pulse = 0.5 + Math.sin(titleAnim / 18) * 0.5;
    ctx.font = 'bold 22px "JetBrains Mono", monospace';
    ctx.fillStyle = `rgba(200,155,90,${pulse})`;
    ctx.shadowColor = COLORS.accent; ctx.shadowBlur = 14 * pulse;
    ctx.fillText('▶   PRESS ENTER TO BEGIN   ◀', CANVAS_W / 2, 580);
    ctx.shadowBlur = 0;

    ctx.font = '11px "JetBrains Mono", monospace';
    ctx.fillStyle = COLORS.textDim;
    ctx.textAlign = 'left';  ctx.fillText('PROTOTYPE   v0.5', 24, CANVAS_H - 24);
    ctx.textAlign = 'right'; ctx.fillText('A MINECRAFT SERVER CONCEPT', CANVAS_W - 24, CANVAS_H - 24);
}

// ───── CLASS SELECT ─────
let selectedClassIdx = 0;
export function updateClassSelect(): 'continue' | 'hub' | 'title' {
    if (keysPressed.has('arrowleft')  || keysPressed.has('a')) { selectedClassIdx = (selectedClassIdx + 3) % 4; SFX.click(); }
    if (keysPressed.has('arrowright') || keysPressed.has('d')) { selectedClassIdx = (selectedClassIdx + 1) % 4; SFX.click(); }
    if (keysPressed.has('escape')) { SFX.back(); return 'title'; }

    const cardW = 240, cardH = 340, gap = 24;
    const totalW = cardW * 4 + gap * 3;
    const startX = (CANVAS_W - totalW) / 2;
    const cardY = 210;
    for (let i = 0; i < 4; i++) {
        const cx = startX + i * (cardW + gap);
        if (mouse.x >= cx && mouse.x <= cx + cardW && mouse.y >= cardY - 20 && mouse.y <= cardY + cardH) {
            if (selectedClassIdx !== i) { selectedClassIdx = i; SFX.click(); }
            if (mouse.clicked) { setClass(CLASSES[selectedClassIdx]); SFX.open(); return 'hub'; }
        }
    }
    if (keysPressed.has('enter') || keysPressed.has(' ')) { setClass(CLASSES[selectedClassIdx]); SFX.open(); return 'hub'; }
    return 'continue';
}
export function drawClassSelect(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = COLORS.bg; ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = COLORS.text;
    ctx.font = 'bold 52px Cinzel, serif';
    ctx.fillText('CHOOSE YOUR PATH', CANVAS_W / 2, 120);
    ctx.font = '14px "JetBrains Mono", monospace';
    ctx.fillStyle = COLORS.textDim;
    ctx.fillText('every class can clear every door — some just have an easier time', CANVAS_W / 2, 154);

    const cardW = 240, cardH = 340, gap = 24;
    const totalW = cardW * 4 + gap * 3;
    const startX = (CANVAS_W - totalW) / 2;
    const cardY = 210;

    for (let i = 0; i < 4; i++) {
        const c = CLASSES[i];
        const cx = startX + i * (cardW + gap);
        const selected = i === selectedClassIdx;
        const yOff = selected ? -10 : 0;

        drawPanel(ctx, cx, cardY + yOff, cardW, cardH, selected ? c.color : COLORS.border);

        ctx.fillStyle = c.color;
        ctx.shadowColor = c.color; ctx.shadowBlur = selected ? 12 : 5;
        ctx.beginPath(); ctx.arc(cx + cardW / 2, cardY + yOff + 90, 40, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = COLORS.bgDark;
        ctx.font = 'bold 44px "JetBrains Mono", monospace';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(c.icon, cx + cardW / 2, cardY + yOff + 92);

        ctx.fillStyle = c.color;
        ctx.font = 'bold 24px Cinzel, serif';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(c.name.toUpperCase(), cx + cardW / 2, cardY + yOff + 180);
        ctx.fillStyle = COLORS.textDim;
        ctx.font = '11px "JetBrains Mono", monospace';
        ctx.fillText(c.tagline, cx + cardW / 2, cardY + yOff + 202);

        ctx.fillStyle = COLORS.text;
        ctx.font = '11px "JetBrains Mono", monospace';
        wrapText(ctx, c.perk, cx + cardW / 2, cardY + yOff + 234, cardW - 24, 14);

        ctx.fillStyle = COLORS.textDim;
        ctx.font = 'italic 10px Cinzel, serif';
        wrapText(ctx, c.description, cx + cardW / 2, cardY + yOff + 282, cardW - 24, 13);
    }

    ctx.fillStyle = COLORS.textDim;
    ctx.font = '12px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('← →  select   ·   ENTER  confirm   ·   ESC  back', CANVAS_W / 2, CANVAS_H - 50);

    const pulse = 0.6 + Math.sin(Date.now() / 280) * 0.4;
    ctx.fillStyle = `rgba(200,155,90,${pulse})`;
    ctx.font = 'bold 20px Cinzel, serif';
    ctx.fillText(`▶   ENTER THE DUNGEON AS ${CLASSES[selectedClassIdx].name.toUpperCase()}   ◀`, CANVAS_W / 2, CANVAS_H - 90);
}

// ───── PAUSE ─────
type PauseTab = 'concept' | 'pillars' | 'economy' | 'roadmap' | 'stats';
let pauseTab: PauseTab = 'concept';
export function updatePause(): 'continue' | 'hub' | 'title' {
    if (keysPressed.has('escape')) { SFX.back(); return 'hub'; }
    const tabs: PauseTab[] = ['concept','pillars','economy','roadmap','stats'];
    if (keysPressed.has('1')) { pauseTab = tabs[0]; SFX.click(); }
    if (keysPressed.has('2')) { pauseTab = tabs[1]; SFX.click(); }
    if (keysPressed.has('3')) { pauseTab = tabs[2]; SFX.click(); }
    if (keysPressed.has('4')) { pauseTab = tabs[3]; SFX.click(); }
    if (keysPressed.has('5')) { pauseTab = tabs[4]; SFX.click(); }

    if (mouse.clicked) {
        const tabY = 170, tabW = 150;
        const startX = (CANVAS_W - tabW * tabs.length) / 2;
        for (let i = 0; i < tabs.length; i++) {
            const tx = startX + i * tabW;
            if (mouse.x >= tx && mouse.x <= tx + tabW - 6 && mouse.y >= tabY && mouse.y <= tabY + 42) {
                pauseTab = tabs[i]; SFX.click();
            }
        }
        if (mouse.x >= CANVAS_W/2 - 120 && mouse.x <= CANVAS_W/2 + 120 && mouse.y >= CANVAS_H - 92 && mouse.y <= CANVAS_H - 50) {
            SFX.back(); return 'hub';
        }
    }
    return 'continue';
}
export function drawPause(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = 'rgba(5,3,8,0.93)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    ctx.fillStyle = COLORS.text;
    ctx.font = 'bold 42px Cinzel, serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillText('▣  PAUSED', CANVAS_W / 2, 120);

    const tabs: { id: PauseTab; label: string }[] = [
        { id: 'concept', label: '1  CONCEPT' },
        { id: 'pillars', label: '2  PILLARS' },
        { id: 'economy', label: '3  ECONOMY' },
        { id: 'roadmap', label: '4  FEATURES' },
        { id: 'stats',   label: '5  STATS'   },
    ];
    const tabY = 170, tabW = 150;
    const startX = (CANVAS_W - tabW * tabs.length) / 2;
    for (let i = 0; i < tabs.length; i++) {
        const t = tabs[i];
        const tx = startX + i * tabW;
        const active = pauseTab === t.id;
        ctx.fillStyle = active ? COLORS.accent : 'rgba(180,140,90,0.15)';
        ctx.fillRect(tx, tabY, tabW - 6, 42);
        ctx.fillStyle = active ? COLORS.bgDark : COLORS.text;
        ctx.font = 'bold 13px "JetBrains Mono", monospace';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(t.label, tx + (tabW - 6) / 2, tabY + 21);
    }

    const px = 140, py = 230, pw = CANVAS_W - 280, ph = 400;
    drawPanel(ctx, px, py, pw, ph);

    ctx.fillStyle = COLORS.text;
    ctx.font = '15px "JetBrains Mono", monospace';
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';

    if (pauseTab === 'stats') drawStats(ctx, px + 40, py + 36);
    else                       wrapText(ctx, PILLAR_TEXT[pauseTab], px + 40, py + 36, pw - 80, 22);

    const bx = CANVAS_W/2 - 120, by = CANVAS_H - 92, bw = 240, bh = 42;
    const hot = mouse.x >= bx && mouse.x <= bx + bw && mouse.y >= by && mouse.y <= by + bh;
    ctx.fillStyle = hot ? COLORS.accent : 'rgba(200,155,90,0.6)';
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = COLORS.bgDark;
    ctx.font = 'bold 16px "JetBrains Mono", monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('▶  RESUME  [ESC]', bx + bw / 2, by + bh / 2);
}
function drawStats(ctx: CanvasRenderingContext2D, x: number, y: number) {
    ctx.fillStyle = COLORS.accent; ctx.font = 'bold 22px Cinzel, serif';
    ctx.fillText('YOUR DUNGEON SO FAR', x, y);
    let cy = y + 50;
    const row = (label: string, val: string) => {
        ctx.fillStyle = COLORS.textDim; ctx.font = '13px "JetBrains Mono", monospace';
        ctx.fillText(label, x, cy);
        ctx.fillStyle = COLORS.text; ctx.font = 'bold 15px "JetBrains Mono", monospace';
        ctx.fillText(val, x + 320, cy);
        cy += 28;
    };
    row('CLASS',          `${player.clazz.icon}  ${player.clazz.name} — ${player.clazz.tagline}`);
    row('RENOWN',         `Level ${renown.level}   (${renown.xp} / ${renown.xpToNext} xp)`);
    row('COINS',          String(wallet.coins));
    row('ROOMS BUILT',    String(stats.rooms));
    row('DOORS OPENED',   String(stats.doorsOpened));
    row('COMBAT TRIALS',  String(stats.trialsByType.combat));
    row('PUZZLE TRIALS',  String(stats.trialsByType.puzzle));
    row('PARKOUR TRIALS', String(stats.trialsByType.parkour));
    row('ECONOMY TRIALS', String(stats.trialsByType.economy));
    row('LORE FRAGMENTS', `${journal.length} / ${LORE_FRAGMENTS.length}`);
}

// ───── JOURNAL (scrollable) ─────
let journalScroll = 0;
export function updateJournal(): 'continue' | 'hub' {
    if (keysPressed.has('escape') || keysPressed.has('j')) { SFX.back(); return 'hub'; }
    // wheel + arrow scroll
    journalScroll += wheel.dy * 0.5;
    if (keysPressed.has('arrowdown') || keysPressed.has('s')) journalScroll += 40;
    if (keysPressed.has('arrowup')   || keysPressed.has('w')) journalScroll -= 40;
    return 'continue';
}
export function drawJournal(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = 'rgba(5,3,8,0.95)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    ctx.fillStyle = COLORS.text;
    ctx.font = 'bold 42px Cinzel, serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillText('✦  JOURNAL  ✦', CANVAS_W / 2, 90);
    ctx.font = '14px "JetBrains Mono", monospace';
    ctx.fillStyle = COLORS.textDim;
    ctx.fillText(`lore fragments found: ${journal.length} / ${LORE_FRAGMENTS.length}`, CANVAS_W / 2, 118);

    const total = LORE_FRAGMENTS.length;
    const cols = 2, cardW = 480, cardH = 130, gap = 18;
    const rows = Math.ceil(total / cols);
    const gridX = (CANVAS_W - cardW * cols - gap) / 2;
    const gridYTop = 150;
    const gridYBot = CANVAS_H - 60;
    const viewH = gridYBot - gridYTop;
    const totalH = rows * (cardH + gap) - gap;
    const maxScroll = Math.max(0, totalH - viewH);
    if (journalScroll < 0) journalScroll = 0;
    if (journalScroll > maxScroll) journalScroll = maxScroll;

    // clip + draw
    ctx.save();
    ctx.beginPath(); ctx.rect(gridX - 8, gridYTop, cardW * cols + gap + 16, viewH); ctx.clip();

    for (let i = 0; i < total; i++) {
        const col = i % cols, row = Math.floor(i / cols);
        const x = gridX + col * (cardW + gap);
        const y = gridYTop + row * (cardH + gap) - journalScroll;
        if (y + cardH < gridYTop || y > gridYBot) continue;
        const entry = journal[i];
        drawPanel(ctx, x, y, cardW, cardH, entry ? COLORS.accentPurple : COLORS.border);
        if (entry) {
            ctx.fillStyle = COLORS.accent; ctx.font = 'bold 16px Cinzel, serif';
            ctx.textAlign = 'left'; ctx.textBaseline = 'top';
            ctx.fillText(entry.title.toUpperCase(), x + 20, y + 16);
            ctx.fillStyle = COLORS.text; ctx.font = '12px "JetBrains Mono", monospace';
            wrapText(ctx, entry.text, x + 20, y + 40, cardW - 40, 17);
        } else {
            ctx.fillStyle = COLORS.textFaded; ctx.font = 'italic 16px Cinzel, serif';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText('— sealed —', x + cardW / 2, y + cardH / 2);
        }
    }
    ctx.restore();

    // scrollbar
    if (totalH > viewH) {
        const trackX = gridX + cols * (cardW + gap) - gap + 12;
        const trackH = viewH;
        ctx.fillStyle = 'rgba(180,140,90,0.15)';
        ctx.fillRect(trackX, gridYTop, 6, trackH);
        const thumbH = Math.max(40, trackH * viewH / totalH);
        const thumbY = gridYTop + (trackH - thumbH) * (journalScroll / maxScroll);
        ctx.fillStyle = COLORS.accent;
        ctx.fillRect(trackX, thumbY, 6, thumbH);
    }

    ctx.fillStyle = COLORS.textDim;
    ctx.font = '12px "JetBrains Mono", monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillText('scroll: wheel  ·  ↑↓  ·  J or ESC to close', CANVAS_W / 2, CANVAS_H - 24);
}

// ───── TRIAL PICKER ─────
import { VARIANTS_BY_TYPE } from './constants';
import type { ChallengeType, TrialVariant } from './types';

let pickerCategory: ChallengeType = 'combat';
let pickerVariantIdx = 0;
let pickerTier = 1;

export type TrialPickerResult =
    | 'continue'
    | 'hub'
    | { launch: { type: ChallengeType; variant: TrialVariant; tier: number } };

export function updateTrialPicker(): TrialPickerResult {
    if (keysPressed.has('escape') || keysPressed.has('t')) { SFX.back(); return 'hub'; }

    // Category tabs
    if (keysPressed.has('1')) { pickerCategory = 'combat';  pickerVariantIdx = 0; SFX.click(); }
    if (keysPressed.has('2')) { pickerCategory = 'puzzle';  pickerVariantIdx = 0; SFX.click(); }
    if (keysPressed.has('3')) { pickerCategory = 'parkour'; pickerVariantIdx = 0; SFX.click(); }
    if (keysPressed.has('4')) { pickerCategory = 'economy'; pickerVariantIdx = 0; SFX.click(); }

    // Variant list navigation
    const variants = VARIANTS_BY_TYPE[pickerCategory];
    if (keysPressed.has('arrowup')   || keysPressed.has('w')) {
        pickerVariantIdx = (pickerVariantIdx + variants.length - 1) % variants.length;
        SFX.click();
    }
    if (keysPressed.has('arrowdown') || keysPressed.has('s')) {
        pickerVariantIdx = (pickerVariantIdx + 1) % variants.length;
        SFX.click();
    }

    // Tier (left/right OR a/d)
    if (keysPressed.has('arrowleft')  || keysPressed.has('a')) {
        pickerTier = Math.max(1, pickerTier - 1); SFX.click();
    }
    if (keysPressed.has('arrowright') || keysPressed.has('d')) {
        pickerTier = Math.min(3, pickerTier + 1); SFX.click();
    }

    // Launch
    if (keysPressed.has('enter') || keysPressed.has(' ')) {
        SFX.open();
        return { launch: { type: pickerCategory, variant: variants[pickerVariantIdx], tier: pickerTier } };
    }

    return 'continue';
}

export function drawTrialPicker(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = 'rgba(5,3,8,0.95)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Title
    ctx.fillStyle = COLORS.text;
    ctx.font = 'bold 36px Cinzel, serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillText('▸  TRIAL TEST CHAMBER  ◂', CANVAS_W / 2, 100);

    ctx.font = 'italic 13px Cinzel, serif';
    ctx.fillStyle = COLORS.textDim;
    ctx.fillText('Launch any trial for practice — no rewards, no room is built', CANVAS_W / 2, 130);

    // Category tabs (1-4)
    const cats: ChallengeType[] = ['combat', 'puzzle', 'parkour', 'economy'];
    const labels = ['1  COMBAT', '2  PUZZLE', '3  PARKOUR', '4  ECONOMY'];
    const tabW = 170, tabY = 168;
    const tabsStartX = (CANVAS_W - tabW * cats.length) / 2;
    for (let i = 0; i < cats.length; i++) {
        const tx = tabsStartX + i * tabW;
        const active = pickerCategory === cats[i];
        ctx.fillStyle = active ? COLORS.accent : 'rgba(90,74,114,0.4)';
        ctx.fillRect(tx, tabY, tabW - 6, 42);
        ctx.fillStyle = active ? COLORS.bgDark : COLORS.text;
        ctx.font = 'bold 13px "JetBrains Mono", monospace';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(labels[i], tx + (tabW - 6) / 2, tabY + 21);
    }

    // Variant list
    const variants = VARIANTS_BY_TYPE[pickerCategory];
    const listX = CANVAS_W / 2;
    const listY = 250;
    const rowH = 38;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let i = 0; i < variants.length; i++) {
        const v = variants[i];
        const y = listY + i * rowH;
        const selected = i === pickerVariantIdx;
        if (selected) {
            ctx.fillStyle = 'rgba(200,155,90,0.18)';
            ctx.fillRect(listX - 220, y - rowH / 2 + 2, 440, rowH - 4);
            ctx.strokeStyle = COLORS.accent; ctx.lineWidth = 1;
            ctx.strokeRect(listX - 220, y - rowH / 2 + 2, 440, rowH - 4);
            ctx.fillStyle = COLORS.accent;
        } else {
            ctx.fillStyle = COLORS.textDim;
        }
        ctx.font = selected ? 'bold 20px Cinzel, serif' : '16px Cinzel, serif';
        ctx.fillText(v.replace(/-/g, ' ').toUpperCase(), listX, y);
    }

    // Tier indicator
    const tierY = CANVAS_H - 138;
    ctx.fillStyle = COLORS.textDim;
    ctx.font = '11px "JetBrains Mono", monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillText('← →  change tier', CANVAS_W / 2, tierY);

    // Tier pip display
    ctx.textBaseline = 'middle';
    for (let t = 1; t <= 3; t++) {
        const tx = CANVAS_W / 2 - 90 + (t - 1) * 90;
        const active = t === pickerTier;
        ctx.fillStyle = active ? COLORS.accent : 'rgba(90,74,114,0.4)';
        ctx.fillRect(tx - 36, tierY + 10, 72, 38);
        ctx.fillStyle = active ? COLORS.bgDark : COLORS.text;
        ctx.font = 'bold 18px Cinzel, serif';
        ctx.fillText(`TIER ${t}`, tx, tierY + 30);
    }

    // Hint
    ctx.fillStyle = COLORS.text;
    ctx.font = 'bold 12px "JetBrains Mono", monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillText('↑↓  pick variant   ·   ENTER  launch   ·   ESC / T  close', CANVAS_W / 2, CANVAS_H - 30);
}