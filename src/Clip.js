import Loader from './Loader.js';
import Chunk from './Chunk.js';
import getContext from './getContext.js';
import { copy, slice } from './utils/buffer.js';

const PROXY_DURATION = 20;
const CHUNK_SIZE = 64 * 1024;

export default class Clip {
	constructor ({ url, volume }) {
		this.url = url;
		this.callbacks = {};
		this.context = getContext();

		this.length = 0;

		this.loader = new Loader( url );
		this.loaded = false;
		this.canplaythrough = false;

		this._totalLoadedBytes = 0;
		this._data = null;
		this._source = null;

		this._currentTime = 0;

		this._volume = volume || 1;
		this._gain = this.context.createGain();
		this._gain.gain.value = this._volume;

		this._timeIndices = [
			{ time: 0, firstByte: 32 } // firstByte isn't zero, because we need to work around an insane Safari bug (see 'filthy hack' below)
		];

		this._chunks = [];
	}

	buffer ( complete ) {
		if ( !this._promise ) {
			this._promise = new Promise( ( fulfil, reject ) => {
				let tempBuffer = new Uint8Array( CHUNK_SIZE * 2 );
				let p = 0;

				let loadStartTime = Date.now();

				const checkCanplaythrough = () => {
					if ( this.canplaythrough || !this.length ) return;

					let duration = 0;
					let bytes = 0;

					for ( let chunk of this._chunks ) {
						if ( !chunk.duration ) break;
						duration += chunk.duration;
						bytes += chunk.buffer.byteLength;
					}

					if ( !duration ) return;

					const scale = this.length / bytes;
					const estimatedDuration = duration * scale;

					const timeNow = Date.now();
					const elapsed = timeNow - loadStartTime;

					const bitrate = this._totalLoadedBytes / elapsed;
					const estimatedTimeToDownload = 1.5 * ( this.length - this._totalLoadedBytes ) / bitrate / 1e3;

					// if we have enough audio that we can start playing now
					// and finish downloading before we run out, we've
					// reached canplaythrough
					const availableAudio = ( bytes / this.length ) * estimatedDuration;

					if ( availableAudio > estimatedTimeToDownload ) {
						this.canplaythrough = true;
						this._fire( 'canplaythrough' );

						fulfil();
					}
				};

				this.loader.load({
					onprogress: ( progress, length, total ) => {
						this.length = total;
						this._fire( 'progress', { progress, length, total });
					},

					ondata: ( uint8Array ) => {
						for ( let i = 0; i < uint8Array.length; i += 1 ) {
							// once the buffer is large enough, wait for
							// the next frame header then drain it
							if ( p > CHUNK_SIZE && uint8Array[i] === 0xFF && uint8Array[i+1] & 0xE0 === 0xE0 ) {
								const chunk = new Chunk({
									clip: this,
									raw: slice( tempBuffer, 0, p ),

									ondecode: this.canplaythrough ? null : checkCanplaythrough
								});

								this._chunks.push( chunk );
								p = 0;
							}

							// write new data to buffer
							tempBuffer[ p++ ] = uint8Array[i];
						}

						this._totalLoadedBytes += uint8Array.length;
					},

					onload: () => {
						if ( !this.canplaythrough ) {
							this.canplaythrough = true;
							this._fire( 'canplaythrough' );
						}

						this.loaded = true;
						this._fire( 'load' );

						fulfil();
					},

					onerror: ( error ) => {
						console.error( error )
					}
				});
			});
		}

		return this._promise;
	}

	off ( eventName, cb ) {
		const callbacks = this.callbacks[ eventName ];
		if ( !callbacks ) return;

		const index = callbacks.indexOf( cb );
		if ( ~index ) callbacks.splice( index, 1 );
	}

	on ( eventName, cb ) {
		const callbacks = this.callbacks[ eventName ] || ( this.callbacks[ eventName ] = [] );
		callbacks.push( cb );

		return {
			cancel: () => this.off( eventName, cb )
		};
	}

	once ( eventName, cb ) {
		const _cb = () => {
			cb();
			this.off( eventName, _cb );
		};

		return this.on( eventName, _cb );
	}

	play () {
		if ( this.playing ) {
			console.warn( 'clip.play() was called on a clip that was already playing' );
			return this;
		}

		if ( !this.canplaythrough ) {
			console.warn( 'clip.play() was called before clip.canplaythrough === true' );
			this.buffer().then( () => this.play() );
			return this;
		}

		console.log( 'this._chunks', this._chunks )

		this._fire( 'play' );

		let playing = this.playing = true;
		const pauseListener = this.on( 'pause', () => {
			playing = false;
			pauseListener.cancel();
		});

		let sourceByte = CHUNK_SIZE; // last byte of source data that was decoded
		let targetByte = 0; // last byte of target data

		this._currentTimeAtStart = this._currentTime;

		let timeIndex;
		for ( let i = 0; i < this._timeIndices.length; i += 1 ) {
			if ( this._timeIndices[i].time > this._currentTimeAtStart ) continue;
			timeIndex = this._timeIndices[i];
		}

		// decode initial chunk...
		this._decode( slice( this._data, timeIndex.firstByte, ( sourceByte = timeIndex.firstByte + CHUNK_SIZE ) ), source => {
			if ( !playing ) return;

			const numberOfChannels = source.numberOfChannels;
			const sampleRate = this.context.sampleRate;

			const target = this.context.createBuffer( numberOfChannels, sampleRate * PROXY_DURATION, sampleRate );

			let timeOffset = ( this._currentTime - timeIndex.time );
			let sampleOffset = ~~( sampleRate * timeOffset );

			this._startTime = this.context.currentTime;
			let runwayEnd = this._startTime;

			// periodically update with new data
			const update = () => {
				if ( !playing ) return;

				const start = sourceByte;
				const end = ( sourceByte += CHUNK_SIZE );

				const lastTimeIndex = this._timeIndices[ this._timeIndices.length - 1 ];
				if ( lastTimeIndex.firstByte < start ) {
					this._timeIndices.push({ firstByte: start, time: runwayEnd });
				}

				if ( !this.loaded && end > this._p ) {
					// content not yet buffered
					setTimeout( update, 500 );
					return;
				}

				this._decode( slice( this._data, start, end ), copyToTarget );
			};

			const endGame = () => {
				if ( this.context.currentTime > runwayEnd ) {
					this._fire( 'ended' );
					this.pause();
					this._currentTime = 0;
				} else {
					requestAnimationFrame( endGame );
				}
			};

			const copyToTarget = decoded => {
				for ( let chan = 0; chan < numberOfChannels; chan += 1 ) {
					const sourceBuffer = decoded.getChannelData( chan );
					const targetBuffer = target.getChannelData( chan );

					for ( let i = sampleOffset; i < sourceBuffer.length; i += 1 ) {
						targetBuffer[ ( i + targetByte - sampleOffset ) % targetBuffer.length ] = sourceBuffer[i];
					}
				}

				targetByte += decoded.length - sampleOffset;
				runwayEnd += decoded.duration - timeOffset;

				sampleOffset = timeOffset = 0;

				// is this the final chunk? blank everything out
				if ( sourceByte > this._data.length ) {
					// TODO need to blank anything out?
					endGame();
				} else {
					// schedule next update
					const timeNow = this.context.currentTime;
					const remainingRunway = runwayEnd - timeNow;

					const scheduled = Math.max( 0, remainingRunway - 0.5 );
					setTimeout( update, scheduled * 1e3 );
				}
			};

			const chunkEndTime = timeIndex.time + source.duration;
			if ( chunkEndTime < this._currentTime ) {
				console.warn( `seeking to content that has not been buffered (seeked ${this._currentTime}, only buffered up to ${chunkEndTime})` );
				update();
			}

			copyToTarget( source );

			this._source = this.context.createBufferSource();
			this._source.loop = true;
			this._source.buffer = target;

			this._source.connect( this._gain );
			this._gain.connect( this.context.destination );

			this._source.start();
		});

		return this;
	}

	pause () {
		if ( !this.playing ) {
			console.warn( 'clip.pause() was called on a clip that was already paused' );
			return this;
		}

		this._currentTime = this._currentTimeAtStart + ( this.context.currentTime - this._startTime );

		this._fire( 'pause' );

		if ( this._source ) {
			this._source.stop();
			this._source = null;
		}

		this.playing = false;

		return this;
	}

	get currentTime () {
		if ( this.playing ) {
			return this.context.currentTime - this._startTime;
		} else {
			return this._currentTime;
		}
	}

	set currentTime ( currentTime ) {
		if ( this.playing ) {
			this.pause();
			this._currentTime = currentTime;
			this.play();
		} else {
			this._currentTime = currentTime;
		}
	}

	get volume () {
		return this._volume;
	}

	set volume ( volume ) {
		this._volume = volume;
		if ( this._source ) this._gain.gain.value = volume;
	}

	_decode ( view, callback, errback ) {
		this.context.decodeAudioData( view.buffer, callback, err => {
			if ( err ) return errback( err );

			// filthy hack taken from http://stackoverflow.com/questions/10365335/decodeaudiodata-returning-a-null-error
			// Thanks Safari developers, you absolute numpties
			for ( let i = 0; i < view.length - 1; i += 1 ) {
				if ( view[i] === 0xFF && view[i+1] & 0xE0 === 0xE0 ) {
					return this._decode( slice( view, i, view.length ), callback, errback );
				}
			}

			errback( new Error( 'Could not decode audio buffer' ) );
		});
	}

	_fire ( eventName, data ) {
		const callbacks = this.callbacks[ eventName ];
		if ( !callbacks ) return;

		callbacks.forEach( cb => cb( data ) );
	}
}
