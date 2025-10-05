import express from "express";
import mysql from "mysql2/promise";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcrypt";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// ---------------------------
// ✅ MySQL connection setup
// ---------------------------
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

// ---------------------------
// ✅ Routes
// ---------------------------

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

// 🔹 Get all users
app.get("/users", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT id, username, role FROM profiles");
    res.json(rows);
  } catch (err) {
    console.error("Error fetching users:", err);
    res.status(500).json({ message: "Failed to fetch users" });
  }
});

// 🔹 Add new user (basic, no hashing — use /api/users for secure version)
app.post("/users", async (req, res) => {
  const { username, password, role } = req.body;
  try {
    await db.query(
      "INSERT INTO profiles (id, username, full_name, role) VALUES (UUID(), ?, ?, ?)",
      [username, username, role]
    );
    res.json({ message: "User registered successfully" });
  } catch (err) {
    console.error("Error registering user:", err);
    res.status(500).json({ message: "Failed to register user" });
  }
});

// 🔹 Secure user registration (used by AddUserDialog.tsx)
app.post("/api/users", async (req, res) => {
  const { email, password, full_name, username, role, badge_number, department } = req.body;

  try {
    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert into profiles table
    await db.query(
      `INSERT INTO profiles (id, username, full_name, role, badge_number, department)
       VALUES (UUID(), ?, ?, ?, ?, ?)`,
      [username, full_name, role, badge_number, department]
    );

    // Optionally insert into a login table
    await db.query(
      `INSERT INTO users (id, email, password, username)
       VALUES (UUID(), ?, ?, ?)`,
      [email, hashedPassword, username]
    );

    res.json({ message: "User created successfully" });
  } catch (err) {
    console.error("Error creating user:", err);
    res.status(500).json({ message: "Failed to create user" });
  }
});

// ---------------------------
// ✅ Start the server
// ---------------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});

export { db };
