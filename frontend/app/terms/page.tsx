export default function TermsPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-16 text-gray-300">
      <h1 className="text-2xl font-bold text-white mb-6">Terms of Service</h1>

      <p className="mb-4">
        Welcome to StreamSync. By creating an account, you agree to the following terms.
      </p>

      <h2 className="text-lg font-semibold text-white mt-6 mb-2">1. Your Account</h2>
      <p className="mb-4">
        You are responsible for keeping your login credentials secure. You must be at least
        13 years old to use StreamSync. You agree to provide accurate information when creating
        your account.
      </p>

      <h2 className="text-lg font-semibold text-white mt-6 mb-2">2. Recording & Streaming</h2>
      <p className="mb-4">
        StreamSync allows you to record and stream video sessions. You are responsible for the
        content you create, and you agree not to upload or stream illegal, harmful, or infringing
        content.
      </p>

      <h2 className="text-lg font-semibold text-white mt-6 mb-2">3. Data & Storage</h2>
      <p className="mb-4">
        Recordings and chat data are stored securely and are accessible only to you and
        participants you invite, unless you choose to make a session public.
      </p>

      <h2 className="text-lg font-semibold text-white mt-6 mb-2">4. Termination</h2>
      <p className="mb-4">
        We may suspend accounts that violate these terms or misuse the platform.
      </p>

      <p className="text-gray-500 text-sm mt-10">Last updated: July 2026</p>
    </div>
  );
}