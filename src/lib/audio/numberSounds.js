// src/lib/audio/numberSounds.js
import { audioService } from "./audioService";

let activeAudio = null;

export const playNumberSound = async (n) => {
  return new Promise((resolve) => {
    if (!n) return resolve();

    // Cancel any currently playing sound
    if (activeAudio) {
      activeAudio.pause();
      activeAudio.currentTime = 0;
      activeAudio = null;
    }

    const letter =
      n <= 15 ? "B" : n <= 30 ? "I" : n <= 45 ? "N" : n <= 60 ? "G" : "O";
    const audio = new Audio(`/sound/${letter}${n}.mp3`);
    activeAudio = audio;

    const onEnd = () => {
      if (activeAudio === audio) activeAudio = null;
      audio.removeEventListener("ended", onEnd);
      resolve();
    };

    audio.addEventListener("ended", onEnd);
    audio.play().catch(() => {
      if (activeAudio === audio) activeAudio = null;
      resolve();
    });
  });
};

export const stopAllSounds = () => {
  if (activeAudio) {
    activeAudio.pause();
    activeAudio.currentTime = 0;
    activeAudio = null;
  }
};

export const initAudio = async () => {
  return await audioService.init();
};

// export const playNumberSound = async (n) => {
//   await audioService.playNumberSound(n);
// };

export const preloadNumberSounds = async () => {
  await audioService.preloadAll();
};

// Resume audio on user interaction (call this when user taps anywhere)
export const resumeAudio = async () => {
  await audioService.resume();
};
