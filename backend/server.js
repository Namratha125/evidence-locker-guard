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


// ---------------------------------------
// ✅ Start server
// ---------------------------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});

export { db };
