import jwt from 'jsonwebtoken';
import AdminUser from '../models/AdminUser.js';

export const protectAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Access denied. No token provided.' });
    }
    const token = authHeader.slice(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await AdminUser.findById(decoded.id).select('-password');
    if (!user) {
      return res.status(401).json({ error: 'User not found.' });
    }
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
};
