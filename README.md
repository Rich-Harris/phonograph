# phonograph

Play audio files without the dreaded 'DOMException: play() can only be initiated by a user gesture' error.

## The problem

You're building a web app that uses audio. Perhaps you have multiple tracks that need to play alongside one another. Some of those files will play in the future – maybe you don't yet know exactly when – and you haven't loaded them yet. Crucially, this all needs to work on mobile, whereby attempting to call `audio.play()` on an HTML5 `<audio>` element will cause a DOMException to be raised unless it happens inside the handler of a whitelisted event - in other words, you can't play new audio without a user gesture.


## The solution

Using the Web Audio API's `AudioBufferSourceNode` we can load the audio, convert it to PCM data, and play it without user interaction. But that's less than ideal with large files, because streaming is extremely difficult (or in some cases impossible) and you have to store the PCM data in memory – and it could be tens of megabytes for a ~5Mb mp3 file, enough to crash mobile browsers.

Phonograph solves this problem by only storing chunks of PCM data, and using `fetch()` where possible to facilitate streaming.


## Installation

```bash
npm i phonograph
```

...or download from [npmcdn.com/phonograph](https://npmcdn.com/phonograph).


## Usage

```js
import { Clip } from 'phonograph';

const clip = new Clip({ url: 'large-file.mp3' });

clip.buffer().then( () => {
	clip.play();
});
```


## License

MIT
