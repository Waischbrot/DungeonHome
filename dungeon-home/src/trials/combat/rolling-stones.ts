import type { Trial } from '../../types';
import { COLORS } from '../../constants';
import { player } from '../../state';
import { spawnBurst } from '../../particles';
import { beep, SFX } from '../../audio';
import { move, drawArena, time } from '../shared';

type Channel = {
    cy: number;
    dir: 1 | -1;
    speed: number;
    spawnInterval: number;
    spawnTimer: number;
};

type Stone = {
    x: number;
    ch: number;
    rot: number;
    alive: boolean;
};

export function makeRollingStones(b: any, p: any, tier: number): Trial {
    const SAFE_TOP = 56;
    const SAFE_BOT = 56;

    const numChannels = 5;
    const channelH = (b.h - SAFE_TOP - SAFE_BOT) / numChannels;

    const STONE_SIZE = 64;
    const STONE_R = STONE_SIZE / 2;
    const PLAYER_R = 11;
    const HIT_PAD = 3;

    // Real challenge again:
    // each channel has a personality, but all remain readable.
    const speedProfile = [2.0, 2.65, 2.25, 3.0, 1.85];
    const dirProfile: (1 | -1)[] = [1, -1, 1, -1, 1];

    const wayfarerEase = player.clazz.id === 'wayfarer' ? 0.82 : 1;
    const channels: Channel[] = [];

    for (let i = 0; i < numChannels; i++) {
        const baseSpeed = (speedProfile[i] + tier * 0.35) * wayfarerEase;

        // Gap is distance between stones in a stream.
        // Smaller at higher tier = more pressure.
        const targetGap = 300 - tier * 30;

        channels.push({
            cy: b.y + SAFE_TOP + (i + 0.5) * channelH,
            dir: dirProfile[i],
            speed: baseSpeed,
            spawnInterval: Math.max(42, Math.floor(targetGap / baseSpeed)),
            spawnTimer: Math.floor(Math.random() * 20),
        });
    }

    const stones: Stone[] = [];

    function addStone(chIdx: number, x: number) {
        stones.push({
            x,
            ch: chIdx,
            rot: Math.random() * Math.PI * 2,
            alive: true,
        });
    }

    // Pre-populate each channel with a proper stream.
    // This makes the board readable immediately and prevents empty starts.
    for (let i = 0; i < numChannels; i++) {
        const ch = channels[i];
        const spacing = ch.speed * ch.spawnInterval;
        const count = Math.ceil((b.w + spacing * 2) / spacing);
        const phase = Math.random() * spacing;

        for (let n = 0; n < count; n++) {
            const x = ch.dir > 0
                ? b.x - spacing + phase + n * spacing
                : b.x + b.w + spacing - phase - n * spacing;

            addStone(i, x);
        }
    }

    // Extra tier pressure: more overlap in alternate channels.
    if (tier >= 2) {
        for (const i of [1, 3]) {
            addStone(i, b.x + b.w * (0.20 + Math.random() * 0.20));
        }
    }

    if (tier >= 3) {
        for (const i of [0, 2, 4]) {
            addStone(i, b.x + b.w * (0.55 + Math.random() * 0.25));
        }
    }

    p.x = b.x + b.w / 2;
    p.y = b.y + b.h - SAFE_BOT / 2;

    const goal = {
        x: b.x + b.w / 2,
        y: b.y + SAFE_TOP / 2,
        r: 26,
    };

    let hitFlash = 0;
    let won = false;

    function spawn(chIdx: number) {
        const ch = channels[chIdx];

        addStone(
            chIdx,
            ch.dir > 0
                ? b.x - STONE_R - 4
                : b.x + b.w + STONE_R + 4,
        );
    }

    return {
        type: 'combat',
        variant: 'rolling-stones',
        player: p,
        bounds: b,
        title: `⚔  ROLLING STONES · TIER ${tier}`,
        hint: 'Read each lane, then cross when the gap opens',

        update() {
            if (!won) move(p, b, 1.18);
            if (hitFlash > 0) hitFlash = Math.max(0, hitFlash - time.dt);

            // Spawn ticks
            for (let i = 0; i < numChannels; i++) {
                const ch = channels[i];

                ch.spawnTimer -= time.dt;

                if (ch.spawnTimer <= 0) {
                    spawn(i);

                    // Slight variance, but never too sparse.
                    ch.spawnTimer = Math.max(
                        32,
                        ch.spawnInterval + (Math.random() - 0.35) * 35,
                    );
                }
            }

            // Move stones + collision
            for (const s of stones) {
                if (!s.alive) continue;

                const ch = channels[s.ch];

                s.x += ch.speed * ch.dir * time.dt;
                s.rot += ch.speed * ch.dir * 0.035 * time.dt;

                if (
                    (ch.dir > 0 && s.x > b.x + b.w + STONE_R + 6) ||
                    (ch.dir < 0 && s.x < b.x - STONE_R - 6)
                ) {
                    s.alive = false;
                    continue;
                }

                if (!won) {
                    const dx = s.x - p.x;
                    const dy = ch.cy - p.y;

                    if (Math.hypot(dx, dy) < STONE_R + PLAYER_R - HIT_PAD) {
                        p.x = b.x + b.w / 2;
                        p.y = b.y + b.h - SAFE_BOT / 2;
                        hitFlash = 24;
                        SFX.fail();
                        break;
                    }
                }
            }

            for (let i = stones.length - 1; i >= 0; i--) {
                if (!stones[i].alive) stones.splice(i, 1);
            }

            if (!won && Math.hypot(p.x - goal.x, p.y - goal.y) < goal.r) {
                won = true;
                beep(800, 0.25, 'sine');
                spawnBurst(goal.x, goal.y, '#6f8a52', 35);
            }
        },

        draw(ctx) {
            drawArena(ctx, b, '#a14040');

            // Safe zones
            ctx.fillStyle = 'rgba(110,140,80,0.10)';
            ctx.fillRect(b.x, b.y, b.w, SAFE_TOP);
            ctx.fillRect(b.x, b.y + b.h - SAFE_BOT, b.w, SAFE_BOT);

            // Channel road background
            ctx.fillStyle = 'rgba(20,12,8,0.22)';
            ctx.fillRect(b.x, b.y + SAFE_TOP, b.w, b.h - SAFE_TOP - SAFE_BOT);

            // Channel dividers
            ctx.strokeStyle = 'rgba(0,0,0,0.45)';
            ctx.lineWidth = 2;
            for (let i = 0; i <= numChannels; i++) {
                const y = b.y + SAFE_TOP + i * channelH;
                ctx.beginPath();
                ctx.moveTo(b.x, y);
                ctx.lineTo(b.x + b.w, y);
                ctx.stroke();
            }

            // Dashed centreline
            ctx.strokeStyle = 'rgba(255, 245, 186, 0.10)';
            ctx.lineWidth = 1;
            ctx.setLineDash([12, 14]);
            for (const ch of channels) {
                ctx.beginPath();
                ctx.moveTo(b.x + 8, ch.cy);
                ctx.lineTo(b.x + b.w - 8, ch.cy);
                ctx.stroke();
            }
            ctx.setLineDash([]);

            // Direction arrows
            ctx.font = 'bold 14px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            for (const ch of channels) {
                ctx.fillStyle = 'rgba(0,0,0,0.22)';
                const g = ch.dir > 0 ? '▶' : '◀';
                for (let x = b.x + 70; x < b.x + b.w - 40; x += 160) {
                    ctx.fillText(g, x, ch.cy);
                }
            }
            ctx.textBaseline = 'alphabetic';

            // Start pad
            ctx.strokeStyle = 'rgba(200,155,90,0.45)';
            ctx.lineWidth = 1;
            ctx.strokeRect(b.x + b.w / 2 - 24, b.y + b.h - SAFE_BOT / 2 - 14, 48, 28);

            // Goal pad
            ctx.fillStyle = won ? '#6f8a52' : '#1a3520';
            ctx.strokeStyle = '#6f8a52';
            ctx.lineWidth = 2;
            ctx.shadowColor = '#6f8a52';
            ctx.shadowBlur = 12;
            ctx.beginPath();
            ctx.arc(goal.x, goal.y, goal.r, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.shadowBlur = 0;

            // Stones
            for (const s of stones) {
                if (!s.alive) continue;

                const ch = channels[s.ch];

                // Shadow
                ctx.fillStyle = 'rgba(0,0,0,0.5)';
                ctx.beginPath();
                ctx.ellipse(s.x, ch.cy + STONE_R - 4, STONE_R * 0.85, STONE_R * 0.28, 0, 0, Math.PI * 2);
                ctx.fill();

                // Body
                ctx.fillStyle = '#4a382a';
                ctx.beginPath();
                ctx.arc(s.x, ch.cy, STONE_R, 0, Math.PI * 2);
                ctx.fill();

                // Highlight
                ctx.fillStyle = '#6a4e34';
                ctx.beginPath();
                ctx.arc(s.x - STONE_R * 0.28, ch.cy - STONE_R * 0.28, STONE_R * 0.62, 0, Math.PI * 2);
                ctx.fill();

                // Outline
                ctx.strokeStyle = '#2a1a10';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(s.x, ch.cy, STONE_R, 0, Math.PI * 2);
                ctx.stroke();

                // Rolling cracks
                ctx.strokeStyle = '#1a1010';
                ctx.lineWidth = 2;
                for (const off of [0, Math.PI / 2]) {
                    const a = s.rot + off;
                    ctx.beginPath();
                    ctx.moveTo(s.x + Math.cos(a) * STONE_R * 0.7, ch.cy + Math.sin(a) * STONE_R * 0.7);
                    ctx.lineTo(s.x - Math.cos(a) * STONE_R * 0.7, ch.cy - Math.sin(a) * STONE_R * 0.7);
                    ctx.stroke();
                }
            }

            ctx.fillStyle = COLORS.text;
            ctx.font = 'bold 14px "JetBrains Mono", monospace';
            ctx.textAlign = 'center';
            ctx.fillText('REACH THE TOP', b.x + b.w / 2, b.y + 30);

            if (hitFlash > 0) {
                ctx.fillStyle = `rgba(161,64,64,${hitFlash / 40})`;
                ctx.fillRect(b.x, b.y, b.w, b.h);
            }
        },

        isComplete() {
            return won;
        },
    };
}