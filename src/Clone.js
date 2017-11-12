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
var Clip_js_1 = require("./Clip.js");
var Clone = /** @class */ (function (_super) {
    __extends(Clone, _super);
    function Clone(original) {
        var _this = _super.call(this, { url: original.url }) || this;
        _this.original = original;
        return _this;
    }
    Clone.prototype.buffer = function () {
        return this.original.buffer();
    };
    Clone.prototype.clone = function () {
        return this.original.clone();
    };
    Object.defineProperty(Clone.prototype, "canplaythrough", {
        get: function () {
            return this.original.canplaythrough;
        },
        set: function (_) {
            // eslint-disable-line no-unused-vars
            // noop
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Clone.prototype, "loaded", {
        get: function () {
            return this.original.loaded;
        },
        set: function (_) {
            // eslint-disable-line no-unused-vars
            // noop
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Clone.prototype, "_chunks", {
        get: function () {
            return this.original._chunks;
        },
        set: function (_) {
            // eslint-disable-line no-unused-vars
            // noop
        },
        enumerable: true,
        configurable: true
    });
    return Clone;
}(Clip_js_1.default));
exports.default = Clone;
