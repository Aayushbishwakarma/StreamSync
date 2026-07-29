import { Elysia, t } from "elysia";
import { db } from "../db";
import { otpCodes } from "../db/schema";
import { sendOtpEmail } from "../utils/mailer";
import { eq, and, gt } from "drizzle-orm";

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6 digits
}

export const otpRoutes = new Elysia({ prefix: "/auth" })
  .post(
    "/send-otp",
    async ({ body }) => {
      const { email, fullName } = body;
      const code = generateCode();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min

      await db.insert(otpCodes).values({ email, code, expiresAt });
      await sendOtpEmail(email, fullName ?? "", code);

      return { success: true };
    },
    {
      body: t.Object({
        email: t.String(),
        fullName: t.Optional(t.String()),
      }),
    }
  )
  .post(
    "/verify-otp",
    async ({ body, set }) => {
      const { email, code } = body;

      const [match] = await db
        .select()
        .from(otpCodes)
        .where(
          and(
            eq(otpCodes.email, email),
            eq(otpCodes.code, code),
            eq(otpCodes.verified, false),
            gt(otpCodes.expiresAt, new Date())
          )
        )
        .limit(1);

      if (!match) {
        set.status = 400;
        return { success: false, message: "Invalid or expired code." };
      }

      await db.update(otpCodes).set({ verified: true }).where(eq(otpCodes.id, match.id));

      return { success: true };
    },
    {
      body: t.Object({
        email: t.String(),
        code: t.String(),
      }),
    }
  );