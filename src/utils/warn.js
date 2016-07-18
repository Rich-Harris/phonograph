export default function warn ( msg ) {
	console.warn(  `%c🔊 Phonograph.js %c${msg}`, 'font-weight: bold;', 'font-weight: normal;' )
	console.groupCollapsed( `%c🔊 stack trace`, 'font-weight: normal; color: #666;' );
	const stack = new Error().stack.split( '\n' ).slice( 2 ).join( '\n' );
	console.log( `%c${stack}`, 'display: block; font-weight: normal; color: #666;' )
	console.groupEnd()
}
