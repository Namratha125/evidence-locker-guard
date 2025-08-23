-- Add DELETE policy for tags table
CREATE POLICY "Users can delete own tags or admins" 
ON public.tags 
FOR DELETE 
USING ((auth.uid() = created_by) OR (get_user_role(auth.uid()) = 'admin'::user_role));