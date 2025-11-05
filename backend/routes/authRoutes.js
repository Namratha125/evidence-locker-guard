// authRoutes.js
import express from 'express';
import { generateToken, verifyPassword, hashPassword } from '../utils/jwtUtils.js';
import { authMiddleware, authorizeRoles } from '../middleware/auth.js';
import pkg from 'uuid';
const { v4: uuidv4 } = pkg;

const router = express.Router();

export default (db) => {
  // Login route
  router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    try {
      const [rows] = await db.query('SELECT * FROM profiles WHERE email = ?', [email]);
      if (!rows || rows.length === 0) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const user = rows[0];
      const isValid = await verifyPassword(password, user.password);
      if (!isValid) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const token = generateToken(user);
      const { password: _p, ...userWithoutPassword } = user;
      
      res.json({ 
        message: 'Login successful',
        user: userWithoutPassword,
        token 
      });
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ message: 'Login failed' });
    }
  });

  // Signup route (requires admin for admin creation)
  router.post('/signup', async (req, res) => {
    const { 
      email, 
      password, 
      username,
      role = 'analyst',
      badge_number,
      department,
      full_name
    } = req.body;

    if (!email || !password || !username) {
      return res.status(400).json({ 
        message: 'Email, password, and username are required' 
      });
    }

    // Block admin creation through public signup
    if (role === 'admin') {
      return res.status(403).json({ 
        message: 'Cannot create admin accounts through public signup' 
      });
    }

    try {
      const hashedPassword = await hashPassword(password);
      const id = uuidv4();

      await db.query(
        `INSERT INTO profiles (
          id, username, full_name, role, badge_number, 
          department, email, password, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          id,
          username,
          full_name || username,
          role,
          badge_number || null,
          department || null,
          email,
          hashedPassword
        ]
      );

      res.status(201).json({ message: 'User created successfully', id });
    } catch (err) {
      console.error('Signup error:', err);
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ message: 'Email or username already exists' });
      }
      res.status(500).json({ message: 'Failed to create user' });
    }
  });

  // Create user (admin only - allows admin creation)
  router.post('/users', authMiddleware, authorizeRoles('admin'), async (req, res) => {
    const { 
      email, 
      password, 
      username, 
      role = 'analyst',
      badge_number,
      department,
      full_name
    } = req.body;

    if (!email || !password || !username) {
      return res.status(400).json({ 
        message: 'Email, password, and username are required' 
      });
    }

    try {
      const hashedPassword = await hashPassword(password);
      const id = uuidv4();

      await db.query(
        `INSERT INTO profiles (
          id, username, full_name, role, badge_number, 
          department, email, password, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          id,
          username,
          full_name || username,
          role,
          badge_number || null,
          department || null,
          email,
          hashedPassword
        ]
      );

      res.status(201).json({ message: 'User created successfully', id });
    } catch (err) {
      console.error('User creation error:', err);
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ message: 'Email or username already exists' });
      }
      res.status(500).json({ message: 'Failed to create user' });
    }
  });

  // Get current user profile
  router.get('/profile', authMiddleware, async (req, res) => {
    try {
      const [rows] = await db.query(
        `SELECT id, username, full_name, role, badge_number, 
                department, email, created_at, updated_at 
         FROM profiles WHERE id = ?`,
        [req.user.id]
      );

      if (!rows || rows.length === 0) {
        return res.status(404).json({ message: 'Profile not found' });
      }

      res.json(rows[0]);
    } catch (err) {
      console.error('Profile fetch error:', err);
      res.status(500).json({ message: 'Error fetching profile' });
    }
  });

  return router;
};