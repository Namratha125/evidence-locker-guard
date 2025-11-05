-- Create application user roles
CREATE ROLE IF NOT EXISTS 'admin_role';
CREATE ROLE IF NOT EXISTS 'investigator_role';
CREATE ROLE IF NOT EXISTS 'analyst_role';
CREATE ROLE IF NOT EXISTS 'legal_role';

-- Grant permissions for admin role (full access)
GRANT ALL PRIVILEGES ON evidence_locker.* TO 'admin_role';

-- Grant permissions for investigator role
GRANT SELECT, INSERT, UPDATE ON evidence_locker.cases TO 'investigator_role';
GRANT SELECT, INSERT ON evidence_locker.evidence TO 'investigator_role';
GRANT SELECT, INSERT ON evidence_locker.chain_of_custody TO 'investigator_role';
GRANT SELECT ON evidence_locker.profiles TO 'investigator_role';
GRANT SELECT, INSERT ON evidence_locker.comments TO 'investigator_role';
GRANT SELECT ON evidence_locker.tags TO 'investigator_role';
GRANT SELECT, INSERT ON evidence_locker.evidence_tags TO 'investigator_role';

-- Grant permissions for analyst role
GRANT SELECT ON evidence_locker.cases TO 'analyst_role';
GRANT SELECT, INSERT ON evidence_locker.evidence TO 'analyst_role';
GRANT SELECT, INSERT ON evidence_locker.chain_of_custody TO 'analyst_role';
GRANT SELECT ON evidence_locker.profiles TO 'analyst_role';
GRANT SELECT, INSERT ON evidence_locker.comments TO 'analyst_role';
GRANT SELECT ON evidence_locker.tags TO 'analyst_role';
GRANT SELECT, INSERT ON evidence_locker.evidence_tags TO 'analyst_role';

-- Grant permissions for legal role
GRANT SELECT ON evidence_locker.cases TO 'legal_role';
GRANT SELECT ON evidence_locker.evidence TO 'legal_role';
GRANT SELECT ON evidence_locker.chain_of_custody TO 'legal_role';
GRANT SELECT ON evidence_locker.profiles TO 'legal_role';
GRANT SELECT, INSERT ON evidence_locker.comments TO 'legal_role';
GRANT SELECT ON evidence_locker.tags TO 'legal_role';
GRANT SELECT ON evidence_locker.evidence_tags TO 'legal_role';

-- Create views for role-based access
CREATE OR REPLACE VIEW user_cases_view AS
SELECT c.*
FROM cases c
WHERE c.created_by = USER() 
   OR c.assigned_to = USER()
   OR c.lead_investigator_id = USER()
   OR USER() IN (SELECT id FROM profiles WHERE role = 'admin');

CREATE OR REPLACE VIEW user_evidence_view AS
SELECT e.*
FROM evidence e
LEFT JOIN chain_of_custody coc ON e.id = coc.evidence_id
LEFT JOIN cases c ON e.case_id = c.id
WHERE e.uploaded_by = USER()
   OR c.assigned_to = USER()
   OR c.lead_investigator_id = USER()
   OR coc.to_user_id = USER()
   OR USER() IN (SELECT id FROM profiles WHERE role = 'admin');

-- Grant access to views
GRANT SELECT ON evidence_locker.user_cases_view TO investigator_role, analyst_role, legal_role;
GRANT SELECT ON evidence_locker.user_evidence_view TO investigator_role, analyst_role, legal_role;

-- Create stored procedures for accessing data
DELIMITER //

DROP PROCEDURE IF EXISTS get_user_cases//
CREATE PROCEDURE get_user_cases(IN user_id CHAR(36))
BEGIN
    SELECT c.*
    FROM cases c
    WHERE c.created_by = user_id 
       OR c.assigned_to = user_id
       OR c.lead_investigator_id = user_id
       OR EXISTS (SELECT 1 FROM profiles WHERE id = user_id AND role = 'admin');
END//

DROP PROCEDURE IF EXISTS get_user_evidence//
CREATE PROCEDURE get_user_evidence(IN user_id CHAR(36))
BEGIN
    SELECT DISTINCT e.*
    FROM evidence e
    LEFT JOIN chain_of_custody coc ON e.id = coc.evidence_id
    LEFT JOIN cases c ON e.case_id = c.id
    WHERE e.uploaded_by = user_id
       OR c.assigned_to = user_id
       OR c.lead_investigator_id = user_id
       OR coc.to_user_id = user_id
       OR EXISTS (SELECT 1 FROM profiles WHERE id = user_id AND role = 'admin');
END//

DELIMITER ;

-- Grant execute permissions on stored procedures
GRANT EXECUTE ON PROCEDURE evidence_locker.get_user_cases TO investigator_role, analyst_role, legal_role;
GRANT EXECUTE ON PROCEDURE evidence_locker.get_user_evidence TO investigator_role, analyst_role, legal_role;