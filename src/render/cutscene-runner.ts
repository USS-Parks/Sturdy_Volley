import {
  Scene,
  ArcRotateCamera,
  Vector3,
  type AbstractMesh,
} from '@babylonjs/core';
import {
  advancePastBeat,
  collectSideEffects,
  createCursor,
  skipToEnd,
  update as updateCutscene,
  type Beat,
  type Cutscene,
  type CutsceneCursor,
} from '../engine/cutscene';
import type { UIOverlay } from '../ui/overlay';

/**
 * Runtime binding for `engine/cutscene.ts` (RF-14). Maps the typed `Beat`
 * stream onto live Babylon camera moves, character-mesh moves, fades, and the
 * dialogue overlay. The implementation handles the subset of beats VS-A1..A5
 * actually need: cameraTo, fade, dialogue, moveCharacter, wait, giveItem,
 * setFlag. Other beats (sound, choice, animation, lighting) tick through as
 * no-ops or are fired without renderer-side effects so a future polish wave
 * can wire them.
 */
export interface CutsceneRunnerDeps {
  scene: Scene;
  camera: ArcRotateCamera;
  overlay: UIOverlay;
  /** Apply persistent side-effects when the cutscene applies a setFlag/giveItem beat. */
  onSetFlag?: (flag: string, value: string | number | boolean) => void;
  onGiveItem?: (itemId: string, qty: number, quality?: number) => void;
  /** Look up an anchor position (XYZ) by id. Falls back to (0,0,0). */
  resolveAnchor: (id: string) => Vector3;
  /** Look up an NPC mesh root by npcId. Returns null when offscreen. */
  resolveNpcMesh?: (npcId: string) => AbstractMesh | null;
}

export interface RunningCutscene {
  cutscene: Cutscene;
  cursor: CutsceneCursor;
  tickIn: number; // ms accumulator for cameraTo / moveCharacter tweens
  cameraStart?: Vector3;
  cameraTarget?: Vector3;
  cameraTweenT?: number;
  cameraTweenDur?: number;
  characterTweens: Map<string, { start: Vector3; target: Vector3; t: number; dur: number }>;
  fadeOpacity: number;
  waitingForDialogue: boolean;
}

/**
 * Mount + return a controller for a single cutscene run. The caller drives
 * `tick(dt)` from its scene's render loop and consumes `isFinished()`.
 */
export function startCutscene(
  cutscene: Cutscene,
  deps: CutsceneRunnerDeps,
): {
  tick: (dt: number) => void;
  skip: () => void;
  isFinished: () => boolean;
  dispose: () => void;
} {
  const state: RunningCutscene = {
    cutscene,
    cursor: createCursor(),
    tickIn: 0,
    characterTweens: new Map(),
    fadeOpacity: 0,
    waitingForDialogue: false,
  };

  // Fade overlay (DOM, on top of the canvas).
  const fadeEl = document.createElement('div');
  fadeEl.className = 'cutscene-fade';
  fadeEl.dataset.testid = 'cutscene-fade';
  fadeEl.style.opacity = '0';
  document.body.appendChild(fadeEl);

  // Skip button (DOM corner).
  const skipBtn = document.createElement('button');
  skipBtn.className = 'cutscene-skip';
  skipBtn.dataset.testid = 'cutscene-skip';
  skipBtn.textContent = 'Skip';
  skipBtn.addEventListener('click', () => skip());
  document.body.appendChild(skipBtn);

  const applyFiredBeats = (fired: { index: number; beat: Beat }[]): void => {
    for (const { beat } of fired) {
      switch (beat.kind) {
        case 'cameraTo': {
          state.cameraStart = deps.camera.target.clone();
          state.cameraTarget = deps.resolveAnchor(beat.target.anchor).add(
            new Vector3(beat.target.offset?.[0] ?? 0, beat.target.offset?.[1] ?? 0, beat.target.offset?.[2] ?? 0),
          );
          state.cameraTweenT = 0;
          state.cameraTweenDur = beat.seconds;
          break;
        }
        case 'fade': {
          // Mark a fade target; tick interpolates.
          state.fadeOpacity = beat.to === 'out' ? 0 : 1; // start state
          break;
        }
        case 'moveCharacter': {
          const mesh = deps.resolveNpcMesh?.(beat.npcId) ?? null;
          if (mesh) {
            state.characterTweens.set(beat.npcId, {
              start: mesh.position.clone(),
              target: deps.resolveAnchor(beat.anchor),
              t: 0,
              dur: beat.seconds,
            });
          }
          break;
        }
        case 'dialogue': {
          state.waitingForDialogue = true;
          deps.overlay.showDialoguePanel({
            speaker: beat.portrait ?? beat.speakerNpcId,
            body: beat.body,
            onDismiss: () => {
              state.waitingForDialogue = false;
              state.cursor = advancePastBeat(state.cursor);
            },
          });
          break;
        }
        case 'giveItem':
          deps.onGiveItem?.(beat.itemId, beat.qty, beat.quality);
          break;
        case 'setFlag':
          deps.onSetFlag?.(beat.flag, beat.value);
          break;
        default:
          // wait/shake/playAnimation/holdProp/releaseProp/lighting/sound/choice — no-op
          break;
      }
    }
  };

  const tick = (dt: number): void => {
    if (state.waitingForDialogue) return; // stall until dismiss

    // Camera tween.
    if (
      state.cameraStart &&
      state.cameraTarget &&
      state.cameraTweenDur !== undefined &&
      state.cameraTweenT !== undefined
    ) {
      state.cameraTweenT += dt;
      const t = Math.min(1, state.cameraTweenT / Math.max(0.01, state.cameraTweenDur));
      const eased = t * t * (3 - 2 * t);
      const pos = Vector3.Lerp(state.cameraStart, state.cameraTarget, eased);
      deps.camera.setTarget(pos);
      if (t >= 1) {
        state.cameraStart = undefined;
        state.cameraTarget = undefined;
        state.cameraTweenDur = undefined;
        state.cameraTweenT = undefined;
      }
    }

    // Character tweens.
    for (const [npcId, tween] of state.characterTweens) {
      tween.t += dt;
      const t = Math.min(1, tween.t / Math.max(0.01, tween.dur));
      const eased = t * t * (3 - 2 * t);
      const pos = Vector3.Lerp(tween.start, tween.target, eased);
      const mesh = deps.resolveNpcMesh?.(npcId) ?? null;
      if (mesh) mesh.position.copyFrom(pos);
      if (t >= 1) state.characterTweens.delete(npcId);
    }

    // Cutscene engine tick — fires beats whose time has come.
    const result = updateCutscene(state.cutscene, state.cursor, dt);
    state.cursor = result.cursor;
    if (result.fired.length > 0) applyFiredBeats(result.fired);
    if (result.ended) finalize();

    // Fade interp — converge toward target opacity over 0.5s.
    const currentOpacity = parseFloat(fadeEl.style.opacity || '0');
    const targetOpacity = state.fadeOpacity;
    if (Math.abs(currentOpacity - targetOpacity) > 0.001) {
      const step = Math.sign(targetOpacity - currentOpacity) * Math.min(dt / 0.5, Math.abs(targetOpacity - currentOpacity));
      fadeEl.style.opacity = String(currentOpacity + step);
    }
  };

  let finished = false;

  const finalize = (): void => {
    if (finished) return;
    finished = true;
    fadeEl.remove();
    skipBtn.remove();
  };

  const skip = (): void => {
    // Apply remaining side effects atomically, then finalize.
    const remaining = collectSideEffects({
      ...state.cutscene,
      beats: state.cutscene.beats.slice(state.cursor.index),
    });
    for (const beat of remaining) {
      if (beat.kind === 'setFlag') deps.onSetFlag?.(beat.flag, beat.value);
      if (beat.kind === 'giveItem') deps.onGiveItem?.(beat.itemId, beat.qty, beat.quality);
    }
    state.cursor = skipToEnd(state.cutscene);
    finalize();
  };

  return {
    tick,
    skip,
    isFinished: () => finished,
    dispose: finalize,
  };
}
