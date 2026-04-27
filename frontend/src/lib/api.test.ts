import { afterEach, describe, expect, it, vi } from "vitest";
import { api, clearToken, setToken } from "./api";

describe("api client", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("sends bearer token when present", async () => {
    setToken("token-123");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await api<{ ok: boolean }>("/api/test");
    expect(response.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, options] = fetchMock.mock.calls[0];
    const headers = options.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer token-123");
  });

  it("clears local auth state and emits auth-expired on 401", async () => {
    setToken("token-123");
    localStorage.setItem("voicebrief_userId", "user-1");
    const listener = vi.fn();
    window.addEventListener("voicebrief:auth-expired", listener);

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" }
        })
      )
    );

    await expect(api("/api/auth/me")).rejects.toThrow("Unauthorized");
    expect(localStorage.getItem("voicebrief_token")).toBeNull();
    expect(localStorage.getItem("voicebrief_userId")).toBeNull();
    expect(listener).toHaveBeenCalledTimes(1);

    window.removeEventListener("voicebrief:auth-expired", listener);
  });

  it("clearToken removes all persisted auth fields", () => {
    localStorage.setItem("voicebrief_token", "token");
    localStorage.setItem("voicebrief_userId", "user-1");
    localStorage.setItem("voicebrief_userEmail", "user@example.com");
    localStorage.setItem("voicebrief_userEmailVerified", "true");

    clearToken();

    expect(localStorage.getItem("voicebrief_token")).toBeNull();
    expect(localStorage.getItem("voicebrief_userId")).toBeNull();
    expect(localStorage.getItem("voicebrief_userEmail")).toBeNull();
    expect(localStorage.getItem("voicebrief_userEmailVerified")).toBeNull();
  });
});
