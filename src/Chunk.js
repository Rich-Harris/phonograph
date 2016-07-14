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

	createSource ( timeOffset, callback, errback ) {
		this.decode( decoded => {
			if ( timeOffset ) {
				const sampleOffset = ~~( timeOffset * decoded.sampleRate );
				const numChannels = decoded.numberOfChannels;

				const offset = this.clip.context.createBuffer( numChannels, decoded.length - sampleOffset, decoded.sampleRate );

				for ( let chan = 0; chan < numChannels; chan += 1 ) {
					const sourceData = decoded.getChannelData( chan );
					const targetData = offset.getChannelData( chan );

					for ( let i = 0; i < sourceData.length - sampleOffset; i += 1 ) {
						targetData[i] = sourceData[ i + sampleOffset ];
					}
				}

				decoded = offset;
			}

			const source = this.clip.context.createBufferSource();
			source.buffer = decoded;

			callback( source );
		}, errback );
	}

	decode ( callback, errback ) {
		this.clip.context.decodeAudioData( this.buffer, callback, errback );
	}

	play () {
		this.decode
	}
}
