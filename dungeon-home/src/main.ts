import './style.css';

import {
    CANVAS_W,
    CANVAS_H,
    COLORS,
    SMITH_COIN_COST,
    SMITH_XP_GAIN,
    LORE_PER_XP_TRADE,
} from './constants';

import { bindCanvas, keysPressed, consumeFrame, mouse } from './input';

import {
    player,
    rooms,
    resetGame,
    addRoomBehindDoor,
    maybeUnlockLore,
    rewardForTrial,
    stats,
    canOpenDoor,
    findNearestNpc,
    journal,
    wallet,
    questState,
    claimCurrentQuest,
    tradeLoreForXp,
    tradeCoinsForXp,
    questIsComplete,
    acceptNextQuest,
    nextOfferableQuest,
} from './state';

import {
    updateParticles,
    drawParticles,
    spawnBurst,
    clearParticles,
} from './particles';

import {
    updateHub,
    drawHub,
    findNearestDoor,
} from './hub';

import { createTrial } from './trials';
import { time } from './trials/shared';

import {
    drawHUD,
    drawMinimap,
    drawDoorInfo,
    drawNpcPrompt,
    drawLocationBar,
    drawToast,
    updateToast,
    showToast,
    drawDialog,
    drawQuestPanel,
} from './ui';

import type { DialogAction } from './ui';

import {
    updateTitle,
    drawTitle,
    updateClassSelect,
    drawClassSelect,
    updatePause,
    drawPause,
    updateJournal,
    drawJournal,
    updateTrialPicker,
    drawTrialPicker,
} from './screens';

import { ensureAudio, SFX } from './audio';

import type {
    Trial,
    Screen,
    Door,
    Npc,
} from './types';

// ──────────────────────────────────────────────────────────────
// Canvas
// ──────────────────────────────────────────────────────────────

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
bindCanvas(canvas);

// ──────────────────────────────────────────────────────────────
// Timing
// ──────────────────────────────────────────────────────────────
//
// Important:
// - `time.dt = 1` means "one 60fps frame worth of simulation time".
// - On 144Hz, `time.dt` is ~0.42.
// - On 30Hz, `time.dt` is ~2.
// - Do NOT globally multiply this for balancing.
//   Tune player speed / trial constants locally instead.
//
// This keeps every device at the same wall-clock speed while still
// rendering every monitor frame smoothly.

const BASE_FRAME_MS = 1000 / 60;
const MAX_DELTA_MS = 100;

let lastTime = performance.now();
let paused = false;

document.addEventListener('visibilitychange', () => {
    paused = document.hidden;

    if (!paused) {
        // Skip the time gap while the tab was hidden.
        lastTime = performance.now();
    }
});

// ──────────────────────────────────────────────────────────────
// Screen state
// ──────────────────────────────────────────────────────────────

let screen: Screen = 'title';

let activeDoor: Door | null = null;
let trial: Trial | null = null;
let testTrial = false;

// ──────────────────────────────────────────────────────────────
// Dialog state
// ──────────────────────────────────────────────────────────────

let activeNpc: Npc | null = null;
let dialogIdx = 0;
let dialogLines: string[] = [];
let dialogAction: DialogAction | null = null;

// ──────────────────────────────────────────────────────────────
// Fade
// ──────────────────────────────────────────────────────────────

const fade = {
    active: false,
    t: 0,
    dur: 28,
    dir: 1 as 1 | -1,
    after: null as null | (() => void),
};

function startFade(after: () => void) {
    if (fade.active) return;

    fade.active = true;
    fade.t = 0;
    fade.dir = 1;
    fade.after = after;
}

function updateFade() {
    if (!fade.active) return;

    fade.t += fade.dir * time.dt;

    if (fade.dir === 1 && fade.t >= fade.dur) {
        fade.after?.();
        fade.after = null;
        fade.dir = -1;
    }

    if (fade.dir === -1 && fade.t <= 0) {
        fade.active = false;
        fade.t = 0;
    }
}

function drawFade(c: CanvasRenderingContext2D) {
    if (!fade.active) return;

    const alpha = Math.max(0, Math.min(1, fade.t / fade.dur));
    c.fillStyle = `rgba(0,0,0,${alpha})`;
    c.fillRect(0, 0, CANVAS_W, CANVAS_H);
}

// ──────────────────────────────────────────────────────────────
// Dialog helpers
// ──────────────────────────────────────────────────────────────

function closeDialog() {
    activeNpc = null;
    dialogIdx = 0;
    dialogLines = [];
    dialogAction = null;
    screen = 'hub';
}

function buildActionForRole(npc: Npc): DialogAction | null {
    switch (npc.role) {
        case 'architect': {
            const currentQuest = questState.current;

            if (currentQuest) {
                const done = questIsComplete(currentQuest);

                if (!done) return null;

                return {
                    label: `[ F ]  Claim reward  ·  +${currentQuest.rewardCoins} coins  ·  +${currentQuest.rewardXp} xp`,
                    enabled: true,
                    perform: () => {
                        const reward = claimCurrentQuest();

                        if (reward) {
                            const parts = [
                                `★ QUEST CLAIMED`,
                                `+${reward.coins} coins`,
                                `+${reward.xp} xp`,
                            ];

                            if (reward.leveledUp) {
                                parts.push(`★ Lv ${reward.newLevel}`);
                            }

                            showToast(parts.join('  ·  '), COLORS.gold);
                            SFX.unlock();
                        }

                        closeDialog();
                    },
                };
            }

            const nextQuest = nextOfferableQuest();

            if (!nextQuest) return null;

            return {
                label: `[ F ]  Accept this task`,
                enabled: true,
                perform: () => {
                    const accepted = acceptNextQuest();

                    if (accepted) {
                        showToast(`✦ NEW QUEST  ·  ${accepted.description}`, COLORS.accent);
                        SFX.unlock();
                    }

                    closeDialog();
                },
            };
        }

        case 'loremaster': {
            const have = journal.length;

            if (have <= 0) {
                return {
                    label: `(no lore fragments — visit deeper rooms)`,
                    enabled: false,
                    perform: () => {},
                };
            }

            return {
                label: `[ F ]  Trade 1 fragment → ${LORE_PER_XP_TRADE} xp  (you have ${have})`,
                enabled: true,
                perform: () => {
                    const reward = tradeLoreForXp();

                    if (reward) {
                        const parts = [
                            `✎ -1 lore`,
                            `+${reward.xp} xp`,
                        ];

                        if (reward.leveledUp) {
                            parts.push(`★ Lv ${reward.newLevel}`);
                        }

                        showToast(parts.join('  ·  '), COLORS.accentPurple);
                        SFX.unlock();
                    }

                    if (activeNpc) {
                        dialogAction = buildActionForRole(activeNpc);
                    }
                },
            };
        }

        case 'smith': {
            if (wallet.coins < SMITH_COIN_COST) {
                return {
                    label: `(need ${SMITH_COIN_COST} coins · you have ${wallet.coins})`,
                    enabled: false,
                    perform: () => {},
                };
            }

            return {
                label: `[ F ]  Trade ${SMITH_COIN_COST} coins → ${SMITH_XP_GAIN} xp`,
                enabled: true,
                perform: () => {
                    const reward = tradeCoinsForXp();

                    if (reward) {
                        const parts = [
                            `◆ -${SMITH_COIN_COST} coins`,
                            `+${reward.xp} xp`,
                        ];

                        if (reward.leveledUp) {
                            parts.push(`★ Lv ${reward.newLevel}`);
                        }

                        showToast(parts.join('  ·  '), COLORS.gold);
                        SFX.unlock();
                    }

                    if (activeNpc) {
                        dialogAction = buildActionForRole(activeNpc);
                    }
                },
            };
        }
    }

    return null;
}

function startNpcDialog(npc: Npc) {
    activeNpc = npc;
    dialogIdx = 0;
    dialogLines = [...npc.lines];

    if (npc.role === 'architect') {
        const currentQuest = questState.current;

        if (currentQuest) {
            const done = questIsComplete(currentQuest);

            if (done) {
                dialogLines.push(`"Your task is done — ${currentQuest.description.toLowerCase()}"`);
                dialogLines.push(`"Step forward. Claim what the dungeon owes you."`);
            } else {
                dialogLines.push(`"Your task: ${currentQuest.description}"`);
            }
        } else {
            const next = nextOfferableQuest();

            if (next) {
                dialogLines.push(`"I have a new task for you, if you will take it."`);
                dialogLines.push(`"${next.description}  ·  Reward: ${next.rewardCoins} coins, ${next.rewardXp} renown."`);
            } else {
                dialogLines.push(`"You have completed every task I had. Walk the dungeon as you please."`);
            }
        }
    }

    dialogAction = buildActionForRole(npc);
}

// ──────────────────────────────────────────────────────────────
// Update
// ──────────────────────────────────────────────────────────────

function updateGame() {
    if (keysPressed.size || mouse.clicked) ensureAudio();

    updateParticles();
    updateToast();
    updateFade();

    switch (screen) {
        case 'title': {
            if (updateTitle() === 'class-select') {
                screen = 'class-select';
            }
            break;
        }

        case 'class-select': {
            const result = updateClassSelect();

            if (result === 'title') {
                screen = 'title';
            }

            if (result === 'hub') {
                resetGame();
                clearParticles();

                startFade(() => {
                    screen = 'hub';
                });
            }

            break;
        }

        case 'hub': {
            updateHub();

            const nearNpc = findNearestNpc();
            const nearDoor = findNearestDoor();

            if (keysPressed.has('e')) {
                if (nearNpc && (!nearDoor || nearNpc.dist <= nearDoor.dist)) {
                    startNpcDialog(nearNpc.npc);
                    SFX.click();
                    screen = 'dialog';
                } else if (nearDoor) {
                    const door = nearDoor.door;

                    if (door.opened) {
                        // Open passages are silent; walking handles traversal.
                    } else if (!canOpenDoor(door)) {
                        showToast(`◆  Renown Lv ${door.seal.tier} required to break this seal`, COLORS.accentRed);
                        SFX.fail();
                    } else {
                        SFX.doorEnter();

                        startFade(() => {
                            activeDoor = door;
                            testTrial = false;
                            trial = createTrial(door.seal.challenge, door.seal.tier, door.seal.variant);
                            clearParticles();
                            screen = 'trial';
                        });
                    }
                }
            }

            if (keysPressed.has('escape')) screen = 'pause';
            if (keysPressed.has('j')) screen = 'journal';
            if (keysPressed.has('t')) screen = 'trial-picker';

            break;
        }

        case 'trial-picker': {
            const result = updateTrialPicker();

            if (result === 'hub') {
                screen = 'hub';
            } else if (typeof result === 'object') {
                SFX.doorEnter();

                startFade(() => {
                    activeDoor = null;
                    testTrial = true;
                    trial = createTrial(result.launch.type, result.launch.tier, result.launch.variant);
                    clearParticles();
                    screen = 'trial';
                });
            }

            break;
        }

        case 'trial': {
            if (trial && trial.isComplete() && !fade.active) {
                handleTrialComplete();
            } else if (trial) {
                trial.update();
            }

            if (keysPressed.has('escape')) {
                startFade(() => {
                    screen = 'hub';
                    trial = null;
                    activeDoor = null;
                    testTrial = false;
                    clearParticles();
                });
            }

            break;
        }

        case 'dialog': {
            if (!activeNpc) {
                screen = 'hub';
                break;
            }

            if (keysPressed.has('escape')) {
                SFX.back();
                closeDialog();
            } else if (
                keysPressed.has('f') &&
                dialogAction?.enabled &&
                dialogIdx === dialogLines.length - 1
            ) {
                SFX.click();
                dialogAction.perform();
            } else if (
                keysPressed.has('e') ||
                keysPressed.has('enter') ||
                keysPressed.has(' ')
            ) {
                if (dialogIdx + 1 < dialogLines.length) {
                    dialogIdx++;
                    SFX.click();
                } else {
                    SFX.click();
                    closeDialog();
                }
            }

            break;
        }

        case 'pause': {
            const result = updatePause();

            if (result === 'hub') screen = 'hub';
            if (result === 'title') screen = 'title';

            break;
        }

        case 'journal': {
            if (updateJournal() === 'hub') {
                screen = 'hub';
            }
            break;
        }
    }
}

function handleTrialComplete() {
    if (!trial) return;

    if (testTrial) {
        showToast('✦  Test complete', COLORS.accent);
        SFX.unlock();

        startFade(() => {
            screen = 'hub';
            trial = null;
            testTrial = false;
            clearParticles();
            spawnBurst(player.x, player.y, '#c89b5a', 24);
        });

        return;
    }

    if (!activeDoor) return;

    const wasQuestComplete = questState.current
        ? questIsComplete(questState.current)
        : false;

    activeDoor.opened = true;

    const newRoom = addRoomBehindDoor(activeDoor);
    stats.doorsOpened++;

    const reward = rewardForTrial(activeDoor.seal.challenge, activeDoor.seal.tier);
    const lore = maybeUnlockLore();

    const parts: string[] = [
        `✦ +${reward.coins} coins  ·  +${reward.xp} xp`,
    ];

    if (reward.leveledUp) {
        parts.push(`★ RENOWN Lv ${reward.newLevel}`);
    }

    if (lore) {
        parts.push(`✎ "${lore.title}"`);
    }

    if (newRoom) {
        stats.rooms = rooms.size;

        if (newRoom.npc) {
            parts.push(`☉ ${newRoom.npc.title}`);
        }
    } else {
        parts.push(`▸ passage opens into an existing room`);
    }

    const nowQuestComplete = questState.current
        ? questIsComplete(questState.current)
        : false;

    if (!wasQuestComplete && nowQuestComplete) {
        parts.push(`★ QUEST DONE — visit the Architect`);
    }

    showToast(
        parts.join('   ·   '),
        reward.leveledUp || (!wasQuestComplete && nowQuestComplete)
            ? COLORS.gold
            : COLORS.accent,
    );

    SFX.unlock();

    startFade(() => {
        screen = 'hub';
        trial = null;
        activeDoor = null;
        clearParticles();
        spawnBurst(player.x, player.y, '#c89b5a', 28);
    });
}

// ──────────────────────────────────────────────────────────────
// Draw
// ──────────────────────────────────────────────────────────────

function drawGame() {
    ctx.imageSmoothingEnabled = false;

    switch (screen) {
        case 'title': {
            drawTitle(ctx);
            break;
        }

        case 'class-select': {
            drawClassSelect(ctx);
            break;
        }

        case 'hub': {
            drawHub(ctx);
            drawHubUI();
            break;
        }

        case 'trial-picker': {
            drawHub(ctx);
            drawHubUI();
            drawTrialPicker(ctx);
            break;
        }

        case 'trial': {
            drawTrialScreen();
            break;
        }

        case 'dialog': {
            drawHub(ctx);
            drawHubUI();

            if (activeNpc) {
                drawDialog(ctx, activeNpc, dialogIdx, dialogLines, dialogAction);
            }

            break;
        }

        case 'pause': {
            drawHub(ctx);
            drawHubUI();
            drawPause(ctx);
            break;
        }

        case 'journal': {
            drawHub(ctx);
            drawHUD(ctx);
            drawMinimap(ctx);
            drawJournal(ctx);
            break;
        }
    }

    drawFade(ctx);
}

function drawHubUI() {
    drawHUD(ctx);
    drawMinimap(ctx);
    drawLocationBar(ctx);
    drawQuestPanel(ctx);

    const nearNpc = findNearestNpc();
    const nearDoor = findNearestDoor();

    if (nearNpc && (!nearDoor || nearNpc.dist <= nearDoor.dist)) {
        drawNpcPrompt(ctx, nearNpc.npc);
    } else if (nearDoor) {
        drawDoorInfo(ctx, nearDoor.door, !canOpenDoor(nearDoor.door));
    }

    drawToast(ctx);
}

function drawTrialScreen() {
    if (!trial) return;

    trial.draw(ctx);
    drawParticles(ctx);

    drawTrialPlayer();
    drawTrialHeader();
}

function drawTrialPlayer() {
    if (!trial) return;

    const bob = Math.sin(Date.now() / 200) * 1.4;

    ctx.fillStyle = player.clazz.color;
    ctx.shadowColor = player.clazz.color;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(trial.player.x, trial.player.y + bob, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = COLORS.skin;
    ctx.beginPath();
    ctx.arc(trial.player.x, trial.player.y - 6 + bob, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = player.clazz.color;
    ctx.beginPath();
    ctx.arc(trial.player.x, trial.player.y - 7 + bob, 4, Math.PI, 0);
    ctx.fill();

    ctx.fillStyle = COLORS.bgDark;
    ctx.beginPath();
    ctx.arc(trial.player.x - 1.4, trial.player.y - 6 + bob, 0.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(trial.player.x + 1.4, trial.player.y - 6 + bob, 0.8, 0, Math.PI * 2);
    ctx.fill();
}

function drawTrialHeader() {
    if (!trial) return;

    ctx.fillStyle = COLORS.text;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';

    ctx.font = 'bold 28px Cinzel, serif';
    ctx.fillText(trial.title, CANVAS_W / 2, 76);

    ctx.font = 'italic 14px Cinzel, serif';
    ctx.fillStyle = COLORS.textDim;
    ctx.fillText(trial.hint, CANVAS_W / 2, 104);

    ctx.font = '11px "JetBrains Mono", monospace';
    ctx.fillStyle = COLORS.textDim;
    ctx.textAlign = 'right';
    ctx.fillText(
        testTrial ? 'ESC — leave test chamber' : 'ESC — abandon trial',
        CANVAS_W - 24,
        CANVAS_H - 20,
    );
}

// ──────────────────────────────────────────────────────────────
// Loop
// ──────────────────────────────────────────────────────────────

function loop(now: number) {
    requestAnimationFrame(loop);

    if (paused) {
        lastTime = now;
        return;
    }

    const elapsed = Math.min(now - lastTime, MAX_DELTA_MS);
    lastTime = now;

    // Device-normalized simulation time.
    // 1.0 = one 60fps frame worth of time.
    // Keep this unscaled. Balance speeds locally in constants/trials.
    time.dt = elapsed / BASE_FRAME_MS;

    updateGame();
    drawGame();

    consumeFrame();
}

requestAnimationFrame(loop);