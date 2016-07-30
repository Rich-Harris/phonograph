export default function warn ( msg ) {
	console.warn(  `%c🔊 Phonograph.js %c${msg}`, 'font-weight: bold;', 'font-weight: normal;' ); //eslint-disable-line no-console
	console.groupCollapsed( `%c🔊 stack trace`, 'font-weight: normal; color: #666;' ); //eslint-disable-line no-console
	const stack = new Error().stack.split( '\n' ).slice( 2 ).join( '\n' );
	console.log( `%c${stack}`, 'display: block; font-weight: normal; color: #666;' ); //eslint-disable-line no-console
	console.groupEnd(); //eslint-disable-line no-console
}
