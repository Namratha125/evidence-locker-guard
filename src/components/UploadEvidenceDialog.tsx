import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Upload } from "lucide-react";

interface UploadEvidenceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEvidenceUploaded: () => void;
}

interface Case {
  id: string;
  case_number: string;
  title: string;
}

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

const UploadEvidenceDialog = ({
  open,
  onOpenChange,
  onEvidenceUploaded,
}: UploadEvidenceDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [cases, setCases] = useState<Case[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    caseId: "",
    collectedBy: "",
    locationFound: "",
    collectedDate: new Date().toISOString().split("T")[0],
  });
  const { toast } = useToast();
  const { user, token } = useAuth();

  useEffect(() => {
    if (open) {
      fetchCases();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const fetchCases = async () => {
    try {
      const url = new URL(`${API_BASE}/cases`);
      url.searchParams.set("status", "active");
      const res = await fetch(url.toString(), {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: res.statusText }));
        throw new Error(err.message || "Failed to fetch cases");
      }
      const data = await res.json();
      setCases(data || []);
    } catch (error: any) {
      console.error("fetchCases error:", error);
      toast({
        title: "Error",
        description: "Failed to fetch cases: " + (error.message || error),
        variant: "destructive",
      });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] ?? null;
    if (selectedFile) {
      setFile(selectedFile);
      if (!formData.title) {
        setFormData({ ...formData, title: selectedFile.name });
      }
    } else {
      setFile(null);
    }
  };

  const calculateFileHash = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !token) {
      toast({
        title: "Error",
        description: "You must be signed in to upload evidence",
        variant: "destructive",
      });
      return;
    }
    if (!file) {
      toast({
        title: "Error",
        description: "Please select a file to upload",
        variant: "destructive",
      });
      return;
    }
    if (!formData.caseId) {
      toast({
        title: "Error",
        description: "Please select a case",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // compute hash
      const hashValue = await calculateFileHash(file);

      // prepare multipart form data
      const fd = new FormData();
      fd.append("file", file);
      fd.append("title", formData.title);
      fd.append("description", formData.description);
      fd.append("case_id", formData.caseId);
      fd.append("file_name", file.name);
      fd.append("file_type", file.type || "");
      fd.append("file_size", String(file.size));
      fd.append("hash_value", hashValue);
      fd.append("collected_by", formData.collectedBy);
      fd.append("location_found", formData.locationFound);
      fd.append("collected_date", formData.collectedDate);
      fd.append("uploaded_by", user.id);
      fd.append("status", "pending");

      // Send to backend. Backend endpoint must handle file (multipart/form-data),
      // save file (disk / S3), and insert DB record into evidence table.
      const res = await fetch(`${API_BASE}/evidence/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          // DO NOT set Content-Type here — browser will set the multipart boundary
        },
        body: fd,
      });

      const resJson = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(resJson.message || res.statusText || "Upload failed");
      }

      // optional: create audit log via backend endpoint (server should create audit itself too)
      // If you have an endpoint for audit logs: POST /audit-logs or similar
      // await fetch(`${API_BASE}/audit-logs`, { method: 'POST', headers: {...}, body: JSON.stringify({...}) });

      toast({
        title: "Success",
        description: "Evidence uploaded successfully",
      });

      // reset form
      setFormData({
        title: "",
        description: "",
        caseId: "",
        collectedBy: "",
        locationFound: "",
        collectedDate: new Date().toISOString().split("T")[0],
      });
      setFile(null);
      onOpenChange(false);
      onEvidenceUploaded();
    } catch (error: any) {
      console.error("Upload error:", error);
      toast({
        title: "Error",
        description: "Failed to upload evidence: " + (error.message || error),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload Evidence</DialogTitle>
          <DialogDescription>
            Upload digital evidence and associate it with a case.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="file">Evidence File</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="file"
                  type="file"
                  onChange={handleFileChange}
                  required
                  className="cursor-pointer"
                />
                <Upload className="h-4 w-4 text-muted-foreground" />
              </div>
              {file && (
                <p className="text-sm text-muted-foreground">
                  Selected: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="caseId">Case</Label>
              <Select
                value={formData.caseId}
                onValueChange={(value) => setFormData({ ...formData, caseId: value })}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a case" />
                </SelectTrigger>
                <SelectContent>
                  {cases.map((case_) => (
                    <SelectItem key={case_.id} value={case_.id}>
                      {case_.case_number} - {case_.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="title">Evidence Title</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Evidence title or identifier"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Detailed description of the evidence"
                rows={3}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="collectedBy">Collected By</Label>
              <Input
                id="collectedBy"
                value={formData.collectedBy}
                onChange={(e) => setFormData({ ...formData, collectedBy: e.target.value })}
                placeholder="Name of person who collected evidence"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="locationFound">Location Found</Label>
              <Input
                id="locationFound"
                value={formData.locationFound}
                onChange={(e) => setFormData({ ...formData, locationFound: e.target.value })}
                placeholder="Where evidence was found"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="collectedDate">Collection Date</Label>
              <Input
                id="collectedDate"
                type="date"
                value={formData.collectedDate}
                onChange={(e) => setFormData({ ...formData, collectedDate: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !file}>
              {loading ? "Uploading..." : "Upload Evidence"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default UploadEvidenceDialog;
