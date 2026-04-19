import { useMemo, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

type AuthMode = "login" | "register";

export default function AuthPage() {
  const { isAuthenticated, login, register, loginDemo } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const redirectPath = useMemo(() => {
    const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;
    return from && from !== "/auth" ? from : "/dashboard";
  }, [location.state]);

  if (isAuthenticated) {
    return <Navigate to={redirectPath} replace />;
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setInfo(null);

    try {
      if (mode === "login") {
        await login(email, password);
        navigate(redirectPath, { replace: true });
      } else {
        const result = await register(email, password, phone.trim() || undefined);
        setMode("login");
        setPassword("");
        setPhone("");
        if (result.verificationEmailSent) {
          setInfo("Account created. Check your inbox to verify your email, then sign in.");
        } else {
          setInfo(
            `Account created, but verification email was not sent${
              result.verificationEmailReason ? `: ${result.verificationEmailReason}` : "."
            }`
          );
        }
      }
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Authentication failed";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDemoLogin(): Promise<void> {
    setSubmitting(true);
    setError(null);
    try {
      await loginDemo();
      navigate("/dashboard", { replace: true });
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Demo login failed";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md card-surface rounded-2xl p-8">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          ← Back to home
        </Link>
        <h1 className="text-2xl font-semibold mt-4">Welcome to Brief Buddy</h1>
        <p className="text-sm text-muted-foreground mt-2">
          {mode === "login" ? "Sign in to your account." : "Create your account to start receiving briefings."}
        </p>

        <div className="mt-6 grid grid-cols-2 rounded-lg border border-border p-1">
          <button
            type="button"
            onClick={() => setMode("login")}
            className={`rounded-md px-3 py-2 text-sm transition-colors ${mode === "login" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => setMode("register")}
            className={`rounded-md px-3 py-2 text-sm transition-colors ${mode === "register" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            Create account
          </button>
        </div>

        <form onSubmit={(event) => void onSubmit(event)} className="mt-6 space-y-4">
          <div className="space-y-1">
            <label htmlFor="email" className="text-sm text-muted-foreground">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="password" className="text-sm text-muted-foreground">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={10}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
            />
            <p className="text-xs text-muted-foreground">Use at least 10 characters with upper/lowercase and a number.</p>
          </div>

          {mode === "register" ? (
            <div className="space-y-1">
              <label htmlFor="phone" className="text-sm text-muted-foreground">
                Phone (optional)
              </label>
              <input
                id="phone"
                type="tel"
                autoComplete="tel"
                inputMode="tel"
                placeholder="+15551234567"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
              />
              <p className="text-xs text-muted-foreground">Use E.164 format if provided (example: +15551234567).</p>
            </div>
          ) : null}

          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : null}
          {info ? (
            <p className="text-sm text-emerald-600">{info}</p>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-accent text-accent-foreground py-2.5 text-sm font-semibold hover:brightness-110 transition-all disabled:opacity-60"
          >
            {submitting ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>

        <div className="mt-4 pt-4 border-t border-border">
          <button
            type="button"
            onClick={() => void handleDemoLogin()}
            disabled={submitting}
            className="w-full rounded-lg border border-border py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-60"
          >
            Continue with demo account
          </button>
        </div>
      </div>
    </div>
  );
}
