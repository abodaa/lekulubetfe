// src/lib/audio/numberSounds.js

let activeAudio = null;
let audioEnabled = true;
let audioUnlocked = false;
let bingoAudio = null; // preloaded so the win jingle plays instantly

// Try to unlock audio on user interaction
const unlockAudio = () => {
  if (audioUnlocked) return;

  // Create a silent audio context to unlock audio
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (AudioContextClass) {
    const context = new AudioContextClass();
    const buffer = context.createBuffer(1, 1, 22050);
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    source.start();
    context.close();
  }

  audioUnlocked = true;
  console.log("🔓 Audio unlocked");

  // Remove listeners after unlock
  document.removeEventListener("click", unlockAudio);
  document.removeEventListener("touchstart", unlockAudio);
};

// Add event listeners to unlock audio
document.addEventListener("click", unlockAudio);
document.addEventListener("touchstart", unlockAudio);

export const playNumberSound = async (n) => {
  return new Promise((resolve) => {
    if (!audioEnabled) {
      resolve();
      return;
    }

    if (!n) {
      resolve();
      return;
    }

    // Cancel any currently playing sound
    if (activeAudio) {
      activeAudio.pause();
      activeAudio.currentTime = 0;
      activeAudio = null;
    }

    const letter =
      n <= 15 ? "B" : n <= 30 ? "I" : n <= 45 ? "N" : n <= 60 ? "G" : "O";
    const audioPath = `/sound/${letter}${n}.MP3`;
    const audio = new Audio(audioPath);
    activeAudio = audio;

    // Set volume
    audio.volume = 0.7;
    audio.preload = "auto";

    const onEnd = () => {
      if (activeAudio === audio) activeAudio = null;
      audio.removeEventListener("ended", onEnd);
      audio.removeEventListener("error", onError);
      resolve();
    };

    const onError = (e) => {
      console.warn(`⚠️ Failed to play sound: ${audioPath}`, e);
      if (activeAudio === audio) activeAudio = null;
      audio.removeEventListener("ended", onEnd);
      audio.removeEventListener("error", onError);
      resolve();
    };

    audio.addEventListener("ended", onEnd);
    audio.addEventListener("error", onError);

    // Play with error handling
    const playPromise = audio.play();

    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        console.warn(`⚠️ Audio play failed for ${audioPath}:`, err);
        if (activeAudio === audio) activeAudio = null;
        resolve();
      });
    }
  });
};

export const stopAllSounds = () => {
  if (activeAudio) {
    activeAudio.pause();
    activeAudio.currentTime = 0;
    activeAudio = null;
  }
};

// Preload the win jingle so it's ready the instant a game completes.
export const preloadBingoSound = () => {
  try {
    if (!bingoAudio) {
      bingoAudio = new Audio("/sound/bingo.mp3");
      bingoAudio.preload = "auto";
      bingoAudio.volume = 0.8;
      bingoAudio.load();
    }
  } catch (e) {
    /* ignore */
  }
  return bingoAudio;
};

// Celebratory sound played when a game completes with a winner.
// Uses the preloaded element so there's no fetch/decode delay.
export const playBingoSound = async () => {
  if (!audioEnabled) return;

  // Stop any number sound still playing, then play the bingo jingle.
  if (activeAudio) {
    activeAudio.pause();
    activeAudio.currentTime = 0;
    activeAudio = null;
  }

  const audio = preloadBingoSound() || new Audio("/sound/bingo.mp3");
  activeAudio = audio;
  try {
    audio.currentTime = 0;
  } catch (e) {
    /* some browsers throw if not yet loaded; ignore */
  }
  audio.volume = 0.8;
  const playPromise = audio.play();
  if (playPromise !== undefined) {
    playPromise.catch((err) => {
      console.warn("⚠️ Bingo audio play failed:", err);
    });
  }
};

export const initAudio = async () => {
  console.log("🎵 Audio system initialized");
  preloadBingoSound();
  return true;
};

export const preloadNumberSounds = async () => {
  console.log("🔊 Preloading sounds...");
  preloadBingoSound();
  const promises = [];
  for (let n = 1; n <= 75; n++) {
    const letter =
      n <= 15 ? "B" : n <= 30 ? "I" : n <= 45 ? "N" : n <= 60 ? "G" : "O";
    const audio = new Audio(`/sound/${letter}${n}.MP3`);
    audio.preload = "auto";
    promises.push(
      new Promise((resolve) => {
        audio.addEventListener("canplaythrough", () => resolve(), {
          once: true,
        });
        audio.addEventListener("error", () => resolve(), { once: true });
        audio.load();
      }),
    );

    if (n % 20 === 0) {
      await Promise.all(promises);
      promises.length = 0;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  await Promise.all(promises);
  console.log("✅ All sounds preloaded");
};

export const resumeAudio = async () => {
  console.log("🎵 Audio resumed");
  return true;
};

export const setAudioEnabled = (enabled) => {
  audioEnabled = enabled;
  if (!enabled) {
    stopAllSounds();
  }
};
