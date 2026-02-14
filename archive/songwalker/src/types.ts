// export type TokenItem = [name: string, content: TokenList | string]

// export type TokenItemOrString = TokenItem | string


// export type TokenList = Array<TokenItem | string>


export type SongError = {
    message: string;
    tokenID?: number;
    trackName?: string;
}


export interface OverrideAliases {
    '@': keyof TrackState,
    '^': keyof TrackState
}


export interface ParsedNote {
    note: string,
    octave: number,
    frequency: number,
}


// export type TrackEventHandler = (trackEvent: SongTrackEvent, tokenID: number) => void;

export interface HandlesTrackEvents {
    handleTrackEvent(trackName: string, trackEvent: SongTrackEvent, tokenID: number): void;
}

export interface TrackState {
    // Required
    currentTime: number,    // Actual time
    position: number,      // Positional time (in beats)
    beatsPerMinute: number,

    // Optional
    instrument?: InstrumentInstance,
    effects?: Array<InstrumentInstance>,
    duration?: number,
    velocity?: number,
    velocityDivisor?: number,
    pan?: number,
    destination?: AudioNode,

    // Track-specific
    trackDuration?: number,
    // trackStart?: number,
    custom?: any
}

export type TrackStateOverrides = {
    [param in keyof TrackState]?: TrackState[param]
}
export type TrackStateOverrideCallback = TrackStateOverrides | ((songState: SongWalkerState) => TrackStateOverrides)

export interface TrackContext {
    parent: TrackState,
    overrides: TrackStateOverrides
}

export type TrackCallback = (this: TrackContext, ...args: any[]) => void


export interface SongWalkerState {
    getContext(): BaseAudioContext

    bufferDuration: number,
    rootTrackState: TrackState
    wait: (track: TrackState, duration: number) => Promise<boolean>
    // waitForTrackToFinish: (track: TrackState) => Promise<void>
    // waitForSongToFinish: () => Promise<void>
    loadPreset: (presetID: string, config: object) => Promise<InstrumentInstance>,
    execute: (track: TrackState, command: string, overrides?: TrackStateOverrides) => void
    executeCallback: (track: TrackState, callback: TrackCallback, overrides?: TrackStateOverrides) => void
    // parseCommand: (commandString: string) => CommandWithOverrides,
    parseNote: (noteString: string) => ParsedNote
    // parseAndExecute: (track: TrackState, commandString: string, additionalParams?: CommandParams) => void
    // executeCallback: (track: TrackState, callback: (...args: any[]) => any, ...args: any[]) => void
}

export type SongCallback = (songState: SongWalkerState) => Promise<void>;

export interface SongTrackEvent {
    waitForEventStart: () => Promise<void>,
    waitForEventEnd: () => Promise<void>,
}


/** Instrument */


// export type InstrumentInstance = (trackState: TrackState, command: string) => NoteHandler;
export type InstrumentInstance = (track: TrackState,
                                  command: string) => void | AudioScheduledSourceNode;

export type InstrumentLoader<Config = any> = (song: SongWalkerState, config: Config) => Promise<InstrumentInstance> | InstrumentInstance

/** Presets */

export type PresetBank = () => Generator<Preset> | AsyncGenerator<Preset>


// export type PresetType = 'instrument' | 'drum-kit' | 'effect'

export type Preset<Config = any> = {
    title: string,
    // type: PresetType,
    // alias?: string,
    loader: InstrumentLoader<Config>,
    config: Config
}
