"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var mpegVersionLookup = {
    0: 2,
    1: 1
};
var mpegLayerLookup = {
    1: 3,
    2: 2,
    3: 1
};
var sampleRateLookup = {
    0: 44100,
    1: 48000,
    2: 32000
};
var channelModeLookup = {
    0: 'stereo',
    1: 'joint stereo',
    2: 'dual channel',
    3: 'mono'
};
function parseMetadata(metadata) {
    var mpegVersion = mpegVersionLookup[metadata.mpegVersion >> 3];
    return {
        mpegVersion: mpegVersion,
        mpegLayer: mpegLayerLookup[metadata.mpegLayer >> 1],
        sampleRate: sampleRateLookup[metadata.sampleRate >> 2] / mpegVersion,
        channelMode: channelModeLookup[metadata.channelMode >> 6]
    };
}
exports.default = parseMetadata;
