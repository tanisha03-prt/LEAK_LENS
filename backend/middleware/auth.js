import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/auth.js';

export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      error: 'Authentication token required. Please sign in to access your portal.'
    });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({
        error: 'Invalid or expired session. Please sign in again.'
      });
    }
    req.user = decoded;
    next();
  });
}

export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access Denied: Your account role (${req.user.role.toUpperCase()}) is not authorized to perform this operation.`
      });
    }
    next();
  };
}
