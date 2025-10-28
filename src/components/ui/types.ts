export type UserRole = 'admin' | 'investigator' | 'analyst' | 'legal';

export interface Profile {
  id: string;
  username: string;
  full_name: string;
  email: string;
  role: UserRole;
  badge_number?: string;
  department?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Case {
  id: string;
  case_number: string;
  title: string;
  description?: string;
  created_by: string;
  assigned_to?: string;
  lead_investigator_id?: string;
  priority?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
}

export type EvidenceStatus = 'pending' | 'verified' | 'archived' | 'disposed';

export interface Evidence {
  id: string;
  case_id: string;
  title: string;
  description?: string;
  uploaded_by: string;
  status?: EvidenceStatus;
  collected_by?: string;
  collected_date?: string;
  location_found?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Tag {
  id: string;
  name: string;
  color?: string;
  created_by: string;
  created_at?: string;
}

export interface Comment {
  id: string;
  content: string;
  created_by: string;
  case_id?: string;
  evidence_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ChainOfCustody {
  id: string;
  evidence_id: string;
  from_user_id?: string;
  to_user_id?: string;
  location?: string;
  notes?: string;
  action:
    | 'created'
    | 'transferred'
    | 'accessed'
    | 'downloaded'
    | 'modified'
    | 'archived';
  timestamp?: string;
}

export interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  resource_id: string;
  resource_type: string;
  details?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  timestamp?: string;
}
