import type { Trial } from '../../types';
import { COLORS } from '../../constants';
import { spawnBurst } from '../../particles';
import { SFX } from '../../audio';
import { move, drawArena, time } from '../shared';

type Shade = {
    x: number;
    y: number;
    caught: boolean;
};

export function makeWaveDefense(b: any, p: any, tier: number): Trial {
    const altar = { x: b.x + b.w / 2, y: b.y + b.h / 2, r: 28 };
    const waves = [3 + tier, 4 + tier, 5 + tier];

    let waveIdx = 0;
    let spawned = 0;
    let spawnTimer = 15;

    let altarHits = 0;
    const altarMaxHits = 3;

    let won = false;
    const shades: Shade[] = [];

    return {
        type: 'combat',
        variant: 'wave-defense',
        player: p,
        bounds: b,
        title: `⚔  WAVE DEFENSE · TIER ${tier}`,
        hint: `Catch shadows before they reach the altar. ${waves.length} waves.`,

        update() {
            move(p, b, 1.25);

            // Spawn current wave
            if (waveIdx < waves.length) {
                if (spawned < waves[waveIdx]) {
                    spawnTimer -= time.dt;

                    if (spawnTimer <= 0) {
                        spawnTimer = Math.max(18, 34 - tier * 3);

                        const side = Math.floor(Math.random() * 4);
                        const s: Shade = { x: 0, y: 0, caught: false };

                        if (side === 0) {
                            s.x = b.x + 12;
                            s.y = b.y + 30 + Math.random() * (b.h - 60);
                        }
                        if (side === 1) {
                            s.x = b.x + b.w - 12;
                            s.y = b.y + 30 + Math.random() * (b.h - 60);
                        }
                        if (side === 2) {
                            s.x = b.x + 30 + Math.random() * (b.w - 60);
                            s.y = b.y + 12;
                        }
                        if (side === 3) {
                            s.x = b.x + 30 + Math.random() * (b.w - 60);
                            s.y = b.y + b.h - 12;
                        }

                        shades.push(s);
                        spawned++;
                    }
                }

                // Advance to next wave only after all spawned shades are resolved.
                if (spawned >= waves[waveIdx] && shades.every(s => s.caught)) {
                    waveIdx++;
                    spawned = 0;
                    spawnTimer = 70;

                    if (waveIdx >= waves.length) {
                        won = true;
                        spawnBurst(altar.x, altar.y, '#c89b5a', 30);
                    }
                }
            }

            // Move shades
            for (const s of shades) {
                if (s.caught) continue;

                const dx = altar.x - s.x;
                const dy = altar.y - s.y;
                const d = Math.hypot(dx, dy) || 1;

                const shadeSpeed = 1.45 + tier * 0.15;

                s.x += (dx / d) * shadeSpeed * time.dt;
                s.y += (dy / d) * shadeSpeed * time.dt;

                // Player catches shade
                if (Math.hypot(s.x - p.x, s.y - p.y) < 18) {
                    s.caught = true;
                    SFX.hit();
                    spawnBurst(s.x, s.y, '#a14040', 14);
                    continue;
                }

                // Shade reaches altar
                const altarDist = Math.hypot(s.x - altar.x, s.y - altar.y);
                if (altarDist < altar.r) {
                    s.caught = true;
                    altarHits++;
                    SFX.fail();
                    spawnBurst(altar.x, altar.y, '#a14040', 22);

                    if (altarHits >= altarMaxHits) {
                        // Reset trial state, not full dungeon.
                        waveIdx = 0;
                        spawned = 0;
                        altarHits = 0;
                        shades.length = 0;
                        spawnTimer = 70;
                        break;
                    }
                }
            }
        },

        draw(ctx) {
            drawArena(ctx, b, '#a14040');

            // Altar base
            ctx.fillStyle = '#3a3328';
            ctx.beginPath();
            ctx.arc(altar.x, altar.y, altar.r + 4, 0, Math.PI * 2);
            ctx.fill();

            // Altar glow
            const pulse = 0.7 + Math.sin(Date.now() / 220) * 0.3;
            ctx.fillStyle = `rgba(200,155,90,${pulse})`;
            ctx.beginPath();
            ctx.arc(altar.x, altar.y, altar.r, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = '#c89b5a';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Altar hit pips
            ctx.fillStyle = COLORS.textDim;
            ctx.font = 'bold 12px "JetBrains Mono", monospace';
            ctx.textAlign = 'center';
            ctx.fillText(
                `ALTAR ${altarMaxHits - altarHits} / ${altarMaxHits}`,
                altar.x,
                altar.y + altar.r + 20,
            );

            // Shades
            for (const s of shades) {
                if (s.caught) continue;

                ctx.fillStyle = '#a14040';
                ctx.shadowColor = '#a14040';
                ctx.shadowBlur = 8;
                ctx.beginPath();
                ctx.arc(s.x, s.y, 10, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;

                ctx.fillStyle = 'rgba(232,220,192,0.9)';
                ctx.beginPath();
                ctx.arc(s.x - 3, s.y - 2, 1.4, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.arc(s.x + 3, s.y - 2, 1.4, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.fillStyle = COLORS.text;
            ctx.font = 'bold 16px "JetBrains Mono", monospace';
            ctx.textAlign = 'center';
            ctx.fillText(
                `WAVE ${Math.min(waveIdx + 1, waves.length)} / ${waves.length}`,
                b.x + b.w / 2,
                b.y + 36,
            );
        },

        isComplete() {
            return won;
        },
    };
}