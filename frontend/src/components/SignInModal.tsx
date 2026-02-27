import { useState } from "react";

interface Props {
  onSignIn: (email: string) => Promise<{ error: Error | null }>;
  onClose: () => void;
}

export function SignInModal({ onSignIn, onClose }: Props) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await onSignIn(email);
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        {sent ? (
          <>
            <h3>Check your email</h3>
            <p className="modal-body">
              We sent a sign-in link to <strong>{email}</strong>. Click it to sign in — no password needed.
            </p>
          </>
        ) : (
          <>
            <h3>Sign in</h3>
            <p className="modal-body">
              Enter your email and we'll send you a sign-in link. Your list will be saved and accessible from any device.
            </p>
            <form onSubmit={handleSubmit}>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
              {error && <p className="modal-error">{error}</p>}
              <button type="submit" className="btn-primary" style={{ marginTop: "0.75rem" }} disabled={loading}>
                {loading ? "Sending..." : "Send me a link"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
