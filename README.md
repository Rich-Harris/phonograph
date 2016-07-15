# phonograph

Stream large audio files without the dreaded 'DOMException: play() can only be initiated by a user gesture' error.

## The problem

You want to play some audio in your web app, but you don't want to use an `<audio>` element because mobile browser makers – in their infinite wisdom – have decided that playback must be initiated by a 'user gesture'.

You've read about the Web Audio API, in particular the [AudioBuffer](https://developer.mozilla.org/en-US/docs/Web/API/AudioBuffer), which seems like it might be useful except for the bit that says it's 'designed to hold small audio snippets, typically less than 45s'. And they're not kidding about that – not only do you have to fetch the entire file before you can play it, but you have to have enough spare RAM to store the uncompressed PCM data (aka .wav – typically ten times the size of the source .mp3) otherwise the browser will crash instantly.


## The solution

By breaking up the data into small chunks, we can use `decodeAudioData` to create a few seconds of PCM data at a time, making it very unlikely that we'll crash the browser.

By using the `fetch()` API, we can stream the data rather than waiting for the whole file to load. *[That's so fetch!](https://jakearchibald.com/2015/thats-so-fetch/)* (On antiquated browsers like iOS Safari, it falls back to regular old XHR – no streaming, but we still get chunking.)


## Installation

```bash
npm i phonograph
```

...or download from [npmcdn.com/phonograph](https://npmcdn.com/phonograph).


## Usage

```js
import { Clip } from 'phonograph';

const clip = new Clip({ url: 'some-file.mp3' });

clip.buffer().then( () => {
  clip.play();
});
```


## API

```js
import { Clip, getContext } from 'phonograph';

context = getContext();
// returns the AudioContext shared by all clips. Saves you having
// to create your own.


/* ------------------------ */
/*       INSTANTIATION      */
/* ------------------------ */

clip = new Clip({
  url: 'some-file.mp3', // Required
  volume: 0.5           // Optional (default 1)
});


/* ------------------------ */
/*          METHODS         */
/* ------------------------ */

promise = clip.buffer( complete ).then( ... );
// Returns a Promise that resolves on 'canplaythrough' event (see
// below) or (if `complete === true`) on 'load' event. The `complete`
// parameter is optional and defaults to `false`

clone = clip.clone();
// Returns a lightweight clone of the original clip, which can
// be played independently but shares audio data with the original.

clip.connect( destination, output, input );
// Connects to a specific AudioNode. All clips are initially
// connected to the default AudioContext's `destination` –
// if you connect to another node then it will disconnect
// from the default. `output` and `input` are optional. See
// https://developer.mozilla.org/en-US/docs/Web/API/AudioNode/connect(AudioNode)

clip.disconnect( destination, output, input );
// Disconnects from the `destination` (if specified). All
// parameters are optional – see
// https://developer.mozilla.org/en-US/docs/Web/API/AudioNode/disconnect

listener = clip.on( eventName, callback );
// Listen for an event (see below)

listener.cancel();
// Equivalent to `clip.off( eventName, callback )`

clip.off( eventName, callback );
// Stop listening for the specified event

listener = clip.once( eventName, callback );
// Listen for an event, but stop listening once it's happened

clip.play();
// Starts playing the clip

clip.pause();
// Stops playing the clip


/* ------------------------ */
/*        PROPERTIES        */
/* ------------------------ */

clip.canplaythrough;
// Whether or not Phonograph estimates that the clip can be played
// all the way through (i.e. all the data will download before the
// end is reached)

clip.currentTime;
// The position of the 'playhead', in seconds

clip.duration;
// Duration of the audio, in seconds. Returns `null` if the
// clip has not yet loaded. Read-only

clip.loaded;
// Whether the clip has finished fetching data

clip.loop;
// If `true`, the clip will restart once it finishes

clip.volume;
// Volume between 0 (silent) and 1 (max)


/* ------------------------ */
/*          EVENTS          */
/* ------------------------ */

clip.on( 'progress', ( progress, length, total ) => {
  // Fires when data is fetched. `progress` is a value
  // between 0 and 1, equal to `length / total` (both
  // measured in bytes)
  progressBar.value = value;
  const percent = progress * 100;
  status.textContent = `${percent.toFixed(1)}% loaded`;
});

clip.on( 'canplaythrough', () => {
  // Phonograph estimates (based on clip size and bandwidth)
  // that it will be able to play the clip through without
  // stopping. YMMV!
  clip.play();
});

clip.on( 'load', () => {
  // All the audio data has been loaded
  clip.play();
});

clip.on( 'play', () => {
  button.textContent = 'pause';
});

clip.on( 'pause', () => {
  button.textContent = 'play';
});

clip.on( 'ended', () => {
  // Clip has ended
  alert( 'that\'s all, folks!' );
});
```


## Caveats and limitations

* This has only been tested with mp3 files with a sample rate of 44.1kHz
* It doesn't yet handle network errors particularly gracefully
* No automated tests. I have no idea how you would test something like this.


## License

MIT
