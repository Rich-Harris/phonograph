// http://www.mp3-tech.org/programmer/frame_header.html
// frame header starts with 'frame sync' – eleven 1s
export default function isFrameHeader ( uint8Array, i ) {
	return uint8Array[i] === 0xFF && uint8Array[i+1] & 0xE0 === 0xE0;
}
