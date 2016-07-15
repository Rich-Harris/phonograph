export default class Chunk {
	constructor ({ clip, raw, onready }) {
		this.clip = clip;
		this.raw = raw;
		this.extended = raw;

		this.length = null;
		this.duration = null;
		this.ready = false;
		this._attached = false;

		this.callback = onready;

		this.length = null;
		this.duration = null;

		this.clip.context.decodeAudioData( raw.buffer, decoded => {
			this.length = decoded.length;
			this.duration = decoded.duration;

			this._ready();
		});
	}

	attach ( nextChunk ) {
		if ( nextChunk ) {
			this.next = nextChunk;

			const len = this.raw.length;
			this.extended = new Uint8Array( len + ( nextChunk.raw.length >> 1 ) );

			let i = 0;

			for ( ; i < len; i += 1 ) {
				this.extended[i] = this.raw[i];
			}

			for ( ; i < this.extended.length; i += 1 ) {
				this.extended[i] = nextChunk.raw[ i - len ];
			}
		}

		this._attached = true;
		this._ready();
	}

	createSource ( timeOffset, callback, errback ) {
		this.clip.context.decodeAudioData( this.extended.buffer, decoded => {
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

	onready ( callback ) {
		if ( this.length ) {
			setTimeout( callback );
		} else {
			this.callback = callback;
		}
	}

	_ready () {
		if ( this._attached && this.length ) {
			this.ready = true;

			if ( this.callback ) {
				this.callback();
				this.callback = null;
			}
		}
	}
}
