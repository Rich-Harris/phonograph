let Loader;

if ( window.fetch ) {
	Loader = class FetchLoader {
		constructor ( url ) {
			this.url = url;
		}

		// TODO cancel?

		load ({ onprogress, ondata, onload, onerror }) {
			fetch( this.url ).then( response => {
				const total = +response.headers.get( 'content-length' );

				if ( !total ) {
					onerror( new Error( 'missing content-length header' ) )
					return;
				};

				let length = 0;
				onprogress( length / total, length, total );

				if ( response.body ) {
					const reader = response.body.getReader();

					const read = () => {
						reader.read().then( chunk => {
							if ( chunk.done ) {
								onprogress( 1, length, length );
								onload();
							} else {
								length += chunk.value.length;
								ondata( chunk.value );
								onprogress( length / total, length, total );

								read();
							}
						}).catch( onerror );
					};

					read();
				}

				else {
					// Firefox doesn't yet implement streaming
					response.arrayBuffer().then( arrayBuffer => {
						const uint8Array = new Uint8Array( arrayBuffer );

						ondata( uint8Array );
						onprogress( uint8Array.length / total, uint8Array.length, total );
						onload();
					});
				}


			}).catch( onerror );
		}
	}
} else {
	Loader = class XhrLoader {
		constructor ( url ) {
			this.url = url;
		}

		load ({ onprogress, ondata, onload, onerror }) {
			const xhr = new XMLHttpRequest();
			xhr.responseType = 'arraybuffer';

			xhr.onerror = onerror;

			xhr.onload = e => {
				onprogress( e.loaded / e.total, e.loaded, e.total );
				ondata( new Uint8Array( xhr.response ) );
				onload();
			};

			xhr.onprogress = e => {
				onprogress( e.loaded / e.total, e.loaded, e.total );
			};

			xhr.open( 'GET', this.url );
			xhr.send();
		}
	}
}

export default Loader;
