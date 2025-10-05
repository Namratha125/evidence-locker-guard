import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Search, Plus, FolderOpen, Edit, MessageSquare, Calendar, User, Eye } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import CreateCaseDialog from '@/components/CreateCaseDialog';
import EditCaseDialog from '@/components/EditCaseDialog';
import CommentsSection from '@/components/CommentsSection';
import AdvancedSearch from '@/components/AdvancedSearch';

interface Case {
  id: string;
  case_number: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  created_at: string;
  created_by: string;
  lead_investigator_id: string;
  assigned_to: string | null;
  findings: string | null;
  due_date: string | null;
  assigned_user?: {
    full_name: string;
  } | null;
  creator?: {
    full_name: string;
  } | null;
}

export default function Cases() {
  const navigate = useNavigate();
  const [cases, setCases] = useState<Case[]>([]);
  const [filteredCases, setFilteredCases] = useState<Case[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedCase, setSelectedCase] = useState<Case | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isCommentsDialogOpen, setIsCommentsDialogOpen] = useState(false);
  const [users, setUsers] = useState<Array<{ id: string; full_name: string }>>([]);
  const { toast } = useToast();

  useEffect(() => {
    fetchCases();
    fetchUsers();
  }, []);

  useEffect(() => {
    setFilteredCases(cases);
  }, [cases]);

  const fetchCases = async () => {
    try {
      setIsLoading(true);
      const { data: casesData, error } = await supabase
        .from('cases')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch user profiles separately for assignment data
      if (casesData && casesData.length > 0) {
        const userIds = [...new Set([
          ...casesData.map(c => c.assigned_to).filter(Boolean),
          ...casesData.map(c => c.created_by).filter(Boolean)
        ])];

        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', userIds);

        const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);
        
        const casesWithProfiles = casesData.map(case_ => ({
          ...case_,
          assigned_user: case_.assigned_to ? profilesMap.get(case_.assigned_to) : null,
          creator: profilesMap.get(case_.created_by) || null
        }));

        setCases(casesWithProfiles);
      } else {
        setCases([]);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to fetch cases: " + error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name')
        .order('full_name');

      if (error) throw error;
      setUsers(data || []);
    } catch (error: any) {
      console.error('Error fetching users:', error);
    }
  };

  const filterCases = () => {
    if (!searchQuery.trim()) {
      setFilteredCases(cases);
      return;
    }

    const filtered = cases.filter(case_ => 
      case_.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      case_.case_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      case_.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredCases(filtered);
  };

  const handleAdvancedSearch = (filters: any) => {
    let filtered = [...cases];

    if (filters.query.trim()) {
      filtered = filtered.filter(case_ => 
        case_.title.toLowerCase().includes(filters.query.toLowerCase()) ||
        case_.case_number.toLowerCase().includes(filters.query.toLowerCase()) ||
        case_.description?.toLowerCase().includes(filters.query.toLowerCase())
      );
    }

    if (filters.status && filters.status !== 'all') {
      filtered = filtered.filter(case_ => case_.status === filters.status);
    }

    if (filters.priority && filters.priority !== 'all') {
      filtered = filtered.filter(case_ => case_.priority === filters.priority);
    }

    if (filters.assignedTo && filters.assignedTo !== 'all') {
      filtered = filtered.filter(case_ => case_.assigned_to === filters.assignedTo);
    }

    if (filters.dateFrom) {
      filtered = filtered.filter(case_ => 
        new Date(case_.created_at) >= filters.dateFrom
      );
    }

    if (filters.dateTo) {
      filtered = filtered.filter(case_ => 
        new Date(case_.created_at) <= filters.dateTo
      );
    }

    setFilteredCases(filtered);
  };

  const updateCaseStatus = async (caseId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('cases')
        .update({ status: newStatus })
        .eq('id', caseId);

      if (error) throw error;

      // Create audit log
      await createAuditLog({
        action: 'update_status',
        resource_type: 'case',
        resource_id: caseId,
        details: { new_status: newStatus }
      });

      toast({
        title: "Success",
        description: "Case status updated successfully",
      });

      fetchCases();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to update case status: " + error.message,
        variant: "destructive",
      });
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'secondary';
    }
  };

  const getPriorityStyle = (priority: string) => {
    switch (priority) {
      case 'urgent': 
        return { 
          backgroundColor: '#fee2e2', 
          borderColor: '#dc2626', 
          color: '#dc2626' 
        };
      case 'high': 
        return { 
          backgroundColor: '#fef3c7', 
          borderColor: '#d97706', 
          color: '#d97706' 
        };
      case 'medium': 
        return { 
          backgroundColor: '#dbeafe', 
          borderColor: '#2563eb', 
          color: '#2563eb' 
        };
      case 'low': 
        return { 
          backgroundColor: '#dcfce7', 
          borderColor: '#16a34a', 
          color: '#16a34a' 
        };
      default: 
        return {};
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'default';
      case 'completed': return 'secondary';
      case 'closed': return 'outline';
      case 'archived': return 'outline';
      default: return 'default';
    }
  };

  const handleEditCase = (case_: Case) => {
    setSelectedCase(case_);
    setIsEditDialogOpen(true);
  };

  const handleViewComments = (case_: Case) => {
    setSelectedCase(case_);
    setIsCommentsDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-48"></div>
          <div className="h-10 bg-muted rounded w-full"></div>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-32 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Cases</h1>
          <p className="text-muted-foreground">Manage investigation cases</p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Case
        </Button>
      </div>

      <div className="mb-6">
        <AdvancedSearch
          type="cases"
          onSearch={handleAdvancedSearch}
          users={users}
        />
      </div>

      <div className="grid gap-4">
        {filteredCases.length === 0 ? (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <div className="text-center">
                <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No cases found</h3>
                <p className="text-muted-foreground">
                  {searchQuery ? 'No cases match your search criteria.' : 'Create your first case to get started.'}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          filteredCases.map((case_) => (
            <Card key={case_.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Badge variant={getStatusColor(case_.status)}>
                      {case_.status}
                    </Badge>
                    <Badge 
                      variant="outline"
                      style={getPriorityStyle(case_.priority)}
                    >
                      {case_.priority} priority
                    </Badge>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(`/cases/${case_.id}`)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleViewComments(case_)}
                    >
                      <MessageSquare className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditCase(case_)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Select value={case_.status} onValueChange={(value) => updateCaseStatus(case_.id, value)}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                        <SelectItem value="archived">Archived</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <CardTitle>{case_.case_number}</CardTitle>
                  <CardDescription>{case_.title}</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  {case_.description || 'No description provided'}
                </p>
                
                <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground mb-4">
                  <div className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    <span>
                      Assigned: {case_.assigned_user?.full_name || 'Unassigned'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    <span>
                      Due: {case_.due_date ? format(new Date(case_.due_date), 'MMM dd, yyyy') : 'No due date'}
                    </span>
                  </div>
                </div>

                {case_.findings && (
                  <div className="mb-4">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Findings:</p>
                    <p className="text-sm bg-muted p-2 rounded">{case_.findings}</p>
                  </div>
                )}

                <div className="text-xs text-muted-foreground">
                  Created: {new Date(case_.created_at).toLocaleDateString()} by {case_.creator?.full_name || 'Unknown'}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <CreateCaseDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onCaseCreated={fetchCases}
      />

      {selectedCase && (
        <EditCaseDialog
          case_={selectedCase}
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          onUpdate={fetchCases}
        />
      )}

      {selectedCase && (
        <Dialog open={isCommentsDialogOpen} onOpenChange={setIsCommentsDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Case Comments - {selectedCase.case_number}</DialogTitle>
            </DialogHeader>
            <CommentsSection caseId={selectedCase.id} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}