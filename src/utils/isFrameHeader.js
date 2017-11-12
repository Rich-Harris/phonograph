"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// http://www.mp3-tech.org/programmer/frame_header.html
// frame header starts with 'frame sync' – eleven 1s
function isFrameHeader(data, i, metadata) {
    if (data[i + 0] !== 255 || (data[i + 1] & 240) !== 240)
        return false;
    return ((data[i + 1] & 6) !== 0 &&
        (data[i + 2] & 240) !== 240 &&
        (data[i + 2] & 12) !== 12 &&
        (data[i + 3] & 3) !== 2 &&
        (data[i + 1] & 8) === metadata.mpegVersion &&
        (data[i + 1] & 6) === metadata.mpegLayer &&
        (data[i + 2] & 12) === metadata.sampleRate &&
        (data[i + 3] & 192) === metadata.channelMode);
}
exports.default = isFrameHeader;
