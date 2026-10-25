import React, { useState } from 'react';
import { 
  Droplet, 
  Bell, 
  Database, 
  Plus, 
  Shield, 
  Wrench, 
  User as UserIcon,
  LogOut,
  ChevronDown
} from 'lucide-react';

export const Navbar = ({
  currentUser,
  onLogout,
  onSwitchPortal,
  onOpenReportModal,
  onOpenBackendModal,
  notifications = [],
  onOpenNotifications,
  activeView
}) => {
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const unreadCount = notifications.filter(n => !n.isRead).length;

  const getBreadcrumb = () => {
    switch (activeView) {
      case 'dashboard': return currentUser?.role === 'resident' ? 'Resident Portal / My Complaints' : 'Dashboard / Campus Water Overview';
      case 'incidents': return 'Incidents / Live Leak Management';
      case 'hotspots': return 'Hotspot Map / Floor-Level Risk Matrix';
      case 'analytics': return 'Analytics / Water Wastage & MTTR';
      case 'maintenance': return 'Maintenance Desk / Dispatched Work Orders';
      case 'buildings': return 'Campus / Structural Riser Network';
      case 'admin': return 'Administration / Staff Provisioning & SLA';
      case 'backend': return 'MERN Backend / MongoDB Architecture';
      default: return 'Overview';
    }
  };

  const getRoleBadge = () => {
    switch (currentUser?.role) {
      case 'admin':
        return {
          label: 'Estate Officer',
          icon: Shield,
          color: 'bg-indigo-50 border-indigo-200 text-indigo-700'
        };
      case 'maintenance':
        return {
          label: currentUser?.specialty || 'Plumbing Specialist',
          icon: Wrench,
          color: 'bg-amber-50 border-amber-200 text-amber-800'
        };
      default:
        return {
          label: currentUser?.roomNumber ? `Resident (${currentUser.roomNumber})` : 'Resident',
          icon: UserIcon,
          color: 'bg-blue-50 border-blue-200 text-blue-700'
        };
    }
  };

  const badge = getRoleBadge();
  const RoleIcon = badge.icon;

  return (
    <header className="h-14 bg-white border-b border-slate-200 px-4 lg:px-6 flex items-center justify-between gap-4 sticky top-0 z-20">
      {/* Zone 1: Brand & View Indicator */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-sm shrink-0">
            <Droplet className="w-5 h-5 fill-white/20" />
          </div>
          <span className="font-bold text-slate-900 text-base tracking-tight whitespace-nowrap shrink-0">
            LeakLens
          </span>
        </div>

        <span className="text-slate-300 hidden md:inline">|</span>

        <span className="text-xs font-medium text-slate-500 truncate hidden sm:inline">
          {getBreadcrumb()}
        </span>
      </div>

      {/* Zone 2: System Specs & Authenticated User Profile */}
      <div className="flex items-center gap-2 md:gap-3 shrink-0">
        {/* Backend & DB Status Badge */}
        <button
          onClick={onOpenBackendModal}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors whitespace-nowrap cursor-pointer"
          title="Inspect Express REST API & MongoDB Mongoose Models"
        >
          <Database className="w-3.5 h-3.5 text-blue-600" />
          <span className="hidden lg:inline">Backend & DB</span>
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
        </button>

        {/* Authenticated User Profile Dropdown */}
        <div className="relative">
          <button 
            onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
            className={`flex items-center gap-2 px-2.5 py-1 text-xs font-medium border rounded-md transition-colors cursor-pointer ${badge.color}`}
          >
            <RoleIcon className="w-3.5 h-3.5 shrink-0" />
            <span className="font-semibold">{currentUser?.name || 'Resident User'}</span>
            <span className="hidden xl:inline text-slate-500 font-normal">({badge.label})</span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          {/* Profile Menu Popup */}
          {isProfileMenuOpen && (
            <div 
              className="absolute right-0 mt-1.5 w-64 bg-white border border-slate-200 rounded-xl shadow-xl py-2 z-30"
              onMouseLeave={() => setIsProfileMenuOpen(false)}
            >
              <div className="px-3.5 py-2 border-b border-slate-100">
                <p className="text-xs font-bold text-slate-900">{currentUser?.name}</p>
                <p className="text-[11px] text-slate-400 font-mono truncate">{currentUser?.email}</p>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                    currentUser?.role === 'admin' ? 'bg-indigo-100 text-indigo-800' :
                    currentUser?.role === 'maintenance' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                  }`}>
                    {currentUser?.role} portal
                  </span>
                  {currentUser?.roomNumber && (
                    <span className="text-[11px] text-slate-500">{currentUser.roomNumber}</span>
                  )}
                </div>
              </div>

              {/* Portal Switch Links */}
              <div className="px-3.5 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Switch Portal
              </div>

              <button
                onClick={() => { setIsProfileMenuOpen(false); onSwitchPortal('resident'); }}
                className="w-full text-left px-3.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center justify-between cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <UserIcon className="w-3.5 h-3.5 text-blue-600" />
                  <span>Resident Portal</span>
                </span>
                {currentUser?.role === 'resident' && <span className="text-[10px] font-semibold text-blue-600">Active</span>}
              </button>

              <button
                onClick={() => { setIsProfileMenuOpen(false); onSwitchPortal('maintenance'); }}
                className="w-full text-left px-3.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center justify-between cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <Wrench className="w-3.5 h-3.5 text-amber-600" />
                  <span>Maintenance Desk</span>
                </span>
                {currentUser?.role === 'maintenance' && <span className="text-[10px] font-semibold text-amber-600">Active</span>}
              </button>

              <button
                onClick={() => { setIsProfileMenuOpen(false); onSwitchPortal('admin'); }}
                className="w-full text-left px-3.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center justify-between cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <Shield className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Admin Console</span>
                </span>
                {currentUser?.role === 'admin' && <span className="text-[10px] font-semibold text-indigo-600">Active</span>}
              </button>

              <div className="border-t border-slate-100 my-1 pt-1">
                <button
                  onClick={() => { setIsProfileMenuOpen(false); onLogout(); }}
                  className="w-full text-left px-3.5 py-2 text-xs text-red-600 hover:bg-red-50 font-semibold flex items-center gap-2 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5 text-red-600" />
                  <span>Sign Out Session</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Notifications Icon Button */}
        <button
          onClick={onOpenNotifications}
          className="relative p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
          title="View Notifications & Escalations"
        >
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center font-mono">
              {unreadCount}
            </span>
          )}
        </button>

        {/* Zone 3: Primary Action (Report Leak) */}
        <button
          onClick={onOpenReportModal}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-sm transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Report Leak</span>
        </button>
      </div>
    </header>
  );
};

export default Navbar;
