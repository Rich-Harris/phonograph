import getContext from './getContext';

let inited: boolean;

window.addEventListener('touchend', init, false);

// https://paulbakaus.com/tutorials/html5/web-audio-on-ios/
export default function init() {
	if (inited) return;

	const context: AudioContext = getContext();

	// create a short empty buffer
	var buffer = context.createBuffer(1, 1, 22050);
	var source: any = context.createBufferSource(); // needs to be `any` to avoid type errors below
	source.buffer = buffer;
	source.connect(context.destination);

	source.start(context.currentTime);

	setTimeout(() => {
		if (!inited) {
			if (
				source.playbackState === source.PLAYING_STATE ||
				source.playbackState === source.FINISHED_STATE
			) {
				inited = true;
				window.removeEventListener('touchend', init, false);
			}
		}
	});
}
