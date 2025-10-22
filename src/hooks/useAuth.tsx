import { createContext, useContext, useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface User {
  id: string;
  email: string;
  role: string;
}

interface Profile {
  id: string;
  username: string;
  full_name: string;
  role: string;
  badge_number?: string;
  department?: string;
  email?: string;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  token: string | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (
    email: string,
    password: string,
    userData: Partial<Profile>
  ) => Promise<{ error?: string }>;
  signOut: () => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [token, setToken] = useState<string | null>(
    localStorage.getItem("evidence_locker_token")
  );
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const storedUser = localStorage.getItem("evidence_locker_user");
    const storedProfile = localStorage.getItem("evidence_locker_profile");
    if (storedUser) setUser(JSON.parse(storedUser));
    if (storedProfile) setProfile(JSON.parse(storedProfile));
    setLoading(false);
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Login failed");

      const { token, user } = data;
      setToken(token);
      setUser(user);
      localStorage.setItem("evidence_locker_token", token);
      localStorage.setItem("evidence_locker_user", JSON.stringify(user));

      await fetchProfile(user.id, token);

      toast({
        title: "Login Successful",
        description: `Welcome back, ${user.email}`,
      });
      return {};
    } catch (error: any) {
      toast({
        title: "Sign In Failed",
        description: error.message,
        variant: "destructive",
      });
      return { error: error.message };
    }
  };

  const signUp = async (
    email: string,
    password: string,
    userData: Partial<Profile>
  ) => {
    try {
      const res = await fetch(`${API_BASE}/api/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, ...userData }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Sign-up failed");

      toast({
        title: "Account Created",
        description: "You can now log in with your new account.",
      });

      return {};
    } catch (error: any) {
      toast({
        title: "Sign Up Failed",
        description: error.message,
        variant: "destructive",
      });
      return { error: error.message };
    }
  };

  const fetchProfile = async (id: string, jwt?: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/profile/${id}`, {
        headers: {
          Authorization: `Bearer ${jwt || token}`,
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to load profile");
      setProfile(data);
      localStorage.setItem("evidence_locker_profile", JSON.stringify(data));
    } catch (error) {
      console.error("Profile fetch failed", error);
      setProfile(null);
    }
  };

  const refreshProfile = async () => {
    if (user && token) await fetchProfile(user.id, token);
  };

  const signOut = () => {
    setUser(null);
    setProfile(null);
    setToken(null);
    localStorage.removeItem("evidence_locker_token");
    localStorage.removeItem("evidence_locker_user");
    localStorage.removeItem("evidence_locker_profile");
    toast({
      title: "Signed Out",
      description: "You have been successfully signed out.",
    });
  };

  const value: AuthContextType = {
    user,
    profile,
    token,
    loading,
    signIn,
    signUp,
    signOut,
    refreshProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined)
    throw new Error("useAuth must be used within an AuthProvider");
  return context;
};
