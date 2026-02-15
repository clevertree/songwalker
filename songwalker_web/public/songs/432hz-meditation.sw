// 432 Hz Meditation — Alternate tuning, long envelopes
const pad = Oscillator({type: 'sine', attack: 1.0, sustain: 0.8, release: 2.0})
const bowl = loadPreset("FluidR3_GM/Pad 2 (warm)")
track.beatsPerMinute = 60
track.tuningPitch = 432

drone(pad)
texture(bowl)

track drone(inst) {
    track.instrument = inst
    track.duration = 2

    // Long sustained tones — A=432 Hz tuning
    A3 /4
    E3 /4
    A3 /2  E3 /2
    D3 /4
    A3 /4
}

track texture(inst) {
    track.instrument = inst
    track.duration = 1

    // Gentle melodic movement
    . /2
    A4 /2
    E4 /2  F#4 /2
    A4 /4
    . /2
    D4 /2  E4 /2
    A4 /4
}
