import Loader from './Loader.js';
import Chunk from './Chunk.js';
import Clone from './Clone.js';
import getContext from './getContext.js';
import { slice } from './utils/buffer.js';
import isFrameHeader from './utils/isFrameHeader.js';
import parseMetadata from './utils/parseMetadata.js';
import warn from './utils/warn.js';

const CHUNK_SIZE = 64 * 1024;
const OVERLAP = 0.2;

export default class Clip {
	constructor ({ url, loop, volume }) {
		this.url = url;
		this.callbacks = {};
		this.context = getContext();

		this.loop = loop || false;

		this.length = 0;

		this.loader = new Loader( url );
		this.loaded = false;
		this.canplaythrough = false;

		this._currentTime = 0;

		this._volume = volume || 1;
		this._gain = this.context.createGain();
		this._gain.gain.value = this._volume;

		this._gain.connect( this.context.destination );

		this._chunks = [];
	}

	buffer ( bufferToCompletion ) {
		if ( !this._loadStarted ) {
			this._loadStarted = true;

			let tempBuffer = new Uint8Array( CHUNK_SIZE * 2 );
			let p = 0;

			let loadStartTime = Date.now();
			let totalLoadedBytes = 0;

			const checkCanplaythrough = () => {
				if ( this.canplaythrough || !this.length ) return;

				let duration = 0;
				let bytes = 0;

				for ( let chunk of this._chunks ) {
					if ( !chunk.duration ) break;
					duration += chunk.duration;
					bytes += chunk.raw.length;
				}

				if ( !duration ) return;

				const scale = this.length / bytes;
				const estimatedDuration = duration * scale;

				const timeNow = Date.now();
				const elapsed = timeNow - loadStartTime;

				const bitrate = totalLoadedBytes / elapsed;
				const estimatedTimeToDownload = 1.5 * ( this.length - totalLoadedBytes ) / bitrate / 1e3;

				// if we have enough audio that we can start playing now
				// and finish downloading before we run out, we've
				// reached canplaythrough
				const availableAudio = ( bytes / this.length ) * estimatedDuration;

				if ( availableAudio > estimatedTimeToDownload ) {
					this.canplaythrough = true;
					this._fire( 'canplaythrough' );
				}
			};

			const drainBuffer = () => {
				const isFirstChunk = this._chunks.length === 0;
				const firstByte = isFirstChunk ? 32 : 0;

				const chunk = new Chunk({
					context: this.context,
					raw: slice( tempBuffer, firstByte, p ),
					metadata: this.metadata,
					referenceHeader: this._referenceHeader,

					onready: this.canplaythrough ? null : checkCanplaythrough
				});

				const lastChunk = this._chunks[ this._chunks.length - 1 ];
				if ( lastChunk ) lastChunk.attach( chunk );

				this._chunks.push( chunk );
				p = 0;

				return chunk;
			};

			this.loader.load({
				onprogress: ( progress, length, total ) => {
					this.length = total;
					this._fire( 'loadprogress', { progress, length, total });
				},

				ondata: ( uint8Array ) => {
					if ( !this.metadata ) {
						for ( let i = 0; i < uint8Array.length; i += 1 ) {
							// determine some facts about this mp3 file from the initial header
							if ( uint8Array[i] === 0b11111111 && ( uint8Array[ i + 1 ] & 0b11110000 ) === 0b11110000 ) {
								// http://www.datavoyage.com/mpgscript/mpeghdr.htm
								this._referenceHeader = {
									mpegVersion: ( uint8Array[ i + 1 ] & 0b00001000 ),
									mpegLayer: ( uint8Array[ i + 1 ] & 0b00000110 ),
									sampleRate: ( uint8Array[ i + 2 ] & 0b00001100 ),
									channelMode: ( uint8Array[ i + 3 ] & 0b11000000 )
								};

								this.metadata = parseMetadata( this._referenceHeader );

								break;
							}
						}
					}

					for ( let i = 0; i < uint8Array.length; i += 1 ) {
						// once the buffer is large enough, wait for
						// the next frame header then drain it
						if ( p > CHUNK_SIZE + 4 && isFrameHeader( uint8Array, i, this._referenceHeader ) ) {
							drainBuffer();
						}

						// write new data to buffer
						tempBuffer[ p++ ] = uint8Array[i];
					}

					totalLoadedBytes += uint8Array.length;
				},

				onload: () => {
					if ( p ) {
						const lastChunk = drainBuffer();
						lastChunk.attach( null );

						totalLoadedBytes += p;
					}

					this._chunks[0].onready( () => {
						if ( !this.canplaythrough ) {
							this.canplaythrough = true;
							this._fire( 'canplaythrough' );
						}

						this.loaded = true;
						this._fire( 'load' );
					});
				},

				onerror: ( error ) => {
					this._fire( 'loaderror', error );
					this._loadStarted = false;
				}
			});
		}

		return new Promise( ( fulfil, reject ) => {
			const ready = bufferToCompletion ? this.loaded : this.canplaythrough;

			if ( ready ) {
				fulfil();
			} else {
				this.once( bufferToCompletion ? 'load' : 'canplaythrough', fulfil );
				this.once( 'loaderror', reject );
			}
		});
	}

	clone () {
		return new Clone( this );
	}

	connect ( destination, output, input ) {
		if ( !this._connected ) {
			this._gain.disconnect();
			this._connected = true;
		}

		this._gain.connect( destination, output, input );
		return this;
	}

	disconnect ( destination, output, input ) {
		this._gain.disconnect( destination, output, input );
	}

	dispose () {
		if ( this.playing ) this.pause();

		if ( this._loadStarted ) {
			// TODO... how to cancel?
			this.loader.cancel();
			this._loadStarted = false;
		}

		this._currentTime = 0;
		this.loaded = false;
		this.canplaythrough = false;
		this._chunks = [];
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
			warn( `clip.play() was called on a clip that was already playing (${this.url})` );
			return this;
		}

		this.playing = true;

		if ( !this.canplaythrough ) {
			warn( `clip.play() was called before clip.canplaythrough === true (${this.url})` );
			this.buffer().then( () => this._play() );
		} else {
			this._play();
		}

		return this;
	}

	pause () {
		if ( !this.playing ) {
			warn( `clip.pause() was called on a clip that was already paused (${this.url})` );
			return this;
		}

		this.playing = false;
		this._currentTime = this._startTime + ( this.context.currentTime - this._contextTimeAtStart );

		this._fire( 'pause' );

		return this;
	}

	get currentTime () {
		if ( this.playing ) {
			return this._startTime + ( this.context.currentTime - this._contextTimeAtStart );
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

	get duration () {
		let total = 0;
		for ( let chunk of this._chunks ) {
			if ( !chunk.duration ) return null;
			total += chunk.duration;
		}

		return total;
	}

	get volume () {
		return this._volume;
	}

	set volume ( volume ) {
		this._gain.gain.value = this._volume = volume;
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
				warn( `attempted to play content that has not yet buffered ${this.url}` );
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

			let lastStart = this._contextTimeAtStart;
			let nextStart = this._contextTimeAtStart + ( chunk.duration - timeOffset );

			const gain = this.context.createGain();
			gain.connect( this._gain );
			gain.gain.setValueAtTime( 0, nextStart + OVERLAP );

			source.connect( gain );
			source.start();

			const endGame = () => {
				if ( this.context.currentTime >= nextStart ) {
					this.pause()._currentTime = 0;
					this._fire( 'ended' );
				} else {
					requestAnimationFrame( endGame );
				}
			};

			const advance = () => {
				if ( !playing ) return;

				let i = chunkIndex++;
				if ( this.loop ) i %= this._chunks.length;

				chunk = this._chunks[i];

				if ( chunk ) {
					chunk.createSource( 0, source => {
						previousSource = currentSource;
						currentSource = source;

						const gain = this.context.createGain();
						gain.connect( this._gain );
						gain.gain.setValueAtTime( 0, nextStart );
						gain.gain.setValueAtTime( 1, nextStart + OVERLAP );

						source.connect( gain );
						source.start( nextStart );

						lastStart = nextStart;
						nextStart += chunk.duration;

						gain.gain.setValueAtTime( 0, nextStart + OVERLAP );

						tick();
					}, err => {
						this._fire( 'playbackerror', err );
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

			const frame = () => {
				if ( !playing ) return;
				requestAnimationFrame( frame );

				this._fire( 'progress' );
			};

			tick();
			frame();
		}, err => {
			this._fire( 'playbackerror', err );
		});
	}
}
