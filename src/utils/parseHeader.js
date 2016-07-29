// http://mpgedit.org/mpgedit/mpeg_format/mpeghdr.htm
const versionLookup = {
	0: 2,
	1: 1
};

const layerLookup = {
	1: 3,
	2: 2,
	3: 1
};

const sampleRateLookup = {
	0: 44100,
	1: 48000,
	2: 32000
};

const channelModeLookup = {
	0: 'stereo',
	1: 'joint stereo',
	2: 'dual channel',
	3: 'mono'
};

const bitrateLookup = {
	11: [ null, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448 ],
	12: [ null, 32, 48, 56,  64,  80,  96, 112, 128, 160, 192, 224, 256, 320, 384 ],
	13: [ null, 32, 40, 48,  56,  64,  80,  96, 112, 128, 160, 192, 224, 256, 320 ],
	21: [ null, 32, 48, 56,  64,  80,  96, 112, 128, 144, 160, 176, 192, 224, 256 ],
	22: [ null,  8, 16, 24,  32,  40,  48,  56,  64,  80,  96, 112, 128, 144, 160 ]
};

bitrateLookup[ 23 ] = bitrateLookup[ 22 ];

let count = 100;

export default function parseHeader ( data, i, canonical, bits ) {
	if ( data[ i + 0 ] !== 0b11111111 || ( data[ i + 1 ] & 0b11110000 ) !== 0b11110000 ) return null;

	const version = versionLookup[ ( data[ i + 1 ] & 0b00001000 ) >> 3 ];
	const layer = layerLookup[ ( data[ i + 1 ] & 0b00000110 ) >> 1 ];
	const sampleRate = sampleRateLookup[ ( data[ i + 2 ] & 0b00001100 ) >> 2 ] / version;
	const channelMode = channelModeLookup[ ( data[ i + 3 ] & 0b11000000 ) >> 6 ];

	if (
		( version !== canonical.version ) ||
		( layer !== canonical.layer ) ||
		( sampleRate !== canonical.sampleRate ) ||
		( channelMode !== canonical.channelMode )
	) {
		return null;
	}

	const bitrateCode = ( data[ i + 2 ] & 0b11110000 ) >> 4;
	const bitrate = bitrateLookup[ `${version}${layer}` ][ bitrateCode ] * 1e3;
	const padding = ( data[2] & 0b00000010 ) >> 1;

	const length = ~~( layer === 1 ?
		( 12 * bitrate / sampleRate + padding ) * 4 :
		( 144 * bitrate / sampleRate + padding )
	);

	return { version, layer, sampleRate, channelMode, bitrate, padding, length };
}
