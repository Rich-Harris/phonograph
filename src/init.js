"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var getContext_1 = require("./getContext");
var inited;
window.addEventListener('touchend', init, false);
// https://paulbakaus.com/tutorials/html5/web-audio-on-ios/
function init() {
    if (inited)
        return;
    var context = getContext_1.default();
    // create a short empty buffer
    var buffer = context.createBuffer(1, 1, 22050);
    var source = context.createBufferSource(); // needs to be `any` to avoid type errors below
    source.buffer = buffer;
    source.connect(context.destination);
    source.start(context.currentTime);
    setTimeout(function () {
        if (!inited) {
            if (source.playbackState === source.PLAYING_STATE ||
                source.playbackState === source.FINISHED_STATE) {
                inited = true;
                window.removeEventListener('touchend', init, false);
            }
        }
    });
}
exports.default = init;
