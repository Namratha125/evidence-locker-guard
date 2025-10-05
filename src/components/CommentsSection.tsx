import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { MessageSquare, Send, Trash2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

interface Comment {
  id: string;
  content: string;
  created_at: string;
  created_by: string;
  profiles: {
    full_name: string;
    username: string;
  } | null;
}

interface CommentsSectionProps {
  caseId?: string;
  evidenceId?: string;
}

export default function CommentsSection({ caseId, evidenceId }: CommentsSectionProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { user, profile } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    fetchComments();
  }, [caseId, evidenceId]);

  const fetchComments = async () => {
    try {
      let query = supabase
        .from('comments')
        .select(`
          id,
          content,
          created_at,
          created_by
        `)
        .order('created_at', { ascending: false });

      if (caseId) {
        query = query.eq('case_id', caseId);
      } else if (evidenceId) {
        query = query.eq('evidence_id', evidenceId);
      }

      const { data: commentsData, error } = await query;
      if (error) throw error;

      // Fetch user profiles separately
      if (commentsData && commentsData.length > 0) {
        const userIds = [...new Set(commentsData.map(c => c.created_by))];
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, full_name, username')
          .in('id', userIds);

        if (profilesError) throw profilesError;

        const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);
        
        const commentsWithProfiles = commentsData.map(comment => ({
          ...comment,
          profiles: profilesMap.get(comment.created_by) || null
        }));

        setComments(commentsWithProfiles);
      } else {
        setComments([]);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load comments: " + error.message,
        variant: "destructive",
      });
    }
  };

  const addComment = async () => {
    if (!newComment.trim() || !user) return;

    setIsLoading(true);
    try {
      const commentData: any = {
        content: newComment.trim(),
        created_by: user.id,
      };

      if (caseId) {
        commentData.case_id = caseId;
      } else if (evidenceId) {
        commentData.evidence_id = evidenceId;
      }

      const { error } = await supabase
        .from('comments')
        .insert(commentData);

      if (error) throw error;

      setNewComment('');
      fetchComments();
      
      toast({
        title: "Success",
        description: "Comment added successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to add comment: " + error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const deleteComment = async (commentId: string) => {
    try {
      const { error } = await supabase
        .from('comments')
        .delete()
        .eq('id', commentId);

      if (error) throw error;

      fetchComments();
      toast({
        title: "Success",
        description: "Comment deleted successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to delete comment: " + error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-5 w-5" />
        <h3 className="font-semibold">Comments ({comments.length})</h3>
      </div>

      {/* Add new comment */}
      <div className="space-y-2">
        <Textarea
          placeholder="Add a comment..."
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          rows={3}
        />
        <Button 
          onClick={addComment} 
          disabled={!newComment.trim() || isLoading}
          size="sm"
        >
          <Send className="h-4 w-4 mr-2" />
          {isLoading ? 'Adding...' : 'Add Comment'}
        </Button>
      </div>

      {/* Comments list */}
      <div className="space-y-3">
        {comments.length === 0 ? (
          <p className="text-muted-foreground text-sm">No comments yet. Be the first to comment!</p>
        ) : (
          comments.map((comment) => (
            <Card key={comment.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>
                        {comment.profiles?.full_name?.charAt(0) || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-sm">
                        {comment.profiles?.full_name || 'Unknown User'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                  {(comment.created_by === user?.id || profile?.role === 'admin') && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteComment(comment.id)}
                      className="h-8 w-8 p-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}