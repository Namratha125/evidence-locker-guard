import express from "express";
import mysql from "mysql2/promise";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// ---------------------------------------
// ✅ MySQL connection setup
// ---------------------------------------
const db = await mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "evidence_locker",
});

// Test DB connection
try {
  await db.query("SELECT 1");
  console.log("✅ Connected to MySQL");
} catch (err) {
  console.error("❌ MySQL connection failed:", err);
  process.exit(1);
}

// ---------------------------------------
// ✅ ROUTES
// ---------------------------------------

// GET all evidence
app.get("/evidence", async (req, res) => {
  const [rows] = await db.query(`
    SELECT e.*, 
           c.case_number, c.title AS case_title,
           p.full_name AS uploaded_by_name
    FROM evidence e
    LEFT JOIN cases c ON e.case_id = c.id
    LEFT JOIN profiles p ON e.uploaded_by = p.id
    ORDER BY e.created_at DESC
  `);
  res.json(rows.map(r => ({
    ...r,
    case: { case_number: r.case_number, title: r.case_title },
    uploaded_by: { full_name: r.uploaded_by_name }
  })));
});

// PUT update evidence status
app.put("/evidence/:id/status", async (req, res) => {
  const { status } = req.body;
  await db.query("UPDATE evidence SET status = ? WHERE id = ?", [status, req.params.id]);
  res.json({ message: "Status updated" });
});

// 🔹 Get all evidence
app.get("/evidence", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM evidence");
    res.json(rows);
  } catch (err) {
    console.error("Error fetching evidence:", err);
    res.status(500).json({ message: "Failed to fetch evidence" });
  }
});

// 🔹 Add new evidence
app.post("/evidence", async (req, res) => {
  const { case_id, title, description, uploaded_by } = req.body;

  try {
    await db.query(
      `INSERT INTO evidence (id, case_id, title, description, uploaded_by)
       VALUES (UUID(), ?, ?, ?, ?)`,
      [case_id, title, description, uploaded_by]
    );
    res.json({ message: "Evidence added successfully" });
  } catch (err) {
    console.error("Error adding evidence:", err.sqlMessage || err);
    res.status(500).json({ message: "Failed to add evidence" });
  }
});

// 🔹 Get all profiles (users)
app.get("/profiles", async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT id, username, full_name, role, department, badge_number, email FROM profiles"
    );
    res.json(rows);
  } catch (err) {
    console.error("Error fetching profiles:", err);
    res.status(500).json({ message: "Failed to fetch profiles" });
  }
});

// 🔹 Register new user (secure)
app.post("/api/users", async (req, res) => {
  const { email, password, full_name, username, role, badge_number, department } = req.body;
  const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || "10", 10);

  if (!email || !password || !username) {
    return res.status(400).json({ message: "Email, password, and username are required" });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);

    await db.query(
      `INSERT INTO profiles (id, username, full_name, role, badge_number, department, email, password)
       VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?)`,
      [username, full_name, role, badge_number, department, email, hashedPassword]
    );

    res.status(201).json({ message: "User created successfully" });
  } catch (err) {
    console.error("Error creating user:", err);
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "Email or username already exists" });
    }
    res.status(500).json({ message: "Failed to create user" });
  }
});

// 🔹 User login
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  try {
    const [rows] = await db.query("SELECT * FROM profiles WHERE email = ?", [email]);
    if (rows.length === 0) return res.status(401).json({ message: "Invalid credentials" });

    const user = rows[0];
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) return res.status(401).json({ message: "Invalid credentials" });

    // Generate JWT
    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "1h" });

    // Exclude password before sending back
    const { password: _p, ...userWithoutPassword } = user;
    res.json({ message: "Login successful", user: userWithoutPassword, token });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Login failed" });
  }
});

// 🔹 Get user profile by ID
app.get("/api/profile/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await db.query(
      "SELECT id, username, full_name, role, badge_number, department, email FROM profiles WHERE id = ?",
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ message: "Profile not found" });
    res.json(rows[0]);
  } catch (err) {
    console.error("Profile fetch error:", err);
    res.status(500).json({ message: "Error fetching profile" });
  }
});

// Get evidence tags
app.get("/evidence/:id/tags", async (req, res) => {
  const { id } = req.params;
  const [rows] = await db.query(`
    SELECT t.id, t.name, t.color
    FROM evidence_tags et
    JOIN tags t ON et.tag_id = t.id
    WHERE et.evidence_id = ?`, [id]);
  res.json(rows);
});

// Get case details
app.get("/cases/:id", async (req, res) => {
  const { id } = req.params;
  const [rows] = await db.query("SELECT id, case_number, title FROM cases WHERE id = ?", [id]);
  res.json(rows[0]);
});

// GET all tags with evidence count
app.get('/tags', async (req, res) => {
  try {
    const [tags] = await db.query(`
      SELECT t.*, p.full_name AS created_by_name,
        (SELECT COUNT(*) FROM evidence_tags et WHERE et.tag_id = t.id) AS evidence_count
      FROM tags t
      LEFT JOIN profiles p ON t.created_by = p.id
      ORDER BY t.created_at DESC
    `);
    res.json(
      tags.map(tag => ({
        ...tag,
        created_by: { full_name: tag.created_by_name }
      }))
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error fetching tags' });
  }
});

// DELETE a tag
app.delete('/tags/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM tags WHERE id = ?', [req.params.id]);
    res.json({ message: 'Tag deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete tag' });
  }
});


// ---------- Dashboard endpoints ----------

// Get overall dashboard stats
app.get("/api/dashboard/stats", async (req, res) => {
  try {
    const [[{ totalCases }]] = await db.query("SELECT COUNT(*) AS totalCases FROM cases");
    const [[{ totalEvidence }]] = await db.query("SELECT COUNT(*) AS totalEvidence FROM evidence");
    const [[{ totalTags }]] = await db.query("SELECT COUNT(*) AS totalTags FROM tags");

    const [recentCases] = await db.query(
      "SELECT id, case_number, title, status FROM cases ORDER BY created_at DESC LIMIT 5"
    );

    const [recentEvidence] = await db.query(
      `SELECT e.id, e.title, e.file_type, c.case_number
       FROM evidence e
       LEFT JOIN cases c ON e.case_id = c.id
       ORDER BY e.created_at DESC LIMIT 5`
    );

    res.json({ totalCases, totalEvidence, totalTags, recentCases, recentEvidence });
  } catch (err) {
    console.error("Error fetching dashboard stats:", err);
    res.status(500).json({ message: "Failed to load dashboard stats" });
  }
});

// GET custody records for an evidence (ordered desc)
app.get('/evidence/:id/custody', async (req, res) => {
  const { id } = req.params;
  try {
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

    // map to expected shape
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
    console.error('Error getting custody records', err);
    res.status(500).json({ message: 'Failed to fetch custody records' });
  }
});

// POST create custody record
app.post('/chain_of_custody', async (req, res) => {
  const { evidence_id, action, from_user_id, to_user_id, location, notes } = req.body;
  if (!evidence_id || !action || !from_user_id || !location) {
    return res.status(400).json({ message: 'Missing required fields' });
  }
  try {
    // if your evidence.id is CHAR(36) use UUID()
    await db.query(
      `INSERT INTO chain_of_custody (id, evidence_id, action, from_user_id, to_user_id, location, notes, timestamp)
       VALUES (UUID(), ?, ?, ?, ?, ?, ?, NOW())`,
      [evidence_id, action, from_user_id, to_user_id || null, location, notes || null]
    );
    res.status(201).json({ message: 'Custody record created' });
  } catch (err) {
    console.error('Error inserting custody record', err);
    res.status(500).json({ message: 'Failed to create custody record' });
  }
});

// GET profiles list (id, full_name) - used to populate "To user"
app.get('/profiles', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT id, full_name FROM profiles ORDER BY full_name');
    res.json(rows);
  } catch (err) {
    console.error('Error fetching profiles', err);
    res.status(500).json({ message: 'Failed to fetch profiles' });
  }
});

// ---------------- Comments API ----------------

// GET /api/comments?caseId=... or ?evidenceId=...
app.get('/api/comments', async (req, res) => {
  try {
    const { caseId, evidenceId } = req.query;

    if (!caseId && !evidenceId) {
      return res.status(400).json({ message: 'caseId or evidenceId required' });
    }

    // Build query
    let query = `
      SELECT c.id, c.content, c.created_at, c.created_by,
             p.full_name, p.username
      FROM comments c
      LEFT JOIN profiles p ON p.id = c.created_by
      WHERE ${caseId ? 'c.case_id = ?' : 'c.evidence_id = ?'}
      ORDER BY c.created_at DESC
    `;
    const param = caseId ? caseId : evidenceId;

    const [rows] = await db.query(query, [param]);
    // Map to frontend shape: include nested profiles optional fields if desired
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
    console.error('Error fetching comments', err);
    res.status(500).json({ message: 'Failed to fetch comments' });
  }
});

// POST /api/comments
app.post('/api/comments', async (req, res) => {
  try {
    const { content, created_by, case_id, evidence_id } = req.body;

    if (!content || !created_by || (!case_id && !evidence_id)) {
      return res.status(400).json({ message: 'content, created_by and either case_id or evidence_id required' });
    }

    // Insert new comment
    await db.query(
      `INSERT INTO comments (id, content, case_id, evidence_id, created_by, created_at, updated_at)
       VALUES (UUID(), ?, ?, ?, ?, NOW(), NOW())`,
      [content, case_id || null, evidence_id || null, created_by]
    );

    // Return created comment (simple approach: fetch last inserted by created_by+timestamp)
    const [[created]] = await db.query(
      `SELECT c.id, c.content, c.created_at, c.created_by, p.full_name, p.username
       FROM comments c
       LEFT JOIN profiles p ON p.id = c.created_by
       WHERE c.created_by = ? 
       ORDER BY c.created_at DESC LIMIT 1`,
      [created_by]
    );

    res.status(201).json(created);
  } catch (err) {
    console.error('Error creating comment', err);
    res.status(500).json({ message: 'Failed to create comment' });
  }
});

// DELETE /api/comments/:id
app.delete('/api/comments/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Optionally you can check auth here (only allow author or admin). For now, delete directly:
    const [result] = await db.query('DELETE FROM comments WHERE id = ?', [id]);
    // result.affectedRows can be checked
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    res.json({ message: 'Comment deleted' });
  } catch (err) {
    console.error('Error deleting comment', err);
    res.status(500).json({ message: 'Failed to delete comment' });
  }
});

// Create a new case (POST /api/cases)
app.post('/api/cases', async (req, res) => {
  try {
    const { case_number, title, description, priority, status, created_by } = req.body;
    if (!case_number || !title || !created_by) {
      return res.status(400).json({ message: 'case_number, title and created_by are required' });
    }

    await db.query(
      `INSERT INTO cases (id, case_number, title, description, lead_investigator_id, status, priority, created_by, created_at, updated_at)
       VALUES (UUID(), ?, ?, ?, NULL, ?, ?, ?, NOW(), NOW())`,
      [case_number, title, description || null, status || 'active', priority || 'medium', created_by]
    );

    // Return the created case (fetch by case_number)
    const [rows] = await db.query('SELECT * FROM cases WHERE case_number = ? ORDER BY created_at DESC LIMIT 1', [case_number]);
    const created = rows[0];

    // Optionally: create an audit log entry here (or let the frontend call /api/audit_logs)
    try {
      await db.query(
        `INSERT INTO audit_logs (id, user_id, action, resource_type, resource_id, details, timestamp)
         VALUES (UUID(), ?, 'create', 'case', ?, ?, NOW())`,
        [created_by, created.id, JSON.stringify({ case_number, title })]
      );
    } catch (auditErr) {
      console.warn('Audit log insert failed', auditErr);
    }

    res.status(201).json(created);
  } catch (err) {
    console.error('Error creating case', err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Case number already exists' });
    }
    res.status(500).json({ message: 'Failed to create case' });
  }
});

// Optional: Audit log POST endpoint if frontend should call it separately
app.post('/api/audit_logs', async (req, res) => {
  try {
    const { user_id, action, resource_type, resource_id, details } = req.body;
    if (!user_id || !action || !resource_type || !resource_id) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    await db.query(
      `INSERT INTO audit_logs (id, user_id, action, resource_type, resource_id, details, timestamp)
       VALUES (UUID(), ?, ?, ?, ?, ?, NOW())`,
      [user_id, action, resource_type, resource_id, JSON.stringify(details || {})]
    );
    res.status(201).json({ message: 'Audit log created' });
  } catch (err) {
    console.error('Error creating audit log', err);
    res.status(500).json({ message: 'Failed to create audit log' });
  }
});

// POST /api/tags
app.post('/api/tags', async (req, res) => {
  try {
    const { name, color, created_by } = req.body;
    if (!name || !created_by) return res.status(400).json({ message: 'name and created_by required' });

    // Insert tag
    const [result] = await db.query(
      `INSERT INTO tags (id, name, color, created_by, created_at)
       VALUES (UUID(), ?, ?, ?, NOW())`,
      [name, color || '#3b82f6', created_by]
    );

    // fetch created tag by last insert id isn't straightforward with UUID; fetch by name+created_by+timestamp
    const [rows] = await db.query(
      `SELECT t.id, t.name, t.color, t.created_at, p.full_name AS created_by_name
       FROM tags t
       LEFT JOIN profiles p ON p.id = t.created_by
       WHERE t.name = ? AND t.created_by = ?
       ORDER BY t.created_at DESC LIMIT 1`,
      [name, created_by]
    );

    res.status(201).json(rows[0] || { message: 'Tag created' });
  } catch (err) {
    console.error('Error creating tag', err);
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Tag name already exists' });
    res.status(500).json({ message: 'Failed to create tag' });
  }
});

// PUT /api/cases/:id  -- update case fields
app.put('/api/cases/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      case_number, title, description, status, priority,
      assigned_to, findings, due_date
    } = req.body;

    // Build dynamic update columns (only update provided fields)
    const updates = [];
    const params = [];

    if (case_number !== undefined) { updates.push('case_number = ?'); params.push(case_number); }
    if (title !== undefined) { updates.push('title = ?'); params.push(title); }
    if (description !== undefined) { updates.push('description = ?'); params.push(description); }
    if (status !== undefined) { updates.push('status = ?'); params.push(status); }
    if (priority !== undefined) { updates.push('priority = ?'); params.push(priority); }
    if (assigned_to !== undefined) { updates.push('assigned_to = ?'); params.push(assigned_to); }
    if (findings !== undefined) { updates.push('findings = ?'); params.push(findings); }
    if (due_date !== undefined) { updates.push('due_date = ?'); params.push(due_date); }

    if (updates.length === 0) {
      return res.status(400).json({ message: 'No fields to update' });
    }

    params.push(id);
    const sql = `UPDATE cases SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`;
    const [result] = await db.query(sql, params);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Case not found' });
    }

    // Optionally return updated row:
    const [rows] = await db.query('SELECT * FROM cases WHERE id = ?', [id]);
    res.json(rows[0]);
  } catch (err) {
    console.error('Error updating case', err);
    res.status(500).json({ message: 'Failed to update case' });
  }
});

// PUT /api/tags/:id  -- update tag
app.put('/api/tags/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, color } = req.body;

    if (!name && !color) {
      return res.status(400).json({ message: 'Nothing to update' });
    }

    const updates = [];
    const params = [];

    if (name !== undefined) { updates.push('name = ?'); params.push(name); }
    if (color !== undefined) { updates.push('color = ?'); params.push(color); }

    params.push(id);
    const sql = `UPDATE tags SET ${updates.join(', ')}, created_at = created_at WHERE id = ?`; 
    // note: created_at preserved; no updated_at column in DDL above. If you have updated_at, set it to NOW().

    const [result] = await db.query(sql, params);

    // If using MySQL2, result.affectedRows indicates success
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Tag not found' });
    }

    // return updated tag
    const [rows] = await db.query('SELECT id, name, color, created_by, created_at FROM tags WHERE id = ?', [id]);
    res.json(rows[0]);
  } catch (err) {
    console.error('Error updating tag', err);
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Tag name already exists' });
    res.status(500).json({ message: 'Failed to update tag' });
  }
});


// ---------------------------------------
// ✅ Start server
// ---------------------------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});

export { db };
