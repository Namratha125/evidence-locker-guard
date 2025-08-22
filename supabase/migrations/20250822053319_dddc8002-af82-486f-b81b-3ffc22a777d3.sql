-- Fix security vulnerability: Restrict evidence access to authorized case members only
-- Drop the overly permissive policy that allows all users to view all evidence
DROP POLICY IF EXISTS "Users can view all evidence" ON public.evidence;

-- Create a secure policy that only allows access to evidence if the user:
-- 1. Uploaded the evidence 
-- 2. Created the case the evidence belongs to
-- 3. Is assigned to the case the evidence belongs to
-- 4. Is the lead investigator of the case the evidence belongs to
-- 5. Is an administrator
CREATE POLICY "Users can view authorized evidence only" 
ON public.evidence 
FOR SELECT 
USING (
  auth.uid() = uploaded_by OR 
  get_user_role(auth.uid()) = 'admin'::user_role OR
  EXISTS (
    SELECT 1 FROM cases c 
    WHERE c.id = evidence.case_id 
    AND (
      c.created_by = auth.uid() OR 
      c.assigned_to = auth.uid() OR 
      c.lead_investigator_id = auth.uid()
    )
  )
);