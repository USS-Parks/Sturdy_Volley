/**
 * Accessibility settings (WEF-12, master Prompt 052). Pure model + defaults +
 * validation — the foundation does not defer accessibility or camera comfort
 * (acceptance §3). Covers all twelve required controls: input remapping, touch
 * target size, camera sensitivity, separate X/Y inversion, a recenter control,
 * reduced motion, camera shake, hold/toggle interaction, auto-facing assistance,
 * high-contrast focus, subtitles, and a no-time-pressure mode.
 */

export interface AccessibilitySettings {
  /** Input remapping: action → bound key/button. */
  keyBindings: Record<string, string>;
  /** Minimum on-screen touch-target size (CSS px); must stay ≥ 44. */
  minTouchTargetPx: number;
  /** Camera look sensitivity multiplier (0.25..2). */
  cameraSensitivity: number;
  /** Separate horizontal / vertical look inversion. */
  invertX: boolean;
  invertY: boolean;
  /** Manual camera-recenter control enabled. */
  recenterEnabled: boolean;
  /** Reduced motion — drops camera/flora impulses, keeps gameplay cues. */
  reducedMotion: boolean;
  /** Camera shake on/off. */
  cameraShake: boolean;
  /** Contextual action: hold-to-charge vs. toggle. */
  interactionHoldToToggle: boolean;
  /** Auto-facing assistance toward the chosen interaction target. */
  autoFacingAssist: boolean;
  /** High-contrast focus ring on the selected target. */
  highContrastFocus: boolean;
  /** Subtitles / captions for dialogue + audio cues. */
  subtitles: boolean;
  /** No-time-pressure mode — relaxes timed challenges. */
  noTimePressure: boolean;
}

/** WCAG-style minimum touch target. */
export const MIN_TOUCH_TARGET_PX = 44;

export const DEFAULT_ACCESSIBILITY: AccessibilitySettings = {
  keyBindings: {
    moveUp: 'w', moveDown: 's', moveLeft: 'a', moveRight: 'd',
    action: 'e', recenter: 'r', mount: 'e', cancel: 'escape',
  },
  minTouchTargetPx: 48,
  cameraSensitivity: 1,
  invertX: false,
  invertY: false,
  recenterEnabled: true,
  reducedMotion: false,
  cameraShake: true,
  interactionHoldToToggle: false,
  autoFacingAssist: true,
  highContrastFocus: false,
  subtitles: true,
  noTimePressure: false,
};

/** The twelve required accessibility controls (acceptance §3) — gate manifest. */
export const ACCESSIBILITY_CHECKS = [
  'remapping',
  'touch-target-size',
  'camera-sensitivity',
  'separate-xy-inversion',
  'recenter-control',
  'reduced-motion',
  'camera-shake',
  'hold-toggle',
  'auto-facing-assist',
  'high-contrast-focus',
  'subtitles',
  'no-time-pressure',
] as const;

export type AccessibilityCheck = (typeof ACCESSIBILITY_CHECKS)[number];

export interface AccessibilityIssue {
  code: 'touch-target-too-small' | 'sensitivity-out-of-range' | 'missing-binding';
  message: string;
}

export function validateAccessibility(s: AccessibilitySettings): AccessibilityIssue[] {
  const issues: AccessibilityIssue[] = [];
  if (s.minTouchTargetPx < MIN_TOUCH_TARGET_PX) {
    issues.push({ code: 'touch-target-too-small', message: `minTouchTargetPx ${s.minTouchTargetPx} below the ${MIN_TOUCH_TARGET_PX} px floor` });
  }
  if (s.cameraSensitivity < 0.25 || s.cameraSensitivity > 2) {
    issues.push({ code: 'sensitivity-out-of-range', message: `cameraSensitivity ${s.cameraSensitivity} outside 0.25–2` });
  }
  for (const action of ['moveUp', 'moveDown', 'moveLeft', 'moveRight', 'action']) {
    if (!s.keyBindings[action]) {
      issues.push({ code: 'missing-binding', message: `no key bound for "${action}"` });
    }
  }
  return issues;
}

/** Which settings key (if any) each required check maps to — completeness proof. */
export const CHECK_TO_SETTING: Record<AccessibilityCheck, keyof AccessibilitySettings> = {
  'remapping': 'keyBindings',
  'touch-target-size': 'minTouchTargetPx',
  'camera-sensitivity': 'cameraSensitivity',
  'separate-xy-inversion': 'invertX',
  'recenter-control': 'recenterEnabled',
  'reduced-motion': 'reducedMotion',
  'camera-shake': 'cameraShake',
  'hold-toggle': 'interactionHoldToToggle',
  'auto-facing-assist': 'autoFacingAssist',
  'high-contrast-focus': 'highContrastFocus',
  'subtitles': 'subtitles',
  'no-time-pressure': 'noTimePressure',
};
