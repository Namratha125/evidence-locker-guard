import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  ArrowLeft,
  User,
  FileText,
  Tag,
  Link2,
} from "lucide-react";
import ChainOfCustodyDialog from "@/components/ChainOfCustodyDialog";
import {  Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import CommentsSection from "@/components/CommentsSection";
import EvidenceTagSelector from "@/components/EvidenceTagSelector";

interface EvidenceData {
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
  tags?: string[];
  case_id?: string;
  file_path?: string;
}

const EvidenceDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile } = useAuth();

  const [evidence, setEvidence] = useState<EvidenceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [custodyDialogOpen, setCustodyDialogOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [evidenceTags, setEvidenceTags] = useState<any[]>([]);

  useEffect(() => {
    if (id) fetchEvidence();
  }, [id]);

  const fetchEvidence = async () => {
    try {
      const res = await axios.get(`/api/evidence/id/${id}`);
      const ev = res.data;

      if (ev.uploaded_by) {
        const profileRes = await axios.post("/api/profiles/by-ids", {
          ids: [ev.uploaded_by],
        });
        ev.uploader = profileRes.data[0];
      }

      // fetch tags
      const tagRes = await axios.get(`/api/evidence/${id}/tags`);
      ev.tags = tagRes.data || [];

      setEvidence(ev);
      setEvidenceTags(tagRes.data || []);
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

  const canEdit = () => {
    // Allow admins, investigators, and analysts to add/remove tags
    if (!profile) return false;
    return profile.role === "admin" || 
           profile.role === "investigator" ||
           profile.role === "analyst" || 
           evidence?.uploaded_by === profile.id;
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "Unknown size";
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (
      Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + " " + sizes[i]
    );
  };

  const API_BASE = (import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/+$/, "");

  const fileUrlFromEvidence = (filePath?: string | null, opts?: { caseId?: string | null; fileName?: string | null }) => {
    if (!filePath && !opts?.fileName) return null;
  
    // Already a full URL → return as-is
    if (filePath && /^https?:\/\//.test(filePath)) return filePath;
  
    // If the path already contains 'uploads/', just prefix API base
    if (filePath) {
      // Normalize Windows backslashes to forward slashes
      let normalized = filePath.replace(/\\/g, "/");
      // Trim leading slashes
      normalized = normalized.replace(/^\/+/, "");

      if (/uploads\//.test(normalized)) {
        return `${API_BASE}/api/${normalized}`;
      }
      // If filePath looks like just a filename, fallthrough to recursive endpoint
      if (!normalized.includes("/")) {
        return `${API_BASE}/api/evidence/${encodeURIComponent(normalized)}`;
      }
      // As a final attempt, try serving via recursive evidence endpoint using the filename portion
      const parts = normalized.split("/");
      const fname = parts[parts.length - 1];
      return `${API_BASE}/api/evidence/${encodeURIComponent(fname)}`;
    }
  
    // Force fallback to uploads/general if nothing else matches
    const fileName = opts?.fileName || filePath;
    // Prefer the recursive evidence endpoint which will search uploads/ recursively
    return `${API_BASE}/api/evidence/${encodeURIComponent(fileName || '')}`;
  };

  const fileUrl = fileUrlFromEvidence(evidence?.file_path, {
    caseId: evidence?.case_id,
    fileName: evidence?.file_name
  });
  if (fileUrl) console.log("Preview file URL:", fileUrl);



  const handleDownload = () => {
    if (!fileUrl) return;
    const link = document.createElement("a");
    link.href = fileUrl;
    link.download = evidence?.file_name || "evidence_file";
    link.click();
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-64" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!evidence) {
    return (
      <div className="container mx-auto p-6 text-center">
        <h1 className="text-2xl font-bold text-foreground mb-4">
          Evidence Not Found
        </h1>
        <Button onClick={() => navigate("/cases")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Cases
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {evidence.title}
            </h1>
            <p className="text-muted-foreground">{evidence.file_name}</p>
          </div>
        </div>
      </div>

      {/* Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Evidence Info */}
          <Card>
            <CardHeader>
              <CardTitle>Evidence Details</CardTitle>
              <CardDescription>
                Uploaded on{" "}
                {new Date(evidence.created_at).toLocaleDateString()}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2 mb-2">
                <Badge variant="outline">{evidence.status}</Badge>
                {evidence.tags?.map((t: any, i: number) => (
                  <Badge
                    key={i}
                    variant="secondary"
                    style={{ backgroundColor: t.color || "#e5e7eb" }}
                  >
                    <Tag className="h-3 w-3 mr-1" />
                    {t.name || t}
                  </Badge>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="text-sm space-y-1">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span>
                      Uploaded by: {evidence.uploader?.full_name || "Unknown"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span>Type: {evidence.file_type}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span>Size: {formatFileSize(evidence.file_size)}</span>
                  </div>
                </div>
              </div>

              {evidence.description && (
                <>
                  <Separator />
                  <div>
                    <h4 className="font-medium mb-2">Description</h4>
                    <p className="text-sm text-muted-foreground">
                      {evidence.description}
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* File Preview */}
          <Card>
            <CardHeader>
              <CardTitle>Preview</CardTitle>
            </CardHeader>
            <CardContent className="flex justify-center">
              {evidence.file_type?.startsWith("image/") ? (
                <>
                  
                  <img
                    src={fileUrl}
                    alt={evidence.title}
                    className="max-h-[400px] rounded-lg shadow-md cursor-pointer transition-transform hover:scale-105"
                    onClick={() => setPreviewOpen(true)}
                  />
                  <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
                    <DialogContent
                      className="bg-black/90 border-none shadow-none p-0 flex items-center justify-center max-w-full w-screen h-screen"
                    >
                      <VisuallyHidden>
                        <DialogTitle>{evidence.title}</DialogTitle>
                        <DialogDescription>Preview of uploaded evidence</DialogDescription>
                      </VisuallyHidden>
                      
                      <img
                        src={fileUrl}
                        alt={evidence.title}
                        className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg"
                      />
                    </DialogContent>
                  </Dialog>



                </>
              ) : evidence.file_type?.startsWith("video/") ? (
                <video
                  src={fileUrl}
                  controls
                  className="max-h-[400px] rounded-lg shadow-md"
                />
              ) : (
                <p className="text-muted-foreground">
                  No preview available for this file type
                </p>
              )}
            </CardContent>
          </Card>

          {/* Tags Section */}
          <Card>
            <CardHeader>
              <CardTitle>Tags</CardTitle>
            </CardHeader>
            <CardContent>
              <EvidenceTagSelector
                evidenceId={evidence.id}
                selectedTags={evidenceTags}
                onTagsChange={setEvidenceTags}
                disabled={!canEdit()}
              />
            </CardContent>
          </Card>
        </div>

        {/* Side Panel */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Button
                variant="outline"
                onClick={() => setCustodyDialogOpen(true)}
              >
                <Link2 className="h-4 w-4 mr-2" />
                View Chain of Custody
              </Button>
              <Button
                variant="secondary"
                className="w-full"
                onClick={handleDownload}
              >
                Download
              </Button>
            </CardContent>
          </Card>

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
