"use client";
import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { socket } from "@/lib/socket";
import { createPeerConnection, capVideoBitrate } from "@/lib/webrtc";
import Image from "next/image";

type SystemMessage = { id: number; type: "system"; text: string };
type ChatMessage = { id: number; type: "chat"; name: string; message: string; time: number };
type FeedItem = SystemMessage | ChatMessage;
type StreamInfo = { screenStreamId: string | null; cameraStreamId: string | null };

const EMOJIS = ["😀", "😂", "😍", "👍", "🎉", "🔥", "❤️", "👏", "😮", "🤔"];

export default function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const searchParams = useSearchParams();
  const role = searchParams.get("role") || "viewer";
  const { user } = useAuth();
  const router = useRouter();

  // room metadata, fetched separately from the socket connection
  const [roomTitle, setRoomTitle] = useState("");
  const [roomDescription, setRoomDescription] = useState("");

  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "connected">(
    "connecting"
  );
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [viewerCount, setViewerCount] = useState(0);
  const [chatInput, setChatInput] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // host-side media state
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const [hasCameraSession, setHasCameraSession] = useState(false);
  const [isCamVideoOn, setIsCamVideoOn] = useState(false);
  const [isMicOn, setIsMicOn] = useState(false);

  const [sessionEnded, setSessionEnded] = useState(false);

  const itemId = useRef(0);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const screenVideoRef = useRef<HTMLVideoElement>(null);
  const cameraVideoRef = useRef<HTMLVideoElement>(null);

  const screenStreamRef = useRef<MediaStream | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());

  // tracks which viewers/streams we already know about so we don't double-wire things
  const knownViewersRef = useRef<Set<string>>(new Set());
  const streamInfoRef = useRef<Map<string, StreamInfo>>(new Map());
  const pendingStreamsRef = useRef<Map<string, MediaStream[]>>(new Map());

  const displayName = user?.displayName || user?.email?.split("@")[0] || "Guest";

  // pull room title/description once we know which room we're in
  useEffect(() => {
    if (!roomId) return;
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/rooms/${roomId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setRoomTitle(data.room.title);
          setRoomDescription(data.room.description);
        }
      })
      .catch((err) => console.error("Failed to load room info:", err));
  }, [roomId]);

  // figures out whether an incoming stream is the screen share or the camera,
  // and falls back to a pending queue if we don't know yet
  const routeIncomingStream = (fromSocketId: string, stream: MediaStream) => {
    const info = streamInfoRef.current.get(fromSocketId);

    if (info?.screenStreamId === stream.id) {
      if (screenVideoRef.current) screenVideoRef.current.srcObject = stream;
      return;
    }
    if (info?.cameraStreamId === stream.id) {
      if (cameraVideoRef.current) cameraVideoRef.current.srcObject = stream;
      return;
    }

    const queue = pendingStreamsRef.current.get(fromSocketId) ?? [];
    queue.push(stream);
    pendingStreamsRef.current.set(fromSocketId, queue);

    if (!screenVideoRef.current?.srcObject) {
      if (screenVideoRef.current) screenVideoRef.current.srcObject = stream;
    } else if (!cameraVideoRef.current?.srcObject) {
      if (cameraVideoRef.current) cameraVideoRef.current.srcObject = stream;
    }
  };

  // once stream-info arrives, go back and correctly assign any streams that
  // were queued up before we knew which was which
  const reconcileStreams = (fromSocketId: string) => {
    const info = streamInfoRef.current.get(fromSocketId);
    const queue = pendingStreamsRef.current.get(fromSocketId);
    if (!info || !queue) return;

    queue.forEach((stream) => {
      if (info.screenStreamId === stream.id && screenVideoRef.current) {
        screenVideoRef.current.srcObject = stream;
      } else if (info.cameraStreamId === stream.id && cameraVideoRef.current) {
        cameraVideoRef.current.srcObject = stream;
      }
    });
  };

  useEffect(() => {
    if (!roomId || !user) return;

    socket.connect();

    socket.on("connect", () => {
      socket.emit("join-room", { roomId, name: displayName, role });
    });

    socket.on("joined", ({ viewerCount }: { viewerCount: number }) => {
      setConnectionStatus("connected");
      setViewerCount(viewerCount);
    });

    socket.on("system-message", (text: string) => {
      itemId.current += 1;
      setFeed((prev) => [...prev, { id: itemId.current, type: "system", text }]);
    });

    socket.on("viewer-count", (count: number) => setViewerCount(count));

    socket.on(
      "chat-message",
      ({ name, message, time }: { name: string; message: string; time: number }) => {
        itemId.current += 1;
        setFeed((prev) => [...prev, { id: itemId.current, type: "chat", name, message, time }]);
      }
    );

    socket.on("viewer-joined", ({ socketId }: { socketId: string; name: string }) => {
      if (role !== "host") return;
      knownViewersRef.current.add(socketId);
      if (screenStreamRef.current || cameraStreamRef.current) {
        connectToViewer(socketId);
      }
    });

    socket.on(
      "webrtc-offer",
      async ({ fromSocketId, offer }: { fromSocketId: string; offer: RTCSessionDescriptionInit }) => {
        let pc = peerConnectionsRef.current.get(fromSocketId);

        if (!pc) {
          pc = createPeerConnection(
            (candidate) => {
              socket.emit("webrtc-ice-candidate", { targetSocketId: fromSocketId, candidate });
            },
            (stream) => routeIncomingStream(fromSocketId, stream)
          );
          peerConnectionsRef.current.set(fromSocketId, pc);
        }

        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socket.emit("webrtc-answer", { targetSocketId: fromSocketId, answer });
      }
    );

    socket.on(
      "stream-info",
      ({
        fromSocketId,
        screenStreamId,
        cameraStreamId,
      }: {
        fromSocketId: string;
        screenStreamId: string | null;
        cameraStreamId: string | null;
      }) => {
        streamInfoRef.current.set(fromSocketId, { screenStreamId, cameraStreamId });
        reconcileStreams(fromSocketId);
      }
    );

    socket.on(
      "webrtc-answer",
      async ({ fromSocketId, answer }: { fromSocketId: string; answer: RTCSessionDescriptionInit }) => {
        const pc = peerConnectionsRef.current.get(fromSocketId);
        if (pc) await pc.setRemoteDescription(new RTCSessionDescription(answer));
      }
    );

    socket.on(
      "webrtc-ice-candidate",
      async ({ fromSocketId, candidate }: { fromSocketId: string; candidate: RTCIceCandidateInit }) => {
        const pc = peerConnectionsRef.current.get(fromSocketId);
        if (pc) await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
    );

    // Viewer: host ended the session
    socket.on("session-ended", () => {
      console.log("[socket] received session-ended"); // TEMP debug — remove once confirmed working
      setSessionEnded(true);
    });

    return () => {
      socket.off("connect");
      socket.off("joined");
      socket.off("system-message");
      socket.off("viewer-count");
      socket.off("chat-message");
      socket.off("viewer-joined");
      socket.off("webrtc-offer");
      socket.off("webrtc-answer");
      socket.off("webrtc-ice-candidate");
      socket.off("stream-info");
      socket.off("session-ended");
      socket.disconnect();
      peerConnectionsRef.current.forEach((pc) => pc.close());
      peerConnectionsRef.current.clear();
    };
  }, [roomId, user, role, displayName]);

  // auto-scroll chat to the bottom whenever the feed updates
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [feed]);

  const sendStreamInfo = (targetSocketId: string) => {
    socket.emit("stream-info", {
      targetSocketId,
      screenStreamId: screenStreamRef.current?.id ?? null,
      cameraStreamId: cameraStreamRef.current?.id ?? null,
    });
  };

  const connectToViewer = async (viewerSocketId: string) => {
    if (peerConnectionsRef.current.has(viewerSocketId)) return;

    const pc = createPeerConnection(
      (candidate) => {
        socket.emit("webrtc-ice-candidate", { targetSocketId: viewerSocketId, candidate });
      },
      () => {}
    );

    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, screenStreamRef.current!);
      });
    }
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, cameraStreamRef.current!);
      });
    }

    peerConnectionsRef.current.set(viewerSocketId, pc);
    await capVideoBitrate(pc, 700);

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit("webrtc-offer", { targetSocketId: viewerSocketId, offer });
    sendStreamInfo(viewerSocketId);
  };

  // used when a viewer is already connected and we need to add a new track
  // (e.g. camera turned on after screen share already started)
  const addTrackAndRenegotiate = async (
    viewerSocketId: string,
    pc: RTCPeerConnection,
    stream: MediaStream
  ) => {
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    await capVideoBitrate(pc, 700);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit("webrtc-offer", { targetSocketId: viewerSocketId, offer });
    sendStreamInfo(viewerSocketId);
  };

  const broadcastToAllViewers = (stream: MediaStream) => {
    knownViewersRef.current.forEach((viewerSocketId) => {
      const existingPc = peerConnectionsRef.current.get(viewerSocketId);
      if (existingPc) {
        addTrackAndRenegotiate(viewerSocketId, existingPc, stream);
      } else {
        connectToViewer(viewerSocketId);
      }
    });
  };

  const handleShareScreen = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { width: 1280, height: 720, frameRate: 15 },
        audio: true,
      });
      screenStreamRef.current = stream;
      if (screenVideoRef.current) screenVideoRef.current.srcObject = stream;
      setIsSharingScreen(true);

      // if the user stops sharing from the browser's own UI, clean up here too
      stream.getVideoTracks()[0].onended = () => handleStopShare();

      broadcastToAllViewers(stream);
    } catch (err) {
      console.error("Screen share failed or was cancelled:", err);
    }
  };

  const handleStopShare = () => {
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;
    setIsSharingScreen(false);
    if (screenVideoRef.current) screenVideoRef.current.srcObject = null;
  };

  const startCameraStream = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480, frameRate: 24 },
      audio: true,
    });
    cameraStreamRef.current = stream;
    if (cameraVideoRef.current) cameraVideoRef.current.srcObject = stream;
    setHasCameraSession(true);
    broadcastToAllViewers(stream);
    return stream;
  };

  const toggleCamVideo = async () => {
    try {
      if (!cameraStreamRef.current) {
        await startCameraStream();
        setIsCamVideoOn(true);
        setIsMicOn(true);
        return;
      }
      cameraStreamRef.current.getVideoTracks().forEach((track) => (track.enabled = !isCamVideoOn));
      setIsCamVideoOn(!isCamVideoOn);
    } catch (err) {
      console.error("Camera access failed:", err);
    }
  };

  const toggleMic = async () => {
    try {
      if (!cameraStreamRef.current) {
        await startCameraStream();
        setIsCamVideoOn(true);
        setIsMicOn(true);
        return;
      }
      cameraStreamRef.current.getAudioTracks().forEach((track) => (track.enabled = !isMicOn));
      setIsMicOn(!isMicOn);
    } catch (err) {
      console.error("Mic access failed:", err);
    }
  };

  const stopCameraStream = () => {
    cameraStreamRef.current?.getTracks().forEach((t) => t.stop());
    cameraStreamRef.current = null;
    setHasCameraSession(false);
    setIsCamVideoOn(false);
    setIsMicOn(false);
    if (cameraVideoRef.current) cameraVideoRef.current.srcObject = null;
  };

  const handleEndLiveSession = () => {
    console.log("[socket] emitting end-session for room", roomId); // TEMP debug
    socket.emit("end-session", { roomId });
    handleStopShare();
    stopCameraStream();
    peerConnectionsRef.current.forEach((pc) => pc.close());
    peerConnectionsRef.current.clear();
    router.push("/");
  };

  const handleLeaveRoom = () => {
    router.push("/");
  };

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = chatInput.trim();
    if (!trimmed) return;
    socket.emit("chat-message", { roomId, name: displayName, message: trimmed });
    setChatInput("");
  };

  const insertEmoji = (emoji: string) => {
    setChatInput((prev) => prev + emoji);
    setShowEmojiPicker(false);
  };

  const formatTime = (timestamp: number) =>
    new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  if (sessionEnded) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">The host has ended this live session.</h1>
          <p className="text-gray-400 mb-6">Thanks for watching!</p>
          <button
            onClick={() => router.push("/")}
            className="bg-indigo-500 hover:bg-indigo-600 text-white px-6 py-3 rounded-lg transition"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white flex">
      <div className="flex-1 p-6 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-indigo-400">StreamSync</h1>
          <div className="flex items-center gap-3">
            <div className="bg-[#12121a] border border-gray-800 rounded-lg px-3 py-1 text-sm text-gray-300">
              Room ID: {roomId}
            </div>

            {role === "host" ? (
              <button
                onClick={handleEndLiveSession}
                className="bg-red-600 hover:bg-red-700 text-white text-sm px-3 py-1.5 rounded-lg transition"
              >
                End Live Session
              </button>
            ) : (
              <button
                onClick={handleLeaveRoom}
                className="border border-gray-700 hover:bg-gray-900 text-white text-sm px-3 py-1.5 rounded-lg transition"
              >
                Leave Room
              </button>
            )}
          </div>
        </div>

        {roomTitle && (
          <div className="mb-4">
            <h2 className="text-2xl font-bold">{roomTitle}</h2>
            {roomDescription && (
              <p className="text-gray-400 text-sm mt-1 max-w-2xl">{roomDescription}</p>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 mb-4">
          <span
            className={`w-2 h-2 rounded-full ${
              connectionStatus === "connected" ? "bg-green-400" : "bg-yellow-400 animate-pulse"
            }`}
          />
          <span className="text-sm text-gray-400">
            {connectionStatus === "connected"
              ? `Connected · ${viewerCount} online`
              : "Connecting to host..."}
          </span>
        </div>

        <div className="flex-1 bg-[#0d0d12] border border-gray-800 rounded-2xl flex items-center justify-center relative overflow-hidden">
          <video
            ref={screenVideoRef}
            autoPlay
            playsInline
            className={`w-full h-full object-contain ${
              isSharingScreen || role === "viewer" ? "" : "hidden"
            }`}
          />

          <video
            ref={cameraVideoRef}
            autoPlay
            playsInline
            muted={role === "host"}
            className={`absolute bottom-20 right-4 w-40 h-28 rounded-lg object-cover border border-gray-700 bg-black ${
              (isCamVideoOn && hasCameraSession) || role === "viewer" ? "" : "hidden"
            }`}
          />

          {role === "host" && !isSharingScreen && !hasCameraSession && (
            <div className="text-center">
              <p className="text-lg font-semibold mb-1">Ready to present</p>
              <p className="text-gray-500 text-sm mb-4">
                Share your screen or turn on your camera to start.
              </p>
            </div>
          )}

          {role === "viewer" && !isSharingScreen && !isCamVideoOn && (
            <p className="absolute bottom-4 text-gray-500 text-xs">
              Waiting for host to start streaming...
            </p>
          )}

          {/* Floating control bar — host only */}
          {role === "host" && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-black/70 backdrop-blur-md rounded-full px-4 py-3 border border-gray-700">
              {/* Camera toggle */}
              <button
                onClick={toggleCamVideo}
                title="Toggle camera"
                className={`w-11 h-11 rounded-full flex items-center justify-center transition ${
                  isCamVideoOn && hasCameraSession
                    ? "bg-gray-700 hover:bg-gray-600"
                    : "bg-red-500 hover:bg-red-600"
                }`}
              >
                <Image
                  src={isCamVideoOn && hasCameraSession ? "/icons/camera_on.svg" : "/icons/camera_off.svg"}
                  alt="camera toggle"
                  width={20}
                  height={20}
                />
              </button>

              {/* Mic toggle */}
              <button
                onClick={toggleMic}
                title="Toggle microphone"
                className={`w-11 h-11 rounded-full flex items-center justify-center transition ${
                  isMicOn && hasCameraSession
                    ? "bg-gray-700 hover:bg-gray-600"
                    : "bg-red-500 hover:bg-red-600"
                }`}
              >
                <Image
                  src={isMicOn && hasCameraSession ? "/icons/mic_on.svg" : "/icons/mic_off.svg"}
                  alt="mic toggle"
                  width={20}
                  height={20}
                />
              </button>

              {/* Divider */}
              <div className="w-px h-6 bg-gray-600" />

              {/* Screen share toggle */}
              <button
                onClick={isSharingScreen ? handleStopShare : handleShareScreen}
                title="Toggle screen share"
                className={`w-11 h-11 rounded-full flex items-center justify-center transition ${
                  isSharingScreen
                    ? "bg-indigo-500 hover:bg-indigo-600"
                    : "bg-gray-700 hover:bg-gray-600"
                }`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                  <line x1="8" y1="21" x2="16" y2="21" />
                  <line x1="12" y1="17" x2="12" y2="21" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Chat panel */}
      <div className="w-80 border-l border-gray-800 flex flex-col bg-[#0d0d12]">
        <div className="px-4 py-3 border-b border-gray-800 font-semibold">Live Chat</div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {feed.map((item) => {
            if (item.type === "system") {
              return (
                <p
                  key={item.id}
                  className="text-center text-gray-500 text-[11px] bg-gray-900/50 rounded-full px-3 py-1 mx-auto w-fit"
                >
                  {item.text}
                </p>
              );
            }
            const isMe = item.name === displayName;
            return (
              <div key={item.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                {!isMe && (
                  <span className="text-xs text-gray-500 mb-0.5">
                    {item.name} · {formatTime(item.time)}
                  </span>
                )}
                <div
                  className={`max-w-[220px] px-3 py-2 rounded-xl text-sm ${
                    isMe
                      ? "bg-indigo-500 text-white rounded-br-sm"
                      : "bg-gray-800 text-gray-100 rounded-bl-sm"
                  }`}
                >
                  {item.message}
                </div>
                {isMe && (
                  <span className="text-xs text-gray-500 mt-0.5">
                    You · {formatTime(item.time)}
                  </span>
                )}
              </div>
            );
          })}
          <div ref={chatEndRef} />
        </div>

        <div className="relative">
          {showEmojiPicker && (
            <div className="absolute bottom-full mb-2 left-3 bg-[#1a1a24] border border-gray-800 rounded-lg p-2 flex flex-wrap gap-1 w-64">
              {EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => insertEmoji(emoji)}
                  className="text-xl hover:bg-gray-800 rounded p-1 transition"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={sendMessage} className="p-3 border-t border-gray-800 flex gap-2">
            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="text-lg px-1"
              title="Emoji"
            >
              😊
            </button>
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 bg-[#0a0a0f] border border-gray-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
            />
            <button
              type="submit"
              className="bg-indigo-500 hover:bg-indigo-600 text-white px-4 rounded-lg text-sm transition"
            >
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}