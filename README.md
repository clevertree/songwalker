# SongWalker (v2.0 Architecture in Progress)

> **⚠️ Note:** This project is currently undergoing a complete rewrite to a Rust-based Core + Web Editor Monorepo architecture. The legacy Next.js implementation has been archived.

Write songs & learn to program!

## New Structure

- **`songwalker_core/`**: Rust library for parsing, compiling the `.sw` language, and DSP.
- **`songwalker_web/`**: Next-gen Web Editor (WASM driven).
- **`archive/`**: Legacy codebase.

## Demo (Legacy)

https://song-walker.vercel.app/

## Concept

SongWalker is a music programming language that compiles into an internal event list for high-precision scheduling. It allows writing songs of *unlimited* potential, unconstrained by standard DAW limitations.

## SongWalker Code Examples (Language Preview)

Here is a preview of the new syntax (v2):

### Playing Tracks

```javascript
// Define a riff
track riff(inst) {
    C3 /2
    Eb3 .  // dot shorthand
}

// Play it
riff(lead)
riff(bass)*90 // with 90 velocity
``` 

### Legacy Documentation below...

### Loading Instruments

This code loads a guitar sample bank as a `lead`, an oscillator as `osc`,
a percussion set `perc` and a reverb effect `reverb`.

```javascript
const lead = await loadPreset(/FluidR3.*\/.*Guitar/i) // Load first matching preset
const osc = await loadPreset("Oscillator", {'type': 'square', mixer: 0.4})
const perc = await loadPreset("FluidR3_GM/Room 1")
const reverb = await loadPreset("Reverb")
```

### Setting track / global variables

SongWalker auto-generates the variable `track` to represent the current playing track

```javascript
track.beatsPerMinute = 160;
```

### Playing Tracks

This code plays both tracks `track1` (with an guitar sample instrument) and `beat1`
simultaneously, then **waits 8 beats**, then plays both tracks again, but this time `track1` uses an oscillator
instrument.

```
track1(lead); beat1^96@4; 8
track1(osc); beat1@7; 8
```

### Defining Tracks

This code defines a track function. Track functions differ from normal javascript functions
because they generate a local `track` variable which represents the current track state.
By changing this track state, we can switch up or reconfigure instruments and effects.

```
track track1(instrument) {
    track.effects = [reverb];           // This track will use the reverb effect only
    track.instrument = instrument;      // Instrument is set to the parameter variable
    track.duration=1/4                  // Note duration will be 1/4th a beat
    C3 /2                               // Play C3, wait 1/2 beat
    C2@/2 /2                            // override note duration with 1/2 beat
    G2 /2                               // Play G2, wait 1/2 beat
    Eb2 /2                              // Play Eb2, wait 1/2 beat
    Eb3 /2                              // Play Eb3, wait 1/2 beat
    F3 /2                               // Play F3, wait 1/2 beat
    Eb3 /2                              // Play Eb3, wait 1/2 beat
    D3 /2                               // Play D3, wait 1/2 beat
    C3 /2                               // Play C3, wait 1/2 beat
    C2 /2                               // Play C2, wait 1/2 beat
    G2 /2                               // Play G2, wait 1/2 beat
    Eb2 /2                              // Play Eb2, wait 1/2 beat
    D3 /2                               // Play D3, wait 1/2 beat
    C2 /2                               // Play C2, wait 1/2 beat
    Bb2 /2                              // Play Bb2, wait 1/2 beat
}
```

Define a percussion track with no parameters

```
track beat1() {
    track.instrument=perc               // Set track instrument to percussion kit
    track.velocityDivisor=10            // Set velocity devisor to 10
    chh^3           /2                  // Play CloseHiHat at 3/10 velocity, wait 1/2
    chh^3           /2                  // Play CloseHiHat at 3/10 velocity, wait 1/2
    chh     as      /2                  // Play CloseHiHat & Acoustic Snare, wait 1/2
    chh^3@/8        /2                  // Play CloseHiHat at 3/10 velocity, wait 1/2
    chh     abd     /2                  // Play CloseHiHat & Base Drum, wait 1/2
    chh^3   abd^6   /2                  // Play CloseHiHat at 3/10 velocity, wait 1/2
    chh     as      /2                  // Play CloseHiHat & Acoustic Snare, wait 1/2
    chh^3           /4                  // Play CloseHiHat at 3/10 velocity, wait 1/4
    chh^3           /4                  // Play CloseHiHat at 3/10 velocity, wait 1/4
    chh     abd     /2                  // Play CloseHiHat & Base Drum, wait 1/2
    chh^3           /2                  // Play CloseHiHat at 3/10 velocity, wait 1/2
    chh     as      /2                  // Play CloseHiHat & Acoustic Snare, wait 1/2
    chh^3           /2                  // Play CloseHiHat at 3/10 velocity, wait 1/2
    chh     abd     /2                  // Play CloseHiHat & Base Drum, wait 1/2
    chh^3   abd^6   /2                  // Play CloseHiHat at 3/10 velocity, wait 1/2
    chh     as      /2                  // Play CloseHiHat & Acoustic Snare, wait 1/2
    ohh^3@/3        /2                  // Play OpenHiHat at 3/10 velocity, wait 1/2
}
```

## Render a Song File

```javascript
import {compileSongToCallback, renderSong} from "@songwalker";

const song = compileSongToCallback(SONG_SOURCE);
await renderSong(song);
```

## Preset Library

SongWalker Preset Library comes with all presets from [WebAudioFont](https://github.com/clevertree/webaudiofontdata/)

See [index](https://surikov.github.io/webaudiofontdata/sound/) of wavetables

- [GeneralUserGS.sf2 license](http://www.schristiancollins.com/generaluser.php)
- [FluidR3.sf2 license](https://github.com/musescore/MuseScore/blob/master/share/sound/FluidR3Mono_License.md)

Main project - [WebAudioFont](https://surikov.github.io/webaudiofont/)

## Looking for help

If you're interested in contributing to this project please contact me at [ari@asu.edu](mailto:ari@asu.edu)
