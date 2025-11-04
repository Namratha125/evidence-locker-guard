import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { 
  ArrowLeft, 
  Edit, 
  Calendar, 
  User, 
  FileText, 
  Eye,
  Link2
} from 'lucide-react';
import { format } from 'date-fns';
import EditCaseDialog from '@/components/EditCaseDialog';
import ChainOfCustodyDialog from '@/components/ChainOfCustodyDialog';
import CommentsSection from '@/components/CommentsSection';

interface CaseData {
  id: string;
  case_number: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  created_at: string;
  updated_at: string;
  due_date?: string;
  findings?: string;
  created_by: string;
  assigned_to?: string;
  lead_investigator_id?: string;
  creator?: { full_name: string };
  assignee?: { full_name: string };
  lead_investigator?: { full_name: string };
}

interface Evidence {
  id: string;
  title: string;
  description?: string;
  file_name?: string;
  file_type?: string;
  file_size?: number;
  status: string;
  created_at: string;
  uploaded_by: string;
  uploader?: { full_name: string };
}

const CaseDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile } = useAuth();
  const [caseData, setCaseData] = useState<CaseData | null>(null);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [custodyDialogOpen, setCustodyDialogOpen] = useState(false);
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string>('');

  // parse date strings like "YYYY-MM-DD HH:MM:SS" safely across browsers
  const parseDate = (s?: any) => {
    if (!s && s !== 0) return null;
    if (s instanceof Date) return isNaN(s.getTime()) ? null : s;
    if (typeof s === 'number') {
      const d = new Date(s);
      return isNaN(d.getTime()) ? null : d;
    }
    const str = String(s);
    if (str === '0000-00-00 00:00:00') return null;
    const normalized = str.includes(' ') && !str.includes('T') ? str.replace(' ', 'T') : str;
    const d = new Date(normalized);
    return isNaN(d.getTime()) ? null : d;
  };

  const formatDateString = (s?: any, fmt = 'PPP') => {
    const d = parseDate(s);
    return d ? format(d, fmt) : 'Invalid date';
  };

  useEffect(() => {
    if (id) {
      fetchCaseData();
      fetchEvidence();
    }
  }, [id]);

  const fetchCaseData = async () => {
    try {
      const res = await axios.get(`/api/cases/${id}`);
      const caseInfo = res.data;

      // Fetch related profiles
      const userIds = [caseInfo.created_by, caseInfo.assigned_to, caseInfo.lead_investigator_id].filter(Boolean);
      let profilesMap = new Map();

      if (userIds.length > 0) {
        const profileRes = await axios.post('/api/profiles/by-ids', { ids: userIds });
        // normalize keys to strings to avoid mismatches
        profilesMap = new Map(profileRes.data.map((p: any) => [String(p.id), p]));
      }

      const caseWithProfiles = {
        ...caseInfo,
        creator: profilesMap.get(String(caseInfo.created_by)),
        assignee: caseInfo.assigned_to ? profilesMap.get(String(caseInfo.assigned_to)) : null,
        lead_investigator: caseInfo.lead_investigator_id ? profilesMap.get(String(caseInfo.lead_investigator_id)) : null
      };

      setCaseData(caseWithProfiles);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to fetch case details: ' + error.message,
        variant: 'destructive',
      });
    }
  };

  const fetchEvidence = async () => {
    try {
      const res = await axios.get(`/api/evidence/case/${id}`);
      const evidenceData = res.data;

      const uploaderIds = [...new Set(evidenceData.map((e: any) => e.uploaded_by).filter(Boolean))];
      let profilesMap = new Map();

      if (uploaderIds.length > 0) {
        const profileRes = await axios.post('/api/profiles/by-ids', { ids: uploaderIds });
        profilesMap = new Map(profileRes.data.map((p: any) => [String(p.id), p]));
      }

      const evidenceWithProfiles = evidenceData.map((e: any) => ({
        ...e,
        uploader: profilesMap.get(String(e.uploaded_by))
      }));

      setEvidence(evidenceWithProfiles);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to fetch evidence: ' + error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status.toLowerCase()) {
      case 'active': return 'default';
      case 'closed': return 'secondary';
      case 'archived': return 'outline';
      default: return 'default';
    }
  };

  const getPriorityColor = (priority: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (priority.toLowerCase()) {
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'default';
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown size';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const handleViewEvidence = (evidenceId: string) => {
    navigate(`/evidence/${evidenceId}`);
  };

  const handleChainOfCustody = (evidenceId: string) => {
    setSelectedEvidenceId(evidenceId);
    setCustodyDialogOpen(true);
  };

  const canEdit = () => {
    if (!caseData || !profile) return false;
    return profile.role === 'admin' || 
           caseData.created_by === profile.id || 
           caseData.lead_investigator_id === profile.id;
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-48" />
            <Skeleton className="h-32" />
          </div>
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">Case Not Found</h1>
          <Button onClick={() => navigate('/cases')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Cases
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/cases')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Cases
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{caseData.case_number}</h1>
            <p className="text-muted-foreground">{caseData.title}</p>
          </div>
        </div>
        {canEdit() && (
          <Button onClick={() => setEditDialogOpen(true)}>
            <Edit className="h-4 w-4 mr-2" />
            Edit Case
          </Button>
        )}
      </div>

      {/* Case Info & Evidence */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Case Info */}
          <Card>
            <CardHeader>
              <CardTitle>Case Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2 mb-4">
                <Badge variant={getStatusColor(caseData.status)}>
                  {caseData.status}
                </Badge>
                <Badge variant={getPriorityColor(caseData.priority)}>
                  {caseData.priority} Priority
                </Badge>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Created:</span>
                    <span>{formatDateString(caseData.created_at)}</span>
                  </div>
                  {caseData.due_date && (
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Due Date:</span>
                      <span>{formatDateString(caseData.due_date)}</span>
                    </div>
                  )}
                </div>
                
                <div className="space-y-2">
                  {caseData.creator && (
                    <div className="flex items-center gap-2 text-sm">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Created by:</span>
                      <span>{caseData.creator.full_name}</span>
                    </div>
                  )}
                  {caseData.assignee && (
                    <div className="flex items-center gap-2 text-sm">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Assigned to:</span>
                      <span>{caseData.assignee.full_name}</span>
                    </div>
                  )}
                  {caseData.lead_investigator && (
                    <div className="flex items-center gap-2 text-sm">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Lead Investigator:</span>
                      <span>{caseData.lead_investigator.full_name}</span>
                    </div>
                  )}
                </div>
              </div>

              {caseData.description && (
                <>
                  <Separator />
                  <div>
                    <h4 className="font-medium mb-2">Description</h4>
                    <p className="text-sm text-muted-foreground">{caseData.description}</p>
                  </div>
                </>
              )}

              {caseData.findings && (
                <>
                  <Separator />
                  <div>
                    <h4 className="font-medium mb-2">Findings</h4>
                    <p className="text-sm text-muted-foreground">{caseData.findings}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Evidence */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Evidence ({evidence.length})
              </CardTitle>
              <CardDescription>Digital evidence associated with this case</CardDescription>
            </CardHeader>
            <CardContent>
              {evidence.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No evidence found for this case
                </div>
              ) : (
                <div className="space-y-3">
                  {evidence.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-3 border border-border rounded-lg">
                      <div className="flex-1">
                        <h4 className="font-medium">{item.title}</h4>
                        <div className="text-sm text-muted-foreground mt-1">
                          {item.file_name && <span>{item.file_name} • </span>}
                          {item.file_type && <span>{item.file_type.toUpperCase()} • </span>}
                          <span>{formatFileSize(item.file_size)}</span>
                          <span> • Uploaded by {item.uploader?.full_name}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{item.status}</Badge>
                        <Button variant="ghost" size="sm" onClick={() => handleChainOfCustody(item.id)}>
                          <Link2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleViewEvidence(item.id)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Comments Section */}
        <div className="space-y-6">
          <CommentsSection caseId={caseData.id} />
        </div>
      </div>

      {/* Dialogs */}
      <EditCaseDialog
        case_={caseData as any}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onUpdate={fetchCaseData}
      />

      <ChainOfCustodyDialog
        open={custodyDialogOpen}
        onOpenChange={setCustodyDialogOpen}
        evidenceId={selectedEvidenceId}
      />
    </div>
  );
};

export default CaseDetails;
