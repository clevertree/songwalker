//! Audio Engine — renders an EventList to audio samples.
//!
//! The engine manages voices, processes events at the correct sample offsets,
//! and produces interleaved stereo f32 output.

use crate::compiler::{EndMode, EventKind, EventList};

use super::mixer::Mixer;
use super::voice::Voice;

/// Note-to-frequency conversion matching the JS `noteToFrequency`.
pub fn note_to_frequency(note: &str) -> Option<f64> {
    let bytes = note.as_bytes();
    if bytes.is_empty() {
        return None;
    }

    // Parse note name (A-G)
    let name = bytes[0] as char;
    let base_semitone = match name {
        'C' => 0,
        'D' => 2,
        'E' => 4,
        'F' => 5,
        'G' => 7,
        'A' => 9,
        'B' => 11,
        _ => return None,
    };

    let mut idx = 1;
    let mut semitone = base_semitone;

    // Parse accidental
    if idx < bytes.len() {
        match bytes[idx] as char {
            '#' => {
                semitone += 1;
                idx += 1;
            }
            'b' => {
                semitone -= 1;
                idx += 1;
            }
            _ => {}
        }
    }

    // Parse octave number
    let octave_str = &note[idx..];
    let octave: i32 = octave_str.parse().ok()?;

    // MIDI note number: C4 = 60
    let midi = (octave + 1) * 12 + semitone;
    // A4 (MIDI 69) = 440 Hz
    Some(440.0 * (2.0_f64).powf((midi as f64 - 69.0) / 12.0))
}

/// Scheduled voice event for the engine.
struct ScheduledNote {
    /// Sample offset when the note starts.
    start_sample: usize,
    /// Sample offset when the note should be released (gate off).
    release_sample: usize,
    frequency: f64,
    velocity: f64,
}

/// The audio rendering engine.
pub struct AudioEngine {
    pub sample_rate: f64,
    pub bpm: f64,
    max_voices: usize,
}

impl AudioEngine {
    pub fn new(sample_rate: f64) -> Self {
        AudioEngine {
            sample_rate,
            bpm: 120.0,
            max_voices: 64,
        }
    }

    /// Render an entire EventList to mono f64 samples.
    pub fn render(&self, event_list: &EventList) -> Vec<f64> {
        // Extract BPM from events
        let mut bpm = self.bpm;
        for evt in &event_list.events {
            if let EventKind::SetProperty { target, value } = &evt.kind {
                if target == "track.beatsPerMinute" {
                    if let Ok(v) = value.parse::<f64>() {
                        bpm = v;
                    }
                }
            }
        }

        let cursor_samples = {
            let seconds = event_list.total_beats * 60.0 / bpm;
            (seconds * self.sample_rate) as usize
        };

        // Collect note events with their sample timings
        let mut scheduled: Vec<ScheduledNote> = Vec::new();
        for evt in &event_list.events {
            if let EventKind::Note {
                pitch,
                velocity,
                gate,
                ..
            } = &evt.kind
            {
                if let Some(freq) = note_to_frequency(pitch) {
                    let start = {
                        let s = evt.time * 60.0 / bpm;
                        (s * self.sample_rate) as usize
                    };
                    let gate_seconds = gate * 60.0 / bpm;
                    let release = start + (gate_seconds * self.sample_rate) as usize;
                    scheduled.push(ScheduledNote {
                        start_sample: start,
                        release_sample: release,
                        frequency: freq,
                        velocity: *velocity / 127.0,
                    });
                }
            }
        }

        // Sort by start time
        scheduled.sort_by_key(|n| n.start_sample);

        // Compute total output length based on EndMode
        let release_env_seconds = 0.05; // matches the hardcoded envelope release
        let release_env_samples = (release_env_seconds * self.sample_rate) as usize;
        // Extra tail for effects (reverb, etc.) — future-proofing
        let effects_tail_samples = (0.5 * self.sample_rate) as usize;

        let total_samples = match event_list.end_mode {
            EndMode::Gate => {
                // End at the latest gate-off (release_sample)
                let max_gate = scheduled.iter().map(|n| n.release_sample).max().unwrap_or(0);
                cursor_samples.max(max_gate)
            }
            EndMode::Release => {
                // End after all envelopes finish
                let max_release = scheduled
                    .iter()
                    .map(|n| n.release_sample + release_env_samples)
                    .max()
                    .unwrap_or(0);
                cursor_samples.max(max_release)
            }
            EndMode::Tail => {
                // End after all notes + effect tails finish
                let max_tail = scheduled
                    .iter()
                    .map(|n| n.release_sample + release_env_samples + effects_tail_samples)
                    .max()
                    .unwrap_or(0);
                cursor_samples.max(max_tail)
            }
        };

        // Render in blocks
        let block_size = 128;
        let mut mixer = Mixer::new();
        let mut voices: Vec<Voice> = Vec::new();
        let mut output = vec![0.0_f64; total_samples];
        let mut next_note_idx = 0;

        let mut block_start = 0;
        while block_start < total_samples {
            let block_end = (block_start + block_size).min(total_samples);
            let this_block = block_end - block_start;

            // Activate new notes that start in this block
            while next_note_idx < scheduled.len()
                && scheduled[next_note_idx].start_sample < block_end
            {
                let note = &scheduled[next_note_idx];
                if voices.len() < self.max_voices {
                    let mut voice = Voice::new(self.sample_rate);
                    voice.envelope.attack = 0.005;
                    voice.envelope.decay = 0.1;
                    voice.envelope.sustain = 0.6;
                    voice.envelope.release = 0.05;
                    voice.release_sample = note.release_sample;
                    voice.note_on(note.frequency, note.velocity);
                    voices.push(voice);
                }
                next_note_idx += 1;
            }

            // Check for note releases — each voice carries its own release_sample
            for voice in voices.iter_mut() {
                if voice.release_sample >= block_start && voice.release_sample < block_end {
                    voice.note_off();
                }
            }

            // Render voices into mixer
            mixer.clear(this_block);
            for voice in voices.iter_mut() {
                if !voice.is_finished() {
                    for i in 0..this_block {
                        let sample = voice.next_sample();
                        mixer.add(i, sample);
                    }
                }
            }

            // Copy mixer output to main buffer
            let mixed = mixer.output();
            for (i, &s) in mixed.iter().enumerate() {
                output[block_start + i] = s;
            }

            // Remove finished voices
            voices.retain(|v| !v.is_finished());

            block_start = block_end;
        }

        output
    }

    /// Render to interleaved stereo i16 PCM (for WAV export).
    pub fn render_pcm_i16(&self, event_list: &EventList) -> Vec<i16> {
        let mono = self.render(event_list);
        let mut stereo = Vec::with_capacity(mono.len() * 2);
        for &s in &mono {
            let sample = (s * 32767.0).round().clamp(-32768.0, 32767.0) as i16;
            stereo.push(sample); // L
            stereo.push(sample); // R
        }
        stereo
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::compiler::{EndMode, Event, EventKind, EventList};

    fn make_simple_song() -> EventList {
        EventList {
            events: vec![
                Event {
                    time: 0.0,
                    kind: EventKind::SetProperty {
                        target: "track.beatsPerMinute".to_string(),
                        value: "120".to_string(),
                    },
                },
                Event {
                    time: 0.0,
                    kind: EventKind::Note {
                        pitch: "C4".to_string(),
                        velocity: 100.0,
                        gate: 1.0,
                        source_start: 0,
                        source_end: 0,
                    },
                },
                Event {
                    time: 1.0,
                    kind: EventKind::Note {
                        pitch: "E4".to_string(),
                        velocity: 80.0,
                        gate: 1.0,
                        source_start: 0,
                        source_end: 0,
                    },
                },
            ],
            total_beats: 2.0,
            end_mode: EndMode::Gate,
        }
    }

    #[test]
    fn note_to_freq_a4() {
        let f = note_to_frequency("A4").unwrap();
        assert!((f - 440.0).abs() < 0.01, "A4 should be 440Hz, got {f}");
    }

    #[test]
    fn note_to_freq_c4() {
        let f = note_to_frequency("C4").unwrap();
        assert!(
            (f - 261.63).abs() < 0.1,
            "C4 should be ~261.63Hz, got {f}"
        );
    }

    #[test]
    fn note_to_freq_accidentals() {
        let sharp = note_to_frequency("F#4").unwrap();
        let flat = note_to_frequency("Gb4").unwrap();
        assert!(
            (sharp - flat).abs() < 0.01,
            "F#4 and Gb4 should be the same frequency"
        );
    }

    #[test]
    fn render_produces_output() {
        let engine = AudioEngine::new(44100.0);
        let song = make_simple_song();
        let audio = engine.render(&song);

        // EndMode::Gate: last note gate ends at beat 2.0 = 1s = 44100 samples
        assert_eq!(audio.len(), 44100);

        // Should have non-zero output
        let max = audio.iter().fold(0.0_f64, |m, &s| m.max(s.abs()));
        assert!(max > 0.01, "Rendered audio should be non-silent, max={max}");
    }

    #[test]
    fn render_output_bounded() {
        let engine = AudioEngine::new(44100.0);
        let song = make_simple_song();
        let audio = engine.render(&song);

        for (i, &s) in audio.iter().enumerate() {
            assert!(
                s.abs() <= 1.0,
                "Output should be bounded to [-1, 1], sample {i} = {s}"
            );
        }
    }

    #[test]
    fn render_pcm_i16_stereo() {
        let engine = AudioEngine::new(44100.0);
        let song = make_simple_song();
        let pcm = engine.render_pcm_i16(&song);

        // Stereo: 2 channels * 44100 samples = 88200
        assert_eq!(pcm.len(), 88200);
    }

    #[test]
    fn empty_song_renders_silent() {
        let engine = AudioEngine::new(44100.0);
        let song = EventList {
            events: vec![],
            total_beats: 1.0,
            end_mode: EndMode::Gate,
        };
        let audio = engine.render(&song);

        // 1 beat at 120 BPM = 0.5s = 22050 samples
        assert_eq!(audio.len(), 22050);
        assert!(audio.iter().all(|&s| s == 0.0));
    }

    #[test]
    fn end_mode_gate_vs_tail() {
        let engine = AudioEngine::new(44100.0);

        let gate_song = EventList {
            events: vec![Event {
                time: 0.0,
                kind: EventKind::Note {
                    pitch: "A4".to_string(),
                    velocity: 100.0,
                    gate: 1.0,
                    source_start: 0,
                    source_end: 0,
                },
            }],
            total_beats: 1.0,
            end_mode: EndMode::Gate,
        };

        let tail_song = EventList {
            events: vec![Event {
                time: 0.0,
                kind: EventKind::Note {
                    pitch: "A4".to_string(),
                    velocity: 100.0,
                    gate: 1.0,
                    source_start: 0,
                    source_end: 0,
                },
            }],
            total_beats: 1.0,
            end_mode: EndMode::Tail,
        };

        let gate_audio = engine.render(&gate_song);
        let tail_audio = engine.render(&tail_song);

        // Tail mode should produce a longer output (includes release + effects tail)
        assert!(
            tail_audio.len() > gate_audio.len(),
            "Tail ({}) should be longer than Gate ({})",
            tail_audio.len(),
            gate_audio.len()
        );
    }

    #[test]
    fn notes_actually_stop_after_gate() {
        let engine = AudioEngine::new(44100.0);
        // Short note: gate = 0.1 beats at 120 BPM = 0.05s = 2205 samples
        // Release envelope = 0.05s = 2205 samples
        // So after ~4410 samples + some margin, output should be silent
        let song = EventList {
            events: vec![
                Event {
                    time: 0.0,
                    kind: EventKind::SetProperty {
                        target: "track.beatsPerMinute".to_string(),
                        value: "120".to_string(),
                    },
                },
                Event {
                    time: 0.0,
                    kind: EventKind::Note {
                        pitch: "A4".to_string(),
                        velocity: 100.0,
                        gate: 0.1,
                        source_start: 0,
                        source_end: 0,
                    },
                },
            ],
            total_beats: 2.0,
            end_mode: EndMode::Tail,
        };

        let audio = engine.render(&song);
        // Check samples well past the gate+release are silent
        let check_start = 10000; // ~0.22s in, well past gate (0.05s) + release (0.05s)
        let tail_max = audio[check_start..]
            .iter()
            .fold(0.0_f64, |m, &s| m.max(s.abs()));
        assert!(
            tail_max < 0.001,
            "Audio should be silent after note gate + release, max={tail_max}"
        );
    }
}
