import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface EvidenceTagSelectorProps {
  evidenceId: string;
  selectedTags: Tag[];
  onTagsChange: (tags: Tag[]) => void;
  disabled?: boolean;
}

const EvidenceTagSelector = ({ evidenceId, selectedTags, onTagsChange, disabled }: EvidenceTagSelectorProps) => {
  const [open, setOpen] = useState(false);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchTags();
  }, []);

  const fetchTags = async () => {
    try {
      const { data, error } = await supabase
        .from('tags')
        .select('*')
        .order('name');

      if (error) throw error;
      setAvailableTags(data || []);
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

  const handleTagSelect = async (tag: Tag) => {
    if (selectedTags.find(t => t.id === tag.id)) return;

    try {
      const { error } = await supabase
        .from('evidence_tags')
        .insert({
          evidence_id: evidenceId,
          tag_id: tag.id
        });

      if (error) throw error;

      const newTags = [...selectedTags, tag];
      onTagsChange(newTags);
      
      toast({
        title: "Success",
        description: `Tag "${tag.name}" added to evidence`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to add tag: " + error.message,
        variant: "destructive",
      });
    }
  };

  const handleTagRemove = async (tagId: string) => {
    try {
      const { error } = await supabase
        .from('evidence_tags')
        .delete()
        .eq('evidence_id', evidenceId)
        .eq('tag_id', tagId);

      if (error) throw error;

      const newTags = selectedTags.filter(t => t.id !== tagId);
      onTagsChange(newTags);
      
      toast({
        title: "Success",
        description: "Tag removed from evidence",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to remove tag: " + error.message,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading tags...</div>;
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {selectedTags.map((tag) => (
          <Badge key={tag.id} variant="secondary" className="flex items-center gap-1">
            <div 
              className="w-2 h-2 rounded-full" 
              style={{ backgroundColor: tag.color }}
            />
            {tag.name}
            {!disabled && (
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-0 ml-1 hover:bg-transparent"
                onClick={() => handleTagRemove(tag.id)}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </Badge>
        ))}
      </div>
      
      {!disabled && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-[200px] justify-between"
            >
              Add tag...
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[200px] p-0">
            <Command>
              <CommandInput placeholder="Search tags..." />
              <CommandList>
                <CommandEmpty>No tags found.</CommandEmpty>
                <CommandGroup>
                  {availableTags
                    .filter(tag => !selectedTags.find(t => t.id === tag.id))
                    .map((tag) => (
                      <CommandItem
                        key={tag.id}
                        value={tag.name}
                        onSelect={() => {
                          handleTagSelect(tag);
                          setOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            selectedTags.find(t => t.id === tag.id) ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <div 
                          className="w-3 h-3 rounded-full mr-2" 
                          style={{ backgroundColor: tag.color }}
                        />
                        {tag.name}
                      </CommandItem>
                    ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
};

export default EvidenceTagSelector;