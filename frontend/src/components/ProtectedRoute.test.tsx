import { describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import ProtectedRoute from "./ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: vi.fn()
}));

const mockedUseAuth = vi.mocked(useAuth);

function renderProtectedRoute() {
  return render(
    <MemoryRouter initialEntries={["/dashboard"]}>
      <Routes>
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <div>Protected dashboard</div>
            </ProtectedRoute>
          }
        />
        <Route path="/auth" element={<div>Auth page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("ProtectedRoute", () => {
  it("renders loading shell while auth state is hydrating", () => {
    mockedUseAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: true
    } as ReturnType<typeof useAuth>);

    const { container } = renderProtectedRoute();
    expect(screen.queryByText("Protected dashboard")).not.toBeInTheDocument();
    expect(screen.queryByText("Auth page")).not.toBeInTheDocument();
    expect(container.querySelector(".min-h-screen.bg-background")).toBeInTheDocument();
  });

  it("redirects unauthenticated users to auth page", () => {
    mockedUseAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: false
    } as ReturnType<typeof useAuth>);

    renderProtectedRoute();
    expect(screen.getByText("Auth page")).toBeInTheDocument();
  });

  it("renders protected content for authenticated users", () => {
    mockedUseAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false
    } as ReturnType<typeof useAuth>);

    renderProtectedRoute();
    expect(screen.getByText("Protected dashboard")).toBeInTheDocument();
  });
});
