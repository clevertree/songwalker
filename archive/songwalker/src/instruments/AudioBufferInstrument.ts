import {InstrumentLoader, SongWalkerState, TrackState} from "../types";
import {parseNote} from "..";
import {configEnvelope, EnvelopeConfig} from "./common/envelope";
import {configFilterByKeyRange, KeyRangeConfig} from "./common/filter";

const DEFAULT_FREQUENCY_ROOT = 220;


export interface AudioBufferInstrumentConfig extends EnvelopeConfig, KeyRangeConfig {
    title?: string,
    src: string | AudioBuffer,
    loop?: boolean,
    loopStart?: number,
    loopEnd?: number,
    pan?: number,
    detune?: number,
    frequencyRoot?: number | string
}

const AudioBufferInstrument: InstrumentLoader<AudioBufferInstrumentConfig> = async (songState: SongWalkerState, config) => {
    // console.log('AudioBufferInstrument', config, title);
    const {getContext, rootTrackState} = songState;
    const audioContext = getContext();
    let createSourceNode = await configAudioBuffer();
    let createGain = configEnvelope(audioContext, config);
    let filterNote = configFilterByKeyRange(config)

    const syncTime = audioContext.currentTime - rootTrackState.currentTime;
    if (syncTime > 0) {
        // TODO: shouldn't happen
        console.error(`AudioBufferInstrument continued loading past buffer (${syncTime}).`)
    }

    function playAudioBuffer(track: TrackState, command: string) {
        // TODO: check alias
        switch (command) {
            case 'play':
                return playAudioBufferNote(track)
            case 'stop':
                throw 'todo';
        }
        const noteInfo = parseNote(command);
        if (!noteInfo)
            throw new Error("Unrecognized note: " + command);
        if (filterNote(noteInfo))
            return;
        return playAudioBufferNote(track, noteInfo.frequency)
    }

    // Set this instrument if no root track instrument was set
    if (!songState.rootTrackState.instrument)
        songState.rootTrackState.instrument = playAudioBuffer;
    return playAudioBuffer

    function playAudioBufferNote(track: TrackState, frequency?: number) {
        let {
            beatsPerMinute,
            currentTime,
            duration,
            pan = 0
        } = {...config, ...track};

        // Envelope
        const gainNode = createGain(track);
        let destination = gainNode;

        // Panning
        if (pan) {
            const panNode = audioContext.createStereoPanner();
            panNode.pan.value = pan;
            panNode.connect(gainNode);
            destination = panNode;
        }

        // Audio Buffer
        const bufferNode = createSourceNode(destination, frequency)

        bufferNode.start(currentTime);
        if (typeof duration !== 'undefined') {
            const endTime = currentTime + (duration * (60 / beatsPerMinute));
            bufferNode.stop(endTime);
        }
        return bufferNode;
        // TODO: add active notes to track state?
    }

    async function configAudioBuffer() {
        let {
            src,
            loop = false,
            frequencyRoot = DEFAULT_FREQUENCY_ROOT,
            detune = 0
        } = config;
        let audioBuffer: AudioBuffer;
        if (typeof src === "string") {
            audioBuffer = await getCachedAudioBuffer(audioContext, src);
        } else {
            audioBuffer = src;
        }
        const parsedFrequencyRoot = getFrequencyRoot(frequencyRoot);
        return (destination: AudioNode, frequency?: number) => {
            const bufferNode = audioContext.createBufferSource();
            bufferNode.buffer = audioBuffer;
            bufferNode.detune.value = detune
            bufferNode.loop = loop;
            if (frequency) {
                bufferNode.playbackRate.value = frequency / parsedFrequencyRoot;
            }
            // Connect Source
            bufferNode.connect(destination);
            return bufferNode;
        }
    }

}
export default AudioBufferInstrument;

let cache = new Map<string, AudioBuffer>();


async function getCachedAudioBuffer(context: BaseAudioContext, src: string): Promise<AudioBuffer> {
    if (cache.has(src))
        return cache.get(src) as AudioBuffer;
    const response = await fetch(src, {signal: AbortSignal.timeout(5000)});
    if (response.status !== 200)
        throw new Error(`Failed to fetch audio file (${response.status} ${response.statusText}): ${src}`);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await context.decodeAudioData(arrayBuffer);
    cache.set(src, audioBuffer);
    return audioBuffer;
}


function getFrequencyRoot(frequencyRoot: number | string | null) {
    if (typeof frequencyRoot === "string") {
        const rootInfo = parseNote(frequencyRoot);
        if (!rootInfo)
            throw new Error("Invalid root frequency: " + frequencyRoot)
        return rootInfo.frequency;
    }
    return frequencyRoot || DEFAULT_FREQUENCY_ROOT;
}
