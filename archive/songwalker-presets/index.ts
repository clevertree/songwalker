import {SongWalkerLibrary} from "./SongWalkerLibrary";
import {WebAudioFontLibrary} from "./WebAudioFont/WebAudioFontLibrary";
import {registerPresetBank} from "@songwalker/presets";

registerPresetBank(SongWalkerLibrary);
registerPresetBank(WebAudioFontLibrary);

export {
    SongWalkerLibrary
}
