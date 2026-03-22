import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { verifyEmailToken } from "@/lib/api";

type VerifyState = "verifying" | "success" | "error";

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const [state, setState] = useState<VerifyState>("verifying");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      setState("error");
      setError("Missing verification token.");
      return;
    }

    let cancelled = false;
    verifyEmailToken(token)
      .then(() => {
        if (!cancelled) {
          setState("success");
          localStorage.setItem("voicebrief_userEmailVerified", "true");
        }
      })
      .catch((verifyError) => {
        if (!cancelled) {
          setState("error");
          setError(verifyError instanceof Error ? verifyError.message : "Verification failed.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md card-surface rounded-2xl p-8">
        <h1 className="text-2xl font-semibold">Email verification</h1>
        {state === "verifying" && <p className="text-sm text-muted-foreground mt-3">Verifying your email address...</p>}
        {state === "success" && (
          <>
            <p className="text-sm text-muted-foreground mt-3">Your email is verified. You can now connect integrations.</p>
            <Link to="/dashboard/settings" className="inline-block mt-5 rounded-lg bg-accent text-accent-foreground px-4 py-2 text-sm font-semibold">
              Go to settings
            </Link>
          </>
        )}
        {state === "error" && (
          <>
            <p className="text-sm text-destructive mt-3">{error ?? "Unable to verify email."}</p>
            <Link to="/auth" className="inline-block mt-5 rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground">
              Back to sign in
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
