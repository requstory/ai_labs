/* Phone features: sounds that play over your own music, keeping the screen on, and the app icon badge. */

type AudioSessionNavigator = Navigator & { audioSession?: { type: string } };
let ctx: AudioContext | null = null;
let voiceOn = true;

/** Must be called from a tap. Sets Coach's sound to mix with other apps so your music keeps playing. */
export function unlockAudio(voice: boolean) {
  voiceOn = voice;
  try {
    const nav = navigator as AudioSessionNavigator;
    // Safari 16.4+: "ambient" mixes with Music, Spotify, YouTube Music etc. instead of pausing them.
    if (nav.audioSession) nav.audioSession.type = 'ambient';
  } catch {
    /* not supported */
  }
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx ??= new AC();
    void ctx.resume();
  } catch {
    ctx = null;
  }
  // iOS only allows speech after a tap; prime it with an empty utterance.
  try {
    if (voiceOn && 'speechSynthesis' in window) speechSynthesis.speak(new SpeechSynthesisUtterance(''));
  } catch {
    /* ignore */
  }
}

export function setVoice(on: boolean) {
  voiceOn = on;
}

export function beep(kind: 'tick' | 'go' | 'done' = 'go') {
  if (!ctx) return;
  try {
    const freqs = kind === 'tick' ? [880] : kind === 'go' ? [660, 990] : [523, 659, 784];
    freqs.forEach((f, i) => {
      const o = ctx!.createOscillator();
      const g = ctx!.createGain();
      const t = ctx!.currentTime + i * 0.13;
      o.frequency.value = f;
      o.type = 'sine';
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + (kind === 'tick' ? 0.09 : 0.18));
      o.connect(g).connect(ctx!.destination);
      o.start(t);
      o.stop(t + 0.2);
    });
  } catch {
    /* ignore */
  }
}

export function say(text: string) {
  if (!voiceOn || !('speechSynthesis' in window)) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-GB';
    u.rate = 1.02;
    speechSynthesis.speak(u);
  } catch {
    /* ignore */
  }
}

/* ---------------- Keep the screen on ---------------- */
type Sentinel = { release: () => Promise<void>; addEventListener: (t: string, f: () => void) => void };
let sentinel: Sentinel | null = null;
let wanted = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((f) => f());
export const onAwakeChange = (f: () => void) => listeners.add(f);
export const isAwake = () => sentinel !== null;

async function acquire() {
  try {
    const wl = (navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<Sentinel> } }).wakeLock;
    if (!wl) return;
    sentinel = await wl.request('screen');
    sentinel.addEventListener('release', () => {
      sentinel = null;
      notify();
    });
  } catch {
    sentinel = null;
  }
  notify();
}

/** Keeps the screen awake during a session. iOS drops the lock when you leave the app; it is taken again on return. */
export async function keepAwake(on: boolean) {
  wanted = on;
  if (on) {
    if (!sentinel) await acquire();
  } else if (sentinel) {
    const s = sentinel;
    sentinel = null;
    try {
      await s.release();
    } catch {
      /* already released */
    }
    notify();
  }
}
document.addEventListener('visibilitychange', () => {
  if (wanted && document.visibilityState === 'visible' && !sentinel) void acquire();
});

/* ---------------- App icon badge ---------------- */
export function setBadge(count: number) {
  try {
    const nav = navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
    if (count > 0) void nav.setAppBadge?.(count);
    else void nav.clearAppBadge?.();
  } catch {
    /* not supported */
  }
}

export const isStandalone = () =>
  matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
export const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/** Saves a file: the share sheet where it works (Save to Files), otherwise a download. */
export async function saveFile(name: string, type: string, text: string, preferShare: boolean): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const blob = new Blob([text], { type });
  const file = new File([blob], name, { type });
  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
  if (preferShare && nav.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return 'shared';
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'cancelled';
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return 'downloaded';
}
