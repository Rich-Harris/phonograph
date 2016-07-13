const fetch = window.fetch || _fetch;

function _fetch ( url ) {
	return new Promise( ( fulfil, reject ) => {
		const xhr = new XMLHttpRequest();
		xhr.responseType = 'arraybuffer';

		xhr.onerror = reject;

		xhr.onload = () => {
			fulfil( new Response( xhr.response ) );
		};

		xhr.open( 'GET', url );
		xhr.send();
	});
}

class Response {
	constructor ( data ) {
		this.data = data;

		this.headers = {
			get: header => {
				if ( header === 'content-length' ) return data.length;
				return null;
			}
		};

		this.body = {
			getReader: () => new Reader( data )
		};
	}
}

class Reader {
	constructor ( data ) {
		this.data = data;
		this.p = 0;
		this.chunkSize = 32768;

		this.done = false;
	}

	read () {
		const chunk = this.done ?
			{ done: true, value: null } :
			{ done: false, value: this.data.slice( p, p += this.chunkSize ) };

		this.done = p > this.data.length;
		return Promise.resolve( chunk )
	}
}

export default fetch;
