"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var buffer_js_1 = require("./utils/buffer.js");
var isFrameHeader_js_1 = require("./utils/isFrameHeader.js");
var getFrameLength_js_1 = require("./utils/getFrameLength.js");
var Chunk = /** @class */ (function () {
    function Chunk(_a) {
        var clip = _a.clip, raw = _a.raw, onready = _a.onready, onerror = _a.onerror;
        var _this = this;
        this.clip = clip;
        this.context = clip.context;
        this.raw = raw;
        this.extended = null;
        this.duration = null;
        this.ready = false;
        this._attached = false;
        this._callback = onready;
        this._firstByte = 0;
        var decode = function (callback, errback) {
            var buffer = buffer_js_1.slice(raw, _this._firstByte, raw.length).buffer;
            _this.context.decodeAudioData(buffer, callback, function (err) {
                if (err)
                    return errback(err);
                _this._firstByte += 1;
                // filthy hack taken from http://stackoverflow.com/questions/10365335/decodeaudiodata-returning-a-null-error
                // Thanks Safari developers, you absolute numpties
                for (; _this._firstByte < raw.length - 1; _this._firstByte += 1) {
                    if (isFrameHeader_js_1.default(raw, _this._firstByte, clip._referenceHeader)) {
                        return decode(callback, errback);
                    }
                }
                errback(new Error("Could not decode audio buffer"));
            });
        };
        decode(function () {
            var numFrames = 0;
            for (var i = _this._firstByte; i < _this.raw.length; i += 1) {
                if (isFrameHeader_js_1.default(_this.raw, i, clip._referenceHeader)) {
                    numFrames += 1;
                    var frameLength = getFrameLength_js_1.default(_this.raw, i, clip.metadata);
                    i += frameLength - Math.min(frameLength, 4);
                }
            }
            _this.duration = numFrames * 1152 / clip.metadata.sampleRate;
            _this._ready();
        }, onerror);
    }
    Chunk.prototype.attach = function (nextChunk) {
        this.next = nextChunk;
        this._attached = true;
        this._ready();
    };
    Chunk.prototype.createSource = function (timeOffset, callback, errback) {
        var _this = this;
        if (!this.ready) {
            throw new Error('Something went wrong! Chunk was not ready in time for playback');
        }
        this.context.decodeAudioData(this.extended.buffer, function (decoded) {
            if (timeOffset) {
                var sampleOffset = ~~(timeOffset * decoded.sampleRate);
                var numChannels = decoded.numberOfChannels;
                var offset = _this.context.createBuffer(numChannels, decoded.length - sampleOffset, decoded.sampleRate);
                for (var chan = 0; chan < numChannels; chan += 1) {
                    var sourceData = decoded.getChannelData(chan);
                    var targetData = offset.getChannelData(chan);
                    for (var i = 0; i < sourceData.length - sampleOffset; i += 1) {
                        targetData[i] = sourceData[i + sampleOffset];
                    }
                }
                decoded = offset;
            }
            var source = _this.context.createBufferSource();
            source.buffer = decoded;
            callback(source);
        }, errback);
    };
    Chunk.prototype.onready = function (callback) {
        if (this.ready) {
            setTimeout(callback);
        }
        else {
            this._callback = callback;
        }
    };
    Chunk.prototype._ready = function () {
        if (this.ready)
            return;
        if (this._attached && this.duration !== null) {
            this.ready = true;
            if (this.next) {
                var rawLen = this.raw.length;
                var nextLen = this.next.raw.length >> 1; // we don't need the whole thing
                this.extended = new Uint8Array(rawLen + nextLen);
                var p = 0;
                for (var i = this._firstByte; i < rawLen; i += 1) {
                    this.extended[p++] = this.raw[i];
                }
                for (var i = 0; i < nextLen; i += 1) {
                    this.extended[p++] = this.next.raw[i];
                }
            }
            else {
                this.extended =
                    this._firstByte > 0
                        ? buffer_js_1.slice(this.raw, this._firstByte, this.raw.length)
                        : this.raw;
            }
            if (this._callback) {
                this._callback();
                this._callback = null;
            }
        }
    };
    return Chunk;
}());
exports.default = Chunk;
