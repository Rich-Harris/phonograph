import buble from 'rollup-plugin-buble';
import pkg from './package.json';

export default {
	input: 'src/index.js',
	output: [
		{ file: pkg.module, format: 'es' },
		{ file: pkg.main, format: 'umd' }
	],
	name: 'Phonograph',
	sourcemap: true,
	plugins: [
		buble({
			transforms: { dangerousForOf: true }
		})
	]
};
