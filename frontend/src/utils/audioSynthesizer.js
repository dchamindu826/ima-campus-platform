// Browser Web Audio API Synthesizer & Speech Synthesis Utility
// Designed for instant, zero-latency, 100% offline audio feedback on Entrance Gate Kiosks
import { extractCallingName } from './nameUtils';

class AudioSynthesizer {
  constructor() {
    this.ctx = null;
    this.speechAvailable = typeof window !== 'undefined' && 'speechSynthesis' in window;
    this.isMuted = false;
    this.volume = 1.0;
  }

  // Initialize or resume AudioContext after user interaction
  initContext() {
    if (typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!this.ctx && AudioCtx) {
        this.ctx = new AudioCtx();
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    } catch (e) {
      console.warn('[AudioSynth] AudioContext initialization failed:', e);
    }
  }

  setMuted(muted) {
    this.isMuted = Boolean(muted);
    if (this.isMuted && this.speechAvailable) {
      window.speechSynthesis.cancel();
    }
  }

  setVolume(vol) {
    this.volume = Math.max(0, Math.min(1, vol));
  }

  // 1. Positive Access Granted Chime (Majestic 3-note harmonic arpeggio: C5 -> E5 -> G5)
  playAccessGranted() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const notes = [
        { freq: 523.25, time: 0.00, dur: 0.20 }, // C5
        { freq: 659.25, time: 0.12, dur: 0.22 }, // E5
        { freq: 783.99, time: 0.24, dur: 0.50 }, // G5
        { freq: 1046.50, time: 0.36, dur: 0.60 } // C6 (Sparkle finish)
      ];

      notes.forEach(({ freq, time, dur }) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + time);

        // Gentle attack & smooth exponential decay
        gain.gain.setValueAtTime(0.001, now + time);
        gain.gain.exponentialRampToValueAtTime(0.45 * this.volume, now + time + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + time + dur);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now + time);
        osc.stop(now + time + dur);
      });
    } catch (e) {
      console.error('[AudioSynth] playAccessGranted error:', e);
    }
  }

  // 2. Access Denied Buzzer (Harsh low triple-staccato sawtooth alarm: 140Hz / 110Hz)
  playAccessDenied() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const beeps = [0, 0.16, 0.32];

      beeps.forEach((timeOffset) => {
        const osc = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(146.83, now + timeOffset); // D3

        osc2.type = 'square';
        osc2.frequency.setValueAtTime(110.00, now + timeOffset); // A2

        gain.gain.setValueAtTime(0.4 * this.volume, now + timeOffset);
        gain.gain.exponentialRampToValueAtTime(0.001, now + timeOffset + 0.12);

        osc.connect(gain);
        osc2.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now + timeOffset);
        osc2.start(now + timeOffset);
        osc.stop(now + timeOffset + 0.13);
        osc2.stop(now + timeOffset + 0.13);
      });
    } catch (e) {
      console.error('[AudioSynth] playAccessDenied error:', e);
    }
  }

  // 3. Already Checked In / Warning Chime (Soft double bell)
  playAlreadyCheckedIn() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const notes = [
        { freq: 440.00, time: 0.00, dur: 0.25 }, // A4
        { freq: 554.37, time: 0.15, dur: 0.40 }  // C#5
      ];

      notes.forEach(({ freq, time, dur }) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + time);

        gain.gain.setValueAtTime(0.001, now + time);
        gain.gain.exponentialRampToValueAtTime(0.35 * this.volume, now + time + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + time + dur);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now + time);
        osc.stop(now + time + dur);
      });
    } catch (e) {
      console.error('[AudioSynth] playAlreadyCheckedIn error:', e);
    }
  }

  // 4. Tap / Blip Sound (Card detected feedback)
  playCardTap() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(987.77, now); // B5
      osc.frequency.exponentialRampToValueAtTime(1318.51, now + 0.06); // E6

      gain.gain.setValueAtTime(0.25 * this.volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.08);
    } catch (e) {
      // ignore
    }
  }

  // 5. Speech Synthesis Voice Announcement
  speakVoice(text, delayMs = 200) {
    if (this.isMuted || !this.speechAvailable || !text) return;

    setTimeout(() => {
      try {
        window.speechSynthesis.cancel(); // Stop any pending speech
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.05; // Slightly brisk for gate turnstile
        utterance.pitch = 1.02;
        utterance.volume = this.volume;

        // Try to pick a clear English voice if available
        const voices = window.speechSynthesis.getVoices();
        const preferredVoice = voices.find(v => 
          (v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Daniel') || v.name.includes('Siri')))
        ) || voices.find(v => v.lang.startsWith('en'));

        if (preferredVoice) {
          utterance.voice = preferredVoice;
        }

        window.speechSynthesis.speak(utterance);
      } catch (err) {
        console.warn('[AudioSynth] Voice speech failed:', err);
      }
    }, delayMs);
  }
}

export const audioSynth = new AudioSynthesizer();
export { extractCallingName };
export default audioSynth;

