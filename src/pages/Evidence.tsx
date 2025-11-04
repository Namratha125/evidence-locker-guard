import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, FileText, Download, Eye, Link2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import UploadEvidenceDialog from '@/components/UploadEvidenceDialog';
import ChainOfCustodyDialog from '@/components/ChainOfCustodyDialog';
import AdvancedSearch from '@/components/AdvancedSearch';

interface Evidence {
  id: string;
  case_id: string;
  title: string;
  description: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  status: string;
  created_at: string;
  case?: {
    case_number: string;
    title: string;
  };
  uploaded_by?: {
    full_name: string;
  };
  tags?: {
    id: string;
    name: string;
    color: string;
  }[];
}

// Base API URL
const API_BASE = (import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/+$/, "");

/**
 * Build a public URL for an evidence file.
 * Handles multiple shapes of file_path stored in DB.
 *
 * filePath may be:
 * - "uploads/<caseId>/<filename>"
 * - "/uploads/<caseId>/<filename>"
 * - "mall_cam1.mp4" (only filename)
 * - already a full URL "https://..."
 *
 * If only filename is present, we use caseId + fileName fallback.
 */
function fileUrlFromEvidence(filePath?: string | null, opts?: { caseId?: string | null; fileName?: string | null }) {
  if (!filePath && !opts?.fileName) return null;

  // Already a full URL → return as-is
  if (filePath && /^https?:\/\//.test(filePath)) return filePath;

  // If the path already contains 'uploads/', just prefix API base
  if (filePath && /uploads\//.test(filePath)) {
    const normalized = filePath.replace(/^\/+/, "");
    return `${API_BASE}/api/${normalized}`;
  }

  // ✅ Force fallback to uploads/general if nothing else matches
  const fileName = opts?.fileName || filePath;
  return `${API_BASE}/api/uploads/general/${fileName}`;
}

const Evidence = () => {
  const navigate = useNavigate();
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [filteredEvidence, setFilteredEvidence] = useState<Evidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [custodyDialogOpen, setCustodyDialogOpen] = useState(false);
  const [selectedEvidenceId, setSelectedEvidenceId] = useState('');
  const [cases, setCases] = useState<Array<{ id: string; case_number: string; title: string }>>([]);
  const [tags, setTags] = useState<Array<{ id: string; name: string; color: string }>>([]);
  const { toast } = useToast();

  const { profile } = useAuth();

  useEffect(() => {
    if (profile) {
      fetchEvidence();
      fetchCases();
      fetchTags();
    }
  }, [profile]);

  // Robust date parser used by filters and display
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
    return d ? format(d, fmt) : 'Unknown';
  };

  useEffect(() => {
    setFilteredEvidence(evidence);
  }, [evidence]);

  // Fetch all evidence with role-based filtering
  const fetchEvidence = async () => {
    try {
      if (!profile) return;
      
      let url = `${API_BASE}/api/evidence`;
      // If not admin, fetch only relevant evidence
      if (profile.role !== 'admin') {
        // For investigators, analysts, and other roles, fetch evidence they created or that belongs to their cases
        url += `?userId=${profile.id}`;
      }
      
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch evidence');
      const data = await res.json();
      setEvidence(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to fetch evidence: " + error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Fetch cases with role-based filtering
  const fetchCases = async () => {
    try {
      if (!profile) return;
      
      let url = `${API_BASE}/api/cases`;
      // If not admin, fetch only relevant cases
      if (profile.role !== 'admin') {
        // For investigators and analysts, fetch cases they're assigned to or created
        url += `?userId=${profile.id}`;
      }
      
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch cases');
      const data = await res.json();
      setCases(data || []);
    } catch (error) {
      console.error('Error fetching cases:', error);
    }
  };

  // Fetch tags with role-based filtering
  const fetchTags = async () => {
    try {
      if (!profile) return;
      
      let url = `${API_BASE}/api/tags`;
      // If not admin, fetch only relevant tags
      if (profile.role !== 'admin') {
        // For investigators and analysts, fetch tags from their cases/evidence
        url += `?userId=${profile.id}`;
      }
      
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch tags');
      const data = await res.json();
      setTags(data || []);
    } catch (error) {
      console.error('Error fetching tags:', error);
    }
  };

  // Copy direct file link to clipboard
  const copyEvidenceLink = async (item: Evidence) => {
    const url = fileUrlFromEvidence(item.file_path, { caseId: item.case_id, fileName: item.file_name });
    if (!url) { toast({ title: "Error", description: "No file available", variant: "destructive" }); return; }
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copied", description: "File URL copied to clipboard" });
    } catch (err: any) {
      toast({ title: "Error", description: "Failed to copy link: " + (err?.message || err), variant: "destructive" });
    }
  };

  // Open file in new tab (view or download depending on headers)
  const viewEvidence = (item: Evidence) => {
    const url = fileUrlFromEvidence(item.file_path, { caseId: item.case_id, fileName: item.file_name });
    if (!url) { toast({ title: "Error", description: "No file available", variant: "destructive" }); return; }
    window.open(url, "_blank", "noopener");
  };

  const handleAdvancedSearch = (filters: any) => {
    let filtered = [...evidence];
    const query = (filters.query || '').toString().trim();
    if (query) {
      const q = query.toLowerCase();
      filtered = filtered.filter(e =>
        (e.title || '').toLowerCase().includes(q) ||
        (e.description || '').toLowerCase().includes(q) ||
        (e.file_name || '').toLowerCase().includes(q) ||
        (e.case?.case_number || '').toLowerCase().includes(q)
      );
    }

    if (filters.status && filters.status !== 'all') {
      const s = String(filters.status).toLowerCase();
      filtered = filtered.filter(e => String(e.status).toLowerCase() === s);
    }

    if (filters.caseId && filters.caseId !== 'all') {
      const cid = String(filters.caseId);
      filtered = filtered.filter(e => String(e.case_id) === cid);
    }

    if (filters.tagId && filters.tagId !== 'all') {
      const tid = String(filters.tagId);
      filtered = filtered.filter(e => 
        !!e.tags && e.tags.some(t => String(t.id) === tid)
      );
    }

    // Normalize date filters and ensure proper comparison
    const from = filters.dateFrom ? new Date(filters.dateFrom.setHours(0, 0, 0, 0)) : null;
    // Set end of day for "to" date to include the entire day
    const to = filters.dateTo ? new Date(filters.dateTo.setHours(23, 59, 59, 999)) : null;

    if (from) {
      filtered = filtered.filter(e => {
        const d = parseDate(e.created_at);
        // Compare dates at start of day for consistent comparison
        return d ? new Date(d.setHours(0, 0, 0, 0)) >= from : false;
      });
    }

    if (to) {
      filtered = filtered.filter(e => {
        const d = parseDate(e.created_at);
        // Compare with end of day for "to" date
        return d ? d <= to : false;
      });
    }

    setFilteredEvidence(filtered);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'verified': return 'default';
      case 'pending': return 'secondary';
      case 'archived': return 'outline';
      default: return 'default';
    }
  };

  // Update evidence status
  const updateEvidenceStatus = async (evidenceId: string, newStatus: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/evidence/${evidenceId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) throw new Error('Failed to update status');

      toast({
        title: "Success",
        description: "Evidence status updated successfully",
      });

      fetchEvidence();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to update evidence status: " + error.message,
        variant: "destructive",
      });
    }
  };

  const getFileTypeIcon = (fileType: string) => <FileText className="h-4 w-4" />;

  // Download / open
  const handleDownload = (item: Evidence) => {
    const url = fileUrlFromEvidence(item.file_path, { caseId: item.case_id, fileName: item.file_name });
    if (!url) {
      toast({ title: "Error", description: "File not found for this evidence", variant: "destructive" });
      return;
    }
    window.open(url, "_blank", "noopener");
  };

  if (loading) {
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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Evidence Management</h1>
          <p className="text-muted-foreground">
            Upload, manage, and track digital evidence
          </p>
        </div>
        <Button onClick={() => setUploadDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Upload Evidence
        </Button>
      </div>

      <div className="mb-6">
        <AdvancedSearch
          type="evidence"
          onSearch={handleAdvancedSearch}
          cases={cases}
          tags={tags}
        />
      </div>

      <div className="grid gap-4">
        {filteredEvidence.length === 0 ? (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <div className="text-center">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No evidence found</h3>
                <p className="text-muted-foreground">
                  No evidence matches your search criteria.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          filteredEvidence.map((item) => (
            <Card key={item.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle className="flex items-center gap-2">
                      {getFileTypeIcon(item.file_type)}
                      {item.title}
                      <Badge variant={getStatusColor(item.status)}>
                        {item.status}
                      </Badge>
                    </CardTitle>
                    <CardDescription className="mt-1">
                      Case: {item.case?.case_number} - {item.case?.title}
                    </CardDescription>
                    {item.tags && item.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {item.tags.map((tag) => (
                          <Badge
                            key={tag.id}
                            variant="outline"
                            className="text-xs"
                            style={{ 
                              backgroundColor: `${tag.color}20`,
                              borderColor: tag.color,
                              color: tag.color
                            }}
                          >
                            {tag.name}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Select
                      value={item.status}
                      onValueChange={(value) => updateEvidenceStatus(item.id, value)}
                    >
                      <SelectTrigger className="w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="verified">Verified</SelectItem>
                        <SelectItem value="archived">Archived</SelectItem>
                      </SelectContent>
                    </Select>

                    {/* Chain of custody (opens dialog) */}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        console.log("Clicked evidence:", item);
                        setSelectedEvidenceId(item.id);
                        setCustodyDialogOpen(true);
                      }}
                    >
                      <Link2 className="h-4 w-4" />
                    </Button>

                    {/* View / open file in new tab */}
                    {/* Open evidence details inside the app (like Cases) */}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate(`/evidence/${item.id}`)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>


                    {/* Download / open file */}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDownload(item)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>

                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  {item.description}
                </p>
                <div className="flex justify-between items-center text-sm text-muted-foreground">
                  <div className="flex items-center gap-4">
                    <span>File: {item.file_name}</span>
                    <span>Size: {formatFileSize(item.file_size || 0)}</span>
                    <span>Type: {item.file_type}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span>Uploaded by: {item.uploaded_by?.full_name}</span>
                    <span>Date: {formatDateString(item.created_at)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <UploadEvidenceDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        onEvidenceUploaded={fetchEvidence}
      />

      <ChainOfCustodyDialog
        open={custodyDialogOpen}
        onOpenChange={setCustodyDialogOpen}
        evidenceId={selectedEvidenceId}
      />
    </div>
  );
};

export default Evidence;
