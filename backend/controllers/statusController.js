import { User, Building, LeakReport, Notification, AuditLog } from '../models/index.js';
import { dbState } from '../config/db.js';
import { PORT } from '../config/auth.js';
import { memoryStore } from '../services/seedData.js';

export async function getStatus(_req, res) {
  let userCount = memoryStore.users.length;
  let buildingCount = memoryStore.buildings.length;
  let leakReportCount = memoryStore.reports.length;
  let notificationCount = memoryStore.notifications.length;
  let auditLogCount = memoryStore.auditLogs.length;

  if (dbState.isMongoConnected) {
    try {
      [userCount, buildingCount, leakReportCount, notificationCount, auditLogCount] = await Promise.all([
        User.countDocuments(),
        Building.countDocuments(),
        LeakReport.countDocuments(),
        Notification.countDocuments(),
        AuditLog.countDocuments()
      ]);
    } catch (err) {
      console.warn('Error reading counts from MongoDB:', err);
    }
  }

  res.json({
    platform: 'LeakLens — Smart Water Leakage Intelligence Platform',
    status: 'operational',
    serverTime: new Date().toISOString(),
    backend: {
      runtime: 'Node.js Express (JavaScript)',
      port: PORT,
      mongooseReady: true,
      mongoConnected: dbState.isMongoConnected,
      storageMode: dbState.isMongoConnected ? 'Persistent MongoDB (Mongoose Models)' : 'In-memory fallback document store',
      mongoUri: process.env.MONGODB_URI ? 'Configured in .env' : 'Not configured (using memory store fallback)',
      mongoMessage: dbState.mongoErrorMessage,
      models: ['User', 'Building', 'LeakReport', 'MaintenanceAssignment', 'Notification', 'AuditLog']
    },
    counts: {
      users: userCount,
      buildings: buildingCount,
      leakReports: leakReportCount,
      notifications: notificationCount,
      auditLogs: auditLogCount
    }
  });
}
