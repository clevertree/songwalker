// Piano Ballad — Sampler preset + reverb, polyphonic chords
const piano = loadPreset("FluidR3_GM/Acoustic Grand Piano")
track.beatsPerMinute = 72
track.tuningPitch = 440

melody(piano)
chords(piano)

track melody(inst) {
    track.instrument = inst
    track.duration = 1/4

    // Phrase 1
    E4 /2  G4 /2  A4 /2  G4 /2
    C5 /1

    // Phrase 2
    B4 /2  A4 /2  G4 /2  E4 /2
    D4 /1

    // Phrase 3
    E4 /4  F4 /4  G4 /4  A4 /4
    G4 /2  E4 /2
    C4 /1

    // Phrase 4 — resolution
    D4 /4  E4 /4  F4 /4  G4 /4
    A4 /2  G4 /2
    C5 /1
}

track chords(inst) {
    track.instrument = inst
    track.duration = 1

    // I - IV - V - I
    [C3, E3, G3] /1
    [F3, A3, C4] /1
    [G3, B3, D4] /1
    [C3, E3, G3] /1

    // vi - IV - V - I
    [A2, C3, E3] /1
    [F3, A3, C4] /1
    [G3, B3, D4] /1
    [C3, E3, G3] /1
}
