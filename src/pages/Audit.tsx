import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, Filter, History, Download } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

interface AuditLog {
  id: string;
  action: string;
  resource_type: string;
  resource_id: string;
  details: any;
  timestamp: string;
  user_id: string;
  user: {
    full_name: string;
    username: string;
  };
}

const Audit = () => {
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAction, setFilterAction] = useState('all');
  const [filterResource, setFilterResource] = useState('all');
  const { toast } = useToast();

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  const fetchAuditLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select(`
          *,
          user:profiles!audit_logs_user_id_fkey(full_name, username)
        `)
        .order('timestamp', { ascending: false })
        .limit(100);

      if (error) throw error;
      console.log('Fetched audit logs:', data);
      setAuditLogs(data || []);
    } catch (error: any) {
      console.error('Audit log fetch error:', error);
      toast({
        title: "Error",
        description: "Failed to fetch audit logs: " + error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = auditLogs.filter(log => {
    const matchesSearch = 
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.resource_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.user?.full_name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesAction = filterAction === 'all' || log.action === filterAction;
    const matchesResource = filterResource === 'all' || log.resource_type === filterResource;
    
    return matchesSearch && matchesAction && matchesResource;
  });

  const getActionColor = (action: string) => {
    switch (action.toLowerCase()) {
      case 'create':
      case 'created':
        return 'default';
      case 'update':
      case 'updated':
      case 'modified':
        return 'secondary';
      case 'delete':
      case 'deleted':
        return 'destructive';
      case 'view':
      case 'accessed':
        return 'outline';
      case 'download':
      case 'downloaded':
        return 'default';
      default:
        return 'secondary';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-48"></div>
          <div className="h-10 bg-muted rounded w-full"></div>
          <div className="space-y-4">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="h-20 bg-muted rounded"></div>
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
          <h1 className="text-3xl font-bold">Audit Log</h1>
          <p className="text-muted-foreground">Track all system activities and user actions</p>
        </div>
        <Button variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </div>

      <div className="flex items-center space-x-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search audit logs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterAction} onValueChange={setFilterAction}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Action" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            <SelectItem value="create">Create</SelectItem>
            <SelectItem value="update">Update</SelectItem>
            <SelectItem value="delete">Delete</SelectItem>
            <SelectItem value="view">View</SelectItem>
            <SelectItem value="download">Download</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterResource} onValueChange={setFilterResource}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Resource" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Resources</SelectItem>
            <SelectItem value="case">Cases</SelectItem>
            <SelectItem value="evidence">Evidence</SelectItem>
            <SelectItem value="tag">Tags</SelectItem>
            <SelectItem value="user">Users</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        {filteredLogs.length === 0 ? (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <div className="text-center">
                <History className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No audit logs found</h3>
                <p className="text-muted-foreground">
                  {searchTerm || filterAction !== 'all' || filterResource !== 'all' 
                    ? 'No logs match your search criteria.' 
                    : 'No audit logs available.'}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          filteredLogs.map((log) => (
            <Card key={log.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <Badge variant={getActionColor(log.action)}>
                      {log.action}
                    </Badge>
                    <div>
                      <p className="font-medium">
                        {log.user?.full_name} ({log.user?.username})
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {log.action} {log.resource_type} {log.resource_id}
                      </p>
                    </div>
                  </div>
                  <div className="text-right text-sm text-muted-foreground">
                    <p>{formatTimestamp(log.timestamp)}</p>
                    {log.details && (
                      <p className="text-xs">
                        {JSON.stringify(log.details).length > 50 
                          ? JSON.stringify(log.details).substring(0, 50) + '...' 
                          : JSON.stringify(log.details)}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default Audit;