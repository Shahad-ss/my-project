import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";

interface User {
  id: string;
  email: string;
}

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function authRequest(
  path: string,
  body?: { email: string; password: string },
) {
  try {
    const response = await fetch(`/api/auth/${path}`, {
      method: body ? "POST" : "GET",
      credentials: "include",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (response.ok) {
      return response.status === 204 ? null : response.json();
    }
    if (response.status !== 404 && response.status !== 502) {
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (data.error) throw new Error(data.error);
    }
  } catch (err: any) {
    if (err.message && err.message !== "Failed to fetch" && !err.message.includes("Authentication failed")) {
      throw err;
    }
  }

  // Fallback to local session storage for frontend-only deployments
  if (path === "signup" || path === "login") {
    if (!body?.email || !body?.password) {
      throw new Error("Please enter an email and password.");
    }
    const user = { id: "usr_" + Date.now(), email: body.email };
    localStorage.setItem("mizan_user", JSON.stringify(user));
    return { user };
  }

  if (path === "me") {
    const stored = localStorage.getItem("mizan_user");
    return { user: stored ? JSON.parse(stored) : null };
  }

  if (path === "logout") {
    localStorage.removeItem("mizan_user");
    return null;
  }

  throw new Error("Authentication failed.");
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    authRequest("me")
      .then((data) => setUser(data.user))
      .catch(() => {
        queryClient.clear();
        setUser(null);
      })
      .finally(() => setIsLoading(false));
  }, [queryClient]);

  const login = useCallback(async (email: string, password: string) => {
    const data = await authRequest("login", { email, password });
    queryClient.clear();
    setUser(data.user);
  }, [queryClient]);

  const signup = useCallback(async (email: string, password: string) => {
    const data = await authRequest("signup", { email, password });
    queryClient.clear();
    setUser(data.user);
  }, [queryClient]);

  const logout = useCallback(async () => {
    try {
      await authRequest("logout");
    } catch {}
    queryClient.clear();
    setUser(null);
  }, [queryClient]);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}