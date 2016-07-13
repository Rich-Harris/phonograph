import fetch from './fetch.js';
import getContext from './getContext.js';
import { copy } from './utils/buffer.js';

const PROXY_DURATION = 20;
const CHUNK_SIZE = 256 * 1024;

export default class Clip {
	constructor ({ url }) {
		this.url = url;
		this.callbacks = {};
		this.context = getContext();

		this.loaded = false;
		this.canplaythrough = false;

		this._p = 0;
		this._data = null;
		this._source = null;

		this._volume = 1;
		this._gain = this.context.createGain();
	}

	buffer () {
		if ( !this._promise ) {
			return fetch( this.url ).then( response => {
				console.dir( 'response', response )
				return new Promise( ( fulfil, reject ) => {
					const length = response.headers.get( 'content-length' );

					if ( !length ) {
						return reject( new Error( 'missing content-length header' ) );
					}

					this._data = new Uint8Array( +length );

					const reader = response.body.getReader();

					const startTime = Date.now();

					let lastP = 0;

					const estimateDuration = () => {
						if ( this.canplaythrough ) return;

						const p = this._p;

						if ( p - lastP < 32768 ) {
							setTimeout( estimateDuration, 200 );
							return;
						}

						lastP = p;
						const scale = length / p;

						this.context.decodeAudioData( this._data.slice( 0, p ).buffer, snippet => {
							this.estimatedDuration = snippet.duration * scale;

							if ( lastP > 262144 ) {
								// stop trying to improve the accuracy past 256kb
								return;
							}

							setTimeout( estimateDuration, 200 );
						});
					};

					setTimeout( estimateDuration, 50 );

					const read = () => {
						return reader.read().then( chunk => {
							if ( chunk.done ) {
								if ( !this.canplaythrough ) {
									this.canplaythrough = true;
									this._fire( 'canplaythrough' );

									fulfil();
								}

								this.loaded = true;
								this._fire( 'load' );
								return;
							}

							for ( let i = 0; i < chunk.value.length; i += 1 ) {
								this._data[ this._p++ ] = chunk.value[i];
							}

							read();

							if ( !this.canplaythrough ) {
								if ( this.estimatedDuration ) {
									const timeNow = Date.now();
									const elapsed = timeNow - startTime;

									const bitrate = this._p / elapsed;
									const estimatedTimeToDownload = 1.5 * ( length - this._p ) / bitrate / 1e3;

									// if we have enough audio that we can start playing now
									// and finish downloading before we run out, we've
									// reached canplaythrough
									const availableAudio = ( this._p / length ) * this.estimatedDuration;

									if ( availableAudio > estimatedTimeToDownload ) {
										this.canplaythrough = true;
										this._fire( 'canplaythrough' );

										fulfil();
									}
								}
							}
						}).catch( reject );
					};

					read();
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

		this._fire( 'play' );

		let playing = this.playing = true;
		const pauseListener = this.on( 'pause', () => {
			playing = false;
			pauseListener.cancel();
		});

		let q = CHUNK_SIZE; // last byte of source data that was decoded
		let r = 0; // last byte of target data

		// decode initial chunk...
		this.context.decodeAudioData( this._data.buffer.slice( 0, q ), source => {
			if ( !playing ) return;

			const numberOfChannels = source.numberOfChannels;
			const sampleRate = this.context.sampleRate;

			const target = this.context.createBuffer( numberOfChannels, sampleRate * PROXY_DURATION, sampleRate );

			const startTime = this.context.currentTime;
			let runwayEnd = startTime;

			// periodically update with new data
			const update = () => {
				if ( !playing ) return;

				const start = q;
				const end = q += CHUNK_SIZE;

				if ( !this.loaded && end > this._p ) {
					setTimeout( update, 500 );
					return;
				}

				this.context.decodeAudioData( this._data.buffer.slice( start, end ), copyToTarget );
			};

			const endGame = () => {
				if ( this.context.currentTime > runwayEnd ) {
					this._fire( 'ended' );
					this.pause();
				} else {
					requestAnimationFrame( endGame );
				}
			};

			const copyToTarget = source => {
				for ( let chan = 0; chan < numberOfChannels; chan += 1 ) {
					const sourceBuffer = source.getChannelData( chan );
					const targetBuffer = target.getChannelData( chan );

					for ( let i = 0; i < sourceBuffer.length; i += 1 ) {
						targetBuffer[ ( i + r ) % targetBuffer.length ] = sourceBuffer[i];
					}
				}

				r += source.length;
				runwayEnd += source.duration;

				// is this the final chunk? blank everything out
				if ( q > this._data.length ) {
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

		this._fire( 'pause' );

		if ( this._source ) {
			this._source.stop();
			this._source = null;
		}

		this.playing = false;

		return this;
	}

	get volume () {
		return this._volume;
	}

	set volume ( volume ) {
		this._volume = volume;
		if ( this._source ) this._gain.gain.value = volume;
	}

	_fire ( eventName, data ) {
		const callbacks = this.callbacks[ eventName ];
		if ( !callbacks ) return;

		callbacks.forEach( cb => cb( data ) );
	}
}
