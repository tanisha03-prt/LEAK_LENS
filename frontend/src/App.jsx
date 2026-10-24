import React, { useState, useEffect } from 'react';
import { Navbar } from './components/layout/Navbar.jsx';
import { Sidebar } from './components/layout/Sidebar.jsx';
import { OverviewDashboard } from './components/dashboard/OverviewDashboard.jsx';
import { IncidentTable } from './components/incidents/IncidentTable.jsx';
import { IncidentDetailModal } from './components/incidents/IncidentDetailModal.jsx';
import { ReportLeakModal } from './components/reports/ReportLeakModal.jsx';
import { HotspotMapView } from './components/hotspots/HotspotMapView.jsx';
import { AnalyticsView } from './components/analytics/AnalyticsView.jsx';
import { MaintenanceDesk } from './components/maintenance/MaintenanceDesk.jsx';
import { AdminConsole } from './components/admin/AdminConsole.jsx';
import { BackendStatusModal } from './components/backend/BackendStatusModal.jsx';
import { NotificationsDrawer } from './components/notifications/NotificationsDrawer.jsx';
import { AuthPage } from './components/auth/AuthPage.jsx';

import { apiClient } from './services/api.js';
import { 
  SEED_USERS, 
  SEED_BUILDINGS, 
  SEED_LEAK_REPORTS, 
  SEED_NOTIFICATIONS, 
  SEED_AUDIT_LOGS 
} from './services/seedData.js';

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => apiClient.getStoredUser());
  const [isInitializingAuth, setIsInitializingAuth] = useState(true);
  const [selectedPortalForLogin, setSelectedPortalForLogin] = useState('resident');

  const [users, setUsers] = useState(SEED_USERS);
  const [buildings, setBuildings] = useState(SEED_BUILDINGS);
  const [reports, setReports] = useState(SEED_LEAK_REPORTS);
  const [notifications, setNotifications] = useState(SEED_NOTIFICATIONS);
  const [auditLogs, setAuditLogs] = useState(SEED_AUDIT_LOGS);

  const [activeView, setActiveView] = useState('dashboard');
  const [selectedReport, setSelectedReport] = useState(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isBackendModalOpen, setIsBackendModalOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  // Load live data from Express REST API using authenticated token
  const refreshData = async () => {
    try {
      const [bData, rData, nData] = await Promise.all([
        apiClient.getBuildings(),
        apiClient.getLeaks(),
        apiClient.getNotifications()
      ]);
      if (bData) setBuildings(bData);
      if (rData) setReports(rData);
      if (nData) setNotifications(nData);

      // Admin or staff endpoints
      if (currentUser?.role === 'admin') {
        const [aData, uData] = await Promise.all([
          apiClient.getAuditLogs(),
          apiClient.getUsers()
        ]);
        if (aData) setAuditLogs(aData);
        if (uData) setUsers(uData);
      } else if (currentUser?.role === 'maintenance') {
        const uData = await apiClient.getUsers('maintenance');
        if (uData) setUsers(uData);
      }
    } catch (err) {
      console.warn('Backend API connection notice, using synchronized local store.', err);
    }
  };

  // Initial session verification
  useEffect(() => {
    const verifyInitialSession = async () => {
      try {
        const user = await apiClient.getMe();
        if (user) {
          setCurrentUser(user);
          if (user.role === 'maintenance') {
            setActiveView('maintenance');
          }
        } else {
          setCurrentUser(null);
        }
      } catch (err) {
        console.warn('Session verification notice:', err);
      } finally {
        setIsInitializingAuth(false);
      }
    };

    verifyInitialSession();
  }, []);

  // Whenever user changes or logs in, refresh data
  useEffect(() => {
    if (currentUser) {
      refreshData();
    }
  }, [currentUser?.id, currentUser?.role]);

  // Logout handler
  const handleLogout = () => {
    apiClient.logout();
    setCurrentUser(null);
    setSelectedPortalForLogin('resident');
    setActiveView('dashboard');
    setSelectedReport(null);
  };

  // Switch Portal handler
  const handleSwitchPortal = (portal) => {
    apiClient.logout();
    setCurrentUser(null);
    setSelectedPortalForLogin(portal);
    setSelectedReport(null);
  };

  // Handle successful login or registration
  const handleAuthSuccess = (user) => {
    setCurrentUser(user);
    if (user.role === 'maintenance') {
      setActiveView('maintenance');
    } else {
      setActiveView('dashboard');
    }
  };

  // Submit new report
  const handleSubmitReport = async (data) => {
    const res = await apiClient.createLeak(data);
    if (res && res.report) {
      setReports(prev => [res.report, ...prev]);
      refreshData();
    }
    return res;
  };

  // Assign technician (Admin Only)
  const handleAssignTechnician = async (reportId, technicianId) => {
    const updated = await apiClient.assignTechnician(reportId, technicianId);
    if (updated) {
      setReports(prev => prev.map(r => r.id === updated.id ? updated : r));
      setSelectedReport(updated);
      refreshData();
    }
  };

  // Update progress & evidence closure (Maintenance or Admin)
  const handleUpdateProgress = async (reportId, payload) => {
    const updated = await apiClient.updateProgress(reportId, payload);
    if (updated) {
      setReports(prev => prev.map(r => r.id === updated.id ? updated : r));
      setSelectedReport(updated);
      refreshData();
    }
  };

  const handleMarkNotificationRead = async (id) => {
    await apiClient.markNotificationRead(id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
  };

  // If initial auth check is ongoing
  if (isInitializingAuth) {
    return (
      <div className="min-h-screen bg-[#071324] flex items-center justify-center text-white font-sans">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium text-slate-300">
            Initializing LeakLens secure hydraulic session...
          </span>
        </div>
      </div>
    );
  }

  // If user is not authenticated, render AuthPage
  if (!currentUser) {
    return (
      <AuthPage
        defaultPortal={selectedPortalForLogin}
        onAuthSuccess={handleAuthSuccess}
      />
    );
  }

  const activeLeaksCount = reports.filter(r => r.status !== 'resolved' && r.status !== 'closed').length;
  const criticalCount = reports.filter(r => r.severity === 'critical' && r.status !== 'resolved').length;
  const technicians = users.filter(u => u.role === 'maintenance');

  // Enforce role-based view restrictions
  let effectiveView = activeView;
  if (currentUser.role === 'resident' && (activeView === 'admin' || activeView === 'maintenance')) {
    effectiveView = 'dashboard';
  } else if (currentUser.role === 'maintenance' && activeView === 'admin') {
    effectiveView = 'maintenance';
  }

  return (
    <div className="flex h-screen bg-[#F8FAFC] text-slate-900 overflow-hidden font-sans">
      {/* Dark Navy Sidebar */}
      <Sidebar
        currentRole={currentUser.role}
        activeView={effectiveView}
        onSelectView={setActiveView}
        activeLeaksCount={activeLeaksCount}
        criticalCount={criticalCount}
        onLogout={handleLogout}
      />

      {/* Main Content Workspace */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Bar Header */}
        <Navbar
          currentUser={currentUser}
          onLogout={handleLogout}
          onSwitchPortal={handleSwitchPortal}
          onOpenReportModal={() => setIsReportModalOpen(true)}
          onOpenBackendModal={() => setIsBackendModalOpen(true)}
          notifications={notifications}
          onOpenNotifications={() => setIsNotificationsOpen(true)}
          activeView={effectiveView}
        />

        {/* Scrollable Viewport */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {effectiveView === 'dashboard' && (
            <OverviewDashboard
              reports={reports}
              buildings={buildings}
              currentUser={currentUser}
              onOpenReport={setSelectedReport}
              onOpenNewReportModal={() => setIsReportModalOpen(true)}
              onNavigateToHotspots={() => setActiveView('hotspots')}
              onNavigateToIncidents={() => setActiveView('incidents')}
            />
          )}

          {effectiveView === 'incidents' && (
            <IncidentTable
              reports={reports}
              buildings={buildings}
              currentRole={currentUser.role}
              onOpenReport={setSelectedReport}
              onOpenNewReport={() => setIsReportModalOpen(true)}
            />
          )}

          {effectiveView === 'hotspots' && (
            <HotspotMapView
              buildings={buildings}
              reports={reports}
              onOpenReport={setSelectedReport}
            />
          )}

          {effectiveView === 'analytics' && (
            <AnalyticsView
              reports={reports}
              buildings={buildings}
            />
          )}

          {effectiveView === 'maintenance' && (
            <MaintenanceDesk
              reports={reports}
              currentUser={currentUser}
              onOpenReport={setSelectedReport}
              onUpdateProgress={handleUpdateProgress}
            />
          )}

          {effectiveView === 'buildings' && (
            <HotspotMapView
              buildings={buildings}
              reports={reports}
              onOpenReport={setSelectedReport}
            />
          )}

          {effectiveView === 'admin' && (
            <AdminConsole
              users={users}
              buildings={buildings}
              reports={reports}
              auditLogs={auditLogs}
              onRefreshUsers={refreshData}
            />
          )}

          {effectiveView === 'backend' && (
            <div className="max-w-4xl mx-auto space-y-4">
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
                <h2 className="text-base font-bold text-slate-900 mb-2">
                  LeakLens MERN Stack Backend & Database Specification
                </h2>
                <p className="text-xs text-slate-600 mb-4">
                  Full Express.js REST API is active with comprehensive Mongoose data models, field validation, and compound indexes.
                </p>
                <button
                  onClick={() => setIsBackendModalOpen(true)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-md transition-colors shadow-xs"
                >
                  Launch Full Architecture & Mongoose Models Inspector
                </button>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Modals & Overlays */}
      <ReportLeakModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        buildings={buildings}
        existingReports={reports}
        currentUser={currentUser}
        onSubmitReport={handleSubmitReport}
      />

      <IncidentDetailModal
        report={selectedReport}
        onClose={() => setSelectedReport(null)}
        currentUser={currentUser}
        onAssignTechnician={handleAssignTechnician}
        onUpdateProgress={handleUpdateProgress}
        technicians={technicians}
      />

      <BackendStatusModal
        isOpen={isBackendModalOpen}
        onClose={() => setIsBackendModalOpen(false)}
      />

      <NotificationsDrawer
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        notifications={notifications}
        onMarkRead={handleMarkNotificationRead}
        onSelectTicket={(ticketId) => {
          const match = reports.find(r => r.id === ticketId || r.ticketNumber === ticketId);
          if (match) {
            setSelectedReport(match);
            setIsNotificationsOpen(false);
          }
        }}
      />
    </div>
  );
}
