// src/lib/audio/audioService.js

class AudioService {
  constructor() {
    this.audioContext = null;
    this.sounds = new Map();
    this.isEnabled = false;
    this.isInitializing = false;
    this.useHtml5Fallback = false;
  }

  async init() {
    if (this.isEnabled) return true;
    if (this.isInitializing) return this.initPromise;

    this.isInitializing = true;

    this.initPromise = (async () => {
      try {
        const AudioContextClass =
          window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) {
          console.warn("⚠️ Web Audio API not supported, using HTML5 fallback");
          this.useHtml5Fallback = true;
          this.isEnabled = true;
          return true;
        }

        this.audioContext = new AudioContextClass();

        if (this.audioContext.state === "suspended") {
          await this.audioContext.resume();
        }

        this.isEnabled = true;
        console.log("✅ Web Audio API initialized");
        return true;
      } catch (error) {
        console.warn("⚠️ Web Audio API failed, using HTML5 fallback:", error);
        this.useHtml5Fallback = true;
        this.isEnabled = true;
        return true;
      } finally {
        this.isInitializing = false;
      }
    })();

    return this.initPromise;
  }

  async loadSound(letter, number) {
    if (this.useHtml5Fallback) return null;
    if (!this.audioContext) return null;

    const key = `${letter}${number}`;
    const url = `https://www.epidemicsound.com/sound-effects/tracks/3db7eb51-2bfc-465c-93ad-3e630c6b12d5/`;

    if (this.sounds.has(key)) return this.sounds.get(key);

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      this.sounds.set(key, audioBuffer);
      return audioBuffer;
    } catch (error) {
      console.warn(`Failed to load ${url}:`, error);
      return null;
    }
  }

  async playNumberSound(n) {
    if (!n) return;
    await this.init();

    const letter = this.getLetterForNumber(n);

    if (this.useHtml5Fallback) {
      return this.playHtml5Sound(letter, n);
    }

    if (this.audioContext) {
      if (this.audioContext.state === "suspended") {
        await this.audioContext.resume();
      }

      const audioBuffer = await this.loadSound(letter, n);
      if (audioBuffer) {
        try {
          const source = this.audioContext.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(this.audioContext.destination);
          source.start();
          source.onended = () => source.disconnect();
          console.log(`✅ Playing ${letter}${n} via Web Audio`);
          return;
        } catch (error) {
          console.warn(`Web Audio failed for ${letter}${n}:`, error);
        }
      }
    }

    return this.playHtml5Sound(letter, n);
  }

  playHtml5Sound(letter, n) {
    return new Promise((resolve) => {
      const audioPath = `https://www.epidemicsound.com/sound-effects/tracks/3db7eb51-2bfc-465c-93ad-3e630c6b12d5/`;
      const audio = new Audio(audioPath);
      audio.volume = 0.7;

      audio.addEventListener(
        "canplaythrough",
        () => {
          audio.play().catch((err) => {
            console.warn(`HTML5 play failed: ${audioPath}`, err);
          });
        },
        { once: true },
      );

      audio.addEventListener(
        "error",
        (e) => {
          console.warn(`HTML5 audio error: ${audioPath}`, e);
          resolve();
        },
        { once: true },
      );

      audio.addEventListener("ended", () => resolve(), { once: true });

      audio.load();
    });
  }

  getLetterForNumber(n) {
    if (n >= 1 && n <= 15) return "B";
    if (n <= 30) return "I";
    if (n <= 45) return "N";
    if (n <= 60) return "G";
    return "O";
  }

  async preloadAll() {
    await this.init();
    console.log("🔊 Preloading sounds...");

    for (let n = 1; n <= 75; n++) {
      const letter = this.getLetterForNumber(n);
      const audio = new Audio(`https://www.epidemicsound.com/sound-effects/tracks/3db7eb51-2bfc-465c-93ad-3e630c6b12d5/`);
      audio.preload = "auto";
      audio.load();
      if (n % 20 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
    console.log("✅ Sounds preloaded");
  }

  async resume() {
    if (this.audioContext && this.audioContext.state === "suspended") {
      await this.audioContext.resume();
      console.log("🎵 Audio context resumed");
    }
  }
}

export const audioService = new AudioService();
