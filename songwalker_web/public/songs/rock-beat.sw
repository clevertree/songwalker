// Rock Beat — Drum kit + bass + guitar, multi-track
const drums = loadPreset("FluidR3_GM/Standard")
const bass = loadPreset("FluidR3_GM/Fingered Bass")
const guitar = loadPreset("FluidR3_GM/Overdriven Guitar")
track.beatsPerMinute = 120

beat(drums)
bassline(bass)
riff(guitar)

track beat(kit) {
    track.instrument = kit
    track.duration = 1/4

    for (let i = 0; i < 4; i++) {
        // Standard rock pattern
        Kick *0.9           HiHat *0.5  /2
        HiHat *0.5          Snare *0.8  /2
        Kick *0.9           HiHat *0.5  /2
        HiHat *0.5          Snare *0.8  /2
    }
}

track bassline(inst) {
    track.instrument = inst
    track.duration = 1/4

    for (let i = 0; i < 4; i++) {
        E2 /2  E2 /4  G2 /4
        A2 /2  A2 /4  B2 /4
    }
}

track riff(inst) {
    track.instrument = inst
    track.duration = 1/8

    for (let i = 0; i < 4; i++) {
        E4 E4 . E4  G4 /4
        A4 A4 . A4  G4 /4
    }
}
