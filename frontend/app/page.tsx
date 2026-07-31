"use client";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";

export default function DashboardPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [camOn, setCamOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [networkBars, setNetworkBars] = useState(0);

  const [streamTitle, setStreamTitle] = useState("");
  const [streamDescription, setStreamDescription] = useState("");
  const [joinRoomInput, setJoinRoomInput] = useState("");

  // avoid hydration mismatches by waiting until we're mounted client-side
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (mounted && !loading && !user) router.push("/login");
  }, [mounted, user, loading, router]);

  // Start camera + mic once user is confirmed logged in
  useEffect(() => {
    if (!mounted || !user) return;

    let active = true;
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        if (!active) return;
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch((err) => console.error("Camera/mic permission error:", err));

    return () => {
      active = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [mounted, user]);

  const toggleCamera = () => {
    const stream = streamRef.current;
    if (!stream) return;
    stream.getVideoTracks().forEach((track) => (track.enabled = !camOn));
    setCamOn(!camOn);
  };

  const toggleMic = () => {
    const stream = streamRef.current;
    if (!stream) return;
    stream.getAudioTracks().forEach((track) => (track.enabled = !micOn));
    setMicOn(!micOn);
  };

  // Real network strength reading — prefer the Network Information API when
  // it's available, otherwise fall back to timing a small fetch ourselves
  useEffect(() => {
    const conn = (navigator as any).connection;

    function updateFromConnectionAPI() {
      if (!conn) return;
      const downlink = conn.downlink;
      const type = conn.effectiveType;

      let bars = 1;
      if (type === "4g" && downlink >= 5) bars = 4;
      else if (type === "4g") bars = 3;
      else if (type === "3g") bars = 2;
      else bars = 1;

      setNetworkBars(bars);
    }

    async function pingFallback() {
      try {
        const start = performance.now();
        await fetch("/favicon.ico", { cache: "no-store" });
        const duration = performance.now() - start;

        let bars = 1;
        if (duration < 100) bars = 4;
        else if (duration < 300) bars = 3;
        else if (duration < 600) bars = 2;
        setNetworkBars(bars);
      } catch {
        setNetworkBars(0);
      }
    }

    if (conn) {
      updateFromConnectionAPI();
      conn.addEventListener("change", updateFromConnectionAPI);
      return () => conn.removeEventListener("change", updateFromConnectionAPI);
    } else {
      pingFallback();
      const interval = setInterval(pingFallback, 10000);
      return () => clearInterval(interval);
    }
  }, []);

  // Validation for Go Live
  const titleValid = streamTitle.trim().length > 0;
  const descriptionWordCount = streamDescription.trim().split(/\s+/).filter(Boolean).length;
  const descriptionValid = descriptionWordCount > 5;
  const canGoLive = titleValid && descriptionValid;

  const handleGoLive = async () => {
    if (!canGoLive || !user?.email) return;

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/rooms/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hostEmail: user.email,
          title: streamTitle,
          description: streamDescription,
        }),
      });

      const data = await res.json();
      if (!data.success) throw new Error("Failed to create room");

      router.push(`/room/${data.roomId}?role=host`);
    } catch (err) {
      console.error("Go Live failed:", err);
    }
  };

  const handleJoinRoom = () => {
    const input = joinRoomInput.trim();
    if (!input) return;

    // Extract room ID whether user pasted a full link or just the ID
    const match = input.match(/room-[a-zA-Z0-9]+/);
    const roomId = match ? match[0] : input;

    router.push(`/room/${roomId}?role=viewer`);
  };

  if (!mounted || loading) {
    return <p className="text-white text-center mt-20">Loading...</p>;
  }
  if (!user) return null;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <Image src="/icons/main_logo.png" alt="StreamSync" width={28} height={28} />
          <span className="font-bold text-indigo-400">StreamSync</span>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full overflow-hidden border border-gray-700">
            {user.photoURL ? (
              <img src={user.photoURL} alt="avatar" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gray-700 flex items-center justify-center text-xs">
                {user.email?.[0].toUpperCase()}
              </div>
            )}
          </div>

          <button
            onClick={logout}
            title="Log out"
            className="p-2 rounded-lg border border-gray-700 hover:bg-gray-900 transition"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-gray-300"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="px-8 py-10 max-w-6xl mx-auto flex flex-col md:flex-row items-start gap-10">
        <div className="max-w-sm w-full">
          <h1 className="text-3xl font-bold mb-2">Start your session.</h1>
          <p className="text-gray-400 mb-6">High-performance recording, simplified.</p>

          {/* Stream Title */}
          <div className="mb-4">
            <label className="text-gray-400 text-xs font-semibold tracking-wide">
              STREAM TITLE
            </label>
            <input
              type="text"
              value={streamTitle}
              onChange={(e) => setStreamTitle(e.target.value)}
              placeholder="Enter a catchy title..."
              className="w-full mt-1 bg-[#0a0a0f] border border-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Stream Description */}
          <div className="mb-2">
            <label className="text-gray-400 text-xs font-semibold tracking-wide">
              STREAM DESCRIPTION
            </label>
            <textarea
              value={streamDescription}
              onChange={(e) => setStreamDescription(e.target.value)}
              placeholder="What's this stream about?"
              rows={3}
              className="w-full mt-1 bg-[#0a0a0f] border border-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 resize-none"
            />
            {streamDescription.trim().length > 0 && !descriptionValid && (
              <p className="text-amber-400 text-xs mt-1">
                Description needs more than 5 words ({descriptionWordCount}/6)
              </p>
            )}
          </div>

          {/* Go Live button */}
          <button
            onClick={handleGoLive}
            disabled={!canGoLive}
            className={`w-full font-semibold py-3 rounded-lg transition mt-4 flex items-center justify-center gap-2 ${
              canGoLive
                ? "bg-indigo-500 hover:bg-indigo-600 text-white cursor-pointer"
                : "bg-gray-800 text-gray-500 cursor-not-allowed"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                canGoLive ? "bg-red-500 animate-pulse" : "bg-gray-600"
              }`}
            />
            Go Live (Create Room)
          </button>

          {!canGoLive && (
            <p className="text-indigo-400 text-xs text-center mt-2">
              Enter a title and description to start your stream
            </p>
          )}

          {/* Join Room — input on the left, button on the right */}
          <div className="flex items-center gap-2 mt-3">
            <input
              type="text"
              value={joinRoomInput}
              onChange={(e) => setJoinRoomInput(e.target.value)}
              placeholder="Enter room ID or paste link"
              className="flex-1 bg-[#0a0a0f] border border-gray-800 rounded-lg px-3 py-3 text-white text-sm focus:outline-none focus:border-indigo-500"
            />
            <button
              onClick={handleJoinRoom}
              disabled={!joinRoomInput.trim()}
              className={`shrink-0 px-5 py-3 rounded-lg font-medium transition flex items-center gap-2 ${
                joinRoomInput.trim()
                  ? "border border-gray-700 hover:bg-gray-900 text-white"
                  : "border border-gray-800 text-gray-600 cursor-not-allowed"
              }`}
            >
              → Join
            </button>
          </div>

          <p className="text-gray-400 text-xs text-center mt-6 flex items-center justify-center gap-1">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            End-to-end encrypted sessions
          </p>
        </div>

        {/* Bigger camera preview */}
        <div className="w-full md:w-[480px] h-[320px] rounded-2xl overflow-hidden border border-gray-800 relative bg-black shrink-0">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className={`w-full h-full object-cover ${camOn ? "" : "hidden"}`}
          />
          {!camOn && (
            <div className="w-full h-full flex items-center justify-center bg-gray-900 text-gray-500 text-sm">
              Camera is off
            </div>
          )}

          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between bg-black/60 backdrop-blur rounded-lg px-3 py-2">
            <div className="flex items-center gap-3">
              <button onClick={toggleCamera} title="Toggle camera">
                <Image
                  src={camOn ? "/icons/camera_on.svg" : "/icons/camera_off.svg"}
                  alt="camera toggle"
                  width={20}
                  height={20}
                />
              </button>
              <button onClick={toggleMic} title="Toggle microphone">
                <Image
                  src={micOn ? "/icons/mic_on.svg" : "/icons/mic_off.svg"}
                  alt="mic toggle"
                  width={20}
                  height={20}
                />
              </button>
            </div>

            <div className="flex items-end gap-[2px] h-4" title={`Signal: ${networkBars}/4`}>
              {[1, 2, 3, 4].map((bar) => (
                <div
                  key={bar}
                  className={`w-1 rounded-sm ${
                    bar <= networkBars ? "bg-green-400" : "bg-gray-700"
                  }`}
                  style={{ height: `${bar * 25}%` }}
                />
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}