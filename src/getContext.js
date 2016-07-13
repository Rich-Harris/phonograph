let context;

export default function getContext () {
	return context || ( context = new ( window.AudioContext || window.webkitAudioContext )() );
}
