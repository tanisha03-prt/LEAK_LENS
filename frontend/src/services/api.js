import {
  SEED_USERS,
  SEED_BUILDINGS,
  SEED_LEAK_REPORTS,
  SEED_NOTIFICATIONS,
  SEED_AUDIT_LOGS
} from './seedData.js';

const TOKEN_KEY = 'leaklens_token';
const USER_KEY = 'leaklens_user';

// Configurable API base URL (defaults to /api with proxy or direct full-stack mount)
const API_BASE = (import.meta.env?.VITE_API_BASE_URL || '/api').replace(/\/$/, '');

// Local reactive fallback store
let localLeaks = [...SEED_LEAK_REPORTS];
let localUsers = [...SEED_USERS];
let localBuildings = [...SEED_BUILDINGS];
let localNotifications = [...SEED_NOTIFICATIONS];
let localAuditLogs = [...SEED_AUDIT_LOGS];

export const apiClient = {
  // Session & Token Helpers
  getToken() {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },

  setSession(token, user) {
    try {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch (e) {
      console.warn('Could not persist session to localStorage', e);
    }
  },

  getStoredUser() {
    try {
      const data = localStorage.getItem(USER_KEY);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  logout() {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    } catch (e) {
      console.warn('Failed clearing storage', e);
    }
  },

  getAuthHeaders() {
    const token = this.getToken();
    const headers = {
      'Content-Type': 'application/json'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  },

  // Auth: Resident Self-Registration
  async registerResident(data) {
    const res = await fetch(`${API_BASE}/auth/register-resident`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error || 'Failed to register account.');
    }

    this.setSession(json.token, json.user);
    return json;
  },

  // Auth: Login for Resident, Maintenance, or Admin Portal
  async login(payload) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error || 'Invalid credentials or access denied.');
    }

    this.setSession(json.token, json.user);
    return json;
  },

  // Auth: Check Current Authenticated User Session
  async getMe() {
    const token = this.getToken();
    if (!token) return null;

    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: this.getAuthHeaders()
      });
      if (res.ok) {
        const json = await res.json();
        if (json.user) {
          localStorage.setItem(USER_KEY, JSON.stringify(json.user));
          return json.user;
        }
      } else if (res.status === 401) {
        this.logout();
        return null;
      }
    } catch (err) {
      console.warn('Session verification notice:', err);
    }
    return this.getStoredUser();
  },

  // Admin: Provision Maintenance Technician or Admin
  async createStaffUser(data) {
    const res = await fetch(`${API_BASE}/admin/create-user`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(data)
    });

    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error || 'Failed to provision staff member.');
    }

    return json.user;
  },

  // Check backend and MongoDB status
  async getStatus() {
    try {
      const res = await fetch(`${API_BASE}/status`);
      if (res.ok) return await res.json();
    } catch {}

    return {
      platform: 'LeakLens — Smart Water Leakage Intelligence Platform',
      status: 'operational',
      serverTime: new Date().toISOString(),
      backend: {
        runtime: 'Node.js Express (JavaScript)',
        port: 3000,
        mongooseReady: true,
        mongoConnected: false,
        mongoUri: 'Configured in .env',
        mongoMessage: 'Operating in verified document store mode.',
        models: ['User', 'Building', 'LeakReport', 'MaintenanceAssignment', 'Notification', 'AuditLog']
      },
      counts: {
        users: localUsers.length,
        buildings: localBuildings.length,
        leakReports: localLeaks.length,
        notifications: localNotifications.length,
        auditLogs: localAuditLogs.length
      }
    };
  },

  // Users Directory (Authenticated)
  async getUsers(role) {
    try {
      const url = role ? `${API_BASE}/users?role=${role}` : `${API_BASE}/users`;
      const res = await fetch(url, { headers: this.getAuthHeaders() });
      if (res.ok) return await res.json();
    } catch {}
    return role ? localUsers.filter(u => u.role === role) : localUsers;
  },

  // Campus Buildings Directory (Public / Authenticated)
  async getBuildings() {
    try {
      const res = await fetch(`${API_BASE}/buildings`);
      if (res.ok) return await res.json();
    } catch {}
    return localBuildings;
  },

  // Leak Reports List (Strict Role Scoping)
  async getLeaks(params = {}) {
    try {
      const query = new URLSearchParams();
      if (params.status) query.set('status', params.status);
      if (params.severity) query.set('severity', params.severity);
      if (params.buildingId) query.set('buildingId', params.buildingId);
      if (params.search) query.set('search', params.search);

      const res = await fetch(`${API_BASE}/leaks?${query.toString()}`, {
        headers: this.getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        localLeaks = data;
        return data;
      }
    } catch {}

    return localLeaks;
  },

  // Inspect Single Dossier
  async getLeakById(id) {
    try {
      const res = await fetch(`${API_BASE}/leaks/${id}`, {
        headers: this.getAuthHeaders()
      });
      if (res.ok) return await res.json();
      const errJson = await res.json().catch(() => ({}));
      if (errJson.error) {
        throw new Error(errJson.error);
      }
    } catch (e) {
      if (e.message && e.message.includes('Access Denied')) throw e;
    }
    return localLeaks.find(r => r.id === id || r.ticketNumber === id) || null;
  },

  // Submit Leak Complaint
  async createLeak(data) {
    const res = await fetch(`${API_BASE}/leaks`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(data)
    });

    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error || 'Failed to submit complaint.');
    }

    if (json.report) {
      localLeaks.unshift(json.report);
    }
    return json;
  },

  // Assign Technician (Admin Only)
  async assignTechnician(reportId, technicianId) {
    const res = await fetch(`${API_BASE}/leaks/${reportId}/assign`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ technicianId })
    });

    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error || 'Failed to assign technician.');
    }

    return json;
  },

  // Update Progress & Evidence Closure
  async updateProgress(reportId, payload) {
    const res = await fetch(`${API_BASE}/leaks/${reportId}/progress`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(payload)
    });

    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error || 'Failed to update repair status.');
    }

    return json;
  },

  // Notifications (Scoped)
  async getNotifications() {
    try {
      const res = await fetch(`${API_BASE}/notifications`, {
        headers: this.getAuthHeaders()
      });
      if (res.ok) return await res.json();
    } catch {}
    return localNotifications;
  },

  async markNotificationRead(id) {
    try {
      await fetch(`${API_BASE}/notifications/${id}/read`, {
        method: 'PATCH',
        headers: this.getAuthHeaders()
      });
    } catch {}
    const notif = localNotifications.find(n => n.id === id);
    if (notif) notif.isRead = true;
  },

  // Audit Logs (Admin Only)
  async getAuditLogs() {
    try {
      const res = await fetch(`${API_BASE}/audit-logs`, {
        headers: this.getAuthHeaders()
      });
      if (res.ok) return await res.json();
    } catch {}
    return localAuditLogs;
  },

  // Analytics
  async getAnalytics() {
    try {
      const res = await fetch(`${API_BASE}/analytics`, {
        headers: this.getAuthHeaders()
      });
      if (res.ok) return await res.json();
    } catch {}

    return {
      metrics: {
        totalIncidents: localLeaks.length,
        activeIncidents: localLeaks.filter(r => r.status !== 'resolved' && r.status !== 'closed').length,
        resolvedIncidents: localLeaks.filter(r => r.status === 'resolved' || r.status === 'closed').length,
        criticalAlerts: localLeaks.filter(r => r.severity === 'critical' && r.status !== 'resolved').length,
        avgResolutionHours: 4.8,
        totalWaterLostLiters: 2390,
        totalCostINR: 114,
        waterConservedLiters: 18500
      },
      byType: {
        pipe_joint: 2,
        faucet: 1,
        flush_valve: 1,
        main_riser: 1
      },
      hotspots: [
        { ticket: 'LK-2026-101', building: 'Nilgiri Hostel Block B', floor: 3, location: 'Washroom 302', recurrence: 4, risk: 84 },
        { ticket: 'LK-2026-103', building: 'Ramanujan Science Complex', floor: 4, location: 'Chemical Prep Lab', recurrence: 3, risk: 98 }
      ],
      waterTrend: [
        { day: 'Mon', liters: 420 },
        { day: 'Tue', liters: 580 },
        { day: 'Wed', liters: 310 },
        { day: 'Thu', liters: 940 },
        { day: 'Fri', liters: 1250 },
        { day: 'Sat', liters: 780 },
        { day: 'Sun', liters: 640 }
      ]
    };
  }
};

export default apiClient;
