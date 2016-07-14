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

		this._gain.connect( this.context.destination );

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
						if ( p ) {
							// drain temp buffer
							const chunk = new Chunk({
								clip: this,
								raw: slice( tempBuffer, 0, p ),

								ondecode: this.canplaythrough ? null : checkCanplaythrough
							});

							this._chunks.push( chunk );

							this._totalLoadedBytes += p;
						}

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

		this.playing = true;

		if ( !this.canplaythrough ) {
			console.warn( 'clip.play() was called before clip.canplaythrough === true' );
			this.buffer().then( () => this.play() );
			return this;
		}

		this._play();
	}

	pause () {
		if ( !this.playing ) {
			console.warn( 'clip.pause() was called on a clip that was already paused' );
			return this;
		}

		this.playing = false;
		this._currentTime = this._startTime + ( this.context.currentTime - this._contextTimeAtStart );

		this._fire( 'pause' );

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

	_play () {
		let chunkIndex;
		let time = 0;
		for ( chunkIndex = 0; chunkIndex < this._chunks.length; chunkIndex += 1 ) {
			const chunk = this._chunks[ chunkIndex ];

			if ( !chunk.duration ) {
				console.warn( 'attempted to play content that has not yet buffered' );
				setTimeout( () => {
					this._play();
				}, 100 );
				return;
			}

			const chunkEnd = time + chunk.duration;
			if ( chunkEnd > this._currentTime ) break;

			time = chunkEnd;
		}

		this._startTime = this._currentTime;
		const timeOffset = this._currentTime - time;

		this._fire( 'play' );

		let playing = true;
		const pauseListener = this.on( 'pause', () => {
			playing = false;

			if ( previousSource ) previousSource.stop();
			if ( currentSource ) currentSource.stop();
			pauseListener.cancel();
		});

		const i = chunkIndex++ % this._chunks.length;

		let chunk = this._chunks[i];
		let previousSource;
		let currentSource;

		chunk.createSource( timeOffset, source => {
			currentSource = source;

			this._contextTimeAtStart = this.context.currentTime;

			source.connect( this._gain );
			source.start();

			let lastStart = this._contextTimeAtStart;
			let nextStart = this._contextTimeAtStart + ( chunk.duration - timeOffset );

			const endGame = () => {
				if ( this.context.currentTime >= nextStart ) {
					this.pause()._currentTime = 0;
					this._fire( 'ended' );
				} else {
					requestAnimationFrame( endGame );
				}
			}

			const advance = () => {
				if ( !playing ) return;

				let i = chunkIndex++;
				if ( this.loop ) i %= this._chunks.length;

				chunk = this._chunks[i];

				if ( chunk ) {
					chunk.createSource( 0, source => {
						previousSource = currentSource;
						currentSource = source;

						source.connect( this._gain );
						source.start( nextStart );

						lastStart = nextStart;
						nextStart += chunk.duration;

						tick();
					});
				} else {
					endGame();
				}
			};

			const tick = () => {
				if ( this.context.currentTime > lastStart ) {
					advance();
				} else {
					setTimeout( tick, 500 );
				}
			};

			tick();
		});
	}
}
