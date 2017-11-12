import { Metadata, RawMetadata } from '../interfaces';

const mpegVersionLookup: Record<string, number> = {
	0: 2,
	1: 1
};

const mpegLayerLookup: Record<string, number> = {
	1: 3,
	2: 2,
	3: 1
};

const sampleRateLookup: Record<string, number> = {
	0: 44100,
	1: 48000,
	2: 32000
};

const channelModeLookup: Record<string, string> = {
	0: 'stereo',
	1: 'joint stereo',
	2: 'dual channel',
	3: 'mono'
};

export default function parseMetadata(metadata: RawMetadata): Metadata {
	const mpegVersion = mpegVersionLookup[metadata.mpegVersion >> 3];

	return {
		mpegVersion,
		mpegLayer: mpegLayerLookup[metadata.mpegLayer >> 1],
		sampleRate: sampleRateLookup[metadata.sampleRate >> 2] / mpegVersion,
		channelMode: channelModeLookup[metadata.channelMode >> 6]
	};
}
