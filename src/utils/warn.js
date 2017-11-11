export default function warn(msg) {
	console.warn( //eslint-disable-line no-console
		`%c🔊 Phonograph.js %c${msg}`,
		'font-weight: bold;',
		'font-weight: normal;'
	);

	console.groupCollapsed( //eslint-disable-line no-console
		`%c🔊 stack trace`,
		'font-weight: normal; color: #666;'
	);

	const stack = new Error().stack
		.split('\n')
		.slice(2)
		.join('\n');

	console.log( //eslint-disable-line no-console
		`%c${stack}`,
		'display: block; font-weight: normal; color: #666;'
	);

	console.groupEnd(); //eslint-disable-line no-console
}
