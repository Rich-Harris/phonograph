import { getContext } from './getContext.js';
import { slice } from './utils/buffer.js';
import isFrameHeader from './utils/isFrameHeader.js';
import getFrameLength from './utils/getFrameLength.js';

export default class Chunk {
	constructor ({ context, raw, onready, metadata, referenceHeader }) {
		this.context = context;
		this.raw = raw;
		this.extended = null;

		this.duration = null;
		this.ready = false;

		this._attached = false;
		this._callback = onready;

		this._firstByte = 0;

		const decode = ( callback, errback ) => {
			const buffer = ( this._firstByte ? slice( raw, this._firstByte, raw.length ) : raw ).buffer;

			this.context.decodeAudioData( buffer, callback, err => {
				if ( err ) return errback( err );

				this._firstByte += 1;

				// filthy hack taken from http://stackoverflow.com/questions/10365335/decodeaudiodata-returning-a-null-error
				// Thanks Safari developers, you absolute numpties
				for ( ; this._firstByte < raw.length - 1; this._firstByte += 1 ) {
					if ( isFrameHeader( raw, this._firstByte, referenceHeader ) ) {
						return decode( callback, errback );
					}
				}

				errback( new Error( 'Could not decode audio buffer' ) );
			});
		};

		decode( decoded => {
			let numFrames = 0;

			for ( let i = this._firstByte; i < this.raw.length; i += 1 ) {
				if ( isFrameHeader( this.raw, i, referenceHeader ) ) {
					numFrames += 1;

					const frameLength = getFrameLength( this.raw, i, metadata );
					i += frameLength - Math.min( frameLength, 4 );
				}
			}

			this.duration = ( numFrames * 1152 / metadata.sampleRate );
			this._ready();
		}, err => {
			throw err;
		});
	}

	attach ( nextChunk ) {
		this.next = nextChunk;
		this._attached = true;

		this._ready();
	}

	createSource ( timeOffset, callback, errback ) {
		if ( !this.ready ) {
			throw new Error( 'Something went wrong! Chunk was not ready in time for playback' );
		}

		this.context.decodeAudioData( this.extended.buffer, decoded => {
			if ( timeOffset ) {
				const sampleOffset = ~~( timeOffset * decoded.sampleRate );
				const numChannels = decoded.numberOfChannels;

				const offset = this.context.createBuffer( numChannels, decoded.length - sampleOffset, decoded.sampleRate );

				for ( let chan = 0; chan < numChannels; chan += 1 ) {
					const sourceData = decoded.getChannelData( chan );
					const targetData = offset.getChannelData( chan );

					for ( let i = 0; i < sourceData.length - sampleOffset; i += 1 ) {
						targetData[i] = sourceData[ i + sampleOffset ];
					}
				}

				decoded = offset;
			}

			const source = this.context.createBufferSource();
			source.buffer = decoded;

			callback( source );
		}, errback );
	}

	onready ( callback ) {
		if ( this.ready ) {
			setTimeout( callback );
		} else {
			this._callback = callback;
		}
	}

	_ready () {
		if ( this.ready ) return;

		if ( this._attached && this.duration !== null ) {
			this.ready = true;

			if ( this.next ) {
				const rawLen = this.raw.length;
				const nextLen = this.next.raw.length >> 1; // we don't need the whole thing

				this.extended = new Uint8Array( rawLen + nextLen );

				let p = 0;

				for ( let i = this._firstByte; i < rawLen; i += 1 ) {
					this.extended[p++] = this.raw[i];
				}

				for ( let i = 0; i < nextLen; i += 1 ) {
					this.extended[p++] = this.next.raw[i];
				}
			} else {
				this.extended = this._firstByte > 0 ?
					slice( this.raw, this._firstByte, this.raw.length ) :
					this.raw;
			}

			if ( this._callback ) {
				this._callback();
				this._callback = null;
			}
		}
	}
}
