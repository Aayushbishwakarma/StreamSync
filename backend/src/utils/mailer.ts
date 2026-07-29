import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendOtpEmail(to: string, fullName: string, code: string) {
  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject: "Your StreamSync verification code",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>Hi ${fullName || "there"},</h2>
        <p>Use the code below to verify your email and finish creating your StreamSync account:</p>
        <div style="font-size: 32px; font-weight: bold; letter-spacing: 6px; margin: 20px 0;">
          ${code}
        </div>
        <p>This code expires in <b>10 minutes</b>. If you didn't request this, you can safely ignore this email.</p>
        <p style="color: #888; font-size: 12px; margin-top: 30px;">— The StreamSync Team</p>
      </div>
    `,
  });
}