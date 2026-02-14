use serde::{Deserialize, Serialize};

use crate::ast::*;

// ── Event List (Compiler Output) ────────────────────────────

/// The compiled output: a flat list of timed events.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventList {
    /// All events sorted by time.
    pub events: Vec<Event>,
    /// Total duration of the song in beats (cursor position at end).
    pub total_beats: f64,
}

/// A single scheduled event.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Event {
    /// When this event fires, in beats from the start.
    pub time: f64,
    pub kind: EventKind,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum EventKind {
    /// Play a note.
    Note {
        pitch: String,
        velocity: f64,
        /// Audible duration in beats.
        duration: f64,
    },
    /// Start a sub-track.
    TrackStart {
        track_name: String,
        velocity: Option<f64>,
        play_duration: Option<f64>,
        args: Vec<String>,
    },
    /// Set a property.
    SetProperty { target: String, value: String },
}

// ── Compiler ────────────────────────────────────────────────

/// Compile context: tracks state during compilation.
struct CompileCtx {
    /// Default step duration in beats (e.g., 1/4 = 0.25).
    default_duration: f64,
    /// Current cursor position in beats.
    cursor: f64,
    /// Collected events.
    events: Vec<Event>,
    /// Track definitions available for lookup.
    track_defs: Vec<TrackDef>,
}

struct TrackDef {
    name: String,
    #[allow(dead_code)]
    params: Vec<String>,
    body: Vec<TrackStatement>,
}

impl CompileCtx {
    fn new() -> Self {
        CompileCtx {
            default_duration: 1.0, // default: 1 beat
            cursor: 0.0,
            events: Vec::new(),
            track_defs: Vec::new(),
        }
    }

    fn emit(&mut self, kind: EventKind) {
        self.events.push(Event {
            time: self.cursor,
            kind,
        });
    }

    fn resolve_duration(&self, dur: &Option<DurationExpr>) -> f64 {
        match dur {
            Some(d) => duration_to_beats(d, self.default_duration),
            None => self.default_duration,
        }
    }
}

/// Convert a DurationExpr to a beat count.
fn duration_to_beats(dur: &DurationExpr, default: f64) -> f64 {
    match dur {
        DurationExpr::Beats(n) => *n,
        DurationExpr::Inverse(n) => 1.0 / n,
        DurationExpr::Fraction(n, m) => n / m,
        DurationExpr::Dots(count) => default * (*count as f64),
    }
}

fn expr_to_string(expr: &Expr) -> String {
    match expr {
        Expr::Identifier(s) => s.clone(),
        Expr::StringLit(s) => s.clone(),
        Expr::Number(n) => format!("{n}"),
        Expr::RegexLit(s) => s.clone(),
        _ => format!("{expr:?}"),
    }
}

// ── Public API ──────────────────────────────────────────────

/// Compile a parsed Program into a flat EventList.
///
/// Phase 1: Compiles a single-pass arrangement. Tracks are inlined,
/// for-loops are unrolled, and the output is a flat timeline.
pub fn compile(program: &Program) -> Result<EventList, String> {
    let mut ctx = CompileCtx::new();

    // First pass: collect track definitions.
    for stmt in &program.statements {
        if let Statement::TrackDef { name, params, body } = stmt {
            ctx.track_defs.push(TrackDef {
                name: name.clone(),
                params: params.clone(),
                body: body.clone(),
            });
        }
    }

    // Second pass: compile top-level statements.
    for stmt in &program.statements {
        compile_statement(&mut ctx, stmt)?;
    }

    ctx.events.sort_by(|a, b| a.time.partial_cmp(&b.time).unwrap());

    Ok(EventList {
        total_beats: ctx.cursor,
        events: ctx.events,
    })
}

fn compile_statement(ctx: &mut CompileCtx, stmt: &Statement) -> Result<(), String> {
    match stmt {
        Statement::TrackDef { .. } => {
            // Already collected in first pass; skip.
            Ok(())
        }
        Statement::TrackCall {
            name,
            velocity,
            play_duration,
            args,
            step,
        } => {
            // Look up the track and inline it.
            let track_body = ctx
                .track_defs
                .iter()
                .find(|td| td.name == *name)
                .map(|td| td.body.clone());

            if let Some(body) = track_body {
                let saved_cursor = ctx.cursor;
                let saved_default_dur = ctx.default_duration;

                // Compile the track body inline.
                compile_track_body(ctx, &body)?;

                // If play_duration is set, cap the track's extent.
                if let Some(pd) = play_duration {
                    let max_dur = duration_to_beats(pd, ctx.default_duration);
                    ctx.cursor = saved_cursor + max_dur;
                }

                ctx.default_duration = saved_default_dur;

                // Apply step (rest after the track call).
                if let Some(s) = step {
                    let step_beats = duration_to_beats(s, ctx.default_duration);
                    ctx.cursor = saved_cursor + step_beats;
                }
            } else {
                // Unknown track: emit as a TrackStart event.
                let arg_strings: Vec<String> = args.iter().map(expr_to_string).collect();
                ctx.emit(EventKind::TrackStart {
                    track_name: name.clone(),
                    velocity: *velocity,
                    play_duration: play_duration
                        .as_ref()
                        .map(|d| duration_to_beats(d, ctx.default_duration)),
                    args: arg_strings,
                });
                if let Some(s) = step {
                    ctx.cursor += duration_to_beats(s, ctx.default_duration);
                }
            }
            Ok(())
        }
        Statement::ConstDecl { .. } => {
            // Const declarations are runtime concerns; skip for Phase 1.
            Ok(())
        }
        Statement::Assignment { target, value } => {
            // Check for known properties.
            if target == "track.beatsPerMinute" {
                // BPM is a runtime property; store as event.
                ctx.emit(EventKind::SetProperty {
                    target: target.clone(),
                    value: expr_to_string(value),
                });
            } else if target == "track.duration" {
                if let Expr::DurationLit(d) = value {
                    ctx.default_duration = duration_to_beats(d, ctx.default_duration);
                } else if let Expr::Number(n) = value {
                    ctx.default_duration = *n;
                }
            } else {
                ctx.emit(EventKind::SetProperty {
                    target: target.clone(),
                    value: expr_to_string(value),
                });
            }
            Ok(())
        }
        Statement::Comment(_) => Ok(()),
    }
}

fn compile_track_body(ctx: &mut CompileCtx, body: &[TrackStatement]) -> Result<(), String> {
    for stmt in body {
        compile_track_statement(ctx, stmt)?;
    }
    Ok(())
}

fn compile_track_statement(ctx: &mut CompileCtx, stmt: &TrackStatement) -> Result<(), String> {
    match stmt {
        TrackStatement::NoteEvent {
            pitch,
            velocity,
            audible_duration,
            step_duration,
        } => {
            let vel = velocity.unwrap_or(100.0);
            let audible = ctx.resolve_duration(audible_duration);
            let step = ctx.resolve_duration(step_duration);

            ctx.emit(EventKind::Note {
                pitch: pitch.clone(),
                velocity: vel,
                duration: audible,
            });
            ctx.cursor += step;
            Ok(())
        }
        TrackStatement::Chord {
            notes,
            audible_duration,
            step_duration,
        } => {
            let chord_audible = audible_duration
                .as_ref()
                .map(|d| duration_to_beats(d, ctx.default_duration));

            for note in notes {
                let note_dur = note
                    .audible_duration
                    .as_ref()
                    .map(|d| duration_to_beats(d, ctx.default_duration))
                    .or(chord_audible)
                    .unwrap_or(ctx.default_duration);

                ctx.emit(EventKind::Note {
                    pitch: note.pitch.clone(),
                    velocity: 100.0,
                    duration: note_dur,
                });
            }

            let step = ctx.resolve_duration(step_duration);
            ctx.cursor += step;
            Ok(())
        }
        TrackStatement::Rest(dur) => {
            ctx.cursor += duration_to_beats(dur, ctx.default_duration);
            Ok(())
        }
        TrackStatement::Assignment { target, value } => {
            if target == "track.duration" {
                if let Expr::DurationLit(d) = value {
                    ctx.default_duration = duration_to_beats(d, ctx.default_duration);
                } else if let Expr::Number(n) = value {
                    ctx.default_duration = *n;
                }
            } else {
                ctx.emit(EventKind::SetProperty {
                    target: target.clone(),
                    value: expr_to_string(value),
                });
            }
            Ok(())
        }
        TrackStatement::ForLoop {
            init: _,
            condition: _,
            update: _,
            body,
        } => {
            // Phase 1: hardcoded unroll — extract loop count from condition.
            // For now, just compile the body once as a placeholder.
            // TODO: properly evaluate loop bounds.
            compile_track_body(ctx, body)?;
            Ok(())
        }
        TrackStatement::TrackCall {
            name,
            velocity,
            play_duration,
            args,
            step,
        } => {
            // Look up and inline sub-track.
            let track_body = {
                // Borrow ctx.track_defs briefly to clone.
                ctx.track_defs
                    .iter()
                    .find(|td| td.name == *name)
                    .map(|td| td.body.clone())
            };

            if let Some(body) = track_body {
                let saved_cursor = ctx.cursor;
                let saved_dur = ctx.default_duration;
                compile_track_body(ctx, &body)?;

                if let Some(pd) = play_duration {
                    ctx.cursor = saved_cursor + duration_to_beats(pd, ctx.default_duration);
                }
                ctx.default_duration = saved_dur;

                if let Some(s) = step {
                    ctx.cursor = saved_cursor + duration_to_beats(s, ctx.default_duration);
                }
            } else {
                let arg_strings: Vec<String> = args.iter().map(expr_to_string).collect();
                ctx.emit(EventKind::TrackStart {
                    track_name: name.clone(),
                    velocity: *velocity,
                    play_duration: play_duration
                        .as_ref()
                        .map(|d| duration_to_beats(d, ctx.default_duration)),
                    args: arg_strings,
                });
                if let Some(s) = step {
                    ctx.cursor += duration_to_beats(s, ctx.default_duration);
                }
            }
            Ok(())
        }
        TrackStatement::Comment(_) => Ok(()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::parse;

    #[test]
    fn test_compile_simple_track() {
        let program = parse(
            r#"
track riff() {
    C3 /2
    D3 /4
    E3 /4
}
riff();
"#,
        )
        .unwrap();

        let events = compile(&program).unwrap();
        assert_eq!(events.total_beats, 1.0); // 0.5 + 0.25 + 0.25

        let notes: Vec<_> = events
            .events
            .iter()
            .filter_map(|e| match &e.kind {
                EventKind::Note { pitch, .. } => Some((e.time, pitch.as_str())),
                _ => None,
            })
            .collect();

        assert_eq!(notes.len(), 3);
        assert_eq!(notes[0], (0.0, "C3"));
        assert_eq!(notes[1], (0.5, "D3"));
        assert_eq!(notes[2], (0.75, "E3"));
    }

    #[test]
    fn test_compile_track_with_rest() {
        let program = parse(
            r#"
track t() {
    C3 /4
    4
    D3 /4
}
t();
"#,
        )
        .unwrap();

        let events = compile(&program).unwrap();
        // 0.25 (C3) + 4.0 (rest) + 0.25 (D3) = 4.5
        assert_eq!(events.total_beats, 4.5);

        let notes: Vec<_> = events
            .events
            .iter()
            .filter_map(|e| match &e.kind {
                EventKind::Note { pitch, .. } => Some((e.time, pitch.as_str())),
                _ => None,
            })
            .collect();

        assert_eq!(notes[0], (0.0, "C3"));
        assert_eq!(notes[1], (4.25, "D3"));
    }

    #[test]
    fn test_song_length_ends_at_last_rest() {
        // Per plan: song ends after the last rest ends, not when last note finishes.
        let program = parse(
            r#"
track t() {
    C3 /4
    D3 /4
}
t();
"#,
        )
        .unwrap();

        let events = compile(&program).unwrap();
        // Two notes, each stepping 0.25 beats.
        // Cursor ends at 0.5, even though the last note (D3) plays for default duration.
        assert_eq!(events.total_beats, 0.5);
    }

    #[test]
    fn test_compile_chord() {
        let program = parse(
            r#"
track t() {
    [C3, E3, G3]@1 /2
}
t();
"#,
        )
        .unwrap();

        let events = compile(&program).unwrap();

        let notes: Vec<_> = events
            .events
            .iter()
            .filter_map(|e| match &e.kind {
                EventKind::Note { pitch, duration, .. } => {
                    Some((e.time, pitch.as_str(), *duration))
                }
                _ => None,
            })
            .collect();

        // All three notes fire at time 0, each with audible duration 1 beat.
        assert_eq!(notes.len(), 3);
        for (time, _, dur) in &notes {
            assert_eq!(*time, 0.0);
            assert_eq!(*dur, 1.0);
        }
        // Step duration /2 = 0.5 beats.
        assert_eq!(events.total_beats, 0.5);
    }

    #[test]
    fn test_compile_velocity() {
        let program = parse(
            r#"
track t() {
    C3*80 /4
}
t();
"#,
        )
        .unwrap();

        let events = compile(&program).unwrap();
        match &events.events[0].kind {
            EventKind::Note { velocity, .. } => assert_eq!(*velocity, 80.0),
            other => panic!("Expected Note, got {other:?}"),
        }
    }

    #[test]
    fn test_compile_track_call_with_step() {
        let program = parse(
            r#"
track a() {
    C3 /4
}
a() 8;
a();
"#,
        )
        .unwrap();

        let events = compile(&program).unwrap();

        let notes: Vec<_> = events
            .events
            .iter()
            .filter_map(|e| match &e.kind {
                EventKind::Note { pitch, .. } => Some((e.time, pitch.as_str())),
                _ => None,
            })
            .collect();

        // First call: C3 at 0.0, then step 8 beats.
        // Second call: C3 at 8.0.
        assert_eq!(notes[0], (0.0, "C3"));
        assert_eq!(notes[1], (8.0, "C3"));
    }

    #[test]
    fn test_compile_default_duration_override() {
        let program = parse(
            r#"
track t() {
    track.duration = 1/4;
    C3
    D3
}
t();
"#,
        )
        .unwrap();

        let events = compile(&program).unwrap();
        // Each note uses default step = 0.25 beats.
        assert_eq!(events.total_beats, 0.5);

        let notes: Vec<_> = events
            .events
            .iter()
            .filter_map(|e| match &e.kind {
                EventKind::Note { pitch, .. } => Some((e.time, pitch.as_str())),
                _ => None,
            })
            .collect();

        assert_eq!(notes[0], (0.0, "C3"));
        assert_eq!(notes[1], (0.25, "D3"));
    }
}
