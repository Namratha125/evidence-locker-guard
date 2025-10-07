import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, Users as UsersIcon, Edit, UserX } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import AddUserDialog from '@/components/AddUserDialog';

interface User {
  id: string;
  username: string;
  full_name: string;
  role: 'admin' | 'investigator' | 'analyst' | 'legal';
  badge_number?: string;
  department?: string;
  created_at: string;
  updated_at: string;
}

const Users = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const { toast } = useToast();
  const { profile } = useAuth();

  useEffect(() => {
    fetchUsers();
  }, []);

  // ✅ Fetch users from MySQL backend
  const fetchUsers = async () => {
    try {
      const response = await fetch('http://localhost:5000/profiles');
      if (!response.ok) throw new Error('Failed to fetch users');
      const data = await response.json();
      setUsers(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to fetch users: " + error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.badge_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.department?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesRole = filterRole === 'all' || user.role === filterRole;

    return matchesSearch && matchesRole;
  });

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'destructive';
      case 'investigator':
        return 'default';
      case 'analyst':
        return 'secondary';
      case 'legal':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  // 🔐 Only admins can access this page
  if (profile?.role !== 'admin') {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center">
              <UserX className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Access Denied</h3>
              <p className="text-muted-foreground">
                You don't have permission to access user management.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-48"></div>
          <div className="h-10 bg-muted rounded w-full"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-48 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">User Management</h1>
          <p className="text-muted-foreground">
            Manage user accounts, roles, and permissions
          </p>
        </div>
        <Button onClick={() => setAddDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add User
        </Button>
      </div>

      <div className="flex items-center space-x-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterRole} onValueChange={setFilterRole}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="investigator">Investigator</SelectItem>
            <SelectItem value="analyst">Analyst</SelectItem>
            <SelectItem value="legal">Legal</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredUsers.length === 0 ? (
          <div className="col-span-full">
            <Card>
              <CardContent className="flex items-center justify-center py-12">
                <div className="text-center">
                  <UsersIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No users found</h3>
                  <p className="text-muted-foreground">
                    {searchTerm || filterRole !== 'all'
                      ? 'No users match your search criteria.'
                      : 'No users available.'}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          filteredUsers.map((user) => (
            <Card key={user.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{user.full_name}</CardTitle>
                    <CardDescription>@{user.username}</CardDescription>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost">
                      <Edit className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Role</span>
                    <Badge variant={getRoleColor(user.role)}>{user.role}</Badge>
                  </div>
                  {user.badge_number && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Badge</span>
                      <span className="text-sm font-mono">{user.badge_number}</span>
                    </div>
                  )}
                  {user.department && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Department</span>
                      <span className="text-sm">{user.department}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Joined</span>
                    <span className="text-sm">
                      {new Date(user.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <AddUserDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onUserAdded={fetchUsers}
      />
    </div>
  );
};

export default Users;
