import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

interface EditTagDialogProps {
  tag: { id: string; name: string; color: string } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTagUpdated: () => void;
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const EditTagDialog = ({ tag, open, onOpenChange, onTagUpdated }: EditTagDialogProps) => {
  const [name, setName] = useState('');
  const [color, setColor] = useState('#3b82f6');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { user, token } = useAuth() as any; 

  useEffect(() => {
    if (tag) {
      setName(tag.name);
      setColor(tag.color || '#3b82f6');
    } else {
      setName('');
      setColor('#3b82f6');
    }
  }, [tag]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !tag) {
      toast({ title: 'Unauthorized', description: 'You must be signed in', variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/tags/${tag.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ name: name.trim(), color: color.trim() })
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || 'Failed to update tag');
      }

      const updated = await res.json();

      // Optional: send audit log (server can also do this)
      try {
        await fetch(`${API_BASE}/api/audit_logs`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            user_id: user.id,
            action: 'update',
            resource_type: 'tag',
            resource_id: tag.id,
            details: { old_name: tag.name, new_name: name.trim(), new_color: color.trim() }
          })
        });
      } catch (auditErr) {
        console.warn('Audit log failed (non-blocking):', auditErr);
      }

      toast({ title: 'Success', description: 'Tag updated successfully' });
      onTagUpdated();
      onOpenChange(false);
      setName('');
      setColor('#3b82f6');
    } catch (err: any) {
      console.error('Update tag error:', err);
      toast({ title: 'Error', description: (err.message || 'Failed to update tag'), variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Tag</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Tag Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter tag name"
              required
            />
          </div>
          <div>
            <Label htmlFor="color">Color</Label>
            <div className="flex items-center space-x-2">
              <Input
                id="color"
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-20 h-10"
              />
              <Input
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="#3b82f6"
                className="flex-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !name.trim()}>
              {isLoading ? 'Updating...' : 'Update Tag'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditTagDialog;
