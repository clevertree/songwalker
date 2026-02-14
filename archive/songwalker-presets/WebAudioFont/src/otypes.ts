export type WaveEnvelope = {
    audioBufferSourceNode?: AudioBufferSourceNode | null,
    target: AudioNode,
    when: number,
    duration: number,
    cancel: () => void,
    pitch: number,
    preset: WavePreset
};
export type WaveZone = {
    keyRangeLow: number,
    keyRangeHigh: number,
    originalPitch: number,
    coarseTune: number,
    fineTune: number,
    loopStart: number,
    loopEnd: number,
    buffer?: AudioBuffer,
    sampleRate: number,
    delay?: number,
    ahdsr?: boolean | WaveAHDSR[],
    sample?: string,
    file?: string,
    sustain?: number
};
export type WavePreset = {
    zones: WaveZone[];
};
export type WaveSlide = {
    when: number, delta: number
};
export type WaveAHDSR = {
    duration: number, volume: number
};
export type CachedPreset = {
    variableName: string, filePath: string
};
export type NumPair = number[];
export type PresetInfo = {
    variable: string, url: string, title: string, pitch: number
};
export type ChordQueue = {
    when: number,
    destination: AudioNode,
    preset: WavePreset,
    pitch: number,
    duration: number,
    volume?: number,
    slides?: WaveSlide[]
};
