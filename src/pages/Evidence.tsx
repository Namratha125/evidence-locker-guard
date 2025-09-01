import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, FileText, Download, Eye, Link2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { createAuditLog } from '@/utils/audit';
import UploadEvidenceDialog from '@/components/UploadEvidenceDialog';
import ChainOfCustodyDialog from '@/components/ChainOfCustodyDialog';

interface Evidence {
  id: string;
  title: string;
  description: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  status: string;
  created_at: string;
  case: {
    case_number: string;
    title: string;
  };
  uploaded_by: {
    full_name: string;
  };
}

const Evidence = () => {
  const navigate = useNavigate();
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [custodyDialogOpen, setCustodyDialogOpen] = useState(false);
  const [selectedEvidenceId, setSelectedEvidenceId] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    fetchEvidence();
  }, []);

  const fetchEvidence = async () => {
    try {
      const { data, error } = await supabase
        .from('evidence')
        .select(`
          *,
          case:cases(case_number, title),
          uploaded_by:profiles(full_name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
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

  const filteredEvidence = evidence.filter(e =>
    e.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.file_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.case?.case_number.toLowerCase().includes(searchTerm.toLowerCase())
  );

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

  const getFileTypeIcon = (fileType: string) => {
    return <FileText className="h-4 w-4" />;
  };

  const handleDownload = async (evidence: Evidence) => {
    try {
      if (!evidence.file_path) {
        toast({
          title: "Error",
          description: "File path not found for this evidence",
          variant: "destructive",
        });
        return;
      }

      const { data, error } = await supabase.storage
        .from('evidence-files')
        .download(evidence.file_path);

      if (error) throw error;

      // Create audit log
      await createAuditLog({
        action: 'download',
        resource_type: 'evidence',
        resource_id: evidence.id,
        details: { file_name: evidence.file_name }
      });

      // Create download link
      const url = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.download = evidence.file_name || 'evidence-file';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "Success",
        description: "File downloaded successfully",
      });
    } catch (error: any) {
      console.error('Download error:', error);
      toast({
        title: "Error",
        description: "Failed to download file: " + error.message,
        variant: "destructive",
      });
    }
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
          <p className="text-muted-foreground">Upload, manage, and track digital evidence</p>
        </div>
        <Button onClick={() => setUploadDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Upload Evidence
        </Button>
      </div>

      <div className="flex items-center space-x-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search evidence..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="grid gap-4">
        {filteredEvidence.length === 0 ? (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <div className="text-center">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No evidence found</h3>
                <p className="text-muted-foreground">
                  {searchTerm ? 'No evidence matches your search criteria.' : 'Upload your first piece of evidence to get started.'}
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
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => {
                        setSelectedEvidenceId(item.id);
                        setCustodyDialogOpen(true);
                      }}
                    >
                      <Link2 className="h-4 w-4" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => navigate(`/evidence/${item.id}`)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
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
                    <span>Date: {new Date(item.created_at).toLocaleDateString()}</span>
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