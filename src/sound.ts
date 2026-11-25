// Sound in the app (design/sound-v1). Every sound is synthesised, so there are
// no files to load. Rules from the approved set:
// - personal sounds play on this phone's own taps and results;
// - shared sounds follow a beat every phone already sees at the same moment,
//   and a phone that arrives more than LATE_MS into that beat stays silent
//   rather than echo the others;
// - nothing role- or tier-specific ever plays for a private moment;
// - the Sound switch (per phone, on by default) mutes everything.
import { SFX, type SoundId } from "./sound-set.js";
import { preferences } from "./storage";

const KEY = "imposter.sound";
const LATE_MS = 300;
const VOLUME = 0.8;

let enabled = preferences.getItem(KEY) !== "off";
const listeners = new Set<(on: boolean) => void>();

export const soundOn = () => enabled;

export function setSound(on: boolean) {
  enabled = on;
  preferences.setItem(KEY, on ? "on" : "off");
  if (on) unlock();
  listeners.forEach((fn) => fn(on));
}

export function onSoundChange(fn: (on: boolean) => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

let unlocked = false;
/** Browsers (iPhone Safari above all) only start audio from a user gesture. */
export function unlock() {
  if (unlocked || !enabled) return;
  try {
    SFX.volume(VOLUME);
    unlocked = true;
  } catch {
    /* No Web Audio: the app stays silent. */
  }
}

/** A sound for this phone only, right now. */
export function play(id: SoundId) {
  if (!enabled || document.hidden) return;
  try {
    unlock();
    SFX.play(id);
  } catch {
    /* Never let sound break a tap. */
  }
}

/**
 * A shared sound tied to a beat every phone sees. `elapsedMs` is how far into
 * that beat this phone is (from the host's reveal timer); a late phone skips it.
 */
export function playShared(id: SoundId, elapsedMs = 0) {
  if (elapsedMs > LATE_MS) return;
  play(id);
}

// Creating an AudioContext can block the main thread for a few hundred ms on
// some devices, so build it in idle time after load (it starts suspended), and
// let the first tap only resume it, which is cheap and satisfies iPhones.
if (typeof window !== "undefined") {
  const prepare = () => {
    if (!enabled) return;
    try {
      SFX.volume(VOLUME);
    } catch {
      /* No Web Audio: stay silent. */
    }
  };
  if ("requestIdleCallback" in window) window.requestIdleCallback(prepare, { timeout: 4000 });
  else setTimeout(prepare, 2000);
  window.addEventListener("pointerdown", unlock, { once: true, capture: true });
}
