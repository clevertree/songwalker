export async function addMIDIEventListener(callback: (ev: MIDIMessageEvent) => any) {
    // TODO: wait for user input
    // console.log('navigator.requestMIDIAccess', navigator, navigator.requestMIDIAccess);

    // console.info("MIDI initializing");
    const MIDI = await navigator.requestMIDIAccess()
    // console.info("MIDI initialized", MIDI);
    MIDI.inputs.forEach(
        (inputDevice) => {
            // @ts-ignore
            inputDevice.addEventListener('midimessage', callback);
        }
    );
    console.log("MIDI input devices detected: ", ...MIDI.inputs);
}

export async function removeMIDIEventListener(callback: (ev: MIDIMessageEvent) => any) {
    const MIDI = await navigator.requestMIDIAccess()
    // console.info("MIDI initialized", MIDI);
    MIDI.inputs.forEach(
        (inputDevice) => {
            // @ts-ignore
            inputDevice.removeEventListener('midimessage', callback);
        }
    );
    console.log("MIDI input devices detected: ", ...MIDI.inputs);
}