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

        // Check if we need to resume (browser autoplay policy)
        if (this.audioContext.state === "suspended") {
          await this.audioContext.resume();
        }

        this.isEnabled = true;
        console.log("✅ Web Audio API initialized");
        return true;
      } catch (error) {
        console.warn(
          "⚠️ Web Audio API initialization failed, using HTML5 fallback:",
          error,
        );
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
    // If using HTML5 fallback, don't preload via Web Audio
    if (this.useHtml5Fallback) return null;

    if (!this.audioContext) return null;

    const key = `${letter}${number}`;
    const url = `/sound/${letter}${number}.mp3`;

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

    // Use HTML5 Audio fallback if Web Audio failed
    if (this.useHtml5Fallback) {
      return this.playHtml5Sound(letter, n);
    }

    // Try Web Audio first
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
          return;
        } catch (error) {
          console.warn(
            `Web Audio failed for ${letter}${n}, trying HTML5 fallback:`,
            error,
          );
        }
      }
    }

    // Fallback to HTML5 Audio
    return this.playHtml5Sound(letter, n);
  }

  playHtml5Sound(letter, n) {
    return new Promise((resolve) => {
      const audioPath = `/sound/${letter}${n}.mp3`;
      const audio = new Audio(audioPath);
      audio.volume = 0.7;

      const onEnd = () => {
        audio.removeEventListener("ended", onEnd);
        audio.removeEventListener("error", onError);
        resolve();
      };

      const onError = (e) => {
        console.warn(`HTML5 audio failed: ${audioPath}`, e);
        audio.removeEventListener("ended", onEnd);
        audio.removeEventListener("error", onError);
        resolve();
      };

      audio.addEventListener("ended", onEnd);
      audio.addEventListener("error", onError);

      audio.play().catch((err) => {
        console.warn(`HTML5 play failed: ${audioPath}`, err);
        resolve();
      });
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

    // Preload using HTML5 Audio (more reliable)
    for (let n = 1; n <= 75; n++) {
      const letter = this.getLetterForNumber(n);
      const audio = new Audio(`/sound/${letter}${n}.mp3`);
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
