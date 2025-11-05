// caseRoutes.js
import express from 'express';
import { authMiddleware, authorizeRoles } from '../middleware/auth.js';
import pkg from 'uuid';
const { v4: uuidv4 } = pkg;

const router = express.Router();

export default (db) => {
  // Get cases (role-based access)
  router.get('/', authMiddleware, async (req, res) => {
    try {
      // Admin sees all cases
      if (req.user.role === 'admin') {
        const [rows] = await db.query(`
          SELECT * FROM cases 
          ORDER BY created_at DESC
        `);
        return res.json(rows);
      }

      // Other roles see only their cases
      const [rows] = await db.query(`
        SELECT * FROM cases 
        WHERE created_by = ?
           OR assigned_to = ?
           OR lead_investigator_id = ?
        ORDER BY created_at DESC
      `, [req.user.id, req.user.id, req.user.id]);

      res.json(rows);
    } catch (err) {
      console.error('Error fetching cases:', err);
      res.status(500).json({ message: 'Failed to fetch cases' });
    }
  });

  // Create case (investigators and admins only)
  router.post('/', 
    authMiddleware,
    authorizeRoles('admin', 'investigator'),
    async (req, res) => {
      try {
        const { 
          case_number,
          title,
          description,
          priority,
          status = 'active'
        } = req.body;

        if (!case_number || !title) {
          return res.status(400).json({ 
            message: 'Case number and title are required'
          });
        }

        const id = uuidv4();
        await db.query(
          `INSERT INTO cases (
            id, case_number, title, description,
            status, priority, created_by, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [
            id,
            case_number,
            title,
            description || null,
            status,
            priority || 'medium',
            req.user.id
          ]
        );

        const [rows] = await db.query(
          'SELECT * FROM cases WHERE id = ?',
          [id]
        );

        res.status(201).json(rows[0]);
      } catch (err) {
        console.error('Error creating case:', err);
        if (err.code === 'ER_DUP_ENTRY') {
          return res.status(409).json({ 
            message: 'Case number already exists'
          });
        }
        res.status(500).json({ message: 'Failed to create case' });
      }
  });

  // Other case routes can be added here...

  return router;
};