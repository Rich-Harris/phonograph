let Loader;

if ( window.fetch ) {
	Loader = class FetchLoader {
		constructor ( url ) {
			this.url = url;
		}

		// TODO cancel?

		load ({ onprogress, ondata, onload, onerror }) {
			fetch( this.url ).then( response => {
				const total = response.headers.get( 'content-length' );
				if ( !total ) throw new Error( 'missing content-length header' );

				let length = 0;
				onprogress( length / total, length, total );

				const reader = response.body.getReader();

				const read = () => {
					reader.read().then( chunk => {
						if ( chunk.done ) {
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

			xhr.onload = () => {
				ondata( new Uint8Array( xhr.response ) );
				onload();
			};

			xhr.onprogress = e => {
				onprogress( e.loaded / e.total, e.loaded, e.total );
			};

			xhr.open( 'GET', url );
			xhr.send();
		}
	}
}

export default Loader;
