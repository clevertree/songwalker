/**
 * SongWalker Audio Player
 *
 * Uses the Rust DSP engine (via WASM) to pre-render audio,
 * then plays it through a standard AudioBufferSourceNode.
 * This ensures deterministic, cross-platform audio output.
 */

import { render_song_samples, render_song_wav } from './wasm/songwalker_core.js';

// Re-export types for backward compatibility
export interface EventList {
    events: any[];
    total_beats: number;
}

// ── Player State ───────────────────────────────────────────

export interface PlayerState {
    playing: boolean;
    currentBeat: number;
    totalBeats: number;
    bpm: number;
}

export type OnStateChange = (state: PlayerState) => void;

/**
 * Pre-renders audio via Rust WASM DSP engine, then plays it.
 */
export class SongPlayer {
    private ctx: AudioContext | null = null;
    private sourceNode: AudioBufferSourceNode | null = null;
    private totalBeats = 0;
    private bpm = 120;
    private startTime = 0;
    private stateTimer: number | null = null;
    private playing = false;
    private onStateChange: OnStateChange | null = null;
    private currentSource: string = '';

    private readonly SAMPLE_RATE = 44100;

    constructor() { }

    /**
     * Register a callback for state changes.
     */
    onState(cb: OnStateChange): void {
        this.onStateChange = cb;
    }

    /**
     * Compile, render, and play the song from source code.
     */
    async playSource(source: string): Promise<void> {
        this.stop();
        this.currentSource = source;

        if (!this.ctx) {
            this.ctx = new AudioContext({ sampleRate: this.SAMPLE_RATE });
        }
        if (this.ctx.state === 'suspended') {
            await this.ctx.resume();
        }

        // Render audio via Rust DSP engine
        const samples = render_song_samples(source, this.SAMPLE_RATE);
        if (samples.length === 0) {
            this.emitState();
            return;
        }

        // Extract BPM and total beats from a compile pass
        // (render_song_samples doesn't return metadata, so we parse it)
        this.extractMetadata(source);

        // Create an AudioBuffer from the rendered samples
        const buffer = this.ctx.createBuffer(1, samples.length, this.SAMPLE_RATE);
        buffer.copyToChannel(samples, 0);

        // Create and start source node
        this.sourceNode = this.ctx.createBufferSource();
        this.sourceNode.buffer = buffer;
        this.sourceNode.connect(this.ctx.destination);

        this.playing = true;
        this.startTime = this.ctx.currentTime;
        this.sourceNode.start(0);

        this.sourceNode.onended = () => {
            this.stop();
        };

        this.stateTimer = window.setInterval(() => this.emitState(), 50);
        this.emitState();
    }

    /**
     * Stop playback.
     */
    stop(): void {
        if (this.sourceNode) {
            try {
                this.sourceNode.stop();
            } catch {
                // already stopped
            }
            this.sourceNode.disconnect();
            this.sourceNode = null;
        }
        this.playing = false;
        if (this.stateTimer !== null) {
            clearInterval(this.stateTimer);
            this.stateTimer = null;
        }
        this.emitState();
    }

    /**
     * Export the current song as a WAV file download.
     */
    exportWav(source: string, filename = 'song.wav'): void {
        const wavBytes = render_song_wav(source, this.SAMPLE_RATE);
        const blob = new Blob([wavBytes], { type: 'audio/wav' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }

    /**
     * Get current playback position in beats.
     */
    getCurrentBeat(): number {
        if (!this.playing || !this.ctx) return 0;
        const elapsed = this.ctx.currentTime - this.startTime;
        return (elapsed * this.bpm) / 60;
    }

    get isPlaying(): boolean {
        return this.playing;
    }

    private extractMetadata(source: string): void {
        // Extract BPM from source text (simple regex)
        const bpmMatch = source.match(/beatsPerMinute\s*=\s*(\d+)/);
        this.bpm = bpmMatch ? parseInt(bpmMatch[1], 10) : 120;

        // Estimate total beats from the rendered audio length
        // This is a rough approximation; the compiler has the exact value
        try {
            // We can use compile_song to get metadata, but to avoid importing 
            // it here, we estimate from the rendered samples
            const durationSec = this.sourceNode?.buffer?.duration ?? 0;
            this.totalBeats = (durationSec * this.bpm) / 60;
        } catch {
            this.totalBeats = 0;
        }
    }

    private emitState(): void {
        if (this.onStateChange) {
            this.onStateChange({
                playing: this.playing,
                currentBeat: this.getCurrentBeat(),
                totalBeats: this.totalBeats,
                bpm: this.bpm,
            });
        }
    }
}
