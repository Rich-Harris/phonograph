import Clip from './Clip.js';

export default class Clone extends Clip {
	constructor ( original ) {
		super({ url: original.url });
		this.original = original;
	}

	buffer () {
		return this.original.buffer();
	}

	clone () {
		return this.original.clone();
	}

	get canplaythrough () {
		return this.original.canplaythrough;
	}

	set canplaythrough ( _ ) {
		// noop
	}

	get loaded () {
		return this.original.loaded;
	}

	set loaded ( _ ) {
		// noop
	}

	get _chunks () {
		return this.original._chunks;
	}

	set _chunks ( _ ) {
		// noop
	}
}
