import { createContext, useContext, useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface Profile {
  id: string;
  username: string;
  full_name: string;
  role: "admin" | "investigator" | "analyst" | "legal";
  badge_number?: string;
  department?: string;
}

interface AuthContextType {
  user: any | null;
  profile: Profile | null;
  session: any | null;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (
    email: string,
    password: string,
    userData: Partial<Profile>
  ) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // Load user session from localStorage (if previously logged in)
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      const parsed = JSON.parse(storedUser);
      setUser(parsed);
      setSession({ token: parsed.token });
      fetchProfile(parsed.id);
    }
    setLoading(false);
  }, []);

  // Fetch profile by id
  const fetchProfile = async (id: string) => {
    try {
      const res = await fetch(`http://localhost:5000/api/profile/${id}`);
      const data = await res.json();
      if (res.ok) setProfile(data);
      else setProfile(null);
    } catch (err) {
      console.error("Error fetching profile:", err);
      setProfile(null);
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const res = await fetch("http://localhost:5000/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast({
          title: "Sign In Failed",
          description: data.message || "Invalid credentials",
          variant: "destructive",
        });
        return { error: data.message };
      }

      setUser(data.user);
      setSession({ token: data.token });
      localStorage.setItem("user", JSON.stringify(data.user));
      fetchProfile(data.user.id);

      toast({
        title: "Signed In",
        description: `Welcome back, ${data.user.username}`,
      });

      return { error: null };
    } catch (error: any) {
      toast({
        title: "Sign In Failed",
        description: error.message,
        variant: "destructive",
      });
      return { error };
    }
  };

  const signUp = async (
    email: string,
    password: string,
    userData: Partial<Profile>
  ) => {
    try {
      const response = await fetch("http://localhost:5000/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          full_name: userData.full_name,
          username: userData.username,
          role: userData.role || "analyst",
          badge_number: userData.badge_number,
          department: userData.department,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast({
          title: "Sign Up Failed",
          description: data.message || "Failed to create user",
          variant: "destructive",
        });
        return { error: data.message };
      }

      toast({
        title: "Account Created",
        description: "Your account has been created successfully!",
      });

      return { error: null };
    } catch (error: any) {
      toast({
        title: "Sign Up Failed",
        description: error.message,
        variant: "destructive",
      });
      return { error };
    }
  };

  const signOut = async () => {
    try {
      localStorage.removeItem("user");
      setUser(null);
      setProfile(null);
      setSession(null);
      toast({
        title: "Signed Out",
        description: "You have been successfully signed out.",
      });
    } catch (error: any) {
      toast({
        title: "Sign Out Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const value = {
    user,
    profile,
    session,
    signIn,
    signUp,
    signOut,
    loading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
