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

export default function parseMetadata ( metadata ) {
	const version = versionLookup[ metadata.version >> 3 ];
	return {
		version,
		layer: layerLookup[ metadata.layer >> 1 ],
		sampleRate: sampleRateLookup[ metadata.sampleRate >> 2 ] / version,
		channelMode: channelModeLookup[ metadata.channelMode >> 6 ]
	};
}
