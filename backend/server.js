// server.js
import express from "express";
import mysql from "mysql2/promise";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import multer from "multer";
import fs from "fs";
import path from "path";
import helmet from 'helmet';
import { fileURLToPath } from "url";
import pkg from "uuid";
const { v4: uuidv4 } = pkg;

dotenv.config();


const app = express();
app.use(cors());
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);

const __dirname = path.resolve();

// ✅ Serve static files correctly whether you run from root or backend
const uploadsDir = path.join(__dirname, "uploads");
app.use("/uploads", express.static(uploadsDir));

console.log("Serving uploads from:", uploadsDir);


// Fallback route for prefixed files like "1761807101279_S002_1.jpg"
app.get('/api/uploads/:folder/:file', (req, res) => {
  const { folder, file } = req.params;
  const dir = path.join(__dirname, 'uploads', folder);

  if (!fs.existsSync(dir)) {
    return res.status(404).send('Folder not found');
  }

  // Try to find a file that ends with the requested name
  const match = fs.readdirSync(dir).find(f => f.endsWith(file));
  if (!match) {
    return res.status(404).send('File not found');
  }

  const fullPath = path.join(dir, match);
  res.sendFile(fullPath);
});


app.use(
  helmet.contentSecurityPolicy({
    useDefaults: true,
    directives: {
      "connect-src": ["'self'", "http://localhost:5000"],
      "default-src": ["'self'"],
    },
  })
);


// --------------------------
// Ensure uploads dir exists
// --------------------------

// Example log to verify path
console.log("Serving uploads from:", path.join(__dirname, "backend/uploads"));
// ---------------------------
// Multer storage configuration
// ---------------------------
// ✅ Define upload directory globally before using in multer
const UPLOADS_DIR = path.join(__dirname, "uploads");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // store under uploads/<case_id> if provided, otherwise uploads/general
    const caseId = req.body.case_id || req.body.caseId || "general";
    const dir = path.join(UPLOADS_DIR, caseId);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}_${file.originalname.replace(/\s+/g, "_")}`;
    cb(null, uniqueName);
  },
});
const upload = multer({ storage });
const router = express.Router();
// ---------------------------------------
// ✅ MySQL connection setup
// ---------------------------------------
let db;
(async () => {
  db = await mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "evidence_locker",
});
try {
    await db.query("SELECT 1");
    console.log("✅ Connected to MySQL");
  } catch (err) {
    console.error("❌ MySQL connection failed:", err);
    process.exit(1);
  }
})();


// Serve uploaded files


// ---------------------------------------
// ROUTES
// ---------------------------------------

// Consolidated GET /evidence (with case & uploader info)
router.get("/evidence", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret_key');
    const userId = decoded.id;

    // get user role
    const [roleRows] = await db.query("SELECT role FROM profiles WHERE id = ?", [userId]);
    const user = roleRows && roleRows[0];
    if (!user) return res.status(404).json({ message: "User not found" });

    let rows;
    if (user.role === 'admin') {
      [rows] = await db.query(`
        SELECT e.*, c.case_number AS case_case_number, c.title AS case_title, p.full_name AS uploaded_by_full_name
        FROM evidence e
        LEFT JOIN cases c ON e.case_id = c.id
        LEFT JOIN profiles p ON e.uploaded_by = p.id
        ORDER BY e.created_at DESC
      `);
    } else {
      [rows] = await db.query(`
        SELECT DISTINCT e.*, c.case_number AS case_case_number, c.title AS case_title, p.full_name AS uploaded_by_full_name
        FROM evidence e
        LEFT JOIN chain_of_custody coc ON e.id = coc.evidence_id
        LEFT JOIN cases c ON e.case_id = c.id
        LEFT JOIN profiles p ON e.uploaded_by = p.id
        WHERE e.uploaded_by = ?
           OR c.assigned_to = ?
           OR c.lead_investigator_id = ?
           OR coc.to_user_id = ?
        ORDER BY e.created_at DESC
      `, [userId, userId, userId, userId]);
    }

    const mapped = rows.map((r) => ({
      id: r.id,
      case_id: r.case_id,
      title: r.title,
      description: r.description,
      file_name: r.file_name,
      file_path: r.file_path,
      file_size: r.file_size,
      file_type: r.file_type,
      hash_value: r.hash_value,
      status: r.status,
      location_found: r.location_found,
      collected_date: r.collected_date,
      collected_by: r.collected_by,
      created_at: r.created_at,
      updated_at: r.updated_at,
      uploaded_by: r.uploaded_by,
      case: r.case_case_number ? { case_number: r.case_case_number, title: r.case_title } : null,
      uploader: r.uploaded_by_full_name ? { full_name: r.uploaded_by_full_name } : null,
    }));

    res.json(mapped);
  } catch (err) {
    console.error("Error fetching evidence:", err);
    res.status(500).json({ message: "Failed to fetch evidence" });
  }
});

// alias: /api/users → /api/profiles
router.get("/users", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT id, username, full_name, email, role, department, badge_number, created_at, updated_at FROM profiles");
    res.json(rows);
  } catch (err) {
    console.error("Error fetching users:", err);
    res.status(500).json({ message: "Failed to fetch users" });
  }
});

// /api/profiles/by-ids
router.post("/profiles/by-ids", async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) return res.json([]);
    const [rows] = await db.query("SELECT id, full_name FROM profiles WHERE id IN (?)", [ids]);
    res.json(rows);
  } catch (err) {
    console.error("Error fetching profiles by IDs:", err);
    res.status(500).json({ message: "Failed to fetch profiles by IDs" });
  }
});

// /api/evidence/case/:id
router.get("/evidence/case/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    const [rows] = await db.query("SELECT * FROM evidence WHERE case_id = ?", [id]);
    res.json(rows);
  } catch (err) {
    console.error("Error fetching evidence for case:", err);
    res.status(500).json({ message: "Failed to fetch evidence for case" });
  }
  
});

// /api/cases/:id/status
router.put("/cases/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!status) return res.status(400).json({ message: "Missing status field" });
    await db.query("UPDATE cases SET status = ? WHERE id = ?", [status, id]);
    res.json({ message: "Case status updated successfully" });
  } catch (err) {
    console.error("Error updating case status:", err);
    res.status(500).json({ message: "Failed to update case status" });
  }
});

// /api/cases/:id  <-- this route was missing
router.put("/cases/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const {
      case_number,
      title,
      description,
      status,
      priority,
      assigned_to,
      findings,
      due_date
    } = req.body;

    await db.query(
      `UPDATE cases 
       SET case_number = ?, title = ?, description = ?, status = ?, priority = ?, assigned_to = ?, findings = ?, due_date = ? 
       WHERE id = ?`,
      [case_number, title, description, status, priority, assigned_to, findings, due_date, id]
    );

    res.json({ message: "Case updated successfully" });
  } catch (err) {
    console.error("Error updating case:", err);
    res.status(500).json({ message: "Failed to update case" });
  }
});


// PUT update evidence status
router.put("/evidence/:id/status", async (req, res) => {
  try {
    const { status } = req.body;
    const { id } = req.params;
    const [result] = await db.query("UPDATE evidence SET status = ?, updated_at = NOW() WHERE id = ?", [status, id]);
    if (result.affectedRows === 0) return res.status(404).json({ message: "Evidence not found" });
    res.json({ message: "Status updated" });
  } catch (err) {
    console.error("Error updating status:", err);
    res.status(500).json({ message: "Failed to update status" });
  }
});

// POST create evidence (simple JSON-based insert - used by some components)
router.post("/evidence", async (req, res) => {
  try {
    const { case_id, title, description, uploaded_by } = req.body;
    if (!case_id || !title || !uploaded_by) {
      return res.status(400).json({ message: "case_id, title and uploaded_by are required" });
    }
    const id = uuidv4();
    await db.query(
      `INSERT INTO evidence (id, case_id, title, description, uploaded_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
      [id, case_id, title, description || null, uploaded_by]
    );

    const [rows] = await db.query("SELECT * FROM evidence WHERE id = ?", [id]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error("Error adding evidence:", err);
    res.status(500).json({ message: "Failed to add evidence" });
  }
});

// --------------------
// Evidence file upload
// --------------------
// Expects multipart/form-data with field "file" and other fields:
// title, description, case_id (or caseId), collected_by, location_found, collected_date,
// uploaded_by (profile id), hash_value (optional)
router.post("/evidence/upload", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    const {
      title,
      description,
      case_id,
      caseId,
      collected_by,
      location_found,
      collected_date,
      uploaded_by,
      hash_value,
      status,
    } = req.body;

    const finalCaseId = case_id || caseId;
    if (!finalCaseId || !title || !uploaded_by) {
      // if file present but required metadata missing, delete file to avoid orphan
      if (file && file.path) fs.unlinkSync(file.path);
      return res.status(400).json({ message: "case_id, title and uploaded_by are required" });
    }

    const id = uuidv4();
    const filePathRelative = file ? `uploads/${finalCaseId}/${file.filename}` : null;
    const fileType = (file && file.mimetype) || null;
    const fileSize = (file && file.size) || null;
    const fileName = (file && file.originalname) || null;

    await db.query(
      `INSERT INTO evidence 
        (id, case_id, title, description, file_name, file_path, file_size, file_type, hash_value, collected_date, collected_by, location_found, uploaded_by, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        id,
        finalCaseId,
        title,
        description || null,
        fileName,
        filePathRelative,
        fileSize,
        fileType,
        hash_value || null,
        collected_date || null,
        collected_by || null,
        location_found || null,
        uploaded_by,
        status || "pending",
      ]
    );

    // return created evidence
    const [rows] = await db.query("SELECT * FROM evidence WHERE id = ?", [id]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error("Error uploading evidence:", err);
    res.status(500).json({ message: "Failed to upload evidence" });
  }
});

// --------------------
// Profiles / Users
// --------------------
router.get("/profiles", async (req, res) => {
  try {
    // include created_at/updated_at so front-end can display join date
    const [rows] = await db.query("SELECT id, username, full_name, role, department, badge_number, email, created_at, updated_at FROM profiles ORDER BY full_name");
    res.json(rows);
  } catch (err) {
    console.error("Error fetching profiles", err);
    res.status(500).json({ message: "Failed to fetch profiles" });
  }
});

// Register new user (secure)
router.post("/users", async (req, res) => {
  const { email, password, full_name, username, role, badge_number, department } = req.body;
  const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || "10", 10);

  if (!email || !password || !username) {
    return res.status(400).json({ message: "Email, password, and username are required" });
  }

  try {
    // Check if trying to create an admin account
    if (role === 'admin') {
      // Verify if request is from an existing admin
      const token = req.headers.authorization?.split(' ')[1];
      if (!token) {
        return res.status(403).json({ message: "Only existing admins can create admin accounts" });
      }

      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret_key');
        if (decoded.role !== 'admin') {
          return res.status(403).json({ message: "Only existing admins can create admin accounts" });
        }
      } catch (err) {
        return res.status(403).json({ message: "Invalid token" });
      }
    }

    const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const id = uuidv4();

    // If no role specified or unauthorized admin attempt, default to analyst
    const assignedRole = (role === 'admin' && req.headers.authorization) ? 'admin' : 'analyst';

    await db.query(
      `INSERT INTO profiles (id, username, full_name, role, badge_number, department, email, password, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [id, username, full_name || username, assignedRole, badge_number || null, department || null, email, hashedPassword]
    );

    res.status(201).json({ message: "User created successfully", id });
  } catch (err) {
    console.error("Error creating user:", err);
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "Email or username already exists" });
    }
    res.status(500).json({ message: "Failed to create user" });
  }
});

// User login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) return res.status(400).json({ message: "Email and password are required" });

  try {
    const [rows] = await db.query("SELECT * FROM profiles WHERE email = ?", [email]);
    if (rows.length === 0) return res.status(401).json({ message: "Invalid credentials" });

    const user = rows[0];
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) return res.status(401).json({ message: "Invalid credentials" });

    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET || "secret_key", { expiresIn: "1h" });
    const { password: _p, ...userWithoutPassword } = user;
    res.json({ message: "Login successful", user: userWithoutPassword, token });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Login failed" });
  }
});

// Get user profile by ID
router.get("/profile/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await db.query("SELECT id, username, full_name, role, badge_number, department, email FROM profiles WHERE id = ?", [id]);
    if (rows.length === 0) return res.status(404).json({ message: "Profile not found" });
    res.json(rows[0]);
  } catch (err) {
    console.error("Profile fetch error:", err);
    res.status(500).json({ message: "Error fetching profile" });
  }
});

// --------------------
// Tags / Evidence tags
// --------------------
router.get("/evidence/:id/tags", async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.query(`
      SELECT t.id, t.name, t.color
      FROM evidence_tags et
      JOIN tags t ON et.tag_id = t.id
      WHERE et.evidence_id = ?`, [id]);
    res.json(rows);
  } catch (err) {
    console.error("Error fetching evidence tags", err);
    res.status(500).json({ message: "Failed to fetch evidence tags" });
  }
});

router.get("/tags", async (req, res) => {
  try {
    // First get all tags with their creators
    const [tags] = await db.query(`
      SELECT 
        t.id,
        t.name,
        t.color,
        t.created_at,
        p.full_name AS created_by_name,
        (
          SELECT COUNT(*)
          FROM evidence_tags et
          WHERE et.tag_id = t.id
        ) as evidence_count
      FROM tags t
      LEFT JOIN profiles p ON t.created_by = p.id
      ORDER BY t.name ASC
    `);

    console.log('Tags with counts:', tags); // Debug log

    const response = tags.map(tag => ({
      id: tag.id,
      name: tag.name,
      color: tag.color,
      created_at: tag.created_at,
      created_by: { full_name: tag.created_by_name },
      evidence_count: parseInt(tag.evidence_count || 0)
    }));

    res.json(response);
  } catch (err) {
    console.error('Error fetching tags:', err);
    res.status(500).json({ error: "Database error fetching tags" });
  }
});

router.post("/tags", async (req, res) => {
  try {
    const { name, color, created_by } = req.body;
    if (!name || !created_by) return res.status(400).json({ message: "name and created_by required" });

    const id = uuidv4();
    await db.query(`INSERT INTO tags (id, name, color, created_by, created_at) VALUES (?, ?, ?, ?, NOW())`, [id, name, color || "#3b82f6", created_by]);
    
    // Create audit log for tag creation
    await db.query(
      `INSERT INTO audit_logs (id, user_id, action, resource_type, resource_id, details, timestamp)
       VALUES (UUID(), ?, 'create', 'tag', ?, ?, NOW())`,
      [created_by, id, JSON.stringify({ name, color })]
    );

    const [rows] = await db.query(
      `SELECT t.id, t.name, t.color, t.created_at, p.full_name AS created_by_name
       FROM tags t
       LEFT JOIN profiles p ON p.id = t.created_by
       WHERE t.id = ?`,
      [id]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error("Error creating tag", err);
    if (err.code === "ER_DUP_ENTRY") return res.status(409).json({ message: "Tag name already exists" });
    res.status(500).json({ message: "Failed to create tag" });
  }
});

router.put("/tags/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, color } = req.body;
    if (!name && !color) return res.status(400).json({ message: "Nothing to update" });

    const updates = [];
    const params = [];
    if (name !== undefined) { updates.push("name = ?"); params.push(name); }
    if (color !== undefined) { updates.push("color = ?"); params.push(color); }
    params.push(id);

    const sql = `UPDATE tags SET ${updates.join(", ")} WHERE id = ?`;
    const [result] = await db.query(sql, params);
    if (result.affectedRows === 0) return res.status(404).json({ message: "Tag not found" });

    const [rows] = await db.query("SELECT id, name, color, created_by, created_at FROM tags WHERE id = ?", [id]);
    res.json(rows[0]);
  } catch (err) {
    console.error("Error updating tag", err);
    if (err.code === "ER_DUP_ENTRY") return res.status(409).json({ message: "Tag name already exists" });
    res.status(500).json({ message: "Failed to update tag" });
  }
});

// Add tag relation to evidence
router.post("/evidence/:id/tags", async (req, res) => {
  try {
    const evidence_id = req.params.id;
    const { tag_id } = req.body;
    if (!tag_id) return res.status(400).json({ message: "tag_id required" });

    await db.query(`INSERT INTO evidence_tags (evidence_id, tag_id) VALUES (?, ?)`, [evidence_id, tag_id]);
    const [rows] = await db.query("SELECT id, name, color FROM tags WHERE id = ?", [tag_id]);
    res.status(201).json(rows[0] || { id: tag_id });
  } catch (err) {
    console.error("Error adding evidence tag", err);
    if (err.code === "ER_DUP_ENTRY") return res.status(409).json({ message: "Tag already added" });
    res.status(500).json({ message: "Failed to add tag to evidence" });
  }
});

router.delete("/evidence/:id/tags/:tagId", async (req, res) => {
  try {
    const { id: evidence_id, tagId } = req.params;
    const [result] = await db.query(`DELETE FROM evidence_tags WHERE evidence_id = ? AND tag_id = ?`, [evidence_id, tagId]);
    if (result.affectedRows === 0) return res.status(404).json({ message: "Relation not found" });
    res.json({ message: "Tag removed from evidence" });
  } catch (err) {
    console.error("Error removing evidence tag", err);
    res.status(500).json({ message: "Failed to remove tag from evidence" });
  }
});

// --------------------
// Cases endpoints
// --------------------
router.get("/cases", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret_key');
    const userId = decoded.id;

    // First check if user exists and get their role
    const [[user]] = await db.query("SELECT role FROM profiles WHERE id = ?", [userId]);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    let query;
    if (user.role === 'admin') {
      query = "SELECT * FROM cases ORDER BY created_at DESC";
      const [rows] = await db.query(query);
      res.json(rows);
    } else {
      query = `
        SELECT * FROM cases 
        WHERE created_by = ?
           OR assigned_to = ?
           OR lead_investigator_id = ?
        ORDER BY created_at DESC`;
      const [rows] = await db.query(query, [userId, userId, userId]);
      res.json(rows);
    }
  } catch (err) {
    console.error("Error fetching cases:", err);
    res.status(500).json({ message: "Failed to fetch cases" });
  }
});

// Get case details
// Get full case details (for CaseDetails.tsx)
router.get("/cases/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.query(`
      SELECT 
        id,
        case_number,
        title,
        description,
        priority,
        status,
        findings,
        due_date,
        created_by,
        assigned_to,
        lead_investigator_id,
        created_at,
        updated_at
      FROM cases
      WHERE id = ?
    `, [id]);

    res.json(rows[0] || null);
  } catch (err) {
    console.error("Error fetching case", err);
    res.status(500).json({ message: "Failed to fetch case" });
  }
});


// Create a new case
router.post("/cases", async (req, res) => {
  try {
    const { case_number, title, description, priority, status, created_by } = req.body;
    if (!case_number || !title || !created_by) return res.status(400).json({ message: "case_number, title and created_by are required" });

    const id = uuidv4();
    await db.query(
      `INSERT INTO cases (id, case_number, title, description, lead_investigator_id, status, priority, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, NULL, ?, ?, ?, NOW(), NOW())`,
      [id, case_number, title, description || null, status || "active", priority || "medium", created_by]
    );

    const [rows] = await db.query("SELECT * FROM cases WHERE id = ?", [id]);

    // Try create audit log (best-effort)
    try {
      await db.query(
        `INSERT INTO audit_logs (id, user_id, action, resource_type, resource_id, details, timestamp)
         VALUES (UUID(), ?, 'create', 'case', ?, ?, NOW())`,
        [created_by, id, JSON.stringify({ case_number, title })]
      );
    } catch (auditErr) {
      console.warn("Audit log insert failed", auditErr);
    }

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error("Error creating case", err);
    if (err.code === "ER_DUP_ENTRY") return res.status(409).json({ message: "Case number already exists" });
    res.status(500).json({ message: "Failed to create case" });
  }
});

// Update case
router.put("/cases/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const {
      case_number, title, description, status, priority,
      assigned_to, findings, due_date
    } = req.body;

    const updates = [];
    const params = [];
    if (case_number !== undefined) { updates.push("case_number = ?"); params.push(case_number); }
    if (title !== undefined) { updates.push("title = ?"); params.push(title); }
    if (description !== undefined) { updates.push("description = ?"); params.push(description); }
    if (status !== undefined) { updates.push("status = ?"); params.push(status); }
    if (priority !== undefined) { updates.push("priority = ?"); params.push(priority); }
    if (assigned_to !== undefined) { updates.push("assigned_to = ?"); params.push(assigned_to); }
    if (findings !== undefined) { updates.push("findings = ?"); params.push(findings); }
    if (due_date !== undefined) { updates.push("due_date = ?"); params.push(due_date); }

    if (updates.length === 0) return res.status(400).json({ message: "No fields to update" });

    params.push(id);
    const sql = `UPDATE cases SET ${updates.join(", ")}, updated_at = NOW() WHERE id = ?`;
    const [result] = await db.query(sql, params);
    if (result.affectedRows === 0) return res.status(404).json({ message: "Case not found" });

    const [rows] = await db.query("SELECT * FROM cases WHERE id = ?", [id]);
    res.json(rows[0]);
  } catch (err) {
    console.error("Error updating case", err);
    res.status(500).json({ message: "Failed to update case" });
  }
});

// --------------------
// Chain of custody
// --------------------
router.get("/evidence/:id/custody", async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.query(
      `SELECT coc.id, coc.action, coc.location, coc.notes, coc.timestamp,
              fromp.id AS from_user_id, fromp.full_name AS from_user_full_name,
              top.id AS to_user_id, top.full_name AS to_user_full_name
       FROM chain_of_custody coc
       LEFT JOIN profiles fromp ON fromp.id = coc.from_user_id
       LEFT JOIN profiles top ON top.id = coc.to_user_id
       WHERE coc.evidence_id = ?
       ORDER BY coc.timestamp DESC`,
      [id]
    );

    const mapped = rows.map(r => ({
      id: r.id,
      action: r.action,
      location: r.location,
      notes: r.notes,
      timestamp: r.timestamp,
      from_user: r.from_user_id ? { id: r.from_user_id, full_name: r.from_user_full_name } : null,
      to_user: r.to_user_id ? { id: r.to_user_id, full_name: r.to_user_full_name } : null,
    }));
    res.json(mapped);
  } catch (err) {
    console.error("Error getting custody records", err);
    res.status(500).json({ message: "Failed to fetch custody records" });
  }
});

router.post("/chain_of_custody", async (req, res) => {
  try {
    const { evidence_id, action, from_user_id, to_user_id, location, notes } = req.body;
    if (!evidence_id || !action || !from_user_id || !location) return res.status(400).json({ message: "Missing required fields" });

    const id = uuidv4();
    await db.query(
      `INSERT INTO chain_of_custody (id, evidence_id, action, from_user_id, to_user_id, location, notes, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [id, evidence_id, action, from_user_id, to_user_id || null, location, notes || null]
    );

    res.status(201).json({ message: "Custody record created", id });
  } catch (err) {
    console.error("Error inserting custody record", err);
    res.status(500).json({ message: "Failed to create custody record" });
  }
});

// GET profiles list for "To user" select
router.get("/profiles/list", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT id, full_name FROM profiles ORDER BY full_name");
    res.json(rows);
  } catch (err) {
    console.error("Error fetching profiles list", err);
    res.status(500).json({ message: "Failed to fetch profiles" });
  }
});

// --------------------
// Comments endpoints
// --------------------
router.get("/comments", async (req, res) => {
  try {
    const { caseId, evidenceId } = req.query;
    if (!caseId && !evidenceId) return res.status(400).json({ message: "caseId or evidenceId required" });

    let query = `
      SELECT c.id, c.content, c.created_at, c.created_by,
             p.full_name, p.username
      FROM comments c
      LEFT JOIN profiles p ON p.id = c.created_by
      WHERE ${caseId ? "c.case_id = ?" : "c.evidence_id = ?"}
      ORDER BY c.created_at DESC
    `;
    const param = caseId || evidenceId;
    const [rows] = await db.query(query, [param]);
    const mapped = rows.map(r => ({
      id: r.id,
      content: r.content,
      created_at: r.created_at,
      created_by: r.created_by,
      full_name: r.full_name,
      username: r.username
    }));
    res.json(mapped);
  } catch (err) {
    console.error("Error fetching comments", err);
    res.status(500).json({ message: "Failed to fetch comments" });
  }
});

router.post("/comments", async (req, res) => {
  try {
    const { content, created_by, case_id, evidence_id } = req.body;
    if (!content || !created_by || (!case_id && !evidence_id)) return res.status(400).json({ message: "content, created_by and either case_id or evidence_id required" });

    const id = uuidv4();
    await db.query(
      `INSERT INTO comments (id, content, case_id, evidence_id, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
      [id, content, case_id || null, evidence_id || null, created_by]
    );

    const [[created]] = await db.query(
      `SELECT c.id, c.content, c.created_at, c.created_by, p.full_name, p.username
       FROM comments c
       LEFT JOIN profiles p ON p.id = c.created_by
       WHERE c.id = ? LIMIT 1`,
      [id]
    );

    res.status(201).json(created);
  } catch (err) {
    console.error("Error creating comment", err);
    res.status(500).json({ message: "Failed to create comment" });
  }
});

router.delete("/comments/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await db.query("DELETE FROM comments WHERE id = ?", [id]);
    if (result.affectedRows === 0) return res.status(404).json({ message: "Comment not found" });
    res.json({ message: "Comment deleted" });
  } catch (err) {
    console.error("Error deleting comment", err);
    res.status(500).json({ message: "Failed to delete comment" });
  }
});

// --------------------
// Audit logs endpoint
// --------------------
router.post("/audit_logs", async (req, res) => {
  try {
    const { user_id, action, resource_type, resource_id, details } = req.body;
    if (!user_id || !action || !resource_type || !resource_id) return res.status(400).json({ message: "Missing required fields" });

    await db.query(
      `INSERT INTO audit_logs (id, user_id, action, resource_type, resource_id, details, timestamp)
       VALUES (UUID(), ?, ?, ?, ?, ?, NOW())`,
      [user_id, action, resource_type, resource_id, JSON.stringify(details || {})]
    );
    res.status(201).json({ message: "Audit log created" });
  } catch (err) {
    console.error("Error creating audit log", err);
    res.status(500).json({ message: "Failed to create audit log" });
  }
});

// ================================
// ✅ GET /api/audit_logs
// ================================
router.get("/audit_logs", async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT al.id, al.user_id, al.action, al.resource_type, al.resource_id, al.details, al.timestamp,
             p.full_name AS user_full_name, p.username AS user_username
      FROM audit_logs al
      LEFT JOIN profiles p ON p.id = al.user_id
      ORDER BY al.timestamp DESC
      LIMIT 100
    `);

    const logs = rows.map(r => {
      let details = r.details;
      try {
        if (typeof details === "string") details = JSON.parse(details);
      } catch {
        // leave details as is
      }

      return {
        id: r.id,
        user_id: r.user_id,
        action: r.action,
        resource_type: r.resource_type,
        resource_id: r.resource_id,
        details,
        timestamp: r.timestamp,
        user: r.user_full_name
          ? { full_name: r.user_full_name, username: r.user_username }
          : null,
      };
    });

    res.json(logs);
  } catch (err) {
    console.error("Error fetching audit logs:", err);
    res.status(500).json({ message: "Failed to fetch audit logs" });
  }
});


// --------------------
// Dashboard stats
// --------------------
router.get("/dashboard/stats", async (req, res) => {
  try {
    const [[{ totalCases }]] = await db.query("SELECT COUNT(*) AS totalCases FROM cases");
    const [[{ totalEvidence }]] = await db.query("SELECT COUNT(*) AS totalEvidence FROM evidence");
    const [[{ totalTags }]] = await db.query("SELECT COUNT(*) AS totalTags FROM tags");

    const [recentCases] = await db.query("SELECT id, case_number, title, status FROM cases ORDER BY created_at DESC LIMIT 5");
    const [recentEvidence] = await db.query(`
      SELECT e.id, e.title, e.file_type, c.case_number
      FROM evidence e
      LEFT JOIN cases c ON e.case_id = c.id
      ORDER BY e.created_at DESC LIMIT 5
    `);

    res.json({ totalCases, totalEvidence, totalTags, recentCases, recentEvidence });
  } catch (err) {
    console.error("Error fetching dashboard stats:", err);
    res.status(500).json({ message: "Failed to load dashboard stats" });
  }
});

// Compatibility endpoints for old Lovable frontend (keeps /auth/* working)
// Place this before `app.use("/api", router);`

// Signup - maps to existing /users logic
router.post("/auth/signup", async (req, res) => {
  // Map front-end field names if they differ (frontend may send fullName instead of full_name)
  const email = req.body.email;
  const password = req.body.password;
  const username = req.body.username;
  const role = req.body.role;
  const badge_number = req.body.badgeNumber || req.body.badge_number || null;
  const department = req.body.department || null;
  const full_name = req.body.fullName || req.body.full_name || username;

  const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || "10", 10);
  if (!email || !password || !username) {
    return res.status(400).json({ message: "Email, password, and username are required" });
  }

  // Never allow admin role through public signup
  if (role === 'admin') {
    return res.status(403).json({ message: "Cannot create admin accounts through public signup" });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const id = uuidv4();

    await db.query(
      `INSERT INTO profiles (id, username, full_name, role, badge_number, department, email, password, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [id, username, full_name || username, "analyst", badge_number, department || null, email, hashedPassword]
    );

    return res.status(201).json({ message: "User created successfully", id });
  } catch (err) {
    console.error("Compat /auth/signup error:", err);
    if (err && err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "Email or username already exists" });
    }
    return res.status(500).json({ message: "Failed to create user" });
  }
});

// Login compatibility - maps to /login
router.post("/auth/login", async (req, res) => {
  const email = req.body.email;
  const password = req.body.password;
  if (!email || !password) return res.status(400).json({ message: "Email and password are required" });

  try {
    const [rows] = await db.query("SELECT * FROM profiles WHERE email = ?", [email]);
    if (!rows || rows.length === 0) return res.status(401).json({ message: "Invalid credentials" });

    const user = rows[0];
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) return res.status(401).json({ message: "Invalid credentials" });

    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET || "secret_key", { expiresIn: "1h" });
    const { password: _p, ...userWithoutPassword } = user;
    return res.json({ message: "Login successful", user: userWithoutPassword, token });
  } catch (err) {
    console.error("Compat /auth/login error:", err);
    return res.status(500).json({ message: "Login failed" });
  }
});

// --- Compatibility top-level auth routes (for frontend calling /auth/* without /api) ---
// Place this BEFORE `app.use("/api", router);`

app.post('/auth/signup', async (req, res) => {
  console.log('TOP-LEVEL /auth/signup body:', req.body);
  // map front-end fields to DB fields
  const email = req.body.email;
  const password = req.body.password;
  const username = req.body.username;
  const role = req.body.role;
  const badge_number = req.body.badgeNumber || req.body.badge_number || null;
  const department = req.body.department || null;
  const full_name = req.body.fullName || req.body.full_name || username;

  const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '10', 10);
  if (!email || !password || !username) {
    return res.status(400).json({ message: 'Email, password, and username are required' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const id = uuidv4();

    await db.query(
      `INSERT INTO profiles (id, username, full_name, role, badge_number, department, email, password, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [id, username, full_name || username, role || 'analyst', badge_number, department || null, email, hashedPassword]
    );

    return res.status(201).json({ message: 'User created successfully', id });
  } catch (err) {
    console.error('TOP-LEVEL /auth/signup error:', err);
    if (err && err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Email or username already exists' });
    }
    return res.status(500).json({ message: 'Failed to create user' });
  }
});

// ================= TAG ROUTES =================

// Get all available tags
app.get("/api/tags", async (req, res) => {
  try {
    console.log('Fetching tags with counts...');
    
    // First get all tags
    const [tags] = await db.query(`
      SELECT 
        t.id,
        t.name,
        t.color,
        t.created_at,
        p.full_name AS created_by_name
      FROM tags t
      LEFT JOIN profiles p ON t.created_by = p.id
      ORDER BY t.name ASC
    `);

    console.log('Found tags:', tags.length);

    // Get counts separately to ensure accuracy
    const tagCounts = await Promise.all(
      tags.map(async (tag) => {
        const [[{ count }]] = await db.query(
          "SELECT COUNT(*) as count FROM evidence_tags WHERE tag_id = ?",
          [tag.id]
        );
        console.log(`Tag ${tag.name} has ${count} evidence items`);
        return {
          ...tag,
          created_by: { full_name: tag.created_by_name },
          evidence_count: parseInt(count || 0)
        };
      })
    );

    res.json(tagCounts);
  } catch (err) {
    console.error("Error fetching tags:", err);
    res.status(500).json({ message: "Failed to fetch tags" });
  }
});

// Get tags for a specific evidence
app.get("/api/evidence/:id/tags", async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT t.id, t.name, t.color 
       FROM evidence_tags et
       JOIN tags t ON et.tag_id = t.id
       WHERE et.evidence_id = ?`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    console.error("Error fetching evidence tags:", err);
    res.status(500).json({ message: "Failed to fetch evidence tags" });
  }
});

// Add or remove tags for an evidence
app.post("/api/evidence/:id/tags", async (req, res) => {
  const { tag_id } = req.body;
  const { id } = req.params;
  console.log('Adding tag to evidence:', { evidenceId: id, tagId: tag_id });
  
  if (!tag_id) return res.status(400).json({ message: "tag_id required" });

  try {
    // First verify if evidence exists
    const [[evidence]] = await db.query("SELECT id, title FROM evidence WHERE id = ?", [id]);
    console.log('Evidence check:', evidence);
    
    if (!evidence) {
      return res.status(404).json({ message: "Evidence not found" });
    }

    // Then verify if tag exists
    const [[tag]] = await db.query("SELECT id, name, color FROM tags WHERE id = ?", [tag_id]);
    console.log('Tag check:', tag);
    
    if (!tag) {
      return res.status(404).json({ message: "Tag not found" });
    }

    // Add the tag relation
    await db.query("INSERT INTO evidence_tags (evidence_id, tag_id) VALUES (?, ?)", [id, tag_id]);
    console.log('Tag relation added successfully');

    // Create audit log for adding tag to evidence
    const token = req.headers.authorization?.split(' ')[1];
    let userId = null;
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret_key');
        userId = decoded.id;
      } catch (e) {
        console.error('Error decoding token:', e);
      }
    }

    if (userId) {
      await db.query(
        `INSERT INTO audit_logs (id, user_id, action, resource_type, resource_id, details, timestamp)
         VALUES (UUID(), ?, 'add_tag', 'evidence', ?, ?, NOW())`,
        [userId, id, JSON.stringify({ 
          tag_name: tag.name,
          tag_id: tag.id,
          evidence_title: evidence.title
        })]
      );
    }

    // Verify the count after adding
    const [[{ count }]] = await db.query(
      "SELECT COUNT(*) as count FROM evidence_tags WHERE tag_id = ?",
      [tag_id]
    );
    console.log('Current evidence count for this tag:', count);

    // Return the tag information with count
    res.json({ ...tag, evidence_count: count });
  } catch (err) {
    console.error("Error adding tag:", err);
    res.status(500).json({ message: "Failed to add tag: " + err.message });
  }
});

// Delete tag from evidence
app.delete("/api/evidence/:id/tags/:tagId", async (req, res) => {
  try {
    console.log('Removing tag from evidence:', { evidenceId: req.params.id, tagId: req.params.tagId });

    // Get evidence and tag details before deletion for audit log
    const [[evidence]] = await db.query(
      "SELECT id, title FROM evidence WHERE id = ?", 
      [req.params.id]
    );
    const [[tag]] = await db.query(
      "SELECT id, name FROM tags WHERE id = ?", 
      [req.params.tagId]
    );

    const [result] = await db.query(
      "DELETE FROM evidence_tags WHERE evidence_id = ? AND tag_id = ?",
      [req.params.id, req.params.tagId]
    );
    
    console.log('Delete result:', result);

    // Create audit log for removing tag from evidence
    const token = req.headers.authorization?.split(' ')[1];
    let userId = null;
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret_key');
        userId = decoded.id;
      } catch (e) {
        console.error('Error decoding token:', e);
      }
    }

    if (userId && evidence && tag) {
      await db.query(
        `INSERT INTO audit_logs (id, user_id, action, resource_type, resource_id, details, timestamp)
         VALUES (UUID(), ?, 'remove_tag', 'evidence', ?, ?, NOW())`,
        [userId, evidence.id, JSON.stringify({ 
          tag_name: tag.name,
          tag_id: tag.id,
          evidence_title: evidence.title
        })]
      );
    }

    // Get updated count
    const [[{ count }]] = await db.query(
      "SELECT COUNT(*) as count FROM evidence_tags WHERE tag_id = ?",
      [req.params.tagId]
    );
    
    console.log('Updated evidence count for tag:', count);

    res.json({ 
      message: "Tag removed",
      evidence_count: count
    });
  } catch (err) {
    console.error("Error removing tag:", err);
    res.status(500).json({ message: "Failed to remove tag" });
  }
});


app.post('/auth/login', async (req, res) => {
  console.log('TOP-LEVEL /auth/login body:', req.body);
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Email and password are required' });

  try {
    const [rows] = await db.query('SELECT * FROM profiles WHERE email = ?', [email]);
    if (!rows || rows.length === 0) return res.status(401).json({ message: 'Invalid credentials' });

    const user = rows[0];
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) return res.status(401).json({ message: 'Invalid credentials' });

    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET || 'secret_key', { expiresIn: '1h' });
    const { password: _p, ...userWithoutPassword } = user;
    return res.json({ message: 'Login successful', user: userWithoutPassword, token });
  } catch (err) {
    console.error('TOP-LEVEL /auth/login error:', err);
    return res.status(500).json({ message: 'Login failed' });
  }
});

// ✅ Get evidence details by database ID
app.get("/api/evidence/id/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await db.query("SELECT * FROM evidence WHERE id = ?", [id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: "Evidence not found" });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error("Error fetching evidence by ID:", err);
    res.status(500).json({ message: "Server error" });
  }
});


// Serve evidence files directly under /api/evidence/*
// Serve evidence files dynamically — supports nested folders like /uploads/<case_id>/file.mp4
app.get('/api/evidence/:filename', (req, res) => {
  const requested = req.params.filename;

  // search recursively under uploads/
  const uploadsDir = path.join(__dirname, 'uploads');
  let foundFile = null;

  function findFileRecursively(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        findFileRecursively(fullPath);
      } else if (entry.name === requested) {
        foundFile = fullPath;
        break;
      }
    }
  }

  findFileRecursively(uploadsDir);

  if (!foundFile) {
    return res.status(404).send('File not found');
  }

  res.sendFile(foundFile);
});



app.use("/api", router);
// -----------------------
// Start server
// -----------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});

export { db };
