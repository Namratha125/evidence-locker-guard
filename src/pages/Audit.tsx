import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, Filter, History, Download } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { authFetch } from '@/lib/api';

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

interface AuditLog {
  id: string;
  action: 'CREATE_CASE' | 'UPDATE_CASE' | 'UPDATE_CASE_STATUS' | 'DELETE_CASE' | string;
  resource_type: string;
  resource_id: string;
  details: {
    oldStatus?: string;
    newStatus?: string;
    message?: string;
  };
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
      const res = await authFetch('/api/audit_logs');

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch audit logs");

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
      log.action?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.resource_type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.user?.full_name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesAction = filterAction === 'all' || log.action === filterAction;
    const matchesResource = filterResource === 'all' || log.resource_type === filterResource;
    
    return matchesSearch && matchesAction && matchesResource;
  });

  const getActionColor = (action: string) => {
    switch (action?.toLowerCase()) {
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
  // Add a helper function to parse and format JSON details
const formatDetails = (details: any): string => {
  if (typeof details === 'string') {
    try {
      details = JSON.parse(details);
    } catch {
      return details;
    }
  }

  if (details.file_name) {
    return `File: ${details.file_name}`;
  }

  if (details.content) {
    return `Comment: ${details.content}`;
  }

  if (details.name && details.color) {
    return `Tag: ${details.name} (${details.color})`;
  }

  // Add other specific formatters as needed
  return Object.entries(details)
    .map(([key, value]) => `${key}: ${value}`)
    .join(', ');
};

// Update the existing formatLogDetails function
const formatLogDetails = (log: AuditLog) => {
  if (!log.details) return '';
  
  return formatDetails(log.details);
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
                        {log.resource_type} {log.resource_id}
                      </p>
                      {log.details && (
                        <p className="text-sm text-foreground mt-1">
                          {formatLogDetails(log)}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right text-sm text-muted-foreground">
                    <p>{formatTimestamp(log.timestamp)}</p>
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
