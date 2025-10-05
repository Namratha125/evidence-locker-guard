-- Sample Users
INSERT INTO profiles (id,username,full_name,role)
VALUES (UUID(),'admin','Admin User','admin'),
       (UUID(),'invest1','Investigator One','investigator');

SET @admin=(SELECT id FROM profiles WHERE username='admin');
SET @invest=(SELECT id FROM profiles WHERE username='invest1');

-- Sample Case
INSERT INTO cases (id,case_number,title,description,created_by,lead_investigator_id,assigned_to)
VALUES (UUID(),'CASE-001','Robbery Case','Case on theft at central plaza',@admin,@invest,@invest);

SET @caseid=(SELECT id FROM cases WHERE case_number='CASE-001');

-- Sample Tag
INSERT INTO tags (id,name,color,created_by)
VALUES (UUID(),'blood-sample','#ff0000',@invest);

-- Sample Evidence
CALL add_evidence(@caseid,'CCTV Footage','Footage showing suspect','cctv1.mp4',
                  '/evidence/cctv1.mp4',1048576,'video/mp4','sha256:xxxx',@invest,@evid);
SELECT @evid AS evidence_id;

-- Sample Comment
INSERT INTO comments (id,content,evidence_id,created_by)
VALUES (UUID(),'Suspect seen near 0:12 timestamp',@evid,@invest);

-- View audit log
SELECT * FROM audit_logs;
