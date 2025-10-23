CREATE DATABASE IF NOT EXISTS evidence_locker;
USE evidence_locker;

CREATE TABLE profiles (
  id CHAR(36) PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE,
  password VARCHAR(255),
  role ENUM('admin','investigator','analyst','legal') DEFAULT 'analyst',
  badge_number VARCHAR(50),
  department VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE cases (
  id CHAR(36) PRIMARY KEY,
  case_number VARCHAR(100) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  lead_investigator_id CHAR(36),
  assigned_to CHAR(36),
  findings TEXT,
  due_date DATETIME,
  status VARCHAR(50) DEFAULT 'active',
  priority VARCHAR(50) DEFAULT 'medium',
  created_by CHAR(36) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (lead_investigator_id) REFERENCES profiles(id),
  FOREIGN KEY (assigned_to) REFERENCES profiles(id),
  FOREIGN KEY (created_by) REFERENCES profiles(id)
);

CREATE TABLE tags (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  color VARCHAR(20) DEFAULT '#3b82f6',
  created_by CHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES profiles(id)
);

CREATE TABLE evidence (
  id CHAR(36) PRIMARY KEY,
  case_id CHAR(36) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  file_name VARCHAR(255),
  file_path TEXT,
  file_size BIGINT,
  file_type VARCHAR(100),
  hash_value VARCHAR(255),
  status ENUM('pending','verified','archived','disposed') DEFAULT 'pending',
  collected_date DATETIME,
  collected_by VARCHAR(255),
  location_found VARCHAR(255),
  uploaded_by CHAR(36) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by) REFERENCES profiles(id)
);

CREATE TABLE evidence_tags (
  evidence_id CHAR(36),
  tag_id CHAR(36),
  PRIMARY KEY (evidence_id, tag_id),
  FOREIGN KEY (evidence_id) REFERENCES evidence(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

CREATE TABLE chain_of_custody (
  id CHAR(36) PRIMARY KEY,
  evidence_id CHAR(36) NOT NULL,
  action ENUM('created','transferred','accessed','downloaded','modified','archived') NOT NULL,
  from_user_id CHAR(36),
  to_user_id CHAR(36),
  notes TEXT,
  location VARCHAR(255),
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (evidence_id) REFERENCES evidence(id) ON DELETE CASCADE,
  FOREIGN KEY (from_user_id) REFERENCES profiles(id),
  FOREIGN KEY (to_user_id) REFERENCES profiles(id)
);

CREATE TABLE audit_logs (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36),
  action VARCHAR(255),
  resource_type VARCHAR(100),
  resource_id CHAR(36),
  details JSON,
  ip_address VARCHAR(100),
  user_agent VARCHAR(255),
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES profiles(id)
);

CREATE TABLE comments (
  id CHAR(36) PRIMARY KEY,
  content TEXT NOT NULL,
  case_id CHAR(36),
  evidence_id CHAR(36),
  created_by CHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CHECK ((case_id IS NOT NULL AND evidence_id IS NULL) OR (case_id IS NULL AND evidence_id IS NOT NULL)),
  FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
  FOREIGN KEY (evidence_id) REFERENCES evidence(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES profiles(id)
);
