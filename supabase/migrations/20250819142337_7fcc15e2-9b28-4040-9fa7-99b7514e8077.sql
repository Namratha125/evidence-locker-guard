-- Create comments table for cases and evidence
CREATE TABLE public.comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  content TEXT NOT NULL,
  case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE,
  evidence_id UUID REFERENCES public.evidence(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT comments_target_check CHECK (
    (case_id IS NOT NULL AND evidence_id IS NULL) OR 
    (case_id IS NULL AND evidence_id IS NOT NULL)
  )
);

-- Enable RLS on comments
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- Create policies for comments
CREATE POLICY "Users can view all comments" 
ON public.comments 
FOR SELECT 
USING (true);

CREATE POLICY "Users can create comments" 
ON public.comments 
FOR INSERT 
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update own comments" 
ON public.comments 
FOR UPDATE 
USING (auth.uid() = created_by);

CREATE POLICY "Users can delete own comments or admins" 
ON public.comments 
FOR DELETE 
USING (auth.uid() = created_by OR get_user_role(auth.uid()) = 'admin'::user_role);

-- Add trigger for automatic timestamp updates
CREATE TRIGGER update_comments_updated_at
BEFORE UPDATE ON public.comments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

-- Add assigned_to field to cases table
ALTER TABLE public.cases 
ADD COLUMN assigned_to UUID REFERENCES public.profiles(id),
ADD COLUMN findings TEXT,
ADD COLUMN due_date TIMESTAMP WITH TIME ZONE;