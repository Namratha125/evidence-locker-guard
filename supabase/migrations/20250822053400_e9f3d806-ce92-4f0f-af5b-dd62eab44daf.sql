-- Fix security vulnerability: Restrict case access to authorized users only
-- Drop the overly permissive policy that allows all users to view all cases
DROP POLICY IF EXISTS "Users can view all cases" ON public.cases;

-- Create a secure policy that only allows access to:
-- 1. Case creators
-- 2. Assigned investigators  
-- 3. Lead investigators
-- 4. Administrators
CREATE POLICY "Users can view authorized cases only" 
ON public.cases 
FOR SELECT 
USING (
  auth.uid() = created_by OR 
  auth.uid() = assigned_to OR 
  auth.uid() = lead_investigator_id OR 
  get_user_role(auth.uid()) = 'admin'::user_role
);