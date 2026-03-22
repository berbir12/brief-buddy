import { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  clearToken,
  getDemoToken,
  getMe,
  loginWithPassword,
  logoutRequest,
  register,
  requestEmailVerification,
  setToken,
  type AuthUser
} from "@/lib/api";

const USER_ID_KEY = "voicebrief_userId";
const USER_EMAIL_KEY = "voicebrief_userEmail";
const USER_EMAIL_VERIFIED_KEY = "voicebrief_userEmailVerified";
const TOKEN_KEY = "voicebrief_token";

type AuthContextValue = {
  token: string | null;
  userId: string | null;
  email: string | null;
  emailVerified: boolean;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  resendVerification: () => Promise<{ sent: boolean; alreadyVerified?: boolean; verificationToken?: string }>;
  loginDemo: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [userId, setUserIdState] = useState<string | null>(() => localStorage.getItem(USER_ID_KEY));
  const [email, setEmailState] = useState<string | null>(() => localStorage.getItem(USER_EMAIL_KEY));
  const [emailVerified, setEmailVerifiedState] = useState<boolean>(() => localStorage.getItem(USER_EMAIL_VERIFIED_KEY) === "true");
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const persistAuth = useCallback((nextToken: string, user: AuthUser) => {
    setToken(nextToken);
    localStorage.setItem(USER_ID_KEY, user.id);
    localStorage.setItem(USER_EMAIL_KEY, user.email);
    localStorage.setItem(USER_EMAIL_VERIFIED_KEY, String(user.emailVerified));
    setTokenState(nextToken);
    setUserIdState(user.id);
    setEmailState(user.email);
    setEmailVerifiedState(user.emailVerified);
  }, []);

  const login = useCallback(async (nextEmail: string, password: string) => {
    const result = await loginWithPassword({ email: nextEmail, password });
    persistAuth(result.token, result.user);
  }, [persistAuth]);

  const registerUser = useCallback(async (nextEmail: string, password: string) => {
    const result = await register({ email: nextEmail, password });
    persistAuth(result.token, result.user);
  }, [persistAuth]);

  const loginDemo = useCallback(async () => {
    const { token: t, userId: u } = await getDemoToken();
    setToken(t);
    localStorage.setItem(USER_ID_KEY, u);
    localStorage.setItem(USER_EMAIL_KEY, "demo@voicebrief.local");
    localStorage.setItem(USER_EMAIL_VERIFIED_KEY, "true");
    setTokenState(t);
    setUserIdState(u);
    setEmailState("demo@voicebrief.local");
    setEmailVerifiedState(true);
  }, []);

  const resendVerification = useCallback(async () => {
    const result = await requestEmailVerification();
    if (result.alreadyVerified) {
      localStorage.setItem(USER_EMAIL_VERIFIED_KEY, "true");
      setEmailVerifiedState(true);
    }
    return result;
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutRequest();
    } catch {
      // Local cleanup still applies even if the request fails.
    }
    clearToken();
    setTokenState(null);
    setUserIdState(null);
    setEmailState(null);
    setEmailVerifiedState(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function hydrate(): Promise<void> {
      if (!token) {
        if (!cancelled) setIsLoading(false);
        return;
      }
      try {
        const { user } = await getMe();
        if (!cancelled) {
          localStorage.setItem(USER_ID_KEY, user.id);
          localStorage.setItem(USER_EMAIL_KEY, user.email);
          localStorage.setItem(USER_EMAIL_VERIFIED_KEY, String(user.emailVerified));
          setUserIdState(user.id);
          setEmailState(user.email);
          setEmailVerifiedState(user.emailVerified);
        }
      } catch {
        clearToken();
        if (!cancelled) {
          setTokenState(null);
          setUserIdState(null);
          setEmailState(null);
          setEmailVerifiedState(false);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    const onAuthExpired = () => {
      setTokenState(null);
      setUserIdState(null);
      setEmailState(null);
      setEmailVerifiedState(false);
      setIsLoading(false);
    };
    window.addEventListener("voicebrief:auth-expired", onAuthExpired);
    return () => window.removeEventListener("voicebrief:auth-expired", onAuthExpired);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        token,
        userId,
        email,
        emailVerified,
        isLoading,
        isAuthenticated: Boolean(token && userId),
        login,
        register: registerUser,
        resendVerification,
        loginDemo,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
