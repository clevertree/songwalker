import AudioBufferInstrument, {AudioBufferInstrumentConfig} from './AudioBufferInstrument'
import OscillatorInstrument, {OscillatorInstrumentConfig} from './OscillatorInstrument'
import PolyphonyInstrument, {PolyphonyInstrumentConfig} from './PolyphonyInstrument'
import ReverbEffect, {ReverbEffectConfig} from '../instruments/effects/reverb/ReverbEffect'
import {Preset} from "../types";
import DelayEffect, {DelayEffectConfig} from "../instruments/effects/delay/DelayEffect";

export {
    InstrumentPresetBank,
    AudioBufferInstrument,
    OscillatorInstrument,
    PolyphonyInstrument,
    ReverbEffect,
}
export type {
    AudioBufferInstrumentConfig,
    OscillatorInstrumentConfig,
    PolyphonyInstrumentConfig,
    ReverbEffectConfig,
}

const InstrumentPresetBank = async function* () {
    yield {
        title: 'Oscillator',
        loader: OscillatorInstrument,
        config: {}
    } as Preset<OscillatorInstrumentConfig>
    yield {
        title: 'AudioBuffer',
        loader: AudioBufferInstrument,
        config: {}
    } as Preset<AudioBufferInstrumentConfig>
    yield {
        title: 'Polyphony',
        loader: PolyphonyInstrument,
        config: {}
    } as Preset<PolyphonyInstrumentConfig>

    /** Effects **/

    yield {
        title: 'Reverb',
        loader: ReverbEffect,
        config: {}
    } as Preset<ReverbEffectConfig>
    yield {
        title: 'Delay',
        loader: DelayEffect,
        config: {}
    } as Preset<DelayEffectConfig>
}
