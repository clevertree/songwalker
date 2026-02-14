import {TrackState} from "../..";

export interface EnvelopeConfig {
    mixer?: number,
    attack?: number,
    // hold?: number,
    // decay?: number,
    // sustain?: number,
    release?: number
}

export function updateEnvelopeConfig(config: EnvelopeConfig, track: TrackState, command: string) {
    const {duration = 0} = track;
    switch (command) {
        case 'attack':
            config.attack = duration * (60 / track.beatsPerMinute)
            return;
        case 'release':
            config.release = duration * (60 / track.beatsPerMinute)
            return;
    }
    throw new Error("Unknown config key: " + command);
}

export function configEnvelope(context: BaseAudioContext, config: EnvelopeConfig): (track: TrackState) => AudioNode {
    // Attack is the time taken for initial run-up of level from nil to peak, beginning when the key is pressed.
    // if (config.mixer || config.attack) {
    return (track: TrackState) => {
        let {attack = 0, mixer = 1, release = 0} = config;
        const {
            currentTime, velocity = 128, velocityDivisor = 128,
            destination = context.destination
        } = track
        let gainNode = context.createGain();
        gainNode.connect(destination);
        const amplitude = mixer * (velocity / velocityDivisor);
        if (attack) {
            gainNode.gain.value = 0;
            gainNode.gain.linearRampToValueAtTime(amplitude, currentTime + (attack));
            console.log('attack', {currentTime, attack})
        } else {
            gainNode.gain.value = amplitude;
        }
        return gainNode;
    }
    // }
    // return (trackState: TrackState) => trackState.destination;
}
