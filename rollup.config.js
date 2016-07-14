import buble from 'rollup-plugin-buble';

export default {
	entry: 'src/index.js',
	plugins: [
		buble({
			transforms: { dangerousForOf: true }
		})
	],
	moduleName: 'Phonograph',
	sourceMap: true,
	targets: [
		{ dest: 'dist/phonograph.es.js', format: 'es' },
		{ dest: 'dist/phonograph.umd.js', format: 'umd' }
	]
};
