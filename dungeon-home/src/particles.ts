import type { Particle } from './types';

export const particles: Particle[] = [];

export function spawnBurst(x: number, y: number, color: string, count: number) {
    for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = 1 + Math.random() * 4;
        particles.push({
            x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
            life: 30 + Math.random() * 30, maxLife: 60,
            color, size: 2 + Math.random() * 3
        });
    }
}

export function spawnDrift(x: number, y: number, color: string, count = 1) {
    for (let i = 0; i < count; i++) {
        particles.push({
            x: x + (Math.random() - 0.5) * 20,
            y, vx: (Math.random() - 0.5) * 0.4,
            vy: -0.3 - Math.random() * 0.6,
            life: 100, maxLife: 100,
            color, size: 1 + Math.random() * 2,
        });
    }
}

export function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx; p.y += p.vy; p.vx *= 0.95; p.vy *= 0.96; p.life--;
        if (p.life <= 0) particles.splice(i, 1);
    }
}

export function drawParticles(ctx: CanvasRenderingContext2D) {
    for (const p of particles) {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.min(1, p.life / p.maxLife);
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
}

export function clearParticles() { particles.length = 0; }