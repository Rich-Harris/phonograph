export default class Chunk {
	constructor ({ clip, raw, ondecode }) {
		this.clip = clip;
		this.buffer = raw.buffer;

		this.length = null;
		this.duration = null;

		this.decode( decoded => {
			this.length = decoded.length;
			this.duration = decoded.duration;

			if ( ondecode ) ondecode();
		});
	}

	decode ( callback, errback ) {
		this.clip.context.decodeAudioData( this.buffer, callback, errback );
	}
}
