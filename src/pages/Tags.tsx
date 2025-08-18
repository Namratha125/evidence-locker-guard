import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, Tag, Edit, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import CreateTagDialog from '@/components/CreateTagDialog';

interface TagItem {
  id: string;
  name: string;
  color: string;
  created_at: string;
  created_by: {
    full_name: string;
  };
  evidence_count?: number;
}

const Tags = () => {
  const [tags, setTags] = useState<TagItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchTags();
  }, []);

  const fetchTags = async () => {
    try {
      const { data, error } = await supabase
        .from('tags')
        .select(`
          *,
          created_by:profiles(full_name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTags(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to fetch tags: " + error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredTags = tags.filter(tag =>
    tag.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-48"></div>
          <div className="h-10 bg-muted rounded w-full"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-32 bg-muted rounded"></div>
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
          <h1 className="text-3xl font-bold">Tag Management</h1>
          <p className="text-muted-foreground">Organize evidence with custom tags and labels</p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Tag
        </Button>
      </div>

      <div className="flex items-center space-x-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tags..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTags.length === 0 ? (
          <div className="col-span-full">
            <Card>
              <CardContent className="flex items-center justify-center py-12">
                <div className="text-center">
                  <Tag className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No tags found</h3>
                  <p className="text-muted-foreground">
                    {searchTerm ? 'No tags match your search criteria.' : 'Create your first tag to organize evidence.'}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          filteredTags.map((tag) => (
            <Card key={tag.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <CardTitle className="flex items-center gap-2">
                    <div 
                      className="w-4 h-4 rounded-full" 
                      style={{ backgroundColor: tag.color }}
                    />
                    {tag.name}
                  </CardTitle>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Evidence Count</span>
                    <Badge variant="secondary">{tag.evidence_count || 0}</Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Created by</span>
                    <span>{tag.created_by?.full_name}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Created</span>
                    <span>{new Date(tag.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
      
      <CreateTagDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onTagCreated={fetchTags}
      />
    </div>
  );
};

export default Tags;