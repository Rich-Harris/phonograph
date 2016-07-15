import { getContext } from './getContext.js';
import { slice } from './utils/buffer.js';
import isFrameHeader from './utils/isFrameHeader.js';

let count = 1;

export default class Chunk {
	constructor ({ context, raw, onready }) {
		this.context = context;
		this.raw = raw;
		this.extended = null;

		this.duration = null;
		this.ready = false;

		this._attached = false;
		this._callback = onready;

		this.duration = null;

		this._firstByte = 0;

		const uid = count++;
		console.log( 'decoding', uid )

		const decode = ( callback, errback ) => {
			const buffer = ( this._firstByte ? slice( raw, this._firstByte, raw.length ) : raw ).buffer;

			this.context.decodeAudioData( buffer, callback, err => {
				if ( err ) console.log( 'err', err )
				if ( err ) return errback( err );

				// filthy hack taken from http://stackoverflow.com/questions/10365335/decodeaudiodata-returning-a-null-error
				// Thanks Safari developers, you absolute numpties
				for ( ; this._firstByte < raw.length - 1; this._firstByte += 1 ) {
					if ( isFrameHeader( raw, this._firstByte ) ) {
						return decode( callback, errback );
					}
				}

				console.log( 'what the actual fuck' );

				errback( new Error( 'Could not decode audio buffer' ) );
			});
		};

		decode( decoded => {
			console.log( 'successfully decoded', uid );
			this.duration = decoded.duration;
			this._ready();
		}, err => {
			console.error( 'decoding error', err );
		});

		setTimeout( () => {
			if ( !this.ready ) {
				console.log( 'not decoded', uid, this )
			}
		}, 1000 );
	}

	attach ( nextChunk ) {
		this.next = nextChunk;
		this._attached = true;

		this._ready();
	}

	createSource ( timeOffset, callback, errback ) {
		if ( !this.ready ) {
			console.log( 'this', this )
			console.log( 'this.ready', this.ready )
			console.log( 'this.extended', this.extended )
			throw new Error( 'Cannot create source if chunk is not ready' );
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
		if ( this._ready ) {
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
