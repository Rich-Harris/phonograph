"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var context;
function getContext() {
    return (context ||
        (context = new (typeof AudioContext !== 'undefined' ? AudioContext : webkitAudioContext)()));
}
exports.default = getContext;
