export function copy ( source, target ) {
	const len = Math.min( source.length, target.length );
	console.log( 'len', len )

	for ( let i = 0; i < len; i += 1 ) {
		target[i] = source[i];
	}
}
