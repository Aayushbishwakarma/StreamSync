import "./global.css";
import { AuthProvider } from "@/context/AuthContext";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[#0a0a0f]">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}