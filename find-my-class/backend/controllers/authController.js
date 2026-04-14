import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import AdminUser from '../models/AdminUser.js';
import { createError } from '../utils/errors.js';

const SALT_ROUNDS = 10;

function sanitizeUser(user) {
  const obj = user.toObject ? user.toObject() : { ...user };
  delete obj.password;
  return obj;
}

function signToken(user) {
  return jwt.sign(
    { id: user._id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export const register = async (req, res) => {
  const { name, email, password, role } = req.body;
  const existing = await AdminUser.findOne({ email: String(email).trim().toLowerCase() });
  if (existing) {
    throw createError('Email already registered', 400);
  }
  const hashedPassword = await bcrypt.hash(String(password), SALT_ROUNDS);
  const user = await AdminUser.create({
    name: String(name).trim(),
    email: String(email).trim().toLowerCase(),
    password: hashedPassword,
    role: String(role).trim()
  });
  const token = signToken(user);
  res.status(201).json({
    user: sanitizeUser(user),
    token
  });
};

export const login = async (req, res) => {
  const { email, password } = req.body;
  const user = await AdminUser.findOne({ email: String(email).trim().toLowerCase() });
  if (!user) {
    throw createError('Invalid email or password', 401);
  }
  const match = await bcrypt.compare(String(password), user.password);
  if (!match) {
    throw createError('Invalid email or password', 401);
  }
  const token = signToken(user);
  res.json({
    user: sanitizeUser(user),
    token
  });
};
