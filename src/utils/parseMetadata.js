const mpegVersionLookup = {
	0: 2,
	1: 1
};

const mpegLayerLookup = {
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

export default function parseMetadata ( metadata ) {
	const mpegVersion = mpegVersionLookup[ metadata.mpegVersion >> 3 ];

	return {
		mpegVersion,
		mpegLayer: mpegLayerLookup[ metadata.mpegLayer >> 1 ],
		sampleRate: sampleRateLookup[ metadata.sampleRate >> 2 ] / mpegVersion,
		channelMode: channelModeLookup[ metadata.channelMode >> 6 ]
	};
}
