export interface RawMetadata {
	mpegVersion: number;
	mpegLayer: number;
	sampleRate: number;
	channelMode: number;
}

export interface Metadata {
	mpegVersion: number;
	mpegLayer: number;
	sampleRate: number;
	channelMode: string;
}