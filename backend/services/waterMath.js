export const LEAK_RATE_LPH = {
  minor: 0.8,     // slow drip (~1 drop every 2-3 sec)
  moderate: 18.0,  // steady drip / small stream
  severe: 85.0,    // continuous running stream / cracked pipe
  critical: 320.0  // pressurized burst / main riser failure
};

// Municipal / campus water tariff rate: ₹48 per 1,000 Liters (1 kiloliter)
export const WATER_COST_PER_LITER_INR = 0.048;

/**
 * Calculates water loss in Liters and estimated cost in INR
 * based on leak severity and duration between report and resolution (or current time).
 */
export function calculateWaterLoss(severity, reportedAtIso, resolvedAtIso) {
  const start = new Date(reportedAtIso).getTime();
  const end = resolvedAtIso ? new Date(resolvedAtIso).getTime() : Date.now();
  const hoursElapsed = Math.max(0.1, (end - start) / (1000 * 60 * 60));
  
  const ratePerHour = LEAK_RATE_LPH[severity] || 0.8;
  const liters = Math.round(hoursElapsed * ratePerHour * 10) / 10;
  const costINR = Math.round(liters * WATER_COST_PER_LITER_INR * 100) / 100;
  
  return {
    liters,
    costINR,
    hoursElapsed: Math.round(hoursElapsed * 10) / 10,
    ratePerHour,
    isEstimate: true
  };
}

/**
 * Calculate dynamic Risk Score (1-100)
 */
export function calculateRiskScore(
  severity,
  reportedAtIso,
  recurrenceCount = 0,
  leakType,
  isResolved = false
) {
  if (isResolved) return 10;

  let score = 20;
  switch (severity) {
    case 'critical':
      score = 80;
      break;
    case 'severe':
      score = 55;
      break;
    case 'moderate':
      score = 35;
      break;
    case 'minor':
    default:
      score = 15;
      break;
  }

  // Recurrence penalty
  score += Math.min(25, recurrenceCount * 8);

  // Time elapsed penalty
  const hours = (Date.now() - new Date(reportedAtIso).getTime()) / (1000 * 60 * 60);
  if (hours > 72) score += 20;
  else if (hours > 24) score += 12;
  else if (hours > 12) score += 6;

  // Hazardous leak type
  if (leakType === 'main_riser' || leakType === 'ceiling_seepage') {
    score += 8;
  }

  return Math.min(100, Math.max(1, Math.round(score)));
}

/**
 * Duplicate Detection Engine:
 * Compares a draft report with active open reports.
 */
export function detectDuplicateComplaint(draft, existingReports = []) {
  const normalizedZone = (draft.roomOrZone || '').toLowerCase().trim();
  if (!normalizedZone || !draft.buildingId) {
    return { isDuplicate: false, confidence: 0 };
  }

  const openReports = existingReports.filter(r => r.status !== 'closed' && r.status !== 'resolved');

  for (const report of openReports) {
    if (String(report.buildingId) === String(draft.buildingId) && Number(report.floor) === Number(draft.floor)) {
      const existingZone = (report.roomOrZone || '').toLowerCase().trim();
      
      // Exact or substring match in room/zone
      const isRoomMatch = existingZone.includes(normalizedZone) || normalizedZone.includes(existingZone);
      const isTypeMatch = report.leakType === draft.leakType;

      if (isRoomMatch) {
        const confidence = isTypeMatch ? 95 : 75;
        return {
          isDuplicate: true,
          confidence,
          matchedTicket: {
            id: report.id,
            ticketNumber: report.ticketNumber,
            title: report.title,
            buildingName: report.buildingName,
            roomOrZone: report.roomOrZone,
            reportedAt: report.reportedAt,
            status: report.status
          }
        };
      }
    }
  }

  return { isDuplicate: false, confidence: 0 };
}
