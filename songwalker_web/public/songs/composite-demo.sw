// Composite Demo — Layered and chained presets
const piano = loadPreset("FluidR3_GM/Acoustic Grand Piano")
const strings = loadPreset("FluidR3_GM/String Ensemble 1")

const layered = Composite({
    mode: 'layer',
    children: [piano, strings]
})

track.beatsPerMinute = 90

main(layered)
counter(piano)

track main(inst) {
    track.instrument = inst
    track.duration = 1/2

    // Layered piano + strings
    C4 /1
    E4 /2  G4 /2
    A4 /1
    G4 /2  E4 /2

    [C4, E4, G4] /2
    [F4, A4, C5] /2
    [G4, B4, D5] /1
    [C4, E4, G4] /2
}

track counter(inst) {
    track.instrument = inst
    track.duration = 1/4

    // Piano countermelody
    . /2
    G5 /4  E5 /4  C5 /4  D5 /4  E5 /2
    . /2
    A5 /4  G5 /4  E5 /4  D5 /4  C5 /2
}
