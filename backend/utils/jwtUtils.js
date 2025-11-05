// jwtUtils.js
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

export const generateToken = (user) => {
  return jwt.sign(
    { 
      id: user.id, 
      role: user.role,
      email: user.email 
    },
    process.env.JWT_SECRET || 'secret_key',
    { expiresIn: '1h' }
  );
};

export const verifyPassword = async (plainPassword, hashedPassword) => {
  return await bcrypt.compare(plainPassword, hashedPassword);
};

export const hashPassword = async (password) => {
  const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '10', 10);
  return await bcrypt.hash(password, BCRYPT_ROUNDS);
};