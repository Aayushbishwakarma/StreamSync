export function createPeerConnection(
  onIceCandidate: (candidate: RTCIceCandidate) => void,
  onTrack: (stream: MediaStream) => void
) {
  const pc = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
  });

  // forward any ICE candidates we discover to the caller so they can send
  // them over the signaling channel
  pc.onicecandidate = (event) => {
    if (event.candidate) onIceCandidate(event.candidate);
  };

  // fire the callback whenever a remote track (screen or camera) comes in
  pc.ontrack = (event) => {
    onTrack(event.streams[0]);
  };

  return pc;
}

// Caps how much bandwidth a video track is allowed to use, so chat/signaling
// never gets starved by a heavy screen share or camera feed.
export async function capVideoBitrate(pc: RTCPeerConnection, maxBitrateKbps: number) {
  const senders = pc.getSenders().filter((s) => s.track?.kind === "video");
  for (const sender of senders) {
    const params = sender.getParameters();
    if (!params.encodings || params.encodings.length === 0) {
      params.encodings = [{}];
    }
    params.encodings[0].maxBitrate = maxBitrateKbps * 1000;
    try {
      await sender.setParameters(params);
    } catch (err) {
      console.warn("Could not set bitrate cap:", err);
    }
  }
}