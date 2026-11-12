import mongoose from 'mongoose';

const AuditLogSchema = new mongoose.Schema(
  {
    action: { type: String, required: true, trim: true },
    actorId: { type: mongoose.Schema.Types.Mixed, ref: 'User', required: true, index: true },
    actorName: { type: String, required: true },
    actorRole: { type: String, enum: ['resident', 'maintenance', 'admin'], required: true },
    targetId: { type: String, required: true, index: true },
    targetType: { 
      type: String, 
      enum: ['leak_report', 'assignment', 'user', 'building'], 
      required: true,
      index: true 
    },
    details: { type: String, required: true },
    timestamp: { type: Date, default: Date.now, index: true }
  },
  { timestamps: false }
);

AuditLogSchema.index({ targetId: 1, timestamp: -1 });

export const AuditLog = mongoose.models.AuditLog || mongoose.model('AuditLog', AuditLogSchema);
export default AuditLog;
