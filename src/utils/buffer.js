"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function slice(view, start, end) {
    if (view.slice) {
        return view.slice(start, end);
    }
    var clone = new Uint8Array(end - start);
    var p = 0;
    for (var i = start; i < end; i += 1) {
        clone[p++] = view[i];
    }
    return clone;
}
exports.slice = slice;
