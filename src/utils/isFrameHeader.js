// http://www.mp3-tech.org/programmer/frame_header.html
// frame header starts with 'frame sync' – eleven 1s
export default function isFrameHeader ( data, i, metadata ) {
	if ( data[ i + 0 ] !== 0b11111111 || ( data[ i + 1 ] & 0b11110000 ) !== 0b11110000 ) return false;

	const isHeader = (
		( ( data[ i + 1 ] & 0b00001000 ) === metadata.version ) &&
		( ( data[ i + 1 ] & 0b00000110 ) === metadata.layer ) &&
		( ( data[ i + 2 ] & 0b00001100 ) === metadata.sampleRate ) &&
		( ( data[ i + 3 ] & 0b11000000 ) === metadata.channelMode )
	);

	return isHeader;
}
