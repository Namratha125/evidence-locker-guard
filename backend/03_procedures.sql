DELIMITER $$

CREATE FUNCTION get_user_role(p_user_id CHAR(36))
RETURNS VARCHAR(20)
DETERMINISTIC
BEGIN
  DECLARE r VARCHAR(20);
  SELECT role INTO r FROM profiles WHERE id=p_user_id;
  RETURN r;
END$$

CREATE FUNCTION countEvidenceByCase(p_caseId CHAR(36))
RETURNS INT DETERMINISTIC
BEGIN
  DECLARE total INT;
  SELECT COUNT(*) INTO total FROM evidence WHERE case_id=p_caseId;
  RETURN total;
END$$

CREATE PROCEDURE add_case(IN p_case_number VARCHAR(100), IN p_title VARCHAR(255),
                          IN p_description TEXT, IN p_created_by CHAR(36),
                          IN p_lead_investigator_id CHAR(36), OUT p_case_id CHAR(36))
BEGIN
  SET p_case_id=UUID();
  INSERT INTO cases (id,case_number,title,description,created_by,lead_investigator_id)
  VALUES (p_case_id,p_case_number,p_title,p_description,p_created_by,p_lead_investigator_id);
  INSERT INTO audit_logs (id,user_id,action,resource_type,resource_id)
  VALUES (UUID(),p_created_by,'Created case','case',p_case_id);
END$$

CREATE PROCEDURE add_evidence(IN p_case_id CHAR(36), IN p_title VARCHAR(255),
                              IN p_description TEXT, IN p_file_name VARCHAR(255),
                              IN p_file_path TEXT, IN p_file_size BIGINT,
                              IN p_file_type VARCHAR(100), IN p_hash_value VARCHAR(255),
                              IN p_uploaded_by CHAR(36), OUT p_evidence_id CHAR(36))
BEGIN
  SET p_evidence_id=UUID();
  INSERT INTO evidence (id,case_id,title,description,file_name,file_path,file_size,
                        file_type,hash_value,uploaded_by)
  VALUES (p_evidence_id,p_case_id,p_title,p_description,p_file_name,p_file_path,
          p_file_size,p_file_type,p_hash_value,p_uploaded_by);
  INSERT INTO audit_logs (id,user_id,action,resource_type,resource_id)
  VALUES (UUID(),p_uploaded_by,'Added evidence','evidence',p_evidence_id);
END$$

CREATE PROCEDURE get_authorized_cases(IN p_user_id CHAR(36))
BEGIN
  SELECT * FROM cases c
  WHERE c.created_by=p_user_id OR c.assigned_to=p_user_id
        OR c.lead_investigator_id=p_user_id
        OR (SELECT role FROM profiles WHERE id=p_user_id)='admin';
END$$

CREATE PROCEDURE get_authorized_evidence(IN p_user_id CHAR(36))
BEGIN
  SELECT e.* FROM evidence e
  JOIN cases c ON e.case_id=c.id
  WHERE e.uploaded_by=p_user_id OR c.created_by=p_user_id
        OR c.assigned_to=p_user_id OR c.lead_investigator_id=p_user_id
        OR (SELECT role FROM profiles WHERE id=p_user_id)='admin';
END$$

CREATE PROCEDURE delete_tag_if_authorized(IN p_tag_id CHAR(36), IN p_user_id CHAR(36), OUT p_success TINYINT)
BEGIN
  DECLARE owner CHAR(36);
  SELECT created_by INTO owner FROM tags WHERE id=p_tag_id;
  IF owner=p_user_id OR (SELECT role FROM profiles WHERE id=p_user_id)='admin' THEN
    DELETE FROM tags WHERE id=p_tag_id;
    SET p_success=1;
  ELSE
    SET p_success=0;
  END IF;
END$$

DELIMITER ;
