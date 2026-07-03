// src/lib/audio/numberSounds.js
//
// Web Audio implementation. Each clip is fetched and decoded ONCE into an
// AudioBuffer, then played through a BufferSource. Compared to the previous
// `new Audio()`-per-call approach this fixes:
//   - silent draws on poor networks (no per-draw fetch; buffers live in memory),
//   - the first-number warmup lag (the output path is pre-warmed),
//   - mute latency (BufferSource.stop() is immediate/sample-accurate).
// The public API is unchanged, so callers (GameLayout, Winner) need no edits.

let audioCtx = null;
let audioEnabled = true;
let currentSource = null; // currently-playing BufferSource (for stopAllSounds)
const buffers = new Map(); // key -> AudioBuffer
let warmed = false;

const getCtx = () => {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
      audioCtx = new AC();
    } catch (e) {
      return null;
    }
  }
  return audioCtx;
};

const letterFor = (n) =>
  n <= 15 ? "B" : n <= 30 ? "I" : n <= 45 ? "N" : n <= 60 ? "G" : "O";
const keyFor = (n) => `${letterFor(n)}${n}`;
const urlFor = (n) => `/sound/${letterFor(n)}${n}.mp3`;

// Warm the output path once so the very first real sound has no startup delay.
const warmOutput = () => {
  const ctx = getCtx();
  if (!ctx || warmed) return;
  try {
    const buf = ctx.createBuffer(1, 1, ctx.sampleRate);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start(0);
    warmed = true;
  } catch (e) {
    /* ignore */
  }
};

// Resume + warm the context on the first user gesture (autoplay policy).
const unlock = () => {
  const ctx = getCtx();
  if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {});
  warmOutput();
  document.removeEventListener("click", unlock);
  document.removeEventListener("touchstart", unlock);
};
if (typeof document !== "undefined") {
  document.addEventListener("click", unlock);
  document.addEventListener("touchstart", unlock);
}

async function loadBuffer(key, url) {
  if (buffers.has(key)) return buffers.get(key);
  const ctx = getCtx();
  if (!ctx) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const arr = await res.arrayBuffer();
    const buf = await ctx.decodeAudioData(arr);
    buffers.set(key, buf);
    return buf;
  } catch (e) {
    return null;
  }
}

function playBuffer(buf, volume) {
  const ctx = getCtx();
  if (!ctx || !buf) return;
  if (ctx.state === "suspended") ctx.resume().catch(() => {});

  // Stop whatever is currently playing first.
  if (currentSource) {
    try {
      currentSource.onended = null;
      currentSource.stop();
    } catch (e) {}
    currentSource = null;
  }

  const src = ctx.createBufferSource();
  src.buffer = buf;
  const gain = ctx.createGain();
  gain.gain.value = volume;
  src.connect(gain);
  gain.connect(ctx.destination);
  src.onended = () => {
    if (currentSource === src) currentSource = null;
  };
  currentSource = src;
  try {
    src.start(0);
  } catch (e) {
    /* ignore */
  }
}

export const playNumberSound = async (n) => {
  if (!audioEnabled || !n) return;
  const key = keyFor(n);
  let buf = buffers.get(key);
  if (!buf) buf = await loadBuffer(key, urlFor(n)); // best-effort if not preloaded
  playBuffer(buf, 0.85);
};

export const stopAllSounds = () => {
  if (currentSource) {
    try {
      currentSource.onended = null;
      currentSource.stop();
    } catch (e) {}
    currentSource = null;
  }
};

export const preloadBingoSound = () => loadBuffer("bingo", "/sound/bingo.mp3");

export const playBingoSound = async () => {
  if (!audioEnabled) return;
  let buf = buffers.get("bingo");
  if (!buf) buf = await loadBuffer("bingo", "/sound/bingo.mp3");
  playBuffer(buf, 0.95);
};

export const initAudio = async () => {
  const ctx = getCtx();
  if (ctx && ctx.state === "suspended") await ctx.resume().catch(() => {});
  warmOutput();
  preloadBingoSound();
  return true;
};

export const preloadNumberSounds = async () => {
  getCtx();
  await preloadBingoSound();
  // Decode in small batches so a poor connection still makes progress and we
  // don't open 75 requests at once.
  for (let start = 1; start <= 75; start += 8) {
    const batch = [];
    for (let n = start; n < start + 8 && n <= 75; n++) {
      batch.push(loadBuffer(keyFor(n), urlFor(n)));
    }
    await Promise.all(batch);
  }
  return true;
};

export const resumeAudio = async () => {
  const ctx = getCtx();
  if (ctx && ctx.state === "suspended") await ctx.resume().catch(() => {});
  return true;
};

export const setAudioEnabled = (enabled) => {
  audioEnabled = enabled;
  if (!enabled) stopAllSounds();
};
