import {AudioBufferInstrumentConfig} from "@songwalker/instruments";
import {InstrumentInstance, TrackState} from "@songwalker";


export default async function AnalyzerEffect(track: TrackState, config: AudioBufferInstrumentConfig): Promise<InstrumentInstance> {
    // TODO: switch destination out
    // TODO: send all commands to trackState.instrument() in case effect is loaded as instrument

    // TODO: effects can be set to variables, but generally add themselves to state.effects array
    const analyzerEffect: InstrumentInstance = () => {

    }
    // this.effects.push(analyzerEffect)
    return analyzerEffect;
}

// Effect may encapsulate current instrument to modify commands in real-time
