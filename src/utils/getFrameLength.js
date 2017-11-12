"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// http://mpgedit.org/mpgedit/mpeg_format/mpeghdr.htm
var bitrateLookup = {
    11: [null, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448],
    12: [null, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384],
    13: [null, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],
    21: [null, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256],
    22: [null, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160]
};
bitrateLookup[23] = bitrateLookup[22];
function getFrameLength(data, i, metadata) {
    var mpegVersion = metadata.mpegVersion;
    var mpegLayer = metadata.mpegLayer;
    var sampleRate = metadata.sampleRate;
    var bitrateCode = (data[i + 2] & 240) >> 4;
    var bitrate = bitrateLookup["" + mpegVersion + mpegLayer][bitrateCode] * 1e3;
    var padding = (data[2] & 2) >> 1;
    var length = ~~(mpegLayer === 1
        ? (12 * bitrate / sampleRate + padding) * 4
        : 144 * bitrate / sampleRate + padding);
    return length;
}
exports.default = getFrameLength;
