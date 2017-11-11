let Loader;

if (window.fetch) {
	Loader = class FetchLoader {
		constructor(url) {
			this.url = url;
			this._cancelled = false;
		}

		cancel() {
			this._cancelled = true;
		}

		load({ onprogress, ondata, onload, onerror }) {
			this._cancelled = false;

			fetch(this.url)
				.then(response => {
					if (this._cancelled) return;

					if (!response.ok) {
						onerror(
							new Error(
								`Bad response (${response.status} – ${response.statusText})`
							)
						);
						return;
					}

					const total = +response.headers.get('content-length') || 0;

					let length = 0;
					onprogress((total ? length : 0) / total, length, total);

					if (response.body) {
						const reader = response.body.getReader();

						const read = () => {
							if (this._cancelled) return;

							reader
								.read()
								.then(chunk => {
									if (this._cancelled) return;

									if (chunk.done) {
										onprogress(1, length, length);
										onload();
									} else {
										length += chunk.value.length;
										ondata(chunk.value);
										onprogress((total ? length : 0) / total, length, total);

										read();
									}
								})
								.catch(onerror);
						};

						read();
					} else {
						// Firefox doesn't yet implement streaming
						response
							.arrayBuffer()
							.then(arrayBuffer => {
								if (this._cancelled) return;

								const uint8Array = new Uint8Array(arrayBuffer);

								ondata(uint8Array);
								onprogress(1, uint8Array.length, uint8Array.length);
								onload();
							})
							.catch(onerror);
					}
				})
				.catch(onerror);
		}
	};
} else {
	Loader = class XhrLoader {
		constructor(url) {
			this.url = url;

			this._cancelled = false;
			this._xhr = null;
		}

		cancel() {
			if (this._cancelled) return;

			this._cancelled = true;

			if (this._xhr) {
				this._xhr.abort();
				this._xhr = null;
			}
		}

		load({ onprogress, ondata, onload, onerror }) {
			this._cancelled = false;

			const xhr = new XMLHttpRequest();
			xhr.responseType = 'arraybuffer';

			xhr.onerror = onerror;

			xhr.onload = e => {
				if (this._cancelled) return;

				onprogress(e.loaded / e.total, e.loaded, e.total);
				ondata(new Uint8Array(xhr.response));
				onload();

				this._xhr = null;
			};

			xhr.onprogress = e => {
				if (this._cancelled) return;

				onprogress(e.loaded / e.total, e.loaded, e.total);
			};

			xhr.open('GET', this.url);
			xhr.send();

			this._xhr = xhr;
		}
	};
}

export default Loader;
