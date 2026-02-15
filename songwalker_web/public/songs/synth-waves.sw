// Synth Waves — Pure oscillator presets, no samples
const lead = Oscillator({type: 'sawtooth', attack: 0.05, release: 0.3})
const pad = Oscillator({type: 'triangle', mixer: 0.3, attack: 0.5, release: 1.0})
const sub = Oscillator({type: 'sine', mixer: 0.5})
track.beatsPerMinute = 128

synth_lead(lead)
synth_pad(pad)
sub_bass(sub)

track synth_lead(inst) {
    track.instrument = inst
    track.duration = 1/8

    // Arpeggiated pattern
    C4 D4 Eb4 F4 G4 F4 Eb4 D4
    C4 Eb4 G4 Bb4 G4 Eb4 C4 .

    // Second phrase
    F4 G4 Ab4 Bb4 C5 Bb4 Ab4 G4
    F4 Ab4 C5 Eb5 C5 Ab4 F4 .
}

track synth_pad(inst) {
    track.instrument = inst
    track.duration = 1

    // Sustained chords
    [C3, Eb3, G3] /2
    [F3, Ab3, C4] /2
    [G3, Bb3, D4] /2
    [C3, Eb3, G3] /2
}

track sub_bass(inst) {
    track.instrument = inst
    track.duration = 1/2

    C2 /2  . /2
    F2 /2  . /2
    G2 /2  . /2
    C2 /2  . /2
}
