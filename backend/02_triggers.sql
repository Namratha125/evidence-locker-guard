DELIMITER $$

CREATE TRIGGER trg_profiles_uuid BEFORE INSERT ON profiles
FOR EACH ROW BEGIN
  IF NEW.id IS NULL OR NEW.id='' THEN SET NEW.id=UUID(); END IF;
END$$

CREATE TRIGGER trg_cases_uuid BEFORE INSERT ON cases
FOR EACH ROW BEGIN
  IF NEW.id IS NULL OR NEW.id='' THEN SET NEW.id=UUID(); END IF;
END$$

CREATE TRIGGER trg_evidence_uuid BEFORE INSERT ON evidence
FOR EACH ROW BEGIN
  IF NEW.id IS NULL OR NEW.id='' THEN SET NEW.id=UUID(); END IF;
END$$

CREATE TRIGGER trg_custody_uuid BEFORE INSERT ON chain_of_custody
FOR EACH ROW BEGIN
  IF NEW.id IS NULL OR NEW.id='' THEN SET NEW.id=UUID(); END IF;
END$$

CREATE TRIGGER trg_audit_uuid BEFORE INSERT ON audit_logs
FOR EACH ROW BEGIN
  IF NEW.id IS NULL OR NEW.id='' THEN SET NEW.id=UUID(); END IF;
END$$

CREATE TRIGGER trg_comments_uuid BEFORE INSERT ON comments
FOR EACH ROW BEGIN
  IF NEW.id IS NULL OR NEW.id='' THEN SET NEW.id=UUID(); END IF;
END$$

-- Auto audit logs
CREATE TRIGGER trg_evidence_audit AFTER INSERT ON evidence
FOR EACH ROW BEGIN
  INSERT INTO audit_logs (id,user_id,action,resource_type,resource_id,details)
  VALUES (UUID(), NEW.uploaded_by, 'Uploaded evidence', 'evidence', NEW.id, JSON_OBJECT('file_name',NEW.file_name));
END$$

CREATE TRIGGER trg_custody_audit AFTER INSERT ON chain_of_custody
FOR EACH ROW BEGIN
  INSERT INTO audit_logs (id,user_id,action,resource_type,resource_id,details)
  VALUES (UUID(), COALESCE(NEW.to_user_id,NEW.from_user_id), CONCAT('Custody action ',NEW.action),'chain_of_custody',NEW.id,JSON_OBJECT('notes',NEW.notes));
END$$

CREATE TRIGGER trg_comments_audit AFTER INSERT ON comments
FOR EACH ROW BEGIN
  INSERT INTO audit_logs (id,user_id,action,resource_type,resource_id,details)
  VALUES (UUID(), NEW.created_by, 'Comment added',
          CASE WHEN NEW.case_id IS NOT NULL THEN 'case' ELSE 'evidence' END,
          COALESCE(NEW.case_id,NEW.evidence_id),
          JSON_OBJECT('content',SUBSTRING(NEW.content,1,255)));
END$$

DELIMITER ;
