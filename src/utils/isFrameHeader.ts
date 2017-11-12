import { RawMetadata } from '../interfaces';

// http://www.mp3-tech.org/programmer/frame_header.html
// frame header starts with 'frame sync' – eleven 1s
export default function isFrameHeader(data: Uint8Array, i: number, metadata: RawMetadata) {
	if (data[i + 0] !== 0b11111111 || (data[i + 1] & 0b11110000) !== 0b11110000)
		return false;

	return (
		(data[i + 1] & 0b00000110) !== 0b00000000 &&
		(data[i + 2] & 0b11110000) !== 0b11110000 &&
		(data[i + 2] & 0b00001100) !== 0b00001100 &&
		(data[i + 3] & 0b00000011) !== 0b00000010 &&
		(data[i + 1] & 0b00001000) === metadata.mpegVersion &&
		(data[i + 1] & 0b00000110) === metadata.mpegLayer &&
		(data[i + 2] & 0b00001100) === metadata.sampleRate &&
		(data[i + 3] & 0b11000000) === metadata.channelMode
	);
}
