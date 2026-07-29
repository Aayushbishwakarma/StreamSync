"use client";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const { signInWithGoogle, signInWithEmail } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setError("");
    try {
      await signInWithGoogle();
      router.push("/");
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signInWithEmail(email, password);
      router.push("/");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="w-14 h-14 rounded-xl bg-indigo-500 flex items-center justify-center mb-4">
        <span className="text-white text-2xl font-bold">S</span>
      </div>
      <h1 className="text-white text-2xl font-bold">StreamSync</h1>
      <p className="text-gray-400 text-sm mb-8">Professional Creator Studio</p>

      <div className="bg-[#12121a] border border-gray-800 rounded-2xl p-8 w-full max-w-sm">
        <h2 className="text-white text-xl font-semibold mb-1">Welcome back</h2>
        <p className="text-gray-400 text-sm mb-6">Access your studio and manage your sessions.</p>

        <form onSubmit={handleEmailLogin} className="space-y-4">
          <div>
            <label className="text-gray-400 text-xs font-semibold tracking-wide">
              EMAIL ADDRESS
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="alex@creators.com"
              required
              className="w-full mt-1 bg-[#0a0a0f] border border-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <div className="flex justify-between items-center">
              <label className="text-gray-400 text-xs font-semibold tracking-wide">
                PASSWORD
              </label>
              <span className="text-indigo-400 text-xs cursor-pointer">Forgot Password?</span>
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full mt-1 bg-[#0a0a0f] border border-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
            />
          </div>

          {error && <p className="text-red-400 text-xs">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-semibold py-3 rounded-lg transition disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div className="flex items-center gap-2 my-6">
          <div className="flex-1 h-px bg-gray-800" />
          <span className="text-gray-500 text-xs">OR CONTINUE WITH</span>
          <div className="flex-1 h-px bg-gray-800" />
        </div>

        <button
          onClick={handleGoogleLogin}
          className="w-full bg-[#1a1a24] hover:bg-[#22222e] border border-gray-800 text-white font-medium py-3 rounded-lg transition"
        >
          Continue with Google
        </button>
      </div>

      <p className="text-gray-400 text-sm mt-6">
        Don&apos;t have an account?{" "}
        <span className="text-indigo-400 cursor-pointer">Create an account</span>
      </p>
    </div>
  );
}