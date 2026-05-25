let ctx: AudioContext | null = null;

export function ensureAudio() {
    if (ctx) return;
    try { ctx = new (window.AudioContext || (window as any).webkitAudioContext)(); }
    catch { /* silent */ }
}

export function beep(freq: number, duration = 0.1, type: OscillatorType = 'square', vol = 0.04) {
    ensureAudio();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
}

export const SFX = {
    click:     () => beep(440, 0.04, 'square', 0.03),
    back:      () => beep(220, 0.08, 'square', 0.03),
    open:      () => { beep(523, 0.1, 'sine'); setTimeout(() => beep(659, 0.1, 'sine'), 80); setTimeout(() => beep(784, 0.25, 'sine'), 160); },
    fail:      () => beep(120, 0.3, 'sawtooth'),
    coin:      (i = 0) => beep(500 + i * 100, 0.12, 'sine'),
    hit:       () => beep(700, 0.1, 'sine'),
    doorEnter: () => { beep(330, 0.08, 'square'); setTimeout(() => beep(440, 0.12, 'square'), 60); },
    unlock:    () => { beep(880, 0.15, 'sine'); setTimeout(() => beep(1320, 0.2, 'sine'), 100); },
};