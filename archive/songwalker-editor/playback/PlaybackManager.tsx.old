import {SongWalker} from "@songwalker/walker";
import {HandlesTrackEvents, SongTrackEvent, TrackEventHandler} from "@songwalker/types";
import {compileSongToCallback} from "@songwalker/compiler";

export class PlaybackManager implements HandlesTrackEvents {

    // private activeSong: SongHandler | null = null;
    private trackEventHandlers: {
        [trackName: string]: Array<TrackEventHandler>
    } = {};

    loadSong(songSource: string) {
        const callback = compileSongToCallback(songSource)
        return new SongWalker(callback, this);
    }


    addTrackEventHandler(trackName: string, callback: TrackEventHandler) {
        if (!this.trackEventHandlers[trackName])
            this.trackEventHandlers[trackName] = [];
        this.trackEventHandlers[trackName].push(callback)
    }

    handleTrackEvent(trackName: string, trackEvent: SongTrackEvent, tokenID: number): void {
        const eventHandlers = this.trackEventHandlers[trackName];
        if (eventHandlers) {
            for (const eventHandler of eventHandlers) {
                eventHandler(trackEvent, tokenID)
            }
        }
    }

}

