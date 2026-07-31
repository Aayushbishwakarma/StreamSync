import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { otpRoutes } from "./routes/otp";
import { roomRoutes } from "./routes/rooms";

const app = new Elysia()
  .use(cors({ origin: "http://localhost:3000" }))
  .use(otpRoutes)
  .use(roomRoutes)
  .get("/", () => "StreamSync backend running")
  .listen(4000);

console.log(`Backend running at http://localhost:${app.server?.port}`);