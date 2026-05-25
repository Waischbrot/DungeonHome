import './style.css';
import { CANVAS_W, CANVAS_H, COLORS, SMITH_COIN_COST, SMITH_XP_GAIN, LORE_PER_XP_TRADE } from './constants';
import { bindCanvas, keysPressed, consumeFrame, mouse } from './input';
import {
    player, resetGame, addRoomBehindDoor, maybeUnlockLore, rewardForTrial,
    stats, canOpenDoor, findNearestNpc, journal, wallet, questState,
    claimCurrentQuest, tradeLoreForXp, tradeCoinsForXp, questIsComplete,
    acceptNextQuest, nextOfferableQuest,
} from './state';
import { updateParticles, drawParticles, spawnBurst, clearParticles } from './particles';
import { updateHub, drawHub, findNearestDoor } from './hub';
import { createTrial } from './trials';
import {
    drawHUD, drawMinimap, drawDoorInfo, drawNpcPrompt, drawLocationBar,
    drawToast, updateToast, showToast, drawDialog, drawQuestPanel,
} from './ui';
import type { DialogAction } from './ui';
import {
    updateTitle, drawTitle, updateClassSelect, drawClassSelect,
    updatePause, drawPause, updateJournal, drawJournal,
} from './screens';
import { ensureAudio, SFX } from './audio';
import type { Trial, Screen, Door, Npc } from './types';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
bindCanvas(canvas);

let screen: Screen = 'title';
let activeDoor: Door | null = null;
let trial: Trial | null = null;

// Dialog state
let activeNpc: Npc | null = null;
let dialogIdx = 0;
let dialogLines: string[] = [];
let dialogAction: DialogAction | null = null;

const fade = { active: false, t: 0, dur: 28, dir: 1 as 1 | -1, after: null as null | (() => void) };
function startFade(after: () => void) {
    if (fade.active) return;
    fade.active = true; fade.t = 0; fade.dir = 1; fade.after = after;
}
function updateFade() {
    if (!fade.active) return;
    fade.t += fade.dir;
    if (fade.dir === 1 && fade.t >= fade.dur) { fade.after?.(); fade.after = null; fade.dir = -1; }
    if (fade.dir === -1 && fade.t <= 0) fade.active = false;
}
function drawFade(c: CanvasRenderingContext2D) {
    if (!fade.active) return;
    c.fillStyle = `rgba(0,0,0,${fade.t / fade.dur})`;
    c.fillRect(0, 0, CANVAS_W, CANVAS_H);
}

// ─── Dialog setup per NPC role ─────────────────────────────────
function closeDialog() {
    activeNpc = null; dialogIdx = 0; dialogLines = []; dialogAction = null;
    screen = 'hub';
}

function buildActionForRole(npc: Npc): DialogAction | null {
    switch (npc.role) {
        case 'architect': {
            // Has a current quest?
            const q = questState.current;
            if (q) {
                const done = questIsComplete(q);
                if (done) {
                    return {
                        label: `[ F ]  Claim reward  ·  +${q.rewardCoins} coins  ·  +${q.rewardXp} xp`,
                        enabled: true,
                        perform: () => {
                            const r = claimCurrentQuest();
                            if (r) {
                                const parts = [`★ QUEST CLAIMED`, `+${r.coins} coins`, `+${r.xp} xp`];
                                if (r.leveledUp) parts.push(`★ Lv ${r.newLevel}`);
                                showToast(parts.join('  ·  '), COLORS.gold);
                                SFX.unlock();
                            }
                            closeDialog();
                        },
                    };
                }
                // active but not yet done — no action button
                return null;
            }
            // No current quest — offer to accept the next one
            const next = nextOfferableQuest();
            if (next) {
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
            // Nothing left to offer
            return null;
        }
        case 'loremaster': {
            const have = journal.length;
            if (have <= 0) {
                return { label: `(no lore fragments — visit deeper rooms)`, enabled: false, perform: () => {} };
            }
            return {
                label: `[ F ]  Trade 1 fragment → ${LORE_PER_XP_TRADE} xp  (you have ${have})`,
                enabled: true,
                perform: () => {
                    const r = tradeLoreForXp();
                    if (r) {
                        const parts = [`✎ -1 lore`, `+${r.xp} xp`];
                        if (r.leveledUp) parts.push(`★ Lv ${r.newLevel}`);
                        showToast(parts.join('  ·  '), COLORS.accentPurple);
                        SFX.unlock();
                    }
                    if (activeNpc) dialogAction = buildActionForRole(activeNpc);
                },
            };
        }
        case 'smith': {
            if (wallet.coins < SMITH_COIN_COST) {
                return { label: `(need ${SMITH_COIN_COST} coins · you have ${wallet.coins})`, enabled: false, perform: () => {} };
            }
            return {
                label: `[ F ]  Trade ${SMITH_COIN_COST} coins → ${SMITH_XP_GAIN} xp`,
                enabled: true,
                perform: () => {
                    const r = tradeCoinsForXp();
                    if (r) {
                        const parts = [`◆ -${SMITH_COIN_COST} coins`, `+${r.xp} xp`];
                        if (r.leveledUp) parts.push(`★ Lv ${r.newLevel}`);
                        showToast(parts.join('  ·  '), COLORS.gold);
                        SFX.unlock();
                    }
                    if (activeNpc) dialogAction = buildActionForRole(activeNpc);
                },
            };
        }
    }
}

function startNpcDialog(npc: Npc) {
    activeNpc = npc;
    dialogIdx = 0;
    dialogLines = [...npc.lines];

    // Architect: append live status lines so the dialog reflects reality
    if (npc.role === 'architect') {
        const q = questState.current;
        if (q) {
            const done = questIsComplete(q);
            if (done) {
                dialogLines.push(`"Your task is done — ${q.description.toLowerCase()}"`);
                dialogLines.push(`"Step forward. Claim what the dungeon owes you."`);
            } else {
                dialogLines.push(`"Your task: ${q.description}"`);
            }
        } else if (nextOfferableQuest()) {
            const next = nextOfferableQuest()!;
            dialogLines.push(`"I have a new task for you, if you will take it."`);
            dialogLines.push(`"${next.description}  ·  Reward: ${next.rewardCoins} coins, ${next.rewardXp} renown."`);
        } else {
            dialogLines.push(`"You have completed every task I had. Walk the dungeon as you please."`);
        }
    }

    dialogAction = buildActionForRole(npc);
}

// ─── Main loop ─────────────────────────────────────────────────
function tick() {
    if (keysPressed.size || mouse.clicked) ensureAudio();
    updateParticles();
    updateToast();
    updateFade();

    switch (screen) {
        case 'title':
            if (updateTitle() === 'class-select') screen = 'class-select';
            break;

        case 'class-select': {
            const r = updateClassSelect();
            if (r === 'title') screen = 'title';
            if (r === 'hub') { resetGame(); clearParticles(); startFade(() => { screen = 'hub'; }); }
            break;
        }

        case 'hub': {
            updateHub();
            const nearNpc  = findNearestNpc();
            const nearDoor = findNearestDoor();

            if (keysPressed.has('e')) {
                if (nearNpc && (!nearDoor || nearNpc.dist <= nearDoor.dist)) {
                    startNpcDialog(nearNpc.npc);
                    SFX.click();
                    screen = 'dialog';
                } else if (nearDoor) {
                    const door = nearDoor.door;
                    if (door.opened) {
                        // pass-through; nothing to do
                    } else if (!canOpenDoor(door)) {
                        showToast(`◆  Renown Lv ${door.seal.tier} required to break this seal`, COLORS.accentRed);
                        SFX.fail();
                    } else {
                        SFX.doorEnter();
                        startFade(() => {
                            activeDoor = door;
                            trial = createTrial(door.seal.challenge, door.seal.tier, door.seal.variant);
                            clearParticles();
                            screen = 'trial';
                        });
                    }
                }
            }
            if (keysPressed.has('escape')) screen = 'pause';
            if (keysPressed.has('j'))      screen = 'journal';
            break;
        }

        case 'trial': {
            if (trial && trial.isComplete() && !fade.active) {
                // Handle completion FIRST so the rest is unambiguous
                if (activeDoor) {
                    const wasQuestComplete = questState.current ? questIsComplete(questState.current) : false;

                    activeDoor.opened = true;
                    const newRoom = addRoomBehindDoor(activeDoor);   // may be null!
                    stats.doorsOpened++;

                    const reward = rewardForTrial(activeDoor.seal.challenge, activeDoor.seal.tier);
                    const lore   = maybeUnlockLore();

                    const parts: string[] = [`✦ +${reward.coins} coins  ·  +${reward.xp} xp`];
                    if (reward.leveledUp) parts.push(`★ RENOWN Lv ${reward.newLevel}`);
                    if (lore)             parts.push(`✎ "${lore.title}"`);

                    if (newRoom) {
                        stats.rooms++;
                        if (newRoom.npc) parts.push(`☉ ${newRoom.npc.name} (${newRoom.npc.title})`);
                    } else {
                        // Door opened but no new room appeared — it links into the existing dungeon
                        parts.push(`▸ passage opens into an existing room`);
                    }

                    // Quest auto-check
                    const nowQuestComplete = questState.current ? questIsComplete(questState.current) : false;
                    if (!wasQuestComplete && nowQuestComplete) {
                        parts.push(`★ QUEST DONE — visit the Architect`);
                    }

                    showToast(
                        parts.join('   ·   '),
                        reward.leveledUp || (!wasQuestComplete && nowQuestComplete) ? COLORS.gold : COLORS.accent,
                    );
                    SFX.unlock();
                }
                startFade(() => {
                    screen = 'hub'; trial = null; activeDoor = null;
                    clearParticles();
                    spawnBurst(player.x, player.y, '#c89b5a', 28);
                });
            } else if (trial) {
                trial.update();
            }
            if (keysPressed.has('escape')) {
                startFade(() => { screen = 'hub'; trial = null; activeDoor = null; clearParticles(); });
            }
            break;
        }

        case 'dialog': {
            if (!activeNpc) { screen = 'hub'; break; }
            if (keysPressed.has('escape')) {
                SFX.back(); closeDialog();
            } else if (keysPressed.has('f') && dialogAction?.enabled && dialogIdx === dialogLines.length - 1) {
                SFX.click();
                dialogAction.perform();    // may close dialog or refresh action
            } else if (keysPressed.has('e') || keysPressed.has('enter') || keysPressed.has(' ')) {
                if (dialogIdx + 1 < dialogLines.length) {
                    dialogIdx++; SFX.click();
                } else {
                    SFX.click(); closeDialog();
                }
            }
            break;
        }

        case 'pause': {
            const r = updatePause();
            if (r === 'hub')   screen = 'hub';
            if (r === 'title') screen = 'title';
            break;
        }

        case 'journal':
            if (updateJournal() === 'hub') screen = 'hub';
            break;
    }

    // ── DRAW ──
    ctx.imageSmoothingEnabled = false;

    switch (screen) {
        case 'title':        drawTitle(ctx); break;
        case 'class-select': drawClassSelect(ctx); break;

        case 'hub': {
            drawHub(ctx);
            drawHUD(ctx);
            drawMinimap(ctx);
            drawLocationBar(ctx);
            drawQuestPanel(ctx);
            const nearNpc  = findNearestNpc();
            const nearDoor = findNearestDoor();
            if (nearNpc && (!nearDoor || nearNpc.dist <= nearDoor.dist)) {
                drawNpcPrompt(ctx, nearNpc.npc);
            } else if (nearDoor) {
                drawDoorInfo(ctx, nearDoor.door, !canOpenDoor(nearDoor.door));
            }
            drawToast(ctx);
            break;
        }

        case 'trial': {
            if (trial) {
                trial.draw(ctx);
                drawParticles(ctx);
                // player avatar in trial
                const bob = Math.sin(Date.now() / 200) * 1.4;
                ctx.fillStyle = player.clazz.color;
                ctx.shadowColor = player.clazz.color; ctx.shadowBlur = 6;
                ctx.beginPath(); ctx.arc(trial.player.x, trial.player.y + bob, 10, 0, Math.PI * 2); ctx.fill();
                ctx.shadowBlur = 0;
                ctx.fillStyle = COLORS.skin;
                ctx.beginPath(); ctx.arc(trial.player.x, trial.player.y - 6 + bob, 4, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = player.clazz.color;
                ctx.beginPath(); ctx.arc(trial.player.x, trial.player.y - 7 + bob, 4, Math.PI, 0); ctx.fill();
                ctx.fillStyle = COLORS.bgDark;
                ctx.beginPath(); ctx.arc(trial.player.x - 1.4, trial.player.y - 6 + bob, 0.8, 0, Math.PI * 2); ctx.fill();
                ctx.beginPath(); ctx.arc(trial.player.x + 1.4, trial.player.y - 6 + bob, 0.8, 0, Math.PI * 2); ctx.fill();

                ctx.fillStyle = COLORS.text; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
                ctx.font = 'bold 28px Cinzel, serif';
                ctx.fillText(trial.title, CANVAS_W / 2, 76);
                ctx.font = 'italic 14px Cinzel, serif';
                ctx.fillStyle = COLORS.textDim;
                ctx.fillText(trial.hint, CANVAS_W / 2, 104);

                ctx.font = '11px "JetBrains Mono", monospace';
                ctx.fillStyle = COLORS.textDim;
                ctx.textAlign = 'right';
                ctx.fillText('ESC — abandon trial', CANVAS_W - 24, CANVAS_H - 20);
            }
            break;
        }

        case 'dialog':
            drawHub(ctx);
            drawHUD(ctx);
            drawMinimap(ctx);
            drawLocationBar(ctx);
            drawQuestPanel(ctx);
            if (activeNpc) drawDialog(ctx, activeNpc, dialogIdx, dialogLines, dialogAction);
            break;

        case 'pause':
            drawHub(ctx); drawHUD(ctx); drawMinimap(ctx); drawLocationBar(ctx); drawQuestPanel(ctx);
            drawPause(ctx);
            break;

        case 'journal':
            drawHub(ctx); drawHUD(ctx); drawMinimap(ctx);
            drawJournal(ctx);
            break;
    }

    drawFade(ctx);
    consumeFrame();
    requestAnimationFrame(tick);
}

tick();