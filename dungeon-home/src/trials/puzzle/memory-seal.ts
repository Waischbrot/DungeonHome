import type { Trial } from '../../types';
import { COLORS } from '../../constants';
import { player } from '../../state';
import { beep, SFX } from '../../audio';
import { move, drawArena } from '../shared';

export function makeMemorySeal(b: any, p: any, tier: number): Trial {
    const len = 2 + tier;
    const plates = [
        { x: b.x + b.w * 0.25, y: b.y + b.h * 0.4,  color: '#a14040', step: 0 },
        { x: b.x + b.w * 0.50, y: b.y + b.h * 0.4,  color: '#6f8a52', step: 1 },
        { x: b.x + b.w * 0.75, y: b.y + b.h * 0.4,  color: '#c89b5a', step: 2 },
        { x: b.x + b.w * 0.375, y: b.y + b.h * 0.75, color: '#6a5a8a', step: 3 },
        { x: b.x + b.w * 0.625, y: b.y + b.h * 0.75, color: '#5fb8b0', step: 4 },
    ];
    const seq: number[] = [];
    for (let i = 0; i < len; i++) seq.push(Math.floor(Math.random() * plates.length));
    let phase: 'show' | 'input' = 'show';
    let showIdx = 0, showTimer = 50;
    let inputIdx = 0, lastTouched = -1, flash = -1, flashTimer = 0;
    const repeats = player.clazz.id === 'scholar' ? 2 : 1;
    let repeatI = 0;
    return {
        type: 'puzzle', variant: 'memory-seal', player: p, bounds: b,
        title: `◉  MEMORY SEAL · TIER ${tier}`,
        hint: 'Watch the sequence — then step on the plates in order',
        update() {
            if (flashTimer > 0) { flashTimer--; if (flashTimer === 0) flash = -1; }
            if (phase === 'show') {
                showTimer--;
                if (showTimer === 25) { flash = seq[showIdx]; flashTimer = 20; beep(360 + showIdx * 90, 0.2, 'sine'); }
                if (showTimer <= 0) {
                    showIdx++; showTimer = 50;
                    if (showIdx >= seq.length) {
                        repeatI++;
                        if (repeatI >= repeats) { phase = 'input'; showIdx = 0; }
                        else { showIdx = 0; }
                    }
                }
                return;
            }
            move(p, b);
            let touching = -1;
            for (const pl of plates) if (Math.hypot(pl.x - p.x, pl.y - p.y) < 28) touching = pl.step;
            if (touching !== -1 && touching !== lastTouched) {
                lastTouched = touching;
                if (touching === seq[inputIdx]) {
                    flash = touching; flashTimer = 15;
                    beep(500 + inputIdx * 100, 0.15, 'sine');
                    inputIdx++;
                } else {
                    SFX.fail();
                    inputIdx = 0; phase = 'show'; showIdx = 0; showTimer = 50; repeatI = 0;
                }
            } else if (touching === -1) lastTouched = -1;
        },
        draw(ctx) {
            drawArena(ctx, b, '#6a5a8a');
            for (const pl of plates) {
                const lit = flash === pl.step;
                ctx.fillStyle = lit ? pl.color : '#251f30';
                ctx.strokeStyle = pl.color; ctx.lineWidth = 2;
                if (lit) { ctx.shadowColor = pl.color; ctx.shadowBlur = 14; }
                ctx.beginPath(); ctx.arc(pl.x, pl.y, 24, 0, Math.PI * 2);
                ctx.fill(); ctx.stroke(); ctx.shadowBlur = 0;
            }
            ctx.fillStyle = COLORS.text;
            ctx.font = 'bold 16px "JetBrains Mono", monospace'; ctx.textAlign = 'center';
            ctx.fillText(
                phase === 'show'
                    ? `MEMORISE  ${showIdx + 1}/${seq.length}` + (repeats > 1 ? `  (REP ${repeatI + 1}/${repeats})` : '')
                    : `${inputIdx} / ${seq.length}`,
                b.x + b.w / 2, b.y + 36,
            );
        },
        isComplete() { return phase === 'input' && inputIdx >= seq.length; },
    };
}