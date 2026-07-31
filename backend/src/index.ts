import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { Server } from "socket.io";
import { otpRoutes } from "./routes/otp";
import { roomRoutes } from "./routes/rooms";

const app = new Elysia()
  .use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:3000" }))
  .use(otpRoutes)
  .use(roomRoutes)
  .get("/", () => "StreamSync backend running")
  .listen(process.env.PORT ? Number(process.env.PORT) : 4000);

console.log(` Elysia API running at http://localhost:${app.server?.port}`);

// --- Attach Socket.IO to the SAME underlying server ---
const io = new Server(app.server! as any, {
  cors: { origin: process.env.FRONTEND_URL || "http://localhost:3000" },
});

type RoomMember = { socketId: string; name: string; role: string };
const rooms = new Map<string, RoomMember[]>();

io.on("connection", (socket) => {
  let currentRoomId: string | null = null;

  socket.on("join-room", ({ roomId, name, role }) => {
    currentRoomId = roomId;
    socket.join(roomId);

    const members = rooms.get(roomId) ?? [];
    members.push({ socketId: socket.id, name, role });
    rooms.set(roomId, members);

    socket.to(roomId).emit("system-message", `${name} joined the room`);
    io.to(roomId).emit("viewer-count", members.length);
    socket.emit("joined", { roomId, viewerCount: members.length });

    if (role === "viewer") {
      const host = members.find((m) => m.role === "host");
      if (host) {
        io.to(host.socketId).emit("viewer-joined", { socketId: socket.id, name });
        socket.emit("host-info", { socketId: host.socketId });
      }
    }
  });

  socket.on("chat-message", ({ roomId, name, message }) => {
    io.to(roomId).emit("chat-message", { name, message, time: Date.now() });
  });

  socket.on("webrtc-offer", ({ targetSocketId, offer }) => {
    io.to(targetSocketId).emit("webrtc-offer", { fromSocketId: socket.id, offer });
  });

  socket.on("webrtc-answer", ({ targetSocketId, answer }) => {
    io.to(targetSocketId).emit("webrtc-answer", { fromSocketId: socket.id, answer });
  });

  socket.on("webrtc-ice-candidate", ({ targetSocketId, candidate }) => {
    io.to(targetSocketId).emit("webrtc-ice-candidate", { fromSocketId: socket.id, candidate });
  });

  socket.on("stream-info", ({ targetSocketId, screenStreamId, cameraStreamId }) => {
    io.to(targetSocketId).emit("stream-info", {
      fromSocketId: socket.id,
      screenStreamId,
      cameraStreamId,
    });
  });

  socket.on("end-session", ({ roomId }) => {
    io.to(roomId).emit("session-ended");
  });

  socket.on("disconnect", () => {
    if (!currentRoomId) return;

    const members = rooms.get(currentRoomId) ?? [];
    const leaving = members.find((m) => m.socketId === socket.id);
    const updated = members.filter((m) => m.socketId !== socket.id);
    rooms.set(currentRoomId, updated);

    if (leaving) {
      socket.to(currentRoomId).emit("system-message", `${leaving.name} left the room`);
    }
    io.to(currentRoomId).emit("viewer-count", updated.length);
  });
});

console.log(" Socket.IO attached to the same server");