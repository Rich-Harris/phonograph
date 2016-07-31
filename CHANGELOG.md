# phonograph changelog

## 1.3.0

* Implement `clip.dispose()`
* Allow multiple load attempts
* Create new promise for each `buffer()` attempt
* Distinguish between `loaderror` and `playbackerror`

## 1.2.2

* Prevent infinite loop with short frame length
* Fire `error` events
* Linting

## 1.2.1

* Ensure progress event on load

## 1.2.0

* VBR support

## 1.1.8

* Rebuild before publishing, d'oh...

## 1.1.7

* Coerce `length`

## 1.1.6

* Init on iOS, and export `init` function

## 1.1.5

* Better logging
* Differentiate between `progress` and `loadprogress` events

## 1.1.4

* Fix `onready` check

## 1.1.3

* Remove logging

## 1.1.2

* Fix XHR loader and Safari decoding

## 1.1.1

* Prevent audible seams

## 1.1.0

* Implement `clip.clone()`

## 1.0.1

* Include files in `pkg.files`

## 1.0.0

* First release
