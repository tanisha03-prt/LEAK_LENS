import { Building, LeakReport } from '../models/index.js';
import { dbState } from '../config/db.js';
import { formatReportDoc } from '../utils/formatDoc.js';
import { memoryStore } from '../services/seedData.js';

export async function getBuildings(_req, res) {
  try {
    let baseBuildings = memoryStore.buildings;
    let allLeaks = [];

    if (dbState.isMongoConnected) {
      const bDocs = await Building.find().lean().catch(() => []);
      if (bDocs && bDocs.length > 0) {
        baseBuildings = bDocs.map(b => ({
          id: b.id || b._id?.toString(),
          name: b.name,
          code: b.code,
          type: b.type,
          totalFloors: b.totalFloors,
          totalRooms: b.totalRooms,
          wings: b.wings || [],
          openLeaksCount: 0,
          totalWastageLiters: 0,
          hotspotScore: b.hotspotScore || 0
        }));
      }

      const lDocs = await LeakReport.find().lean().catch(() => []);
      allLeaks = lDocs.map(formatReportDoc);
    } else {
      allLeaks = memoryStore.reports;
    }

    const updatedBuildings = baseBuildings.map(b => {
      const bLeaks = allLeaks.filter(r => r.buildingId === b.id || r.buildingId === b.code);
      const openCount = bLeaks.filter(r => r.status !== 'closed' && r.status !== 'resolved').length;
      const totalWater = bLeaks.reduce((acc, curr) => acc + (curr.waterLossLiters || 0), 0);
      const criticals = bLeaks.filter(r => r.severity === 'critical' && r.status !== 'resolved').length;
      const hotspotScore = Math.min(100, (openCount * 18) + (criticals * 35));
      return {
        ...b,
        openLeaksCount: openCount,
        totalWastageLiters: Math.round(totalWater),
        hotspotScore: hotspotScore || b.hotspotScore
      };
    });

    return res.json(updatedBuildings);
  } catch (err) {
    console.error('Error fetching buildings:', err);
    return res.json(memoryStore.buildings);
  }
}
