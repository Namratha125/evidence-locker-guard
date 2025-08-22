-- Fix security vulnerability: Restrict comment access to authorized users only
-- Drop the overly permissive policy that allows all users to view all comments
DROP POLICY IF EXISTS "Users can view all comments" ON public.comments;

-- Create a secure policy that only allows viewing comments if the user has access to the related case or evidence
CREATE POLICY "Users can view authorized comments only" 
ON public.comments 
FOR SELECT 
USING (
  -- Allow if user has access to the case (when comment is on a case)
  (case_id IS NOT NULL AND (
    EXISTS (
      SELECT 1 FROM public.cases c 
      WHERE c.id = comments.case_id 
      AND (
        c.created_by = auth.uid() OR 
        c.assigned_to = auth.uid() OR 
        c.lead_investigator_id = auth.uid() OR 
        get_user_role(auth.uid()) = 'admin'::user_role
      )
    )
  ))
  OR
  -- Allow if user has access to the evidence (when comment is on evidence)
  (evidence_id IS NOT NULL AND (
    EXISTS (
      SELECT 1 FROM public.evidence e 
      JOIN public.cases c ON c.id = e.case_id
      WHERE e.id = comments.evidence_id 
      AND (
        e.uploaded_by = auth.uid() OR 
        get_user_role(auth.uid()) = 'admin'::user_role OR
        c.created_by = auth.uid() OR 
        c.assigned_to = auth.uid() OR 
        c.lead_investigator_id = auth.uid()
      )
    )
  ))
);