import { User } from '../models/index.js';
import { dbState } from '../config/db.js';
import { memoryStore } from '../services/seedData.js';

export async function getUsers(req, res) {
  const { role } = req.query;
  const userRole = req.user.role;

  try {
    if (dbState.isMongoConnected) {
      const query = {};
      if (role) query.role = role;
      const docs = await User.find(query).lean();
      if (docs && docs.length > 0) {
        return res.json(docs.map(d => ({
          id: d.id || d._id?.toString(),
          name: d.name,
          email: userRole === 'admin' ? d.email : (d.role === 'maintenance' ? d.email : '***@campus.edu'),
          role: d.role,
          phone: userRole === 'admin' ? d.phone : (d.role === 'maintenance' ? d.phone : undefined),
          roomNumber: d.roomNumber,
          department: d.department,
          specialty: d.specialty,
          status: d.status,
          avatar: d.avatar,
          createdAt: d.createdAt ? new Date(d.createdAt).toISOString() : new Date().toISOString()
        })));
      }
    }
  } catch (err) {
    console.warn('Falling back to memory users:', err);
  }

  let list = memoryStore.users;
  if (role) {
    list = list.filter(u => u.role === role);
  }

  // Sanitize passwordHash and private phone numbers for non-admins
  const sanitized = list.map(u => ({
    id: u.id,
    name: u.name,
    email: userRole === 'admin' ? u.email : (u.role === 'maintenance' ? u.email : '***@campus.edu'),
    role: u.role,
    phone: userRole === 'admin' ? u.phone : (u.role === 'maintenance' ? u.phone : undefined),
    roomNumber: u.roomNumber,
    department: u.department,
    specialty: u.specialty,
    status: u.status,
    avatar: u.avatar,
    createdAt: u.createdAt
  }));

  res.json(sanitized);
}
