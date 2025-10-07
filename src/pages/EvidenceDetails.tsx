import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import EvidenceTagSelector from '@/components/EvidenceTagSelector';
import {
  ArrowLeft,
  Download,
  Calendar,
  User,
  FileText,
  Hash,
  MapPin,
  Link2,
  Image,
  Video,
  FileIcon,
} from 'lucide-react';
import ChainOfCustodyDialog from '@/components/ChainOfCustodyDialog';
import CommentsSection from '@/components/CommentsSection';

interface Evidence {
  id: string;
  title: string;
  description?: string;
  file_name?: string;
  file_path?: string;
  file_type?: string;
  file_size?: number;
  hash_value?: string;
  status: string;
  location_found?: string;
  collected_date?: string;
  collected_by?: string;
  created_at: string;
  case_id: string;
  uploaded_by: string;
  case?: {
    case_number: string;
    title: string;
  };
  uploader?: {
    full_name: string;
  };
  tags?: {
    id: string;
    name: string;
    color: string;
  }[];
}

const EvidenceDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [evidence, setEvidence] = useState<Evidence | null>(null);
  const [loading, setLoading] = useState(true);
  const [custodyDialogOpen, setCustodyDialogOpen] = useState(false);
  const [evidenceTags, setEvidenceTags] = useState<any[]>([]);

  const API_BASE = "http://localhost:5000"; // ✅ your backend base URL

  useEffect(() => {
    if (id) fetchEvidenceData();
  }, [id]);

  const fetchEvidenceData = async () => {
    try {
      const res = await fetch(`${API_BASE}/evidence/${id}`);
      if (!res.ok) throw new Error("Failed to fetch evidence");

      const data = await res.json();

      // Fetch related info
      const [caseRes, uploaderRes, tagsRes] = await Promise.all([
        fetch(`${API_BASE}/cases/${data.case_id}`),
        fetch(`${API_BASE}/profiles/${data.uploaded_by}`),
        fetch(`${API_BASE}/evidence/${id}/tags`),
      ]);

      const [caseData, uploaderData, tagsData] = await Promise.all([
        caseRes.ok ? caseRes.json() : null,
        uploaderRes.ok ? uploaderRes.json() : null,
        tagsRes.ok ? tagsRes.json() : [],
      ]);

      const fullEvidence = {
        ...data,
        case: caseData,
        uploader: uploaderData,
        tags: tagsData,
      };

      setEvidence(fullEvidence);
      setEvidenceTags(tagsData || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status?.toLowerCase()) {
      case 'verified': return 'default';
      case 'pending': return 'secondary';
      case 'archived': return 'outline';
      default: return 'default';
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown size';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getFileIcon = (fileType?: string) => {
    if (!fileType) return <FileIcon className="h-6 w-6" />;
    if (fileType.startsWith('image/')) return <Image className="h-6 w-6" />;
    if (fileType.startsWith('video/')) return <Video className="h-6 w-6" />;
    return <FileIcon className="h-6 w-6" />;
  };

  const handleDownload = async () => {
    if (!evidence?.file_path) return;
    try {
      const res = await fetch(`${API_BASE}/files/${evidence.id}`);
      if (!res.ok) throw new Error("File not found");

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = evidence.file_name || "evidence-file";
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      toast({
        title: "Download Failed",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (!evidence) {
    return (
      <div className="container mx-auto p-6 text-center">
        <h1 className="text-2xl font-bold text-foreground mb-4">Evidence Not Found</h1>
        <Button onClick={() => navigate('/evidence')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Evidence
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/evidence')}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Evidence
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{evidence.title}</h1>
            <p className="text-muted-foreground">
              Case: {evidence.case?.case_number} - {evidence.case?.title}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setCustodyDialogOpen(true)}>
            <Link2 className="h-4 w-4 mr-2" /> Chain of Custody
          </Button>
          {evidence.file_path && (
            <Button onClick={handleDownload}>
              <Download className="h-4 w-4 mr-2" /> Download
            </Button>
          )}
        </div>
      </div>

      {/* DETAILS */}
      <Card>
        <CardHeader><CardTitle>Evidence Information</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Badge variant={getStatusColor(evidence.status)}>{evidence.status}</Badge>
          <Separator />
          <div className="grid grid-cols-2 gap-4">
            <p><b>Uploaded by:</b> {evidence.uploader?.full_name}</p>
            <p><b>Location:</b> {evidence.location_found}</p>
            <p><b>File:</b> {evidence.file_name}</p>
            <p><b>Size:</b> {formatFileSize(evidence.file_size)}</p>
          </div>
          <Separator />
          <p>{evidence.description}</p>
        </CardContent>
      </Card>

      <ChainOfCustodyDialog
        open={custodyDialogOpen}
        onOpenChange={setCustodyDialogOpen}
        evidenceId={evidence.id}
      />
      <CommentsSection evidenceId={evidence.id} />
    </div>
  );
};

export default EvidenceDetails;
