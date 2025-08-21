import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
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
  FileIcon
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
  const [previewUrl, setPreviewUrl] = useState<string>('');

  useEffect(() => {
    if (id) {
      fetchEvidenceData();
    }
  }, [id]);

  const fetchEvidenceData = async () => {
    try {
      const { data, error } = await supabase
        .from('evidence')
        .select(`
          *,
          case:cases!evidence_case_id_fkey(case_number, title),
          uploader:profiles!evidence_uploaded_by_fkey(full_name),
          tags:evidence_tags(tag:tags!evidence_tags_tag_id_fkey(id, name, color))
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      
      // Transform the tags data
      const transformedData = {
        ...data,
        tags: data.tags?.map((t: any) => t.tag).filter(Boolean) || []
      };
      
      setEvidence(transformedData);
      
      // Try to get file preview URL if it's an image
      if (data.file_path && data.file_type?.startsWith('image/')) {
        const { data: urlData } = await supabase.storage
          .from('evidence-files')
          .createSignedUrl(data.file_path, 60 * 60); // 1 hour
        
        if (urlData?.signedUrl) {
          setPreviewUrl(urlData.signedUrl);
        }
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to fetch evidence details: " + error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status.toLowerCase()) {
      case 'verified': return 'default';
      case 'pending': return 'secondary';
      case 'compromised': return 'destructive';
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
      const { data, error } = await supabase.storage
        .from('evidence-files')
        .download(evidence.file_path);

      if (error) throw error;

      // Create download link
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = evidence.file_name || 'evidence-file';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Log audit event  
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('audit_logs').insert({
          action: 'download',
          resource_type: 'evidence',
          resource_id: evidence.id,
          user_id: user.id,
          details: { file_name: evidence.file_name }
        });
      }

      toast({
        title: "Success",
        description: "Evidence file downloaded successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to download file: " + error.message,
        variant: "destructive",
      });
    }
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

  if (!evidence) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">Evidence Not Found</h1>
          <Button onClick={() => navigate('/evidence')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Evidence
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/evidence')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Evidence
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{evidence.title}</h1>
            <p className="text-muted-foreground">
              Case: {evidence.case?.case_number} - {evidence.case?.title}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setCustodyDialogOpen(true)}>
            <Link2 className="h-4 w-4 mr-2" />
            Chain of Custody
          </Button>
          {evidence.file_path && (
            <Button onClick={handleDownload}>
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* File Preview */}
          {evidence.file_type && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {getFileIcon(evidence.file_type)}
                  File Preview
                </CardTitle>
              </CardHeader>
              <CardContent>
                {previewUrl && evidence.file_type?.startsWith('image/') ? (
                  <div className="text-center">
                    <img 
                      src={previewUrl} 
                      alt={evidence.title}
                      className="max-w-full max-h-96 mx-auto rounded-lg border border-border"
                    />
                  </div>
                ) : evidence.file_type?.startsWith('video/') ? (
                  <div className="text-center p-8 border border-border rounded-lg">
                    <Video className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">Video preview not available</p>
                    <p className="text-sm text-muted-foreground">Use download to view the file</p>
                  </div>
                ) : (
                  <div className="text-center p-8 border border-border rounded-lg">
                    <FileIcon className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">File preview not available</p>
                    <p className="text-sm text-muted-foreground">
                      {evidence.file_type?.toUpperCase()} file - Use download to view
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Evidence Information */}
          <Card>
            <CardHeader>
              <CardTitle>Evidence Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2 mb-4">
                <Badge variant={getStatusColor(evidence.status)}>
                  {evidence.status}
                </Badge>
                {evidence.tags?.map((tag) => (
                  <Badge 
                    key={tag.id} 
                    variant="outline"
                    style={{ borderColor: tag.color, color: tag.color }}
                  >
                    {tag.name}
                  </Badge>
                ))}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Uploaded:</span>
                    <span>{new Date(evidence.created_at).toLocaleDateString()}</span>
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Uploaded by:</span>
                    <span>{evidence.uploader?.full_name}</span>
                  </div>

                  {evidence.collected_date && (
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Collected:</span>
                      <span>{new Date(evidence.collected_date).toLocaleDateString()}</span>
                    </div>
                  )}

                  {evidence.collected_by && (
                    <div className="flex items-center gap-2 text-sm">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Collected by:</span>
                      <span>{evidence.collected_by}</span>
                    </div>
                  )}
                </div>
                
                <div className="space-y-3">
                  {evidence.file_name && (
                    <div className="flex items-center gap-2 text-sm">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">File:</span>
                      <span className="truncate">{evidence.file_name}</span>
                    </div>
                  )}

                  {evidence.file_type && (
                    <div className="flex items-center gap-2 text-sm">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Type:</span>
                      <span>{evidence.file_type}</span>
                    </div>
                  )}

                  {evidence.file_size && (
                    <div className="flex items-center gap-2 text-sm">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Size:</span>
                      <span>{formatFileSize(evidence.file_size)}</span>
                    </div>
                  )}

                  {evidence.location_found && (
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Location:</span>
                      <span>{evidence.location_found}</span>
                    </div>
                  )}
                </div>
              </div>

              {evidence.hash_value && (
                <>
                  <Separator />
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Hash className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">File Hash (SHA-256)</span>
                    </div>
                    <code className="text-xs bg-muted p-2 rounded block break-all">
                      {evidence.hash_value}
                    </code>
                  </div>
                </>
              )}

              {evidence.description && (
                <>
                  <Separator />
                  <div>
                    <h4 className="font-medium mb-2">Description</h4>
                    <p className="text-sm text-muted-foreground">{evidence.description}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {/* Related Case */}
          <Card>
            <CardHeader>
              <CardTitle>Related Case</CardTitle>
            </CardHeader>
            <CardContent>
              <div 
                className="p-3 border border-border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => navigate(`/cases/${evidence.case_id}`)}
              >
                <h4 className="font-medium">{evidence.case?.case_number}</h4>
                <p className="text-sm text-muted-foreground">{evidence.case?.title}</p>
              </div>
            </CardContent>
          </Card>

          {/* Comments */}
          <CommentsSection evidenceId={evidence.id} />
        </div>
      </div>

      <ChainOfCustodyDialog
        open={custodyDialogOpen}
        onOpenChange={setCustodyDialogOpen}
        evidenceId={evidence.id}
      />
    </div>
  );
};

export default EvidenceDetails;