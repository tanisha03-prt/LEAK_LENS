import bcrypt from 'bcryptjs';
import { User, AuditLog } from '../models/index.js';
import { dbState } from '../config/db.js';
import { memoryStore } from '../services/seedData.js';

export async function createStaffUser(req, res) {
  try {
    const { name, email, password, role, department, specialty, phone } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({ error: 'Staff member name is required.' });
    }
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid staff email address is required.' });
    }
    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ error: 'Staff password must be at least 6 characters in length.' });
    }
    if (role !== 'maintenance' && role !== 'admin') {
      return res.status(400).json({ error: 'Provisioned role must be either "maintenance" or "admin".' });
    }

    const cleanEmail = email.toLowerCase().trim();

    if (dbState.isMongoConnected) {
      const exists = await User.findOne({ email: cleanEmail });
      if (exists) return res.status(409).json({ error: 'A staff or resident account with this email already exists.' });
    }
    const memExists = memoryStore.users.find(u => u.email.toLowerCase() === cleanEmail);
    if (memExists) return res.status(409).json({ error: 'A staff or resident account with this email already exists.' });

    const passwordHash = bcrypt.hashSync(password, 10);
    const userId = `usr_${role === 'admin' ? 'admin' : 'maint'}_${Date.now()}`;
    const now = new Date();
    const nowIso = now.toISOString();

    const newStaffUser = {
      id: userId,
      name: name.trim(),
      email: cleanEmail,
      passwordHash,
      role,
      department: department || (role === 'maintenance' ? 'Plumbing & Hydraulic Maintenance' : 'Estate Operations'),
      specialty: specialty || (role === 'maintenance' ? 'Riser & Pipe Fitting' : 'Estate Officer'),
      phone: phone ? String(phone).trim() : '+91 98112 00000',
      status: 'active',
      createdAt: nowIso
    };

    if (dbState.isMongoConnected) {
      const created = await User.create({
        name: newStaffUser.name,
        email: cleanEmail,
        passwordHash,
        role,
        department: newStaffUser.department,
        specialty: newStaffUser.specialty,
        phone: newStaffUser.phone,
        status: 'active'
      });
      newStaffUser.id = created._id.toString();
    }

    memoryStore.users.push(newStaffUser);

    const auditEntry = {
      action: 'STAFF_USER_PROVISIONED',
      actorId: req.user.userId,
      actorName: req.user.name,
      actorRole: req.user.role,
      targetId: newStaffUser.id,
      targetType: 'user',
      details: `Estate admin created ${role.toUpperCase()} account for ${newStaffUser.name} (${cleanEmail}).`,
      timestamp: now
    };
    if (dbState.isMongoConnected) {
      AuditLog.create(auditEntry).catch(() => null);
    }
    memoryStore.auditLogs.unshift({
      id: `aud_${Date.now()}`,
      ...auditEntry,
      timestamp: nowIso
    });

    return res.status(201).json({
      message: `Authorized ${role} account provisioned successfully`,
      user: {
        id: newStaffUser.id,
        name: newStaffUser.name,
        email: newStaffUser.email,
        role: newStaffUser.role,
        department: newStaffUser.department,
        specialty: newStaffUser.specialty,
        phone: newStaffUser.phone,
        status: newStaffUser.status,
        createdAt: nowIso
      }
    });
  } catch (err) {
    console.error('Error provisioning staff user:', err);
    return res.status(500).json({ error: 'Failed to provision staff account', details: err?.message });
  }
}

export async function getAuditLogs(req, res) {
  try {
    if (dbState.isMongoConnected) {
      const docs = await AuditLog.find().sort({ timestamp: -1 }).limit(100).lean();
      if (docs && docs.length > 0) {
        return res.json(docs.map(d => ({
          id: d.id || d._id?.toString(),
          action: d.action,
          actorId: d.actorId ? (d.actorId.toString ? d.actorId.toString() : String(d.actorId)) : 'usr_1',
          actorName: d.actorName,
          actorRole: d.actorRole,
          targetId: d.targetId,
          targetType: d.targetType,
          details: d.details,
          timestamp: d.timestamp ? new Date(d.timestamp).toISOString() : new Date().toISOString()
        })));
      }
    }
  } catch (err) {
    console.warn('Falling back to memory audit logs:', err);
  }
  res.json(memoryStore.auditLogs);
}
