export function slice(view, start, end) {
	if (view.slice) {
		return view.slice(start, end);
	}

	let clone = new view.constructor(end - start);
	let p = 0;

	for (let i = start; i < end; i += 1) {
		clone[p++] = view[i];
	}

	return clone;
}
