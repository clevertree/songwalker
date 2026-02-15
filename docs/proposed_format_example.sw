// SongWalker - Refactored Format (Matching User Preference)
// ========================================================
// Based on public/song/test.sw

// 1. Setup & Presets
const lead = loadPreset(/FluidR3.*\/.*Guitar/i);
const drums = loadPreset("FluidR3/StandardKit");
const osc = Oscillator({type: 'square', mixer: 0.4});
const reverb = loadPreset("Reverb");

track.beatsPerMinute = 160;

// 2. Arrangement (Direct Callbacks)
// The syntax here is: TrackIdentifier [Modifiers] (Arguments) [StepDuration?]
// * = Velocity/Dynamics
// @ = Play Duration (Cutoff)

main_riff(lead);          // Simple call

// "Play main_riff with osc, velocity 96, only the first 4 beats, and then wait 8 beats"
main_riff*96@4(osc) 8; 

// "Play drum_beat, limiting output/loop to length 4, step 16"
drum_beat@4() 16;


// 3. Track Definitions
track main_riff(instrument) {
    track.instrument = instrument;
    track.effects = [reverb];
    track.duration = 1/4; // Default step duration

    // --- Minimalist Note Syntax ---
    // Note [Modifiers] /StepDuration
    
    C3 /2
    
    // Explicit modifiers (from test.sw)
    // C2 is the note. 
    // @/4 overrides the AUDIBLE duration to 1/4.
    // /2 is the STEP duration (time until next line).
    C2@/4 /2  
    
    G2 /2
    Eb2 /2

    // Arrays/Chords played for 1 beat (C3 plays 2 beats), but resting only half a beat 
    [C3@2, E3, G3]@1 /2

    // Standard JS Logic is allowed for loops
    for (let i=0; i<2; i++) {
        Eb3 /8
        F3  /8
    }
}

track drum_beat() {
    track.instrument = drums;
    
    // Minimalist drum syntax
    // *3 = Modifier (Velocity)
    // @/8 = Duration Override
    
    Kick*3           /2
    HiHat*3          /2
    
    // Example from test.sw: 'as', 'abd' likely variables or constants
    HiHat   as       /2
    HiHat*3 @/8      /2
}