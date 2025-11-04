import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FolderOpen, Plus, Edit, MessageSquare, Calendar, User, Eye } from 'lucide-react';
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
  assigned_user?: { full_name: string } | null;
  creator?: { full_name: string } | null;
}

export default function Cases() {
  const navigate = useNavigate();
  // Robust date parser: accepts Date, number (timestamp), or string like
  // "YYYY-MM-DD HH:MM:SS" and normalizes to a Date or returns null.
  const parseDate = (s?: any) => {
    if (!s && s !== 0) return null;
    // handle Date instance
    if (s instanceof Date) return isNaN(s.getTime()) ? null : s;
    // handle numeric timestamps
    if (typeof s === 'number') {
      const d = new Date(s);
      return isNaN(d.getTime()) ? null : d;
    }
    const str = String(s);
    // treat MySQL zero datetime as missing
    if (str === '0000-00-00 00:00:00') return null;
    // If string uses space between date and time and no 'T', convert to ISO-ish
    const normalized = str.includes(' ') && !str.includes('T') ? str.replace(' ', 'T') : str;
    const d = new Date(normalized);
    return isNaN(d.getTime()) ? null : d;
  };

  const formatDateString = (s?: any, fmt = 'MMM dd, yyyy') => {
    const d = parseDate(s);
    return d ? format(d, fmt) : null;
  };
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

  const { profile } = useAuth();

  useEffect(() => {
    if (profile) {
      fetchCases();
      fetchUsers();
    }
  }, [profile]);

  useEffect(() => {
    setFilteredCases(cases);
  }, [cases]);

  const fetchCases = async () => {
    try {
      if (!profile) return;
      
      setIsLoading(true);
      // Build URL based on user role
      let url = '/api/cases';
      if (profile.role !== 'admin') {
        // For non-admin users, only fetch cases they're involved with
        url += `?userId=${profile.id}`;
      }
      const res = await axios.get(url);
      let casesData = res.data;

      if (casesData && casesData.length > 0) {
        // If the list endpoint returns minimal case objects (no created_at/assigned_to),
        // fetch details for those cases so the dashboard can show dates and assignments.
        const needsDetails = casesData.filter((c: any) => !c.created_at || c.assigned_to === undefined);
        if (needsDetails.length > 0) {
          try {
            const detailPromises = needsDetails.map((c: any) => axios.get(`/api/cases/${c.id}`));
            const detailsRes = await Promise.allSettled(detailPromises);
            const detailsMap = new Map<string, any>();
            detailsRes.forEach((r) => {
              if (r.status === 'fulfilled' && r.value?.data) {
                detailsMap.set(r.value.data.id, r.value.data);
              }
            });
            // merge details into a new array and reuse the variable for downstream processing
            const mergedCases = casesData.map((c: any) => detailsMap.get(c.id) ? { ...c, ...detailsMap.get(c.id) } : c);
            casesData = mergedCases as any;
          } catch (err) {
            // non-fatal, continue with whatever data we have
            console.warn('Failed to fetch case details for list:', err);
          }
        }
        const userIds = [...new Set([
          ...casesData.map((c: any) => c.assigned_to).filter(Boolean),
          ...casesData.map((c: any) => c.created_by).filter(Boolean),
          ...casesData.map((c: any) => c.lead_investigator_id).filter(Boolean),
        ])];

        let profilesMap = new Map();
        if (userIds.length > 0) {
          const profileRes = await axios.post('/api/profiles/by-ids', { ids: userIds });
          // Store both number and string versions of IDs to handle type mismatches
          profileRes.data.forEach((p: any) => {
            profilesMap.set(String(p.id), p);
            profilesMap.set(Number(p.id), p);
            profilesMap.set(p.id, p);
          });
        }

        const casesWithProfiles = casesData.map((c: any) => ({
          ...c,
          assigned_user: c.assigned_to ? profilesMap.get(c.assigned_to) : null,
          creator: c.created_by ? profilesMap.get(c.created_by) : null,
        }));

        setCases(casesWithProfiles);
      } else {
        setCases([]);
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to fetch cases: ' + error.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      if (!profile) return;
      
      // For admin, fetch all users
      // For other roles, fetch users related to their cases/department
      let url = '/api/profiles';
      if (profile.role !== 'admin') {
        url += `?relatedToUser=${profile.id}`;
      }
      
      const res = await axios.get(url);
      setUsers(res.data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const handleAdvancedSearch = (filters: any) => {
    let filtered = [...cases];

    if (filters.query.trim()) {
      filtered = filtered.filter(c =>
        c.title.toLowerCase().includes(filters.query.toLowerCase()) ||
        c.case_number.toLowerCase().includes(filters.query.toLowerCase()) ||
        c.description?.toLowerCase().includes(filters.query.toLowerCase())
      );
    }

    if (filters.status && filters.status !== 'all') {
      filtered = filtered.filter(c => c.status === filters.status);
    }

    if (filters.priority && filters.priority !== 'all') {
      filtered = filtered.filter(c => c.priority === filters.priority);
    }

    if (filters.assignedTo && filters.assignedTo !== 'all') {
      filtered = filtered.filter(c => c.assigned_to === filters.assignedTo);
    }

    if (filters.dateFrom) {
      filtered = filtered.filter(c => {
        const created = parseDate(c.created_at);
        return created ? created >= filters.dateFrom : false;
      });
    }

    if (filters.dateTo) {
      filtered = filtered.filter(c => {
        const created = parseDate(c.created_at);
        return created ? created <= filters.dateTo : false;
      });
    }

    setFilteredCases(filtered);
  };

  const updateCaseStatus = async (caseId: string, newStatus: string) => {
    try {
      await axios.put(`/api/cases/${caseId}/status`, { status: newStatus });

      toast({
        title: 'Success',
        description: 'Case status updated successfully',
      });

      fetchCases();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to update case status: ' + error.message,
        variant: 'destructive',
      });
    }
  };

  const getPriorityStyle = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return { backgroundColor: '#fee2e2', borderColor: '#dc2626', color: '#dc2626' };
      case 'high':
        return { backgroundColor: '#fef3c7', borderColor: '#d97706', color: '#d97706' };
      case 'medium':
        return { backgroundColor: '#dbeafe', borderColor: '#2563eb', color: '#2563eb' };
      case 'low':
        return { backgroundColor: '#dcfce7', borderColor: '#16a34a', color: '#16a34a' };
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
        <AdvancedSearch type="cases" onSearch={handleAdvancedSearch} users={users} />
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
                    <Badge variant="outline" style={getPriorityStyle(case_.priority)}>
                      {case_.priority} priority
                    </Badge>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button variant="ghost" size="sm" onClick={() => navigate(`/cases/${case_.id}`)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => { setSelectedCase(case_); setIsCommentsDialogOpen(true); }}>
                      <MessageSquare className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => { setSelectedCase(case_); setIsEditDialogOpen(true); }}>
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
                <p className="text-sm text-muted-foreground mb-4">{case_.description || 'No description provided'}</p>
                <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground mb-4">
                  <div className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    <span>Assigned: {case_.assigned_user?.full_name || case_.assigned_to || 'Unassigned'}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    <span>Due: {case_.due_date ? formatDateString(case_.due_date) : 'No due date'}</span>
                  </div>
                </div>
                {case_.findings && (
                  <div className="mb-4">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Findings:</p>
                    <p className="text-sm bg-muted p-2 rounded">{case_.findings}</p>
                  </div>
                )}
                <div className="text-xs text-muted-foreground">
                  Created: {formatDateString(case_.created_at)} by {case_.creator?.full_name || 'Unknown'}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <CreateCaseDialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen} onCaseCreated={fetchCases} />

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
