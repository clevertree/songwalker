//! SongWalker CLI — Compile and render .sw files to WAV.
//!
//! Usage:
//!   songwalker_cli <input.sw> [output.wav]
//!   songwalker_cli --check <input.sw>
//!   songwalker_cli --ast <input.sw>

use songwalker_core::{compiler, dsp, parse};
use std::env;
use std::fs;
use std::process;

fn main() {
    let args: Vec<String> = env::args().collect();

    if args.len() < 2 {
        eprintln!("SongWalker CLI v{}", env!("CARGO_PKG_VERSION"));
        eprintln!();
        eprintln!("Usage:");
        eprintln!("  {} <input.sw> [output.wav]   Render to WAV", args[0]);
        eprintln!("  {} --check <input.sw>        Check syntax only", args[0]);
        eprintln!("  {} --ast <input.sw>          Print AST", args[0]);
        process::exit(1);
    }

    match args[1].as_str() {
        "--check" => {
            if args.len() < 3 {
                eprintln!("Error: --check requires a file argument");
                process::exit(1);
            }
            cmd_check(&args[2]);
        }
        "--ast" => {
            if args.len() < 3 {
                eprintln!("Error: --ast requires a file argument");
                process::exit(1);
            }
            cmd_ast(&args[2]);
        }
        _ => {
            let input = &args[1];
            let output = if args.len() >= 3 {
                args[2].clone()
            } else {
                // Replace .sw extension with .wav, or append .wav
                if input.ends_with(".sw") {
                    format!("{}.wav", &input[..input.len() - 3])
                } else {
                    format!("{input}.wav")
                }
            };
            cmd_render(input, &output);
        }
    }
}

fn read_source(path: &str) -> String {
    match fs::read_to_string(path) {
        Ok(s) => s,
        Err(e) => {
            eprintln!("Error reading '{path}': {e}");
            process::exit(1);
        }
    }
}

fn cmd_check(path: &str) {
    let source = read_source(path);

    match parse(&source) {
        Ok(program) => {
            match compiler::compile(&program) {
                Ok(event_list) => {
                    println!(
                        "✓ {path}: {} events, {:.1} beats",
                        event_list.events.len(),
                        event_list.total_beats,
                    );
                }
                Err(e) => {
                    eprintln!("Compile error in '{path}': {e}");
                    process::exit(1);
                }
            }
        }
        Err(e) => {
            eprintln!("Parse error in '{path}': {e}");
            process::exit(1);
        }
    }
}

fn cmd_ast(path: &str) {
    let source = read_source(path);

    match parse(&source) {
        Ok(program) => {
            println!("{program:#?}");
        }
        Err(e) => {
            eprintln!("Parse error in '{path}': {e}");
            process::exit(1);
        }
    }
}

fn cmd_render(input: &str, output: &str) {
    let source = read_source(input);

    // Parse
    let program = match parse(&source) {
        Ok(p) => p,
        Err(e) => {
            eprintln!("Parse error: {e}");
            process::exit(1);
        }
    };

    // Compile
    let event_list = match compiler::compile(&program) {
        Ok(el) => el,
        Err(e) => {
            eprintln!("Compile error: {e}");
            process::exit(1);
        }
    };

    let sample_rate = 44100;
    let total_beats = event_list.total_beats;
    let num_events = event_list.events.len();

    // Render to WAV
    let wav_data = dsp::renderer::render_wav(&event_list, sample_rate);

    // Write output
    match fs::write(output, &wav_data) {
        Ok(()) => {
            let duration_sec = total_beats * 60.0 / 120.0; // default BPM for display
            let size_kb = wav_data.len() / 1024;
            println!("✓ Rendered '{input}' → '{output}'");
            println!(
                "  {num_events} events, {total_beats:.1} beats, ~{duration_sec:.1}s, {size_kb} KB",
            );
        }
        Err(e) => {
            eprintln!("Error writing '{output}': {e}");
            process::exit(1);
        }
    }
}
