import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Clock, User, MapPin } from 'lucide-react';

interface ChainOfCustodyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  evidenceId: string;
}

interface CustodyRecord {
  id: string;
  action: string;
  timestamp: string;
  location: string;
  notes: string;
  from_user: { full_name: string } | null;
  to_user: { full_name: string } | null;
}

interface User {
  id: string;
  full_name: string;
}

const ChainOfCustodyDialog = ({ open, onOpenChange, evidenceId }: ChainOfCustodyDialogProps) => {
  const [custodyRecords, setCustodyRecords] = useState<CustodyRecord[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [action, setAction] = useState<'created' | 'transferred' | 'accessed' | 'downloaded' | 'modified' | 'archived'>('transferred');
  const [toUserId, setToUserId] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (open && evidenceId) {
      fetchCustodyRecords();
      fetchUsers();
    }
  }, [open, evidenceId]);

  const fetchCustodyRecords = async () => {
    try {
      const { data, error } = await supabase
        .from('chain_of_custody')
        .select(`
          *,
          from_user:profiles!chain_of_custody_from_user_id_fkey(full_name),
          to_user:profiles!chain_of_custody_to_user_id_fkey(full_name)
        `)
        .eq('evidence_id', evidenceId)
        .order('timestamp', { ascending: false });

      if (error) throw error;
      setCustodyRecords(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to fetch custody records: " + error.message,
        variant: "destructive",
      });
    }
  };

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name')
        .order('full_name');

      if (error) throw error;
      setUsers(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to fetch users: " + error.message,
        variant: "destructive",
      });
    }
  };

  const handleAddRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('chain_of_custody')
        .insert({
          evidence_id: evidenceId,
          action,
          from_user_id: user.id,
          to_user_id: toUserId || null,
          location,
          notes
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Custody record added successfully",
      });
      
      setAction('transferred');
      setToUserId('');
      setLocation('');
      setNotes('');
      fetchCustodyRecords();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to add custody record: " + error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'transferred': return 'default';
      case 'accessed': return 'secondary';
      case 'modified': return 'outline';
      case 'archived': return 'destructive';
      default: return 'default';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Chain of Custody</DialogTitle>
          <DialogDescription>
            Track evidence handling and transfers
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Add New Record Form */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Add Custody Record</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddRecord} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="action">Action</Label>
                    <Select value={action} onValueChange={(value: any) => setAction(value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="transferred">Transfer</SelectItem>
                        <SelectItem value="accessed">Access</SelectItem>
                        <SelectItem value="modified">Modified</SelectItem>
                        <SelectItem value="archived">Archive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="toUser">To User (Optional)</Label>
                    <Select value={toUserId} onValueChange={setToUserId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select user" />
                      </SelectTrigger>
                      <SelectContent>
                        {users.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Evidence locker A-1"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Additional details about this action"
                    rows={3}
                  />
                </div>
                <Button type="submit" disabled={loading || !location}>
                  {loading ? "Adding..." : "Add Record"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Custody Records History */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Custody History</CardTitle>
            </CardHeader>
            <CardContent>
              {custodyRecords.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  No custody records found
                </p>
              ) : (
                <div className="space-y-4">
                  {custodyRecords.map((record) => (
                    <div key={record.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Badge variant={getActionColor(record.action)}>
                              {record.action}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              {new Date(record.timestamp).toLocaleString()}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-sm">
                            <div className="flex items-center gap-1">
                              <User className="h-4 w-4" />
                              <span>From: {record.from_user?.full_name || 'System'}</span>
                            </div>
                            {record.to_user && (
                              <div className="flex items-center gap-1">
                                <User className="h-4 w-4" />
                                <span>To: {record.to_user.full_name}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-1">
                              <MapPin className="h-4 w-4" />
                              <span>{record.location}</span>
                            </div>
                          </div>
                          {record.notes && (
                            <p className="text-sm text-muted-foreground">
                              {record.notes}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ChainOfCustodyDialog;