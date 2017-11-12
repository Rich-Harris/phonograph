let context: AudioContext;

declare var webkitAudioContext: any;

export default function getContext() {
	return (
		context ||
		(context = new (typeof AudioContext !== 'undefined' ? AudioContext : webkitAudioContext)())
	);
}
