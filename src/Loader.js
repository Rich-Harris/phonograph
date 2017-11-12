"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var FetchLoader = /** @class */ (function () {
    function FetchLoader(url) {
        this.url = url;
        this._cancelled = false;
    }
    FetchLoader.prototype.cancel = function () {
        this._cancelled = true;
    };
    FetchLoader.prototype.load = function (_a) {
        var _this = this;
        var onprogress = _a.onprogress, ondata = _a.ondata, onload = _a.onload, onerror = _a.onerror;
        this._cancelled = false;
        fetch(this.url)
            .then(function (response) {
            if (_this._cancelled)
                return;
            if (!response.ok) {
                onerror(new Error("Bad response (" + response.status + " \u2013 " + response.statusText + ")"));
                return;
            }
            var total = +response.headers.get('content-length') || 0;
            var length = 0;
            onprogress((total ? length : 0) / total, length, total);
            if (response.body) {
                var reader_1 = response.body.getReader();
                var read_1 = function () {
                    if (_this._cancelled)
                        return;
                    reader_1
                        .read()
                        .then(function (chunk) {
                        if (_this._cancelled)
                            return;
                        if (chunk.done) {
                            onprogress(1, length, length);
                            onload();
                        }
                        else {
                            length += chunk.value.length;
                            ondata(chunk.value);
                            onprogress((total ? length : 0) / total, length, total);
                            read_1();
                        }
                    })
                        .catch(onerror);
                };
                read_1();
            }
            else {
                // Firefox doesn't yet implement streaming
                response
                    .arrayBuffer()
                    .then(function (arrayBuffer) {
                    if (_this._cancelled)
                        return;
                    var uint8Array = new Uint8Array(arrayBuffer);
                    ondata(uint8Array);
                    onprogress(1, uint8Array.length, uint8Array.length);
                    onload();
                })
                    .catch(onerror);
            }
        })
            .catch(onerror);
    };
    return FetchLoader;
}());
exports.FetchLoader = FetchLoader;
var XhrLoader = /** @class */ (function () {
    function XhrLoader(url) {
        this.url = url;
        this._cancelled = false;
        this._xhr = null;
    }
    XhrLoader.prototype.cancel = function () {
        if (this._cancelled)
            return;
        this._cancelled = true;
        if (this._xhr) {
            this._xhr.abort();
            this._xhr = null;
        }
    };
    XhrLoader.prototype.load = function (_a) {
        var _this = this;
        var onprogress = _a.onprogress, ondata = _a.ondata, onload = _a.onload, onerror = _a.onerror;
        this._cancelled = false;
        var xhr = new XMLHttpRequest();
        xhr.responseType = 'arraybuffer';
        xhr.onerror = onerror;
        xhr.onload = function (e) {
            if (_this._cancelled)
                return;
            onprogress(e.loaded / e.total, e.loaded, e.total);
            ondata(new Uint8Array(xhr.response));
            onload();
            _this._xhr = null;
        };
        xhr.onprogress = function (e) {
            if (_this._cancelled)
                return;
            onprogress(e.loaded / e.total, e.loaded, e.total);
        };
        xhr.open('GET', this.url);
        xhr.send();
        this._xhr = xhr;
    };
    return XhrLoader;
}());
exports.XhrLoader = XhrLoader;
