import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Upload } from 'lucide-react';

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

const UploadEvidenceDialog = ({ open, onOpenChange, onEvidenceUploaded }: UploadEvidenceDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [cases, setCases] = useState<Case[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    caseId: '',
    collectedBy: '',
    locationFound: '',
    collectedDate: new Date().toISOString().split('T')[0]
  });
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (open) {
      fetchCases();
    }
  }, [open]);

  const fetchCases = async () => {
    try {
      const { data, error } = await supabase
        .from('cases')
        .select('id, case_number, title')
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCases(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to fetch cases: " + error.message,
        variant: "destructive",
      });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      if (!formData.title) {
        setFormData({ ...formData, title: selectedFile.name });
      }
    }
  };

  const calculateFileHash = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !file) return;

    setLoading(true);
    try {
      // Calculate file hash
      const hashValue = await calculateFileHash(file);

      // Upload file to storage
      const fileName = `${Date.now()}_${file.name}`;
      const filePath = `${formData.caseId}/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('evidence-files')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Insert evidence record
      const { error: insertError } = await supabase
        .from('evidence')
        .insert({
          title: formData.title,
          description: formData.description,
          case_id: formData.caseId,
          file_name: file.name,
          file_path: filePath,
          file_type: file.type,
          file_size: file.size,
          hash_value: hashValue,
          collected_by: formData.collectedBy,
          location_found: formData.locationFound,
          collected_date: formData.collectedDate,
          uploaded_by: user.id,
          status: 'pending'
        });

      if (insertError) throw insertError;

      toast({
        title: "Success",
        description: "Evidence uploaded successfully",
      });

      // Reset form
      setFormData({
        title: '',
        description: '',
        caseId: '',
        collectedBy: '',
        locationFound: '',
        collectedDate: new Date().toISOString().split('T')[0]
      });
      setFile(null);
      onOpenChange(false);
      onEvidenceUploaded();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to upload evidence: " + error.message,
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
              <Select value={formData.caseId} onValueChange={(value) => setFormData({ ...formData, caseId: value })} required>
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
              {loading ? 'Uploading...' : 'Upload Evidence'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default UploadEvidenceDialog;