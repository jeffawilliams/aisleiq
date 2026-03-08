import { useState } from "react";

interface Props {
  onSubmit: (category: string, message: string, email: string) => Promise<{ error: unknown }>;
  onClose: () => void;
  userEmail: string | null;
}

export function FeedbackModal({ onSubmit, onClose, userEmail }: Props) {
  const [category, setCategory] = useState("bug");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState(userEmail ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const { error } = await onSubmit(category, message, email);
    setSubmitting(false);
    if (error) {
      setError("Something went wrong. Please try again.");
    } else {
      setSubmitted(true);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        {submitted ? (
          <>
            <h3>Thanks!</h3>
            <p className="modal-body">Your feedback was received.</p>
            <button className="btn-primary" onClick={onClose}>Close</button>
          </>
        ) : (
          <>
            <h3>Send Feedback</h3>
            <form onSubmit={handleSubmit}>
              <select
                className="feedback-category-select"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="bug">Bug Report</option>
                <option value="enhancement">Feature Request</option>
                <option value="question">Question</option>
                <option value="comment">General Comment</option>
              </select>
              <textarea
                className="feedback-message"
                rows={4}
                placeholder="What's on your mind?"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
              />
              <input
                type="email"
                placeholder="your@email.com (optional — if you'd like a reply)"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              {error && <p className="modal-error">{error}</p>}
              <button
                type="submit"
                className="btn-primary"
                style={{ marginTop: "0.75rem" }}
                disabled={submitting}
              >
                {submitting ? "Sending…" : "Send Feedback"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
