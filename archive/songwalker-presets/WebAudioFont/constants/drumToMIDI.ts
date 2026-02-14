const DrumToMIDI: { [shortName: string]: number } = {
    abd: 35, // Acoustic Bass Drum
    bd: 36, // Bass Drum 1
    ss: 37, // Side Stick
    as: 38, // Acoustic Snare
    hc: 39, // Hand Clap
    es: 40, // Electric Snare
    lft: 41, // Low Floor Tom
    chh: 42, // Closed Hi Hat
    hft: 43, // High Floor Tom
    phh: 44, // Pedal Hi-Hat
    lt: 45, // Low Tom
    ohh: 46, // Open Hi-Hat
    lmt: 47, // Low-Mid Tom
    hmt: 48, // Hi Mid Tom
    cc: 49, // Crash Cymbal 1
    ht: 50, // High Tom
    rc: 51, // Ride Cymbal 1
    chc: 52, // Chinese Cymbal
    rb: 53, // Ride Bell
    tr: 54, // Tambourine
    sc: 55, // Splash Cymbal
    cb: 56, // Cowbell
    cc2: 57, // Crash Cymbal 2
    vs: 58, // Vibraslap
    rc2: 59, // Ride Cymbal 2
    hb: 60, // Hi Bongo
    lb: 61, // Low Bongo
    mhc: 62, // Mute Hi Conga
    ohc: 63, // Open Hi Conga
    lc: 64, // Low Conga
    htb: 65, // High Timbale
    ltb: 66, // Low Timbale
    ha: 67, // High Agogo
    la: 68, // Low Agogo
    cbs: 69, // Cabasa
    mrc: 70, // Maracas
    sw: 71, // Short Whistle
    lg: 72, // Long Whistle
    sgr: 73, // Short Guiro
    lgr: 74, // Long Guiro
    cl: 75, // Claves
    hwb: 76, // Hi Wood Block
    lwb: 77, // Low Wood Block
    mc: 78, // Mute Cuica
    oc: 79, // Open Cuica
    mt: 80, // Mute Triangle
    ot: 81, // Open Triangle
}
export default DrumToMIDI;
