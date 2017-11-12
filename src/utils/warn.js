"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function warn(msg) {
    console.warn(//eslint-disable-line no-console
    "%c\uD83D\uDD0A Phonograph.js %c" + msg, 'font-weight: bold;', 'font-weight: normal;');
    console.groupCollapsed(//eslint-disable-line no-console
    "%c\uD83D\uDD0A stack trace", 'font-weight: normal; color: #666;');
    var stack = new Error().stack
        .split('\n')
        .slice(2)
        .join('\n');
    console.log(//eslint-disable-line no-console
    "%c" + stack, 'display: block; font-weight: normal; color: #666;');
    console.groupEnd(); //eslint-disable-line no-console
}
exports.default = warn;
