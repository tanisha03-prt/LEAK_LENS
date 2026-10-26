import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { User, AuditLog } from '../models/index.js';
import { dbState } from '../config/db.js';
import { JWT_SECRET } from '../config/auth.js';
import { memoryStore } from '../services/seedData.js';

export async function registerResident(req, res) {
  try {
    const { name, email, password, buildingId, roomNumber, phone } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({ error: 'Full legal resident name is required (minimum 2 characters).' });
    }
    if (!email || typeof email !== 'string' || !email.includes('@') || !email.includes('.')) {
      return res.status(400).json({ error: 'Please provide a valid resident email address.' });
    }
    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters in length.' });
    }
    if (!buildingId || typeof buildingId !== 'string') {
      return res.status(400).json({ error: 'Campus hostel or residential building selection is required.' });
    }
    if (!roomNumber || typeof roomNumber !== 'string' || !roomNumber.trim()) {
      return res.status(400).json({ error: 'Room or apartment number is required for leak dispatch records.' });
    }

    const cleanEmail = email.toLowerCase().trim();

    // Enforce email uniqueness in MongoDB
    if (dbState.isMongoConnected) {
      const existingUserDoc = await User.findOne({ email: cleanEmail });
      if (existingUserDoc) {
        return res.status(409).json({ error: 'An account with this email address already exists. Please sign in.' });
      }
    }

    // Enforce email uniqueness in memory store
    const existingMemUser = memoryStore.users.find(u => u.email.toLowerCase() === cleanEmail);
    if (existingMemUser) {
      return res.status(409).json({ error: 'An account with this email address already exists. Please sign in.' });
    }

    // Hash password with bcrypt - never plaintext
    const passwordHash = bcrypt.hashSync(password, 10);
    const userId = `usr_res_${Date.now()}`;
    const now = new Date();
    const nowIso = now.toISOString();

    const newResident = {
      id: userId,
      name: name.trim(),
      email: cleanEmail,
      passwordHash,
      role: 'resident',
      buildingId,
      roomNumber: roomNumber.trim(),
      phone: phone ? String(phone).trim() : '+91 98000 00000',
      status: 'active',
      avatar: '/src/assets/images/avatar_resident_user_1792652999623.jpg',
      createdAt: nowIso
    };

    if (dbState.isMongoConnected) {
      const createdDoc = await User.create({
        name: newResident.name,
        email: cleanEmail,
        passwordHash,
        role: 'resident',
        buildingId,
        roomNumber: newResident.roomNumber,
        phone: newResident.phone,
        status: 'active',
        avatar: newResident.avatar
      });
      newResident.id = createdDoc._id.toString();
    }

    memoryStore.users.unshift(newResident);

    // Record audit event
    const auditData = {
      action: 'RESIDENT_REGISTERED',
      actorId: newResident.id,
      actorName: newResident.name,
      actorRole: 'resident',
      targetId: newResident.id,
      targetType: 'user',
      details: `Resident registered for ${newResident.roomNumber} (${cleanEmail}).`,
      timestamp: now
    };

    if (dbState.isMongoConnected) {
      AuditLog.create(auditData).catch(() => null);
    }
    memoryStore.auditLogs.unshift({
      id: `aud_${Date.now()}`,
      ...auditData,
      timestamp: nowIso
    });

    // Issue JWT token with resident payload
    const token = jwt.sign(
      {
        userId: newResident.id,
        email: cleanEmail,
        role: 'resident',
        name: newResident.name
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(201).json({
      message: 'Resident account registered successfully',
      token,
      user: {
        id: newResident.id,
        name: newResident.name,
        email: cleanEmail,
        role: 'resident',
        buildingId: newResident.buildingId,
        roomNumber: newResident.roomNumber,
        phone: newResident.phone,
        status: newResident.status,
        avatar: newResident.avatar,
        createdAt: nowIso
      }
    });
  } catch (err) {
    console.error('Registration failure:', err);
    return res.status(500).json({ error: 'Failed to create resident account', details: err?.message });
  }
}

export async function login(req, res) {
  try {
    const { email, password, portal } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const cleanEmail = String(email).toLowerCase().trim();
    let userFound = null;

    if (dbState.isMongoConnected) {
      userFound = await User.findOne({ email: cleanEmail }).lean().catch(() => null);
    }
    if (!userFound) {
      userFound = memoryStore.users.find(u => u.email.toLowerCase() === cleanEmail);
    }

    if (!userFound) {
      return res.status(401).json({ error: 'Invalid email or password. Please verify your credentials.' });
    }

    // Verify bcrypt password hash
    const passwordValid = bcrypt.compareSync(String(password), userFound.passwordHash);
    if (!passwordValid) {
      return res.status(401).json({ error: 'Invalid email or password. Please verify your credentials.' });
    }

    // Check account status
    if (userFound.status === 'inactive') {
      return res.status(403).json({ error: 'This account has been deactivated. Contact the Campus Estate Office.' });
    }

    // Portal role authorization verification
    if (portal) {
      if (portal === 'admin' && userFound.role !== 'admin') {
        return res.status(403).json({
          error: `Access Denied: This account (${userFound.role}) does not hold Estate Administrator credentials. Please use the ${userFound.role === 'maintenance' ? 'Maintenance' : 'Resident'} Portal.`
        });
      }
      if (portal === 'maintenance' && userFound.role !== 'maintenance') {
        return res.status(403).json({
          error: `Access Denied: Only authorized Maintenance Technicians can access this portal. Residents must use the Resident Portal.`
        });
      }
      if (portal === 'resident' && userFound.role !== 'resident') {
        return res.status(403).json({
          error: `Staff Notice: This is an authorized ${userFound.role.toUpperCase()} account. Please sign in via the ${userFound.role === 'admin' ? 'Admin' : 'Maintenance'} Portal.`
        });
      }
    }

    const userId = userFound.id || (userFound._id ? userFound._id.toString() : `usr_${Date.now()}`);

    // Generate authenticated JWT
    const token = jwt.sign(
      {
        userId,
        email: userFound.email,
        role: userFound.role,
        name: userFound.name
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Record login audit
    const now = new Date();
    const loginAudit = {
      action: 'USER_LOGIN',
      actorId: userId,
      actorName: userFound.name,
      actorRole: userFound.role,
      targetId: userId,
      targetType: 'user',
      details: `Authenticated into ${portal ? `${portal} portal` : 'system'}.`,
      timestamp: now
    };
    if (dbState.isMongoConnected) {
      AuditLog.create(loginAudit).catch(() => null);
    }
    memoryStore.auditLogs.unshift({
      id: `aud_${Date.now()}`,
      ...loginAudit,
      timestamp: now.toISOString()
    });

    return res.json({
      token,
      user: {
        id: userId,
        name: userFound.name,
        email: userFound.email,
        role: userFound.role,
        phone: userFound.phone,
        roomNumber: userFound.roomNumber,
        buildingId: userFound.buildingId ? (userFound.buildingId.toString ? userFound.buildingId.toString() : String(userFound.buildingId)) : undefined,
        department: userFound.department,
        specialty: userFound.specialty,
        status: userFound.status,
        avatar: userFound.avatar,
        createdAt: userFound.createdAt ? new Date(userFound.createdAt).toISOString() : new Date().toISOString()
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Authentication service encountered an unexpected error', details: err?.message });
  }
}

export async function getMe(req, res) {
  const currentUserId = req.user.userId;
  let user = null;

  if (dbState.isMongoConnected) {
    if (mongoose.isValidObjectId(currentUserId)) {
      user = await User.findById(currentUserId).lean().catch(() => null);
    }
    if (!user) {
      user = await User.findOne({ $or: [{ email: req.user.email }, { _id: currentUserId }] }).lean().catch(() => null);
    }
  }

  if (!user) {
    user = memoryStore.users.find(u => u.id === currentUserId || u.email.toLowerCase() === req.user.email.toLowerCase());
  }

  if (!user) {
    return res.status(404).json({ error: 'User profile not found.' });
  }

  return res.json({
    user: {
      id: user.id || user._id?.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      roomNumber: user.roomNumber,
      buildingId: user.buildingId ? (user.buildingId.toString ? user.buildingId.toString() : String(user.buildingId)) : undefined,
      department: user.department,
      specialty: user.specialty,
      status: user.status,
      avatar: user.avatar,
      createdAt: user.createdAt ? new Date(user.createdAt).toISOString() : new Date().toISOString()
    }
  });
}
