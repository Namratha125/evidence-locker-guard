import { supabase } from '@/integrations/supabase/client';

export interface AuditLogData {
  action: string;
  resource_type: string;
  resource_id: string;
  details?: any;
  ip_address?: string;
  user_agent?: string;
}

export const createAuditLog = async (data: AuditLogData) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('audit_logs')
      .insert({
        user_id: user.id,
        action: data.action,
        resource_type: data.resource_type,
        resource_id: data.resource_id,
        details: data.details,
        ip_address: data.ip_address,
        user_agent: data.user_agent || navigator.userAgent,
      });

    if (error) {
      console.error('Failed to create audit log:', error);
    }
  } catch (error) {
    console.error('Error creating audit log:', error);
  }
};