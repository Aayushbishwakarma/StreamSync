"use client";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SignupPage() {
  const { signUpWithEmail, signInWithGoogle } = useAuth();
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!agreed) {
      setError("You must agree to the Terms of Service and Privacy Policy.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters with one special symbol.");
      return;
    }

    setLoading(true);
    try {
      // create the Firebase account first
      await signUpWithEmail(email, password);

      // then ask our backend to generate and email an OTP
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, fullName }),
      });

      if (!res.ok) throw new Error("Failed to send OTP email");

      // and finally send them to verify it
      router.push(`/verify-otp?email=${encodeURIComponent(email)}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    setError("");
    try {
      await signInWithGoogle();
      router.push("/"); // Google accounts are already verified by Google
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="bg-[#12121a] border border-gray-800 rounded-2xl p-8 w-full max-w-sm">
        <h1 className="text-white text-xl font-bold text-center">StreamSync</h1>
        <h2 className="text-white text-lg font-semibold text-center mt-4">Create your studio</h2>
        <p className="text-gray-400 text-sm text-center mb-6">
          Start recording high-performance sessions today.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-gray-400 text-xs font-semibold">FULL NAME</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Alex Rivera"
              required
              className="w-full mt-1 bg-[#0a0a0f] border border-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="text-gray-400 text-xs font-semibold">EMAIL ADDRESS</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="alex@streamsync.io"
              required
              className="w-full mt-1 bg-[#0a0a0f] border border-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="text-gray-400 text-xs font-semibold">PASSWORD</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••"
                required
                className="w-full mt-1 bg-[#0a0a0f] border border-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            <p className="text-gray-500 text-xs mt-1">
              Must be at least 8 characters with one special symbol.
            </p>
          </div>

          <div className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-1"
            />
            <p className="text-gray-400 text-xs">
              I agree to the{" "}
              <Link href="/terms" target="_blank" className="text-indigo-400 underline">
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link href="/privacy" target="_blank" className="text-indigo-400 underline">
                Privacy Policy
              </Link>
              .
            </p>
          </div>

          {error && <p className="text-red-400 text-xs">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-semibold py-3 rounded-lg transition disabled:opacity-50"
          >
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </form>

        <div className="flex items-center gap-2 my-6">
          <div className="flex-1 h-px bg-gray-800" />
          <span className="text-gray-500 text-xs">OR CONTINUE WITH</span>
          <div className="flex-1 h-px bg-gray-800" />
        </div>

        <button
          onClick={handleGoogleSignup}
          className="w-full bg-[#1a1a24] hover:bg-[#22222e] border border-gray-800 text-white font-medium py-3 rounded-lg transition"
        >
          Continue with Google
        </button>

        <p className="text-gray-400 text-sm text-center mt-6">
          Already have an account?{" "}
          <button
            onClick={() => router.push("/login")}
            className="text-indigo-400 hover:underline cursor-pointer"
          >
            Sign In
          </button>
        </p>
      </div>
    </div>
  );
}