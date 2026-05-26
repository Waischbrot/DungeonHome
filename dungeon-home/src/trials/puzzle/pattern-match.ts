import type { Trial } from '../../types';
import { COLORS } from '../../constants';
import { spawnBurst } from '../../particles';
import { beep, SFX } from '../../audio';
import { move, drawArena, time } from '../shared';

export function makePatternMatch(b: any, p: any, tier: number): Trial {
    const symbols = ['▲', '●', '■', '◆', '★', '✦'];
    const colors  = ['#a14040', '#6f8a52', '#c89b5a', '#6a5a8a', '#7a6a4a', '#5fb8b0'];
    const numPlates = 5;
    const plateSyms: number[] = [];
    while (plateSyms.length < numPlates) {
        const i = Math.floor(Math.random() * symbols.length);
        if (!plateSyms.includes(i)) plateSyms.push(i);
    }
    const plates = plateSyms.map((symIdx, i) => ({
        x: b.x + b.w * (i + 1) / (numPlates + 1),
        y: b.y + b.h * 0.65,
        symIdx,
    }));
    const totalRounds = 3 + tier;
    let round = 0;
    let target = plateSyms[Math.floor(Math.random() * plateSyms.length)];
    let lastTouched = -1, flash = -1, flashTimer = 0, wrongFlash = 0;
    return {
        type: 'puzzle', variant: 'pattern-match', player: p, bounds: b,
        title: `◉  PATTERN MATCH · TIER ${tier}`,
        hint: `Step on the plate matching the symbol above. ${totalRounds} rounds.`,
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
                if (plates[touching].symIdx === target) {
                    flash = touching; flashTimer = 15;
                    beep(600 + round * 80, 0.15, 'sine');
                    spawnBurst(plates[touching].x, plates[touching].y, colors[target], 10);
                    round++;
                    if (round < totalRounds) {
                        const opts = plateSyms.filter(s => s !== target);
                        target = opts[Math.floor(Math.random() * opts.length)];
                    }
                } else { SFX.fail(); wrongFlash = 25; }
            } else if (touching === -1) lastTouched = -1;
        },
        draw(ctx) {
            drawArena(ctx, b, '#6a5a8a');
            ctx.fillStyle = '#251f30';
            ctx.fillRect(b.x + b.w / 2 - 60, b.y + 60, 120, 100);
            ctx.strokeStyle = '#6a5a8a'; ctx.lineWidth = 2;
            ctx.strokeRect(b.x + b.w / 2 - 60, b.y + 60, 120, 100);
            ctx.fillStyle = colors[target];
            ctx.font = 'bold 64px serif';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.shadowColor = colors[target]; ctx.shadowBlur = 8;
            ctx.fillText(symbols[target], b.x + b.w / 2, b.y + 113);
            ctx.shadowBlur = 0;
            for (let i = 0; i < plates.length; i++) {
                const pl = plates[i];
                const lit = flash === i && flashTimer > 0;
                ctx.fillStyle = lit ? colors[pl.symIdx] : '#251f30';
                ctx.strokeStyle = colors[pl.symIdx]; ctx.lineWidth = 2;
                ctx.beginPath(); ctx.arc(pl.x, pl.y, 26, 0, Math.PI * 2);
                ctx.fill(); ctx.stroke();
                ctx.fillStyle = lit ? '#251f30' : colors[pl.symIdx];
                ctx.font = 'bold 28px serif';
                ctx.fillText(symbols[pl.symIdx], pl.x, pl.y);
            }
            ctx.fillStyle = COLORS.text;
            ctx.font = 'bold 16px "JetBrains Mono", monospace';
            ctx.fillText(`ROUND ${round} / ${totalRounds}`, b.x + b.w / 2, b.y + 36);
            if (wrongFlash > 0) {
                ctx.fillStyle = `rgba(161,64,64,${wrongFlash / 50})`;
                ctx.fillRect(b.x, b.y, b.w, b.h);
            }
            ctx.textBaseline = 'alphabetic';
        },
        isComplete() { return round >= totalRounds; },
    };
}