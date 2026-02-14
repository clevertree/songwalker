export function generateRandomBuffer(context: BaseAudioContext) {
    const src = context.createBuffer(1, 8192, 44100);
    const audioBufferArray = src.getChannelData(0);
    for (let i = 0; i < 8192; i++) {
        audioBufferArray[i] = Math.sin((i % 168) / 168.0 * Math.PI * 2);
    }
    return src;
}
