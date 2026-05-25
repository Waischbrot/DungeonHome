export const keys = new Set<string>();
export const keysPressed = new Set<string>();          // edge-triggered
export const mouse = { x: 0, y: 0, down: false, clicked: false };
export const wheel = { dy: 0 };                        // accumulated this frame

let canvasRef: HTMLCanvasElement | null = null;
export function bindCanvas(c: HTMLCanvasElement) { canvasRef = c; }

function toCanvas(e: MouseEvent) {
    if (!canvasRef) return { x: 0, y: 0 };
    const r = canvasRef.getBoundingClientRect();
    return {
        x: (e.clientX - r.left) * (canvasRef.width  / r.width),
        y: (e.clientY - r.top)  * (canvasRef.height / r.height),
    };
}

// ─── Keyboard ──────────────────────────────────────────────────
window.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if (!keys.has(k)) keysPressed.add(k);
    keys.add(k);
    if ([
        'w','a','s','d',
        'arrowup','arrowdown','arrowleft','arrowright',
        ' ','e','escape','enter','j','m','f','tab',
    ].includes(k)) e.preventDefault();
});
window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));

// ─── Mouse ─────────────────────────────────────────────────────
window.addEventListener('mousemove', e => {
    const p = toCanvas(e); mouse.x = p.x; mouse.y = p.y;
});
window.addEventListener('mousedown', e => {
    const p = toCanvas(e); mouse.x = p.x; mouse.y = p.y;
    mouse.down = true; mouse.clicked = true;
});
window.addEventListener('mouseup',   () => { mouse.down = false; });

// ─── Wheel (for scrollable journal & long codex pages) ─────────
window.addEventListener('wheel', e => {
    // normalise to pixel-ish units; clamp so trackpads don't explode
    let delta = e.deltaY;
    if (e.deltaMode === 1) delta *= 16;                  // line mode
    if (e.deltaMode === 2) delta *= 100;                 // page mode
    wheel.dy += Math.max(-200, Math.min(200, delta));
    // only prevent default if the canvas is the scroll target — keeps
    // the rest of the page (devtools etc.) friendly during dev.
    if (canvasRef && e.target === canvasRef) e.preventDefault();
}, { passive: false });

// Called at the very end of each game tick.
export function consumeFrame() {
    keysPressed.clear();
    mouse.clicked = false;
    wheel.dy = 0;
}