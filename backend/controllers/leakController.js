import mongoose from 'mongoose';
import { LeakReport, Building, User, AuditLog, Notification } from '../models/index.js';
import { dbState } from '../config/db.js';
import { formatReportDoc } from '../utils/formatDoc.js';
import { calculateWaterLoss, calculateRiskScore, detectDuplicateComplaint } from '../services/waterMath.js';
import { memoryStore } from '../services/seedData.js';

export async function getLeaks(req, res) {
  try {
    const { status, severity, buildingId, search } = req.query;
    const currentUserId = req.user.userId;
    const currentUserRole = req.user.role;

    let reports = [];

    if (dbState.isMongoConnected) {
      const filterQuery = {};

      // STRICT DATA OWNERSHIP: Residents only ever receive complaints they created
      if (currentUserRole === 'resident') {
        filterQuery['reportedBy.userId'] = currentUserId;
      } else if (currentUserRole === 'maintenance') {
        // Maintenance technicians see their assigned tasks and unassigned queue items
        filterQuery.$or = [
          { 'assignment.assignedToId': currentUserId },
          { 'assignment.assignedToId': { $exists: false } },
          { assignment: null }
        ];
      }
      // Admins see all complaints across the campus without restriction

      if (status && status !== 'all') {
        filterQuery.status = status;
      }
      if (severity && severity !== 'all') {
        filterQuery.severity = severity;
      }
      if (buildingId && buildingId !== 'all') {
        if (mongoose.isValidObjectId(buildingId)) {
          filterQuery.$or = [
            { buildingId: buildingId },
            { buildingId: new mongoose.Types.ObjectId(String(buildingId)) }
          ];
        } else {
          filterQuery.buildingId = buildingId;
        }
      }

      if (search) {
        const query = String(search).trim();
        const searchRegex = new RegExp(query, 'i');
        filterQuery.$or = [
          { ticketNumber: searchRegex },
          { title: searchRegex },
          { roomOrZone: searchRegex },
          { buildingName: searchRegex }
        ];
      }

      const docs = await LeakReport.find(filterQuery).sort({ reportedAt: -1 });
      reports = docs.map(formatReportDoc);
    } else {
      // In-memory fallback with identical strict ownership rules
      reports = [...memoryStore.reports];

      if (currentUserRole === 'resident') {
        reports = reports.filter(r => r.reportedBy && r.reportedBy.userId === currentUserId);
      } else if (currentUserRole === 'maintenance') {
        reports = reports.filter(r => !r.assignment || r.assignment.assignedToId === currentUserId);
      }

      if (status && status !== 'all') {
        reports = reports.filter(r => r.status === status);
      }
      if (severity && severity !== 'all') {
        reports = reports.filter(r => r.severity === severity);
      }
      if (buildingId && buildingId !== 'all') {
        reports = reports.filter(r => r.buildingId === buildingId);
      }
      if (search) {
        const query = String(search).toLowerCase();
        reports = reports.filter(r => 
          r.ticketNumber.toLowerCase().includes(query) ||
          r.title.toLowerCase().includes(query) ||
          r.roomOrZone.toLowerCase().includes(query) ||
          r.buildingName.toLowerCase().includes(query)
        );
      }
    }

    // Dynamic water loss and risk scores calculation
    const computedReports = reports.map(r => {
      const calc = calculateWaterLoss(r.severity, r.reportedAt, r.resolvedAt);
      const score = calculateRiskScore(
        r.severity,
        r.reportedAt,
        r.recurrenceCount || 0,
        r.leakType,
        r.status === 'resolved' || r.status === 'closed'
      );
      return {
        ...r,
        waterLossLiters: calc.liters,
        costLostINR: calc.costINR,
        riskScore: score
      };
    });

    computedReports.sort((a, b) => b.riskScore - a.riskScore);
    return res.json(computedReports);
  } catch (err) {
    console.error('Error fetching leaks:', err);
    return res.status(500).json({ error: 'Failed to retrieve leak reports', details: err?.message });
  }
}

export async function getLeakById(req, res) {
  const { id } = req.params;
  const currentUserRole = req.user.role;
  const currentUserId = req.user.userId;

  let reportDoc = null;
  if (dbState.isMongoConnected) {
    if (mongoose.isValidObjectId(id)) {
      reportDoc = await LeakReport.findById(id).lean().catch(() => null);
    }
    if (!reportDoc) {
      reportDoc = await LeakReport.findOne({ $or: [{ ticketNumber: id }, { _id: id }] }).lean().catch(() => null);
    }
  }

  let report = reportDoc ? formatReportDoc(reportDoc) : (memoryStore.reports.find(r => r.id === id || r.ticketNumber === id) || null);

  if (!report) {
    return res.status(404).json({ error: 'Water leak complaint record not found.' });
  }

  // Resident Privacy Rule: cannot view another resident's private complaint
  if (currentUserRole === 'resident' && report.reportedBy.userId !== currentUserId) {
    return res.status(403).json({
      error: 'Access Denied: You are not authorized to inspect another resident’s private complaint dossier.'
    });
  }

  return res.json(report);
}

export async function createLeak(req, res) {
  try {
    const {
      title,
      description,
      buildingId,
      floor,
      roomOrZone,
      severity,
      leakType,
      photoUrl
    } = req.body;

    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'Incident summary / title is required.' });
    }
    if (!buildingId) {
      return res.status(400).json({ error: 'Campus building selection is required.' });
    }
    if (floor === undefined || isNaN(Number(floor))) {
      return res.status(400).json({ error: 'Valid floor number is required.' });
    }
    if (!roomOrZone || typeof roomOrZone !== 'string' || !roomOrZone.trim()) {
      return res.status(400).json({ error: 'Exact room or zone location is required.' });
    }
    if (!severity || !['minor', 'moderate', 'severe', 'critical'].includes(severity)) {
      return res.status(400).json({ error: 'Valid severity level is required (minor, moderate, severe, critical).' });
    }
    if (!leakType) {
      return res.status(400).json({ error: 'Plumbing leak type is required.' });
    }

    // SAFE REPORTER BINDING: Derived strictly from verified JWT token - no impersonation
    const safeReporterId = req.user.userId;
    const reporterName = req.user.name;
    const reporterRole = req.user.role;
    const reporterContact = req.body.contact || '+91 98765 43210';

    // Resolve building metadata safely
    let buildingName = 'Campus Building';
    let buildingCode = 'B';
    if (dbState.isMongoConnected) {
      let bDoc = null;
      if (mongoose.isValidObjectId(buildingId)) {
        bDoc = await Building.findById(buildingId).lean().catch(() => null);
      }
      if (!bDoc) {
        bDoc = await Building.findOne({
          $or: [{ code: buildingId }, { name: buildingId }, { _id: buildingId }]
        }).lean().catch(() => null);
      }
      if (bDoc) {
        buildingName = bDoc.name;
        buildingCode = bDoc.code || 'B';
      }
    }
    if (buildingName === 'Campus Building') {
      const memBld = memoryStore.buildings.find(b => b.id === buildingId || b.code === buildingId);
      if (memBld) {
        buildingName = memBld.name;
        buildingCode = memBld.code;
      }
    }

    // Open reports duplicate check
    let existingOpenReports = [];
    let totalReportsCount = memoryStore.reports.length;

    if (dbState.isMongoConnected) {
      const openDocs = await LeakReport.find({
        status: { $nin: ['resolved', 'closed'] }
      }).lean().catch(() => []);
      existingOpenReports = openDocs.map(formatReportDoc);
      totalReportsCount = await LeakReport.countDocuments().catch(() => memoryStore.reports.length);
    } else {
      existingOpenReports = memoryStore.reports.filter(r => r.status !== 'resolved' && r.status !== 'closed');
    }

    const dupResult = detectDuplicateComplaint(
      { buildingId: String(buildingId), floor: Number(floor), roomOrZone: String(roomOrZone), leakType: String(leakType) },
      existingOpenReports
    );

    // Recurrence check
    let recurrenceCount = 0;
    if (dbState.isMongoConnected) {
      const regex = new RegExp(String(roomOrZone).trim(), 'i');
      const recDocs = await LeakReport.find({
        floor: Number(floor),
        roomOrZone: regex
      }).lean().catch(() => []);
      recurrenceCount = recDocs.length;
    } else {
      recurrenceCount = memoryStore.reports.filter(
        r => String(r.buildingId) === String(buildingId) &&
             r.floor === Number(floor) &&
             r.roomOrZone.toLowerCase().includes(String(roomOrZone).toLowerCase().trim())
      ).length;
    }
    const isRecurring = recurrenceCount > 0;

    const now = new Date();
    const nowIso = now.toISOString();
    const ticketNumber = `LK-2026-${105 + totalReportsCount}`;

    const calc = calculateWaterLoss(severity, nowIso);
    const riskScore = calculateRiskScore(severity, nowIso, recurrenceCount, leakType);

    const reportData = {
      ticketNumber,
      title: title.trim(),
      description: description.trim(),
      buildingId: buildingId,
      buildingName,
      floor: Number(floor),
      roomOrZone: roomOrZone.trim(),
      plumbingShaftOrRiser: `Shaft ${buildingCode}-${floor}`,
      severity,
      leakType,
      status: 'reported',
      reportedBy: {
        userId: safeReporterId,
        name: reporterName,
        role: reporterRole,
        contact: reporterContact
      },
      photoUrl: photoUrl || '/src/assets/images/leak_pipe_dripping_1792652997799.jpg',
      leakRateLph: calc.ratePerHour,
      isEstimatedRate: true,
      waterLossLiters: 0,
      costLostINR: 0,
      riskScore,
      isRecurring,
      recurrenceCount,
      isDuplicateFlagged: dupResult.isDuplicate,
      duplicateOfTicketId: dupResult.matchedTicket?.ticketNumber,
      reportedAt: now,
      slaBreach: false
    };

    let savedReport;

    if (dbState.isMongoConnected) {
      const createdDoc = await LeakReport.create(reportData);
      savedReport = formatReportDoc(createdDoc);
      memoryStore.reports.unshift(savedReport);
      console.log(`✅ Persisted authenticated leak report [${savedReport.ticketNumber}] to MongoDB.`);
    } else {
      savedReport = {
        id: `rep_${Date.now()}`,
        ...reportData,
        reportedAt: nowIso,
        updatedAt: nowIso
      };
      memoryStore.reports.unshift(savedReport);
    }

    // Audit Log & Notification persistence
    const auditData = {
      action: 'LEAK_REPORTED',
      actorId: safeReporterId,
      actorName: reporterName,
      actorRole: reporterRole,
      targetId: savedReport.id,
      targetType: 'leak_report',
      details: `Registered complaint ${ticketNumber} (${severity}) at ${buildingName} - ${roomOrZone}.`,
      timestamp: now
    };

    if (dbState.isMongoConnected) {
      try {
        await AuditLog.create(auditData);
        await Notification.create({
          roleTarget: 'maintenance',
          title: `New ${severity.toUpperCase()} Water Leak Filed`,
          message: `${ticketNumber} reported in ${buildingName} Floor ${floor} (${roomOrZone}) by ${reporterName}.`,
          type: severity === 'critical' ? 'urgent' : 'assignment',
          ticketId: savedReport.id,
          isRead: false,
          createdAt: now
        });
      } catch (logErr) {
        console.warn('Notice saving audit log to MongoDB:', logErr);
      }
    }

    memoryStore.auditLogs.unshift({
      id: `aud_${Date.now()}`,
      ...auditData,
      timestamp: nowIso
    });

    memoryStore.notifications.unshift({
      id: `notif_${Date.now()}`,
      roleTarget: 'maintenance',
      title: `New ${severity.toUpperCase()} Water Leak Filed`,
      message: `${ticketNumber} reported in ${buildingName} Floor ${floor} (${roomOrZone}) by ${reporterName}.`,
      type: severity === 'critical' ? 'urgent' : 'assignment',
      ticketId: savedReport.id,
      createdAt: nowIso,
      isRead: false
    });

    return res.status(201).json({
      report: savedReport,
      duplicateAlert: dupResult.isDuplicate ? dupResult : null
    });
  } catch (err) {
    console.error('Error creating leak report:', err);
    return res.status(500).json({
      error: 'Failed to record leak complaint',
      details: err?.message || 'Database error'
    });
  }
}

export async function assignTechnician(req, res) {
  try {
    const { id } = req.params;
    const { technicianId } = req.body;
    const adminName = req.user.name;
    const adminId = req.user.userId;

    let reportDoc = null;
    let report = null;

    if (dbState.isMongoConnected) {
      if (mongoose.isValidObjectId(id)) {
        reportDoc = await LeakReport.findById(id);
      }
      if (!reportDoc) {
        reportDoc = await LeakReport.findOne({ $or: [{ ticketNumber: id }, { _id: id }] }).catch(() => null);
      }
    }

    if (!reportDoc) {
      report = memoryStore.reports.find(r => r.id === id || r.ticketNumber === id) || null;
      if (!report) return res.status(404).json({ error: 'Incident not found' });
    }

    // Resolve assigned technician identity
    let techName = 'Assigned Technician';
    if (dbState.isMongoConnected && technicianId) {
      let tDoc = null;
      if (mongoose.isValidObjectId(technicianId)) {
        tDoc = await User.findById(technicianId).lean().catch(() => null);
      }
      if (!tDoc) {
        tDoc = await User.findOne({ $or: [{ email: technicianId }, { _id: technicianId }] }).lean().catch(() => null);
      }
      if (tDoc) techName = tDoc.name;
    }
    if (techName === 'Assigned Technician') {
      const memTech = memoryStore.users.find(u => u.id === technicianId);
      if (memTech) techName = memTech.name;
    }

    const now = new Date();
    const nowIso = now.toISOString();

    if (reportDoc) {
      reportDoc.status = 'assigned';
      reportDoc.assignment = {
        assignedToId: technicianId,
        technicianName: techName,
        assignedAt: now,
        notes: `Dispatched by ${adminName}.`,
        partsReplaced: [],
        waterValveShutOff: false,
        hoursSpent: 0
      };
      reportDoc.updatedAt = now;
      await reportDoc.save();
      report = formatReportDoc(reportDoc);

      const memIdx = memoryStore.reports.findIndex(r => r.id === report.id || r.ticketNumber === report.ticketNumber);
      if (memIdx >= 0) memoryStore.reports[memIdx] = report;
      else memoryStore.reports.unshift(report);

      await AuditLog.create({
        action: 'TECHNICIAN_ASSIGNED',
        actorId: adminId,
        actorName: adminName,
        actorRole: 'admin',
        targetId: report.id,
        targetType: 'assignment',
        details: `Assigned incident ${report.ticketNumber} to technician ${techName}.`,
        timestamp: now
      }).catch(() => null);

      await Notification.create({
        userId: technicianId,
        roleTarget: 'maintenance',
        title: 'New Work Order Dispatched',
        message: `You were dispatched to ${report.ticketNumber} at ${report.buildingName} ${report.roomOrZone}.`,
        type: 'assignment',
        ticketId: report.id,
        createdAt: now,
        isRead: false
      }).catch(() => null);
    } else if (report) {
      report.status = 'assigned';
      report.assignment = {
        assignedToId: technicianId,
        technicianName: techName,
        assignedAt: nowIso,
        notes: `Dispatched by ${adminName}.`,
        partsReplaced: [],
        waterValveShutOff: false,
        hoursSpent: 0
      };
      report.updatedAt = nowIso;
    }

    memoryStore.auditLogs.unshift({
      id: `aud_${Date.now()}`,
      action: 'TECHNICIAN_ASSIGNED',
      actorId: adminId,
      actorName: adminName,
      actorRole: 'admin',
      targetId: report.id,
      targetType: 'assignment',
      details: `Assigned incident ${report.ticketNumber} to technician ${techName}.`,
      timestamp: nowIso
    });

    memoryStore.notifications.unshift({
      id: `notif_${Date.now()}`,
      userId: technicianId,
      roleTarget: 'maintenance',
      title: 'New Work Order Dispatched',
      message: `You were dispatched to ${report.ticketNumber} at ${report.buildingName} ${report.roomOrZone}.`,
      type: 'assignment',
      ticketId: report.id,
      createdAt: nowIso,
      isRead: false
    });

    return res.json(report);
  } catch (err) {
    console.error('Error assigning technician:', err);
    return res.status(500).json({ error: 'Failed to assign technician', details: err?.message });
  }
}

export async function updateProgress(req, res) {
  try {
    const { id } = req.params;
    const { status, notes, partsUsed, waterValveShutOff, hoursSpent, evidencePhotoUrl } = req.body;
    const actorName = req.user.name;
    const actorRole = req.user.role;
    const actorId = req.user.userId;

    let reportDoc = null;
    let report = null;

    if (dbState.isMongoConnected) {
      if (mongoose.isValidObjectId(id)) {
        reportDoc = await LeakReport.findById(id);
      }
      if (!reportDoc) {
        reportDoc = await LeakReport.findOne({ $or: [{ ticketNumber: id }, { _id: id }] }).catch(() => null);
      }
    }

    if (!reportDoc) {
      report = memoryStore.reports.find(r => r.id === id || r.ticketNumber === id) || null;
      if (!report) return res.status(404).json({ error: 'Incident not found' });
    }

    // If maintenance technician, verify assignment ownership
    if (actorRole === 'maintenance') {
      const assignedToId = reportDoc ? reportDoc.assignment?.assignedToId : report?.assignment?.assignedToId;
      if (assignedToId && assignedToId !== actorId) {
        return res.status(403).json({
          error: 'Access Denied: This work order is assigned to another technician.'
        });
      }
    }

    const now = new Date();
    const nowIso = now.toISOString();

    if (reportDoc) {
      if (status) reportDoc.status = status;
      if (!reportDoc.assignment) {
        reportDoc.assignment = {
          assignedToId: actorId,
          technicianName: actorName,
          assignedAt: now,
          waterValveShutOff: Boolean(waterValveShutOff),
          hoursSpent: Number(hoursSpent) || 0
        };
      }
      if (notes) reportDoc.assignment.notes = notes;
      if (partsUsed && Array.isArray(partsUsed)) reportDoc.assignment.partsReplaced = partsUsed;
      if (typeof waterValveShutOff === 'boolean') reportDoc.assignment.waterValveShutOff = waterValveShutOff;
      if (hoursSpent !== undefined) reportDoc.assignment.hoursSpent = Number(hoursSpent);

      if (status === 'resolved') {
        reportDoc.resolvedAt = now;
        reportDoc.resolutionPhotoUrl = evidencePhotoUrl || '/src/assets/images/repaired_pipe_clean_1792652998773.jpg';
        reportDoc.riskScore = 10;
      }
      reportDoc.updatedAt = now;
      await reportDoc.save();
      report = formatReportDoc(reportDoc);

      const memIdx = memoryStore.reports.findIndex(r => r.id === report.id || r.ticketNumber === report.ticketNumber);
      if (memIdx >= 0) memoryStore.reports[memIdx] = report;
      else memoryStore.reports.unshift(report);

      await AuditLog.create({
        action: status === 'resolved' ? 'REPAIR_RESOLVED_EVIDENCE' : 'WORK_PROGRESS_UPDATED',
        actorId,
        actorName,
        actorRole,
        targetId: report.id,
        targetType: 'leak_report',
        details: status === 'resolved' 
          ? `Completed repair with photographic proof. Parts: ${(partsUsed || []).join(', ') || 'Fittings replaced'}.`
          : `Updated work status to ${status}. Notes: ${notes || 'Inspection active'}`,
        timestamp: now
      }).catch(() => null);

      if (status === 'resolved') {
        await Notification.create({
          userId: report.reportedBy.userId,
          roleTarget: 'resident',
          title: 'Leak Incident Resolved with Evidence',
          message: `Your complaint ${report.ticketNumber} has been resolved by ${actorName}. Photographic proof is available.`,
          type: 'resolved',
          ticketId: report.id,
          isRead: false,
          createdAt: now
        }).catch(() => null);
      }
    } else if (report) {
      if (status) report.status = status;
      if (!report.assignment) {
        report.assignment = {
          assignedToId: actorId,
          technicianName: actorName,
          assignedAt: nowIso,
          waterValveShutOff: Boolean(waterValveShutOff),
          hoursSpent: Number(hoursSpent) || 0
        };
      }
      if (notes) report.assignment.notes = notes;
      if (partsUsed && Array.isArray(partsUsed)) report.assignment.partsReplaced = partsUsed;
      if (typeof waterValveShutOff === 'boolean') report.assignment.waterValveShutOff = waterValveShutOff;
      if (hoursSpent !== undefined) report.assignment.hoursSpent = Number(hoursSpent);

      if (status === 'resolved') {
        report.resolvedAt = nowIso;
        report.resolutionPhotoUrl = evidencePhotoUrl || '/src/assets/images/repaired_pipe_clean_1792652998773.jpg';
        report.riskScore = 10;
      }
      report.updatedAt = nowIso;
    }

    memoryStore.auditLogs.unshift({
      id: `aud_${Date.now()}`,
      action: status === 'resolved' ? 'REPAIR_RESOLVED_EVIDENCE' : 'WORK_PROGRESS_UPDATED',
      actorId,
      actorName,
      actorRole,
      targetId: report.id,
      targetType: 'leak_report',
      details: status === 'resolved' 
        ? `Completed repair with photographic proof. Parts: ${(partsUsed || []).join(', ') || 'Fittings replaced'}.`
        : `Updated work status to ${status}. Notes: ${notes || 'Inspection active'}`,
      timestamp: nowIso
    });

    if (status === 'resolved') {
      memoryStore.notifications.unshift({
        id: `notif_${Date.now()}`,
        userId: report.reportedBy.userId,
        roleTarget: 'resident',
        title: 'Leak Incident Resolved with Evidence',
        message: `Your complaint ${report.ticketNumber} has been resolved by ${actorName}. Photographic proof is available.`,
        type: 'resolved',
        ticketId: report.id,
        createdAt: nowIso,
        isRead: false
      });
    }

    return res.json(report);
  } catch (err) {
    console.error('Error updating repair progress:', err);
    return res.status(500).json({ error: 'Failed to update repair progress', details: err?.message });
  }
}
