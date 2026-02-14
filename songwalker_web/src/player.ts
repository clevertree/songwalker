/**
 * SongWalker Audio Scheduler
 *
 * Takes a compiled EventList from the Rust core and schedules
 * note events against a WebAudio AudioContext with lookahead buffering.
 */

export interface NoteEvent {
  pitch: string;
  velocity: number;
  duration: number;
}

export interface TrackStartEvent {
  track_name: string;
  velocity: number | null;
  play_duration: number | null;
  args: string[];
}

export interface SetPropertyEvent {
  target: string;
  value: string;
}

export type EventKind =
  | { Note: NoteEvent }
  | { TrackStart: TrackStartEvent }
  | { SetProperty: SetPropertyEvent };

export interface ScheduledEvent {
  time: number; // in beats
  kind: EventKind;
}

export interface EventList {
  events: ScheduledEvent[];
  total_beats: number;
}

// ── Note frequency map ─────────────────────────────────────

const NOTE_NAMES: Record<string, number> = {
  C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11,
};

/**
 * Convert a note name like "C3", "Eb4", "F#5" to a frequency in Hz.
 */
export function noteToFrequency(note: string): number | null {
  const match = note.match(/^([A-G])(b|#)?(\d+)$/);
  if (!match) return null;

  const [, name, accidental, octaveStr] = match;
  const octave = parseInt(octaveStr, 10);
  let semitone = NOTE_NAMES[name];
  if (semitone === undefined) return null;

  if (accidental === '#') semitone += 1;
  else if (accidental === 'b') semitone -= 1;

  // MIDI note number: C4 = 60
  const midi = (octave + 1) * 12 + semitone;
  // A4 (MIDI 69) = 440 Hz
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// ── Scheduler ──────────────────────────────────────────────

export interface PlayerState {
  playing: boolean;
  currentBeat: number;
  totalBeats: number;
  bpm: number;
}

export type OnStateChange = (state: PlayerState) => void;

export class SongPlayer {
  private ctx: AudioContext | null = null;
  private events: ScheduledEvent[] = [];
  private totalBeats = 0;
  private bpm = 120;
  private startTime = 0; // AudioContext time when playback started
  private nextEventIndex = 0;
  private schedulerTimer: number | null = null;
  private stateTimer: number | null = null;
  private playing = false;
  private onStateChange: OnStateChange | null = null;

  // Lookahead scheduling parameters
  private readonly LOOKAHEAD_SEC = 0.15; // schedule events this far ahead
  private readonly SCHEDULE_INTERVAL_MS = 50; // how often to call scheduler

  constructor() {}

  /**
   * Load a compiled event list for playback.
   */
  load(eventList: EventList): void {
    this.stop();
    this.events = eventList.events;
    this.totalBeats = eventList.total_beats;
    this.nextEventIndex = 0;

    // Extract BPM from SetProperty events
    for (const evt of this.events) {
      if ('SetProperty' in evt.kind) {
        const prop = (evt.kind as { SetProperty: SetPropertyEvent }).SetProperty;
        if (prop.target === 'track.beatsPerMinute') {
          this.bpm = parseFloat(prop.value) || 120;
        }
      }
    }

    this.emitState();
  }

  /**
   * Register a callback for state changes (play/pause, position, etc.)
   */
  onState(cb: OnStateChange): void {
    this.onStateChange = cb;
  }

  /**
   * Start playback.
   */
  async play(): Promise<void> {
    if (this.playing) return;

    if (!this.ctx) {
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }

    this.playing = true;
    this.nextEventIndex = 0;
    this.startTime = this.ctx.currentTime;

    this.schedulerLoop();
    this.stateTimer = window.setInterval(() => this.emitState(), 50);
    this.emitState();
  }

  /**
   * Stop playback.
   */
  stop(): void {
    this.playing = false;
    if (this.schedulerTimer !== null) {
      clearTimeout(this.schedulerTimer);
      this.schedulerTimer = null;
    }
    if (this.stateTimer !== null) {
      clearInterval(this.stateTimer);
      this.stateTimer = null;
    }
    this.nextEventIndex = 0;
    this.emitState();
  }

  /**
   * Get current playback position in beats.
   */
  getCurrentBeat(): number {
    if (!this.playing || !this.ctx) return 0;
    const elapsed = this.ctx.currentTime - this.startTime;
    return (elapsed * this.bpm) / 60;
  }

  // ── Scheduler Loop ──────────────────────────────────────

  private schedulerLoop(): void {
    if (!this.playing || !this.ctx) return;

    const currentTime = this.ctx.currentTime;
    const horizon = currentTime + this.LOOKAHEAD_SEC;

    while (this.nextEventIndex < this.events.length) {
      const evt = this.events[this.nextEventIndex];
      const eventTimeSec = this.startTime + (evt.time * 60) / this.bpm;

      if (eventTimeSec > horizon) break;

      this.scheduleEvent(evt, eventTimeSec);
      this.nextEventIndex++;
    }

    // Check if song is done
    const songEndSec = this.startTime + (this.totalBeats * 60) / this.bpm;
    if (currentTime >= songEndSec) {
      this.stop();
      return;
    }

    this.schedulerTimer = window.setTimeout(
      () => this.schedulerLoop(),
      this.SCHEDULE_INTERVAL_MS,
    );
  }

  private scheduleEvent(evt: ScheduledEvent, whenSec: number): void {
    if (!this.ctx) return;

    if ('Note' in evt.kind) {
      const note = (evt.kind as { Note: NoteEvent }).Note;
      this.scheduleNote(note, whenSec);
    }
    // TrackStart and SetProperty are handled at load time for now
  }

  private scheduleNote(note: NoteEvent, whenSec: number): void {
    if (!this.ctx) return;

    const freq = noteToFrequency(note.pitch);
    if (freq === null) return; // skip unrecognized pitches (e.g., drum names)

    const durationSec = (note.duration * 60) / this.bpm;
    const velocity = Math.min(note.velocity / 127, 1.0);

    // Simple oscillator-based playback (Phase 2 placeholder)
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, whenSec);

    gain.gain.setValueAtTime(velocity * 0.3, whenSec);
    gain.gain.exponentialRampToValueAtTime(0.001, whenSec + durationSec);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(whenSec);
    osc.stop(whenSec + durationSec + 0.05);
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
