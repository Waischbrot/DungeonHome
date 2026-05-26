import type { Trial } from '../../types';
import { COLORS } from '../../constants';
import { beep, SFX } from '../../audio';
import { move, drawArena, time } from '../shared';

export function makeRuneCipher(b: any, p: any, tier: number): Trial {
    const runes  = ['Ϛ', 'Ψ', 'Ω', 'Ϟ', 'Ϡ'];
    const colors = ['#a14040', '#6f8a52', '#c89b5a', '#6a5a8a', '#5fb8b0'];
    const len = 3 + Math.floor(tier / 2);
    const target: number[] = [];
    for (let i = 0; i < len; i++) target.push(Math.floor(Math.random() * runes.length));
    const plates = runes.map((_, i) => ({
        x: b.x + b.w * (i + 1) / (runes.length + 1),
        y: b.y + b.h * 0.7,
    }));
    let inputIdx = 0, lastTouched = -1, flash = -1, flashTimer = 0, wrongFlash = 0;
    return {
        type: 'puzzle', variant: 'rune-cipher', player: p, bounds: b,
        title: `◉  RUNE CIPHER · TIER ${tier}`,
        hint: 'The cipher is shown above — step on plates in the same order',
        update() {
            if (flashTimer > 0) flashTimer--;
            if (wrongFlash > 0) wrongFlash--;
            move(p, b);
            let touching = -1;
            for (let i = 0; i < plates.length; i++) {
                if (Math.hypot(plates[i].x - p.x, plates[i].y - p.y) < 28) touching = i;
            }
            if (touching !== -1 && touching !== lastTouched) {
                lastTouched = touching;
                if (touching === target[inputIdx]) {
                    flash = touching; flashTimer = 15;
                    beep(500 + inputIdx * 80, 0.15, 'sine');
                    inputIdx++;
                } else { SFX.fail(); inputIdx = 0; wrongFlash = 25; }
            } else if (touching === -1) lastTouched = -1;
        },
        draw(ctx) {
            drawArena(ctx, b, '#6a5a8a');
            const startX = b.x + b.w / 2 - (target.length * 50) / 2;
            for (let i = 0; i < target.length; i++) {
                const cx = startX + i * 50 + 25, cy = b.y + 100;
                const done = i < inputIdx;
                ctx.fillStyle = done ? '#2a3a22' : '#251f30';
                ctx.fillRect(cx - 22, cy - 22, 44, 44);
                ctx.strokeStyle = done ? '#6f8a52' : '#6a5a8a';
                ctx.lineWidth = 2;
                ctx.strokeRect(cx - 22, cy - 22, 44, 44);
                ctx.fillStyle = done ? '#6f8a52' : colors[target[i]];
                ctx.font = 'bold 28px serif';
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText(runes[target[i]], cx, cy);
            }
            for (let i = 0; i < plates.length; i++) {
                const pl = plates[i];
                const lit = flash === i && flashTimer > 0;
                ctx.fillStyle = lit ? colors[i] : '#251f30';
                ctx.strokeStyle = colors[i]; ctx.lineWidth = 2;
                ctx.beginPath(); ctx.arc(pl.x, pl.y, 28, 0, Math.PI * 2);
                ctx.fill(); ctx.stroke();
                ctx.fillStyle = lit ? '#251f30' : colors[i];
                ctx.font = 'bold 24px serif';
                ctx.fillText(runes[i], pl.x, pl.y);
            }
            ctx.fillStyle = COLORS.text;
            ctx.font = 'bold 16px "JetBrains Mono", monospace';
            ctx.fillText(`${inputIdx} / ${target.length}`, b.x + b.w / 2, b.y + 36);
            if (wrongFlash > 0) {
                ctx.fillStyle = `rgba(161,64,64,${wrongFlash / 50})`;
                ctx.fillRect(b.x, b.y, b.w, b.h);
            }
            ctx.textBaseline = 'alphabetic';
        },
        isComplete() { return inputIdx >= target.length; },
    };
}