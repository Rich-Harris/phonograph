"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
var Loader_1 = require("./Loader");
var Chunk_1 = require("./Chunk");
var Clone_1 = require("./Clone");
var getContext_1 = require("./getContext");
var buffer_1 = require("./utils/buffer");
var isFrameHeader_1 = require("./utils/isFrameHeader");
var parseMetadata_1 = require("./utils/parseMetadata");
var warn_1 = require("./utils/warn");
var CHUNK_SIZE = 64 * 1024;
var OVERLAP = 0.2;
var PhonographError = /** @class */ (function (_super) {
    __extends(PhonographError, _super);
    function PhonographError(message, opts) {
        var _this = _super.call(this, message) || this;
        _this.phonographCode = opts.phonographCode;
        _this.url = opts.url;
        return _this;
    }
    return PhonographError;
}(Error));
var Clip = /** @class */ (function () {
    function Clip(_a) {
        var url = _a.url, loop = _a.loop, volume = _a.volume;
        this.url = url;
        this.callbacks = {};
        this.context = getContext_1.default();
        this.loop = loop || false;
        this.buffered = 0;
        this.length = 0;
        this.loader = new (window.fetch ? Loader_1.FetchLoader : Loader_1.XhrLoader)(url);
        this.loaded = false;
        this.canplaythrough = false;
        this._currentTime = 0;
        this._volume = volume || 1;
        this._gain = this.context.createGain();
        this._gain.gain.value = this._volume;
        this._gain.connect(this.context.destination);
        this._chunks = [];
    }
    Clip.prototype.buffer = function (bufferToCompletion) {
        var _this = this;
        if (bufferToCompletion === void 0) { bufferToCompletion = false; }
        if (!this._loadStarted) {
            this._loadStarted = true;
            var tempBuffer_1 = new Uint8Array(CHUNK_SIZE * 2);
            var p_1 = 0;
            var loadStartTime_1 = Date.now();
            var totalLoadedBytes_1 = 0;
            var checkCanplaythrough_1 = function () {
                if (_this.canplaythrough || !_this.length)
                    return;
                var duration = 0;
                var bytes = 0;
                for (var _i = 0, _a = _this._chunks; _i < _a.length; _i++) {
                    var chunk = _a[_i];
                    if (!chunk.duration)
                        break;
                    duration += chunk.duration;
                    bytes += chunk.raw.length;
                }
                if (!duration)
                    return;
                var scale = _this.length / bytes;
                var estimatedDuration = duration * scale;
                var timeNow = Date.now();
                var elapsed = timeNow - loadStartTime_1;
                var bitrate = totalLoadedBytes_1 / elapsed;
                var estimatedTimeToDownload = 1.5 * (_this.length - totalLoadedBytes_1) / bitrate / 1e3;
                // if we have enough audio that we can start playing now
                // and finish downloading before we run out, we've
                // reached canplaythrough
                var availableAudio = bytes / _this.length * estimatedDuration;
                if (availableAudio > estimatedTimeToDownload) {
                    _this.canplaythrough = true;
                    _this._fire('canplaythrough');
                }
            };
            var drainBuffer_1 = function () {
                var isFirstChunk = _this._chunks.length === 0;
                var firstByte = isFirstChunk ? 32 : 0;
                var chunk = new Chunk_1.default({
                    clip: _this,
                    raw: buffer_1.slice(tempBuffer_1, firstByte, p_1),
                    onready: _this.canplaythrough ? null : checkCanplaythrough_1,
                    onerror: function (error) {
                        error.url = _this.url;
                        error.phonographCode = 'COULD_NOT_DECODE';
                        _this._fire('loaderror', error);
                    }
                });
                var lastChunk = _this._chunks[_this._chunks.length - 1];
                if (lastChunk)
                    lastChunk.attach(chunk);
                _this._chunks.push(chunk);
                p_1 = 0;
                return chunk;
            };
            this.loader.load({
                onprogress: function (progress, length, total) {
                    _this.buffered = length;
                    _this.length = total;
                    _this._fire('loadprogress', { progress: progress, length: length, total: total });
                },
                ondata: function (uint8Array) {
                    if (!_this.metadata) {
                        for (var i = 0; i < uint8Array.length; i += 1) {
                            // determine some facts about this mp3 file from the initial header
                            if (uint8Array[i] === 255 &&
                                (uint8Array[i + 1] & 240) === 240) {
                                // http://www.datavoyage.com/mpgscript/mpeghdr.htm
                                _this._referenceHeader = {
                                    mpegVersion: uint8Array[i + 1] & 8,
                                    mpegLayer: uint8Array[i + 1] & 6,
                                    sampleRate: uint8Array[i + 2] & 12,
                                    channelMode: uint8Array[i + 3] & 192
                                };
                                _this.metadata = parseMetadata_1.default(_this._referenceHeader);
                                break;
                            }
                        }
                    }
                    for (var i = 0; i < uint8Array.length; i += 1) {
                        // once the buffer is large enough, wait for
                        // the next frame header then drain it
                        if (p_1 > CHUNK_SIZE + 4 &&
                            isFrameHeader_1.default(uint8Array, i, _this._referenceHeader)) {
                            drainBuffer_1();
                        }
                        // write new data to buffer
                        tempBuffer_1[p_1++] = uint8Array[i];
                    }
                    totalLoadedBytes_1 += uint8Array.length;
                },
                onload: function () {
                    if (p_1) {
                        var lastChunk = drainBuffer_1();
                        lastChunk.attach(null);
                        totalLoadedBytes_1 += p_1;
                    }
                    _this._chunks[0].onready(function () {
                        if (!_this.canplaythrough) {
                            _this.canplaythrough = true;
                            _this._fire('canplaythrough');
                        }
                        _this.loaded = true;
                        _this._fire('load');
                    });
                },
                onerror: function (error) {
                    error.url = _this.url;
                    error.phonographCode = 'COULD_NOT_LOAD';
                    _this._fire('loaderror', error);
                    _this._loadStarted = false;
                }
            });
        }
        return new Promise(function (fulfil, reject) {
            var ready = bufferToCompletion ? _this.loaded : _this.canplaythrough;
            if (ready) {
                fulfil();
            }
            else {
                _this.once(bufferToCompletion ? 'load' : 'canplaythrough', fulfil);
                _this.once('loaderror', reject);
            }
        });
    };
    Clip.prototype.clone = function () {
        return new Clone_1.default(this);
    };
    Clip.prototype.connect = function (destination, output, input) {
        if (!this._connected) {
            this._gain.disconnect();
            this._connected = true;
        }
        this._gain.connect(destination, output, input);
        return this;
    };
    Clip.prototype.disconnect = function (destination, output, input) {
        this._gain.disconnect(destination, output, input);
    };
    Clip.prototype.dispose = function () {
        if (this.playing)
            this.pause();
        if (this._loadStarted) {
            this.loader.cancel();
            this._loadStarted = false;
        }
        this._currentTime = 0;
        this.loaded = false;
        this.canplaythrough = false;
        this._chunks = [];
        this._fire('dispose');
    };
    Clip.prototype.off = function (eventName, cb) {
        var callbacks = this.callbacks[eventName];
        if (!callbacks)
            return;
        var index = callbacks.indexOf(cb);
        if (~index)
            callbacks.splice(index, 1);
    };
    Clip.prototype.on = function (eventName, cb) {
        var _this = this;
        var callbacks = this.callbacks[eventName] || (this.callbacks[eventName] = []);
        callbacks.push(cb);
        return {
            cancel: function () { return _this.off(eventName, cb); }
        };
    };
    Clip.prototype.once = function (eventName, cb) {
        var _this = this;
        var _cb = function (data) {
            cb(data);
            _this.off(eventName, _cb);
        };
        return this.on(eventName, _cb);
    };
    Clip.prototype.play = function () {
        var _this = this;
        var promise = new Promise(function (fulfil, reject) {
            _this.once('ended', fulfil);
            _this.once('loaderror', reject);
            _this.once('playbackerror', reject);
            _this.once('dispose', function () {
                if (_this.ended)
                    return;
                var err = new PhonographError('Clip was disposed', {
                    phonographCode: 'CLIP_WAS_DISPOSED',
                    url: _this.url
                });
                reject(err);
            });
        });
        if (this.playing) {
            warn_1.default("clip.play() was called on a clip that was already playing (" + this.url + ")");
        }
        else if (!this.canplaythrough) {
            warn_1.default("clip.play() was called before clip.canplaythrough === true (" + this.url + ")");
            this.buffer().then(function () { return _this._play(); });
        }
        else {
            this._play();
        }
        this.playing = true;
        this.ended = false;
        return promise;
    };
    Clip.prototype.pause = function () {
        if (!this.playing) {
            warn_1.default("clip.pause() was called on a clip that was already paused (" + this.url + ")");
            return this;
        }
        this.playing = false;
        this._currentTime =
            this._startTime + (this.context.currentTime - this._contextTimeAtStart);
        this._fire('pause');
        return this;
    };
    Object.defineProperty(Clip.prototype, "currentTime", {
        get: function () {
            if (this.playing) {
                return (this._startTime + (this.context.currentTime - this._contextTimeAtStart));
            }
            else {
                return this._currentTime;
            }
        },
        set: function (currentTime) {
            if (this.playing) {
                this.pause();
                this._currentTime = currentTime;
                this.play();
            }
            else {
                this._currentTime = currentTime;
            }
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Clip.prototype, "duration", {
        get: function () {
            var total = 0;
            for (var _i = 0, _a = this._chunks; _i < _a.length; _i++) {
                var chunk = _a[_i];
                if (!chunk.duration)
                    return null;
                total += chunk.duration;
            }
            return total;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Clip.prototype, "volume", {
        get: function () {
            return this._volume;
        },
        set: function (volume) {
            this._gain.gain.value = this._volume = volume;
        },
        enumerable: true,
        configurable: true
    });
    Clip.prototype._fire = function (eventName, data) {
        var callbacks = this.callbacks[eventName];
        if (!callbacks)
            return;
        callbacks.slice().forEach(function (cb) { return cb(data); });
    };
    Clip.prototype._play = function () {
        var _this = this;
        var chunkIndex;
        var time = 0;
        for (chunkIndex = 0; chunkIndex < this._chunks.length; chunkIndex += 1) {
            var chunk_1 = this._chunks[chunkIndex];
            if (!chunk_1.duration) {
                warn_1.default("attempted to play content that has not yet buffered " + this.url);
                setTimeout(function () {
                    _this._play();
                }, 100);
                return;
            }
            var chunkEnd = time + chunk_1.duration;
            if (chunkEnd > this._currentTime)
                break;
            time = chunkEnd;
        }
        this._startTime = this._currentTime;
        var timeOffset = this._currentTime - time;
        this._fire('play');
        var playing = true;
        var pauseListener = this.on('pause', function () {
            playing = false;
            if (previousSource)
                previousSource.stop();
            if (currentSource)
                currentSource.stop();
            pauseListener.cancel();
        });
        var i = chunkIndex++ % this._chunks.length;
        var chunk = this._chunks[i];
        var previousSource;
        var currentSource;
        chunk.createSource(timeOffset, function (source) {
            currentSource = source;
            _this._contextTimeAtStart = _this.context.currentTime;
            var lastStart = _this._contextTimeAtStart;
            var nextStart = _this._contextTimeAtStart + (chunk.duration - timeOffset);
            var gain = _this.context.createGain();
            gain.connect(_this._gain);
            gain.gain.setValueAtTime(0, nextStart + OVERLAP);
            source.connect(gain);
            source.start(_this.context.currentTime);
            var endGame = function () {
                if (_this.context.currentTime >= nextStart) {
                    _this.pause()._currentTime = 0;
                    _this.ended = true;
                    _this._fire('ended');
                }
                else {
                    requestAnimationFrame(endGame);
                }
            };
            var advance = function () {
                if (!playing)
                    return;
                var i = chunkIndex++;
                if (_this.loop)
                    i %= _this._chunks.length;
                chunk = _this._chunks[i];
                if (chunk) {
                    chunk.createSource(0, function (source) {
                        previousSource = currentSource;
                        currentSource = source;
                        var gain = _this.context.createGain();
                        gain.connect(_this._gain);
                        gain.gain.setValueAtTime(0, nextStart);
                        gain.gain.setValueAtTime(1, nextStart + OVERLAP);
                        source.connect(gain);
                        source.start(nextStart);
                        lastStart = nextStart;
                        nextStart += chunk.duration;
                        gain.gain.setValueAtTime(0, nextStart + OVERLAP);
                        tick();
                    }, function (error) {
                        error.url = _this.url;
                        error.phonographCode = 'COULD_NOT_CREATE_SOURCE';
                        _this._fire('playbackerror', error);
                    });
                }
                else {
                    endGame();
                }
            };
            var tick = function () {
                if (_this.context.currentTime > lastStart) {
                    advance();
                }
                else {
                    setTimeout(tick, 500);
                }
            };
            var frame = function () {
                if (!playing)
                    return;
                requestAnimationFrame(frame);
                _this._fire('progress');
            };
            tick();
            frame();
        }, function (error) {
            error.url = _this.url;
            error.phonographCode = 'COULD_NOT_START_PLAYBACK';
            _this._fire('playbackerror', error);
        });
    };
    return Clip;
}());
exports.default = Clip;
