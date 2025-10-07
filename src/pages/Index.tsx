import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FolderOpen, FileText, Tag } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface DashboardStats {
  totalCases: number;
  totalEvidence: number;
  totalTags: number;
  recentCases: any[];
  recentEvidence: any[];
}

const Index = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalCases: 0,
    totalEvidence: 0,
    totalTags: 0,
    recentCases: [],
    recentEvidence: [],
  });
  const [loading, setLoading] = useState(true);
  const { profile } = useAuth();

  const API_BASE = "http://localhost:5000"; // ✅ Your backend base URL

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/dashboard/stats`);
      if (!res.ok) throw new Error("Failed to fetch dashboard data");
      const data = await res.json();
      setStats(data);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 text-center">
        <p>Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back, {profile?.full_name}</p>
        </div>
        <Badge variant="outline" className="text-sm">
          Role: {profile?.role}
        </Badge>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Cases</CardTitle>
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCases}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Evidence Items</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalEvidence}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Tags</CardTitle>
            <Tag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalTags}</div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Recent Cases */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Cases</CardTitle>
            <CardDescription>Latest case activities</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {stats.recentCases.length === 0 ? (
              <p className="text-muted-foreground text-sm">No recent cases found.</p>
            ) : (
              stats.recentCases.slice(0, 3).map((case_: any) => (
                <div key={case_.id} className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{case_.case_number}</p>
                    <p className="text-sm text-muted-foreground">{case_.title}</p>
                  </div>
                  <Badge variant="outline">{case_.status}</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Recent Evidence */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Evidence</CardTitle>
            <CardDescription>Latest evidence uploads</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {stats.recentEvidence.length === 0 ? (
              <p className="text-muted-foreground text-sm">No recent evidence found.</p>
            ) : (
              stats.recentEvidence.slice(0, 3).map((evidence: any) => (
                <div key={evidence.id} className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{evidence.title}</p>
                    <p className="text-sm text-muted-foreground">{evidence.case_number}</p>
                  </div>
                  <Badge variant="secondary">{evidence.file_type || "Unknown"}</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Index;
