import { Elysia, t } from "elysia";
import { db } from "../db";
import { rooms } from "../db/schema";
import { eq } from "drizzle-orm";

function generateRoomId() {
  const random = Math.random().toString(36).substring(2, 8);
  return `room-${random}`;
}

export const roomRoutes = new Elysia({ prefix: "/rooms" })
  .post(
    "/create",
    async ({ body }) => {
      const { hostEmail, title, description } = body;
      const id = generateRoomId();

      await db.insert(rooms).values({ id, hostEmail, title, description });

      return { success: true, roomId: id };
    },
    {
      body: t.Object({
        hostEmail: t.String(),
        title: t.String(),
        description: t.String(),
      }),
    }
  )
  .get("/:id", async ({ params, set }) => {
    const [room] = await db.select().from(rooms).where(eq(rooms.id, params.id)).limit(1);

    if (!room) {
      set.status = 404;
      return { success: false, message: "Room not found" };
    }

    return { success: true, room };
  });