-- Fix critical security vulnerability: Restrict profiles table access
-- Current policy allows anyone to view all profiles (using expression: true)
-- This exposes sensitive law enforcement data to unauthorized users

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

-- Create a more secure policy that only allows authenticated users to view profiles
CREATE POLICY "Authenticated users can view profiles" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (true);

-- For even better security, we could restrict to same organization/department
-- but keeping it simple for now to maintain existing functionality