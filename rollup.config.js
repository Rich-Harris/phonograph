import buble from 'rollup-plugin-buble';

export default {
	entry: 'src/index.js',
	plugins: [ buble() ],
	targets: [
		{ dest: 'dist/phonograph.es.js', format: 'es' },
		{ dest: 'dist/phonograph.umd.js', format: 'umd' }
	]
};
