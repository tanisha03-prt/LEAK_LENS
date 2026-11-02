import mongoose from 'mongoose';
import { Notification } from '../models/index.js';
import { dbState } from '../config/db.js';
import { memoryStore } from '../services/seedData.js';

export async function getNotifications(req, res) {
  const userRole = req.user.role;
  const userId = req.user.userId;

  try {
    if (dbState.isMongoConnected) {
      const query = {
        $or: [
          { roleTarget: 'all' },
          { roleTarget: userRole },
          { userId: userId }
        ]
      };
      const docs = await Notification.find(query).sort({ createdAt: -1 }).lean();
      if (docs && docs.length > 0) {
        return res.json(docs.map(d => ({
          id: d.id || d._id?.toString(),
          roleTarget: d.roleTarget,
          title: d.title,
          message: d.message,
          type: d.type,
          ticketId: d.ticketId,
          isRead: Boolean(d.isRead),
          createdAt: d.createdAt ? new Date(d.createdAt).toISOString() : new Date().toISOString()
        })));
      }
    }
  } catch (err) {
    console.warn('Falling back to memory notifications:', err);
  }

  let items = memoryStore.notifications.filter(n => 
    n.roleTarget === 'all' || 
    n.roleTarget === userRole || 
    n.userId === userId
  );
  res.json(items);
}

export async function markNotificationRead(req, res) {
  const { id } = req.params;
  try {
    if (dbState.isMongoConnected) {
      if (mongoose.isValidObjectId(id)) {
        await Notification.findByIdAndUpdate(id, { isRead: true });
      } else {
        await Notification.findOneAndUpdate({ $or: [{ _id: id }, { ticketId: id }] }, { isRead: true });
      }
    }
  } catch (err) {
    console.warn('Error marking notification read in MongoDB:', err);
  }

  const item = memoryStore.notifications.find(n => n.id === id);
  if (item) item.isRead = true;
  res.json({ success: true, item });
}
