// src/lib/audio/audioService.js

class AudioService {
  constructor() {
    this.audioContext = null;
    this.sounds = new Map();
    this.isEnabled = false;
    this.isInitializing = false;
  }

  async init() {
    // Prevent multiple initializations
    if (this.isEnabled) return true;
    if (this.isInitializing) return this.initPromise;

    this.isInitializing = true;

    this.initPromise = (async () => {
      try {
        // Create audio context
        const AudioContextClass =
          window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) {
          console.warn("⚠️ Web Audio API not supported");
          return false;
        }

        this.audioContext = new AudioContextClass();

        // Resume context (required after user interaction)
        await this.audioContext.resume();

        this.isEnabled = true;
        console.log("✅ Web Audio API initialized for Mini App");
        return true;
      } catch (error) {
        console.warn("⚠️ Web Audio API initialization failed:", error);
        return false;
      } finally {
        this.isInitializing = false;
      }
    })();

    return this.initPromise;
  }

  async loadSound(letter, number) {
    if (!this.audioContext) return null;

    const key = `${letter}${number}`;
    const url = `/sound/${letter}${number}.mp3`;

    if (this.sounds.has(key)) return this.sounds.get(key);

    try {
      const response = await fetch(url);
      if (!response.ok) {
        // Try lowercase extension as fallback
        const fallbackUrl = `/sound/${letter}${number}.mp3`;
        const fallbackResponse = await fetch(fallbackUrl);
        if (!fallbackResponse.ok)
          throw new Error(`HTTP ${fallbackResponse.status}`);
        const fallbackArrayBuffer = await fallbackResponse.arrayBuffer();
        const fallbackAudioBuffer =
          await this.audioContext.decodeAudioData(fallbackArrayBuffer);
        this.sounds.set(key, fallbackAudioBuffer);
        return fallbackAudioBuffer;
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

    // Ensure audio is initialized
    const initialized = await this.init();
    if (!initialized || !this.audioContext) return;

    // Ensure context is running (resume if suspended)
    if (this.audioContext.state === "suspended") {
      await this.audioContext.resume();
    }

    const letter = this.getLetterForNumber(n);

    const audioBuffer = await this.loadSound(letter, n);
    if (!audioBuffer) return;

    try {
      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioContext.destination);
      source.start();

      // Clean up source when done
      source.onended = () => {
        source.disconnect();
      };
    } catch (error) {
      console.warn(`Failed to play sound for ${letter}${n}:`, error);
    }
  }

  getLetterForNumber(n) {
    if (n >= 1 && n <= 15) return "B";
    if (n <= 30) return "I";
    if (n <= 45) return "N";
    if (n <= 60) return "G";
    return "O";
  }

  async preloadAll() {
    const initialized = await this.init();
    if (!initialized) return;

    console.log("🔊 Preloading all sounds for Mini App...");
    const promises = [];
    for (let n = 1; n <= 75; n++) {
      const letter = this.getLetterForNumber(n);
      promises.push(this.loadSound(letter, n));

      // Load in batches to avoid overwhelming the network
      if (n % 10 === 0) {
        await Promise.all(promises);
        promises.length = 0;
        // Small delay to prevent rate limiting
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }
    await Promise.all(promises);
    console.log("✅ All sounds preloaded for Mini App");
  }

  // Resume audio context (call this on user interaction)
  async resume() {
    if (this.audioContext && this.audioContext.state === "suspended") {
      await this.audioContext.resume();
      console.log("🎵 Audio context resumed");
    }
  }
}

export const audioService = new AudioService();
