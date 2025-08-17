-- Create user roles enum
CREATE TYPE public.user_role AS ENUM ('admin', 'investigator', 'analyst', 'legal');

-- Create evidence status enum
CREATE TYPE public.evidence_status AS ENUM ('pending', 'verified', 'archived', 'disposed');

-- Create custody action enum
CREATE TYPE public.custody_action AS ENUM ('created', 'transferred', 'accessed', 'downloaded', 'modified', 'archived');

-- Create profiles table for user information
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    role user_role NOT NULL DEFAULT 'analyst',
    badge_number TEXT,
    department TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create cases table
CREATE TABLE public.cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_number TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    lead_investigator_id UUID REFERENCES public.profiles(id),
    status TEXT DEFAULT 'active',
    priority TEXT DEFAULT 'medium',
    created_by UUID REFERENCES public.profiles(id) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create tags table
CREATE TABLE public.tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    color TEXT DEFAULT '#3b82f6',
    created_by UUID REFERENCES public.profiles(id) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create evidence table
CREATE TABLE public.evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    file_name TEXT,
    file_path TEXT,
    file_size BIGINT,
    file_type TEXT,
    hash_value TEXT,
    status evidence_status DEFAULT 'pending',
    collected_date TIMESTAMP WITH TIME ZONE,
    collected_by TEXT,
    location_found TEXT,
    uploaded_by UUID REFERENCES public.profiles(id) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create evidence_tags junction table
CREATE TABLE public.evidence_tags (
    evidence_id UUID REFERENCES public.evidence(id) ON DELETE CASCADE,
    tag_id UUID REFERENCES public.tags(id) ON DELETE CASCADE,
    PRIMARY KEY (evidence_id, tag_id)
);

-- Create chain_of_custody table
CREATE TABLE public.chain_of_custody (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evidence_id UUID REFERENCES public.evidence(id) ON DELETE CASCADE NOT NULL,
    action custody_action NOT NULL,
    from_user_id UUID REFERENCES public.profiles(id),
    to_user_id UUID REFERENCES public.profiles(id),
    notes TEXT,
    location TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create audit_logs table
CREATE TABLE public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) NOT NULL,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id UUID NOT NULL,
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chain_of_custody ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper function to check user role
CREATE OR REPLACE FUNCTION public.get_user_role(user_id UUID)
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT role FROM public.profiles WHERE id = user_id;
$$;

-- RLS Policies for profiles
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Admins can manage all profiles" ON public.profiles FOR ALL TO authenticated USING (public.get_user_role(auth.uid()) = 'admin');

-- RLS Policies for cases
CREATE POLICY "Users can view all cases" ON public.cases FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create cases" ON public.cases FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Users can update own cases or admins" ON public.cases FOR UPDATE TO authenticated USING (
    auth.uid() = created_by OR 
    auth.uid() = lead_investigator_id OR 
    public.get_user_role(auth.uid()) = 'admin'
);

-- RLS Policies for tags
CREATE POLICY "Users can view all tags" ON public.tags FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create tags" ON public.tags FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Users can update own tags or admins" ON public.tags FOR UPDATE TO authenticated USING (
    auth.uid() = created_by OR public.get_user_role(auth.uid()) = 'admin'
);

-- RLS Policies for evidence
CREATE POLICY "Users can view all evidence" ON public.evidence FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create evidence" ON public.evidence FOR INSERT TO authenticated WITH CHECK (auth.uid() = uploaded_by);
CREATE POLICY "Users can update evidence if case member or admin" ON public.evidence FOR UPDATE TO authenticated USING (
    auth.uid() = uploaded_by OR 
    public.get_user_role(auth.uid()) = 'admin' OR
    EXISTS (
        SELECT 1 FROM public.cases c 
        WHERE c.id = case_id AND (c.created_by = auth.uid() OR c.lead_investigator_id = auth.uid())
    )
);

-- RLS Policies for evidence_tags
CREATE POLICY "Users can view all evidence tags" ON public.evidence_tags FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can manage evidence tags if can edit evidence" ON public.evidence_tags FOR ALL TO authenticated USING (
    EXISTS (
        SELECT 1 FROM public.evidence e 
        WHERE e.id = evidence_id AND (
            e.uploaded_by = auth.uid() OR 
            public.get_user_role(auth.uid()) = 'admin' OR
            EXISTS (
                SELECT 1 FROM public.cases c 
                WHERE c.id = e.case_id AND (c.created_by = auth.uid() OR c.lead_investigator_id = auth.uid())
            )
        )
    )
);

-- RLS Policies for chain_of_custody
CREATE POLICY "Users can view all custody records" ON public.chain_of_custody FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create custody records" ON public.chain_of_custody FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = from_user_id OR auth.uid() = to_user_id
);

-- RLS Policies for audit_logs
CREATE POLICY "Users can view own audit logs" ON public.audit_logs FOR SELECT TO authenticated USING (
    auth.uid() = user_id OR public.get_user_role(auth.uid()) = 'admin'
);
CREATE POLICY "System can create audit logs" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (true);

-- Create storage buckets for evidence files
INSERT INTO storage.buckets (id, name, public) VALUES ('evidence-files', 'evidence-files', false);

-- Storage policies for evidence files
CREATE POLICY "Users can view evidence files" ON storage.objects FOR SELECT TO authenticated USING (
    bucket_id = 'evidence-files'
);

CREATE POLICY "Users can upload evidence files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'evidence-files'
);

CREATE POLICY "Users can update evidence files if authorized" ON storage.objects FOR UPDATE TO authenticated USING (
    bucket_id = 'evidence-files'
);

-- Function to handle profile creation on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, username, full_name, role)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'username', SPLIT_PART(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'analyst')
    );
    RETURN NEW;
END;
$$;

-- Trigger for profile creation
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_cases_updated_at BEFORE UPDATE ON public.cases FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_evidence_updated_at BEFORE UPDATE ON public.evidence FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();