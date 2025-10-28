import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

interface Case {
  id: string;
  case_number: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  assigned_to: string | null;
  findings: string | null;
  due_date: string | null;
}

interface User {
  id: string;
  full_name: string;
  role: string;
}

interface EditCaseDialogProps {
  case_: Case;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function EditCaseDialog({ case_, open, onOpenChange, onUpdate }: EditCaseDialogProps) {
  const [formData, setFormData] = useState({
    case_number: '',
    title: '',
    description: '',
    status: '',
    priority: '',
    assigned_to: '',
    findings: '',
    due_date: null as Date | null,
  });
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { user, token } = useAuth() as any; 

  useEffect(() => {
    if (case_) {
      setFormData({
        case_number: case_.case_number,
        title: case_.title,
        description: case_.description || '',
        status: case_.status || 'active',
        priority: case_.priority || 'medium',
        assigned_to: case_.assigned_to || '',
        findings: case_.findings || '',
        due_date: case_.due_date ? new Date(case_.due_date) : null,
      });
    }
  }, [case_]);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/profiles`);
      if (!res.ok) throw new Error('Failed to load users');
      const data = await res.json();
      // backend returns [{id, full_name}, ...]
      setUsers(data || []);
    } catch (err: any) {
      console.error('Error fetching users:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.case_number.trim() || !formData.title.trim()) {
      toast({
        title: "Error",
        description: "Case number and title are required",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const updateData: any = {
        case_number: formData.case_number.trim(),
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        status: formData.status,
        priority: formData.priority,
        findings: formData.findings.trim() || null,
        due_date: formData.due_date ? formData.due_date.toISOString().slice(0, 19).replace('T', ' ') : null, // MySQL DATETIME friendly
        assigned_to: formData.assigned_to && formData.assigned_to !== 'unassigned' ? formData.assigned_to : null
      };

      const res = await fetch(`${API_BASE}/api/cases/${case_.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(updateData),
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || 'Failed to update case');
      }

      // Optionally create audit log (backend can also do this)
      try {
        await fetch(`${API_BASE}/api/audit_logs`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            user_id: user?.id ?? null,
            action: 'update',
            resource_type: 'case',
            resource_id: case_.id,
            details: { case_number: formData.case_number, changes: updateData }
          })
        });
      } catch (auditErr) {
        console.warn('Audit log failed (non-blocking):', auditErr);
      }

      toast({
        title: "Success",
        description: "Case updated successfully",
      });

      onUpdate();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to update case: " + (error.message || error),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Case</DialogTitle>
          <div className="text-sm text-muted-foreground">Update case information and assignment details.</div>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="case_number">Case Number *</Label>
              <Input
                id="case_number"
                value={formData.case_number}
                onChange={(e) => setFormData({ ...formData, case_number: e.target.value })}
                placeholder="e.g., CASE-2024-001"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                <SelectTrigger>
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

          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Case title"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Case description"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select value={formData.priority} onValueChange={(value) => setFormData({ ...formData, priority: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="assigned_to">Assigned To</Label>
              <Select value={formData.assigned_to} onValueChange={(value) => setFormData({ ...formData, assigned_to: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select user" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.full_name} ({u.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Due Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !formData.due_date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {formData.due_date ? format(formData.due_date, "PPP") : "Select due date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={formData.due_date || undefined}
                  onSelect={(date) => setFormData({ ...formData, due_date: date || null })}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="findings">Findings</Label>
            <Textarea
              id="findings"
              value={formData.findings}
              onChange={(e) => setFormData({ ...formData, findings: e.target.value })}
              placeholder="Case findings and notes"
              rows={4}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Updating...' : 'Update Case'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
