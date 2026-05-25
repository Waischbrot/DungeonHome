import type { Trial } from '../../types';
import { COLORS } from '../../constants';
import { spawnBurst } from '../../particles';
import { SFX } from '../../audio';
import { move, drawArena } from '../shared';

export function makeWaveDefense(b: any, p: any, tier: number): Trial {
    const altar = { x: b.x + b.w / 2, y: b.y + b.h / 2, r: 28 };
    const waves = [3 + tier, 4 + tier, 5 + tier];
    let waveIdx = 0, spawned = 0, spawnTimer = 30;
    let altarHits = 0; const altarMaxHits = 3;
    let won = false;
    type Shade = { x: number; y: number; caught: boolean };
    const shades: Shade[] = [];
    return {
        type: 'combat', variant: 'wave-defense', player: p, bounds: b,
        title: `⚔  WAVE DEFENSE · TIER ${tier}`,
        hint: `Stop the shadows before they reach the altar. ${waves.length} waves.`,
        update() {
            move(p, b);
            if (waveIdx < waves.length) {
                if (spawned < waves[waveIdx]) {
                    spawnTimer--;
                    if (spawnTimer <= 0) {
                        spawnTimer = 38;
                        const side = Math.floor(Math.random() * 4);
                        const s: Shade = { x: 0, y: 0, caught: false };
                        if (side === 0) { s.x = b.x + 12;       s.y = b.y + 30 + Math.random() * (b.h - 60); }
                        if (side === 1) { s.x = b.x + b.w - 12; s.y = b.y + 30 + Math.random() * (b.h - 60); }
                        if (side === 2) { s.x = b.x + 30 + Math.random() * (b.w - 60); s.y = b.y + 12; }
                        if (side === 3) { s.x = b.x + 30 + Math.random() * (b.w - 60); s.y = b.y + b.h - 12; }
                        shades.push(s); spawned++;
                    }
                }
                if (spawned >= waves[waveIdx] && shades.every(s => s.caught)) {
                    waveIdx++; spawned = 0; spawnTimer = 90;
                    if (waveIdx >= waves.length) {
                        won = true;
                        spawnBurst(altar.x, altar.y, '#c89b5a', 30);
                    }
                }
            }
            for (const s of shades) {
                if (s.caught) continue;
                const dx = altar.x - s.x, dy = altar.y - s.y;
                const d = Math.hypot(dx, dy) || 1;
                s.x += (dx / d) * 0.9;
                s.y += (dy / d) * 0.9;
                if (Math.hypot(s.x - p.x, s.y - p.y) < 18) {
                    s.caught = true; SFX.hit(); spawnBurst(s.x, s.y, '#a14040', 14);
                }
                if (d < altar.r) {
                    s.caught = true; altarHits++; SFX.fail();
                    spawnBurst(altar.x, altar.y, '#a14040', 22);
                    if (altarHits >= altarMaxHits) {
                        waveIdx = 0; spawned = 0; altarHits = 0;
                        shades.length = 0; spawnTimer = 90;
                    }
                }
            }
        },
        draw(ctx) {
            drawArena(ctx, b, '#a14040');
            ctx.fillStyle = '#3a3328';
            ctx.beginPath(); ctx.arc(altar.x, altar.y, altar.r + 4, 0, Math.PI * 2); ctx.fill();
            const pulse = 0.7 + Math.sin(Date.now() / 220) * 0.3;
            ctx.fillStyle = `rgba(200,155,90,${pulse})`;
            ctx.beginPath(); ctx.arc(altar.x, altar.y, altar.r, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#c89b5a'; ctx.lineWidth = 2; ctx.stroke();
            for (const s of shades) {
                if (s.caught) continue;
                ctx.fillStyle = '#a14040';
                ctx.shadowColor = '#a14040'; ctx.shadowBlur = 8;
                ctx.beginPath(); ctx.arc(s.x, s.y, 10, 0, Math.PI * 2); ctx.fill();
                ctx.shadowBlur = 0;
            }
            ctx.fillStyle = COLORS.text;
            ctx.font = 'bold 16px "JetBrains Mono", monospace';
            ctx.textAlign = 'center';
            ctx.fillText(
                `WAVE ${Math.min(waveIdx + 1, waves.length)} / ${waves.length}     ALTAR ${altarMaxHits - altarHits} / ${altarMaxHits}`,
                b.x + b.w / 2, b.y + 36,
            );
        },
        isComplete() { return won; },
    };
}