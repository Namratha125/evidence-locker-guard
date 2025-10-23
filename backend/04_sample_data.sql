USE evidence_locker;

-- 1) Create 5 profiles (users)
-- Make sure you're using the correct database
USE evidence_locker;

-- Insert 5 users with email and bcrypt-hashed passwords
-- Passwords used (plaintext for reference): Admin123!, Invest123!, Invest234!, Analyst123!, Legal123!
-- These hashes are generated with bcrypt 10 rounds

INSERT INTO profiles (id,username, full_name, role, email, password) VALUES
(NULL,'admin', 'Admin User', 'admin', 'admin@example.com', '$2b$10$CwTycUXWue0Thq9StjUM0uJ8VbC4h9R0EDpqN3XrN5hK7fUJ92t4W'),
(NULL,'invest1', 'Investigator One', 'investigator', 'invest1@example.com', '$2b$10$N9qo8uLOickgx2ZMRZo5i.uW8TZp6Kq6FjX.oD/3RZbX4JpPzH/fi'),
(NULL,'invest2', 'Investigator Two', 'investigator', 'invest2@example.com', '$2b$10$7sNffW1yKmy2o6J4hGZ6CeS4e9v9MIP8Q9wFQxqkbKj6qQp5KJpWO'),
(NULL,'analyst1', 'Analyst One', 'analyst', 'analyst1@example.com', '$2b$10$3mQhY2rH0N2f9Q5y5yFjAu0E.Yc.QYI.4GH4nqvZB.KlIoYexkx2G'),
(NULL,'legal1', 'Legal Counsel', 'legal', 'legal1@example.com', '$2b$10$T3n7s7UlSxq2W9F1m8v3GeV.9J9lQY0H8m3pZlFv9ePZkG0qJw3vG');


-- Grab their IDs into session variables
SET @admin = (SELECT id FROM profiles WHERE username='admin' LIMIT 1);
SET @invest1 = (SELECT id FROM profiles WHERE username='invest1' LIMIT 1);
SET @invest2 = (SELECT id FROM profiles WHERE username='invest2' LIMIT 1);
SET @analyst1 = (SELECT id FROM profiles WHERE username='analyst1' LIMIT 1);
SET @legal1 = (SELECT id FROM profiles WHERE username='legal1' LIMIT 1);

-- 2) Create 5 cases using the stored procedure add_case (OUT param returns case id)
CALL add_case('CASE-001','Robbery at Mall','Robbery reported at central mall', @admin, @invest1, @case1);
CALL add_case('CASE-002','Laptop Theft','Laptop stolen from lab', @invest1, @invest2, @case2);
CALL add_case('CASE-003','Data Breach','Potential evidence of data leak', @analyst1, @invest1, @case3);
CALL add_case('CASE-004','Arson','Suspicious fire incident', @legal1, @invest2, @case4);
CALL add_case('CASE-005','Vandalism','Damage to public property', @invest2, @invest1, @case5);

-- Optionally view the returned ids
SELECT @case1 AS case1, @case2 AS case2, @case3 AS case3, @case4 AS case4, @case5 AS case5;

-- 3) Create 5 tags (each created by a different user)
INSERT INTO tags (name, color, created_by) VALUES
  ('cctv','#3b82f6', @invest1),
  ('forensic','#10b981', @analyst1),
  ('dna','#ef4444', @invest2),
  ('urgent','#f59e0b', @admin),
  ('sensitive','#8b5cf6', @legal1);

-- Grab tag ids
SET @tag1 = (SELECT id FROM tags WHERE name='cctv' LIMIT 1);
SET @tag2 = (SELECT id FROM tags WHERE name='forensic' LIMIT 1);
SET @tag3 = (SELECT id FROM tags WHERE name='dna' LIMIT 1);
SET @tag4 = (SELECT id FROM tags WHERE name='urgent' LIMIT 1);
SET @tag5 = (SELECT id FROM tags WHERE name='sensitive' LIMIT 1);

-- 4) Add 5 evidence records using add_evidence (procedure will create audit log via trigger/proc depending on your schema)
CALL add_evidence(@case1, 'CCTV Footage - Mall', 'Camera feed showing suspect', 'mall_cam1.mp4', '/evidence/mall_cam1.mp4', 2048000, 'video/mp4', 'sha256:aaa111', @invest1, @e1);
CALL add_evidence(@case2, 'Laptop Photo', 'Photo of stolen laptop', 'laptop.jpg', '/evidence/laptop.jpg', 512000, 'image/jpeg', 'sha256:bbb222', @invest1, @e2);
CALL add_evidence(@case3, 'Server Logs', 'Possible exfil logs', 'logs.zip', '/evidence/logs.zip', 1024000, 'application/zip', 'sha256:ccc333', @analyst1, @e3);
CALL add_evidence(@case4, 'Fire Scene Photo', 'Photo from fire scene', 'fire1.png', '/evidence/fire1.png', 256000, 'image/png', 'sha256:ddd444', @invest2, @e4);
CALL add_evidence(@case5, 'Graffiti Photo', 'Vandalism evidence', 'graffiti.jpg', '/evidence/graffiti.jpg', 128000, 'image/jpeg', 'sha256:eee555', @invest2, @e5);

-- Show evidence ids returned
SELECT @e1 AS evidence1, @e2 AS evidence2, @e3 AS evidence3, @e4 AS evidence4, @e5 AS evidence5;

-- 5) Link tags to evidence via evidence_tags (many-to-many)
INSERT INTO evidence_tags (evidence_id, tag_id) VALUES
  (@e1, @tag1),
  (@e1, @tag4),
  (@e2, @tag2),
  (@e3, @tag2),
  (@e3, @tag5);

-- Add two more links to reach 5 total rows for evidence_tags (so table has at least 5 rows)
INSERT INTO evidence_tags (evidence_id, tag_id) VALUES
  (@e4, @tag4),
  (@e5, @tag3);

-- 6) Add 5 chain_of_custody records (trigger will create ids)
INSERT INTO chain_of_custody (evidence_id, action, from_user_id, to_user_id, notes, location)
VALUES
  (@e1, 'created', NULL, @invest1, 'Initial upload by investigator', 'Mall - CCTV Room'),
  (@e1, 'transferred', @invest1, @analyst1, 'Transferred for analysis', 'Evidence Room'),
  (@e2, 'created', NULL, @invest1, 'Initial photo upload', 'Lab A'),
  (@e3, 'created', NULL, @analyst1, 'Logs uploaded for review', 'Server Room'),
  (@e4, 'created', NULL, @invest2, 'Photo taken at scene', 'Fire Scene');

-- 7) Add 5 comments (each attached to an evidence item)
INSERT INTO comments (content, evidence_id, created_by) VALUES
  ('Suspect enters frame at 00:12', @e1, @invest1),
  ('Unique sticker on laptop lid', @e2, @invest1),
  ('Logs show exfil at 03:05', @e3, @analyst1),
  ('Possible accelerant residue in corner', @e4, @invest2),
  ('Graffiti matches previous incident', @e5, @legal1);

-- 8) Optional: Add 5 comments attached to cases (to ensure CASE comments also exist)
INSERT INTO comments (content, case_id, created_by) VALUES
  ('Witness reported clothing description', @case1, @invest1),
  ('Follow up needed with lab', @case2, @analyst1),
  ('Legal counsel to review data sharing', @case3, @legal1),
  ('Forensic team scheduled', @case4, @invest2),
  ('Coordinate with city services', @case5, @admin);

-- 9) Quick verification queries - counts and recent audit logs
SELECT 'profiles' AS table_name, COUNT(*) AS total_rows FROM profiles
UNION ALL
SELECT 'cases', COUNT(*) FROM cases
UNION ALL
SELECT 'tags', COUNT(*) FROM tags
UNION ALL
SELECT 'evidence', COUNT(*) FROM evidence
UNION ALL
SELECT 'evidence_tags', COUNT(*) FROM evidence_tags
UNION ALL
SELECT 'chain_of_custody', COUNT(*) FROM chain_of_custody
UNION ALL
SELECT 'audit_logs', COUNT(*) FROM audit_logs
UNION ALL
SELECT 'comments', COUNT(*) FROM comments;

-- show recently inserted evidence + audit logs for them
SELECT e.id AS evidence_id, e.title, e.file_name, e.uploaded_by, al.id AS audit_id, al.action, al.timestamp, al.details
FROM evidence e
LEFT JOIN audit_logs al ON al.resource_id = e.id
WHERE e.id IN (@e1,@e2,@e3,@e4,@e5)
ORDER BY e.id, al.timestamp;

-- Show chain_of_custody entries for evidence @e1
SELECT * FROM chain_of_custody WHERE evidence_id = @e1;

-- View last 20 audit log entries (to see what triggers/procedures created)
SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 20;
