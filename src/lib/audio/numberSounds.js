// src/lib/audio/numberSounds.js
import { audioService } from "./audioService";

export const initAudio = async () => {
  return await audioService.init();
};

export const playNumberSound = async (n) => {
  await audioService.playNumberSound(n);
};

export const preloadNumberSounds = async () => {
  await audioService.preloadAll();
};

// Resume audio on user interaction (call this when user taps anywhere)
export const resumeAudio = async () => {
  await audioService.resume();
};
