// Lightweight in-browser WAV encoder for fast transcription uploads
export function audioBufferToWav(buffer, optSampleRate = 16000) {
    const numChannels = 1; // Mono
    const sampleRate = optSampleRate;
    const format = 1; // PCM
    const bitDepth = 16;

    // Resample / average channels to mono
    const originalSampleRate = buffer.sampleRate;
    const originalLength = buffer.length;
    const ratio = sampleRate / originalSampleRate;
    const newLength = Math.round(originalLength * ratio);
    
    // Mixdown to mono
    const channelData = new Float32Array(newLength);
    const originalChannels = [];
    for (let c = 0; c < buffer.numberOfChannels; c++) {
        originalChannels.push(buffer.getChannelData(c));
    }

    for (let i = 0; i < newLength; i++) {
        const origIdx = Math.floor(i / ratio);
        let sum = 0;
        for (let c = 0; c < originalChannels.length; c++) {
            sum += originalChannels[c][origIdx] || 0;
        }
        channelData[i] = sum / originalChannels.length;
    }

    const dataByteLength = newLength * 2; // 16-bit = 2 bytes per sample
    const bufferArray = new ArrayBuffer(44 + dataByteLength);
    const view = new DataView(bufferArray);

    function writeString(view, offset, string) {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    }

    // RIFF identifier
    writeString(view, 0, 'RIFF');
    // RIFF chunk length
    view.setUint32(4, 36 + dataByteLength, true);
    // RIFF type
    writeString(view, 8, 'WAVE');
    // format chunk identifier
    writeString(view, 12, 'fmt ');
    // format chunk length
    view.setUint32(16, 16, true);
    // sample format (raw PCM)
    view.setUint16(20, format, true);
    // channel count
    view.setUint16(22, numChannels, true);
    // sample rate
    view.setUint32(24, sampleRate, true);
    // byte rate (sample rate * block align)
    view.setUint32(28, sampleRate * numChannels * (bitDepth / 8), true);
    // block align (channel count * bytes per sample)
    view.setUint16(32, numChannels * (bitDepth / 8), true);
    // bits per sample
    view.setUint16(34, bitDepth, true);
    // data chunk identifier
    writeString(view, 36, 'data');
    // data chunk length
    view.setUint32(40, dataByteLength, true);

    // Write PCM samples
    let offset = 44;
    for (let i = 0; i < newLength; i++) {
        let s = Math.max(-1, Math.min(1, channelData[i]));
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        offset += 2;
    }

    return new Blob([view], { type: 'audio/wav' });
}

export async function extractFastAudioBlob(file) {
    if (!file) return null;
    try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return null;

        const audioCtx = new AudioContextClass();
        const arrayBuffer = await file.arrayBuffer();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        audioCtx.close();

        return audioBufferToWav(audioBuffer, 16000);
    } catch (e) {
        console.warn('[FastAudio] Client audio extraction skipped, uploading video directly:', e);
        return null;
    }
}
