import { getContext } from './getContext.js';
import { slice } from './utils/buffer.js';
import isFrameHeader from './utils/isFrameHeader.js';
import parseHeader from './utils/parseHeader.js';

let count = 1;

export default class Chunk {
	constructor ({ context, raw, onready, metadata, bits }) {
		this.context = context;
		this.raw = raw;
		this.extended = null;

		this.duration = null;
		this.ready = false;

		this._attached = false;
		this._callback = onready;

		this.duration = null;

		this._firstByte = 0;
		this._metadata = metadata;
		this._bits = bits;

		this._uid = count++;

		const decode = ( callback, errback ) => {
			const buffer = ( this._firstByte ? slice( raw, this._firstByte, raw.length ) : raw ).buffer;

			this.context.decodeAudioData( buffer, callback, err => {
				if ( err ) return errback( err );

				this._firstByte += 1;

				// filthy hack taken from http://stackoverflow.com/questions/10365335/decodeaudiodata-returning-a-null-error
				// Thanks Safari developers, you absolute numpties
				for ( ; this._firstByte < raw.length - 1; this._firstByte += 1 ) {
					if ( isFrameHeader( raw, this._firstByte, metadata ) ) {
						return decode( callback, errback );
					}
				}

				errback( new Error( 'Could not decode audio buffer' ) );
			});
		};

		decode( decoded => {
			console.group( 'decoded' )
			this.duration = decoded.duration;

			// // calculate duration by counting samples
			// let i = 0;
			// let parsed;
			// let numFrames = 0;
			// while ( parsed = parseHeader( this.raw, i, this._metadata, this._bits ) ) {
			// 	numFrames += 1;
			// 	i += parsed.length;
			// }
			//
			// console.log( 'numFrames', numFrames )
			// const duration = numFrames * 1152 / this._metadata.sampleRate;
			// console.log( 'duration, this.duration', duration, this.duration )

			let numFrames = 0;
			let lastIndex = 0;
			let lastFrame;

			console.log( 'this._firstByte', this._firstByte )

			for ( let i = this._firstByte; i < this.raw.length; i += 1 ) {
				if ( isFrameHeader( this.raw, i, this._bits ) ) {
					numFrames += 1;

					const frameLength = i - lastIndex;
					if ( lastFrame && frameLength !== lastFrame.length ) {
						console.log( 'frameLength, lastFrame.length', frameLength, lastFrame.length )
					}

					lastFrame = parseHeader( this.raw, i, this._metadata, this._bits );
					lastIndex = i;

					i += lastFrame.length - 4;
				}
			}

			console.log( `%c ${numFrames} frames`, 'font-size: 2em;' )
			const duration = ( numFrames * 1152 / this._metadata.sampleRate );
			console.log( 'duration, this.duration', duration, this.duration );

			console.log( 'this.duration * this._metadata.sampleRate / 1152', this.duration * this._metadata.sampleRate / 1152 )

			this.duration = duration;


			this._ready();
			console.groupEnd()
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

			// this.frameIndices = [];
			// this.frameSizes = [];
			// this.frameLengths = [];
			// // let lastFrameIndex = 0;
			// // for ( let i = 0; i < this.extended.length; i += 1 ) {
			// // 	if ( isFrameHeader( this.extended, i, this._bits ) ) {
			// // 		const parsed = parseHeader( this.extended, i, this._metadata, this._bits );
			// // 		if ( !parsed ) throw new Error( 'Could not parse' )
			// // 		const offset = i + this._firstByte;
			// // 		this.frameIndices.push( offset );
			// // 		if ( i > 0 ) this.frameSizes.push( offset - lastFrameIndex );
			// // 		lastFrameIndex = offset;
			// // 		this.frameLengths.push( parsed.length );
			// // 	}
			// // }
			//
			// let i = 0;
			// let parsed;
			// while ( parsed = parseHeader( this.extended, i, this._metadata, this._bits ) ) {
			// 	const offset = i + this._firstByte;
			// 	this.frameIndices.push( offset );
			// 	i += parsed.length;
			// 	this.frameLengths.push( parsed.length );
			// }
			//
			// console.group( 'ready', this._uid )
			//
			// console.log( 'this.frameIndices', this.frameIndices )
			// console.log( 'this.frameLengths', this.frameLengths )
			// // console.log( 'this.frameSizes', this.frameSizes )
			// // console.log( 'this.frameLengths', this.frameLengths )
			//
			// this.numFrames = this.frameIndices.length;
			// this.numSamples = this.numFrames * 1152;
			//
			// if ( !this.numFrames ) {
			// 	console.log( 'this._firstByte', this._firstByte )
			// 	console.log( 'this._metadata, this._bits', this._metadata, this._bits )
			// 	console.log( 'slice(this.extended, 0, 4 )', slice(this.extended, 0, 4 ) )
			// }
			//
			// console.log( 'this.numFrames', this.numFrames )
			// console.log( 'this.duration', this.duration )
			// console.log( 'this.numSamples / this._metadata.sampleRate', this.numSamples / this._metadata.sampleRate )
			//
			// console.groupEnd()

			if ( this._callback ) {
				this._callback();
				this._callback = null;
			}
		}
	}
}
