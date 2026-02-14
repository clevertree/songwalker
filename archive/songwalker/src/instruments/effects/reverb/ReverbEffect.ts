import {TrackState} from "../../..";
import {InstrumentLoader} from "../../../types";

export interface ReverbEffectConfig {
    duration?: number,
    decay?: number,
    reverse?: boolean,
    wet?: number
    dry?: number
}

const ReverbEffect: InstrumentLoader<ReverbEffectConfig> = (songState, config) => {
    const audioContext = songState.getContext();
    const {
        duration = 1,
        decay = 2,
        reverse = false
    } = config;
    const input = new ConvolverNode(audioContext);
    const output = input;

    buildImpulse();

    const syncTime = audioContext.currentTime - songState.rootTrackState.currentTime;
    if (syncTime > 0) {
        console.error(`ReverbEffect continued loading past buffer (${syncTime}).`)
    }

    return function connectReverbEffect(track: TrackState) {
        const {
            destination = audioContext.destination
        } = track;
        const {wet = 0.5, dry = 1} = config;
        const effectDestination = audioContext.createGain();
        output.connect(destination);

        // Mixer
        const wetGain = new GainNode(audioContext, {gain: wet});
        const dryGain = new GainNode(audioContext, {gain: dry});
        wetGain.connect(input)
        dryGain.connect(destination)

        // Connect to destination
        effectDestination.connect(wetGain);
        effectDestination.connect(dryGain);

        // Return track state object
        track.destination = effectDestination
    }

    function buildImpulse() {
        const durationSeconds = duration * (60 / songState.rootTrackState.beatsPerMinute)
        // based on https://github.com/clevertree/simple-reverb/
        let rate = audioContext.sampleRate
            , length = rate * durationSeconds
            // , decay = this.decay
            , impulse = audioContext.createBuffer(2, length, rate)
            , impulseL = impulse.getChannelData(0)
            , impulseR = impulse.getChannelData(1)
            , n, i;

        for (i = 0; i < length; i++) {
            n = reverse ? length - i : i;
            impulseL[i] = (Math.random() * 2 - 1) * Math.pow(1 - n / length, decay);
            impulseR[i] = (Math.random() * 2 - 1) * Math.pow(1 - n / length, decay);
        }

        input.buffer = impulse;
    }
}

export default ReverbEffect;
