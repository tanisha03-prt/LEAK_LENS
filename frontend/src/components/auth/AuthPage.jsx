import React, { useState, useEffect } from 'react';
import { 
  Droplet, 
  Shield, 
  Wrench, 
  User as UserIcon, 
  UserCheck, 
  Lock, 
  Mail, 
  Building as BuildingIcon, 
  Home, 
  Phone, 
  AlertCircle, 
  CheckCircle2, 
  Eye, 
  EyeOff, 
  ArrowRight,
  Waves
} from 'lucide-react';
import { apiClient } from '../../services/api.js';

export const AuthPage = ({
  onAuthSuccess,
  defaultPortal = 'resident'
}) => {
  const [activePortal, setActivePortal] = useState(defaultPortal);
  const [residentMode, setResidentMode] = useState('login');
  
  // Login fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Resident Signup fields
  const [name, setName] = useState('');
  const [buildingId, setBuildingId] = useState('');
  const [roomNumber, setRoomNumber] = useState('');
  const [phone, setPhone] = useState('');

  // States
  const [buildings, setBuildings] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Load buildings on mount for resident signup dropdown
  useEffect(() => {
    apiClient.getBuildings().then(list => {
      setBuildings(list || []);
      if (list && list.length > 0 && !buildingId) {
        setBuildingId(list[0].id);
      }
    });
  }, []);

  // Reset form when portal changes
  const handleSwitchPortal = (portal) => {
    setActivePortal(portal);
    setErrorMessage(null);
    setSuccessMessage(null);
    setEmail('');
    setPassword('');
  };

  // Helper for quick demo filling
  const handleFillDemo = (demoEmail, demoPass) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setErrorMessage(null);
  };

  // Submit Handler
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsLoading(true);

    try {
      if (activePortal === 'resident' && residentMode === 'signup') {
        if (!name.trim()) throw new Error('Please enter your full name.');
        if (!email.trim()) throw new Error('Please enter your email.');
        if (!password || password.length < 6) throw new Error('Password must be at least 6 characters.');
        if (!buildingId) throw new Error('Please select your campus building.');
        if (!roomNumber.trim()) throw new Error('Please enter your room number.');

        const res = await apiClient.registerResident({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password,
          buildingId,
          roomNumber: roomNumber.trim(),
          phone: phone.trim() || undefined
        });

        setSuccessMessage('Resident account created successfully! Entering portal...');
        setTimeout(() => {
          onAuthSuccess(res.user);
        }, 600);
      } else {
        // Login flow
        if (!email.trim() || !password) {
          throw new Error('Please provide both email and password.');
        }

        const res = await apiClient.login({
          email: email.trim().toLowerCase(),
          password,
          portal: activePortal
        });

        setSuccessMessage(`Welcome back, ${res.user.name}!`);
        setTimeout(() => {
          onAuthSuccess(res.user);
        }, 500);
      }
    } catch (err) {
      setErrorMessage(err.message || 'Authentication failed. Please check your entries.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#071324] text-slate-100 flex flex-col justify-center items-center p-4 sm:p-6 relative overflow-hidden">
      {/* Background hydraulic glow */}
      <div className="absolute top-0 -left-40 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 -right-40 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-xl z-10 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center gap-2.5 px-4 py-1.5 rounded-full bg-blue-900/40 border border-blue-500/30 text-blue-300 text-xs font-semibold mb-2 shadow-inner">
            <Waves className="w-4 h-4 text-blue-400" />
            <span>Campus Hydraulic Guard & Water Intelligence</span>
          </div>

          <div className="flex items-center justify-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
              <Droplet className="w-6 h-6 fill-white/20" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white font-sans">
              LeakLens OS
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto">
            Real-time leakage mitigation, hydraulic riser diagnostics, and role-based maintenance dispatch.
          </p>
        </div>

        {/* Portal Selector Navigation */}
        <div className="bg-[#0B1F3A] p-1.5 rounded-xl border border-[#1E3A5F] shadow-lg grid grid-cols-3 gap-1">
          {/* 1. Resident Portal Tab */}
          <button
            type="button"
            onClick={() => handleSwitchPortal('resident')}
            className={`flex items-center justify-center gap-2 py-2.5 px-2 rounded-lg text-xs font-semibold transition-all ${
              activePortal === 'resident'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <UserIcon className="w-4 h-4 shrink-0" />
            <span className="truncate">Resident Portal</span>
          </button>

          {/* 2. Maintenance Portal Tab */}
          <button
            type="button"
            onClick={() => handleSwitchPortal('maintenance')}
            className={`flex items-center justify-center gap-2 py-2.5 px-2 rounded-lg text-xs font-semibold transition-all ${
              activePortal === 'maintenance'
                ? 'bg-amber-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Wrench className="w-4 h-4 shrink-0" />
            <span className="truncate">Maintenance</span>
          </button>

          {/* 3. Admin Portal Tab */}
          <button
            type="button"
            onClick={() => handleSwitchPortal('admin')}
            className={`flex items-center justify-center gap-2 py-2.5 px-2 rounded-lg text-xs font-semibold transition-all ${
              activePortal === 'admin'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Shield className="w-4 h-4 shrink-0" />
            <span className="truncate">Admin Portal</span>
          </button>
        </div>

        {/* Form Card */}
        <div className="bg-[#0E2442] rounded-2xl border border-[#1E3A5F] shadow-2xl p-6 sm:p-8 space-y-6">
          {/* Portal Context Banner */}
          <div className="flex items-start justify-between border-b border-[#1A3860] pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${
                  activePortal === 'resident' ? 'bg-blue-500' :
                  activePortal === 'maintenance' ? 'bg-amber-500' : 'bg-indigo-500'
                }`} />
                <h2 className="text-base font-bold text-white tracking-tight">
                  {activePortal === 'resident' && (residentMode === 'signup' ? 'Create Resident Account' : 'Resident Sign In')}
                  {activePortal === 'maintenance' && 'Maintenance Technician Gateway'}
                  {activePortal === 'admin' && 'Campus Estate Officer Portal'}
                </h2>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {activePortal === 'resident' && 'Register or sign in to submit leak complaints and track riser status.'}
                {activePortal === 'maintenance' && 'Access assigned work orders, update repair notes, and file evidence.'}
                {activePortal === 'admin' && 'Estate operations console for dispatching, user provisioning, and analytics.'}
              </p>
            </div>

            {/* Resident Sign In / Sign Up toggle */}
            {activePortal === 'resident' && (
              <div className="flex bg-[#0A1A2F] p-1 rounded-lg border border-[#1B3658] text-[11px] shrink-0">
                <button
                  type="button"
                  onClick={() => { setResidentMode('login'); setErrorMessage(null); }}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                    residentMode === 'login' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => { setResidentMode('signup'); setErrorMessage(null); }}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                    residentMode === 'signup' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Sign Up
                </button>
              </div>
            )}
          </div>

          {/* Alerts */}
          {errorMessage && (
            <div className="p-3 bg-red-950/60 border border-red-500/50 rounded-lg text-xs text-red-200 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1">{errorMessage}</div>
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-emerald-950/60 border border-emerald-500/50 rounded-lg text-xs text-emerald-200 flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="flex-1">{successMessage}</div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* SIGNUP EXTRA FIELDS */}
            {activePortal === 'resident' && residentMode === 'signup' && (
              <>
                {/* Full Name */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Full Legal Name *
                  </label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="e.g. Aditi Sharma"
                      className="w-full text-xs pl-9 pr-3 py-2.5 bg-[#09182C] border border-[#1A3860] rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Building and Room Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Campus Hostel / Building *
                    </label>
                    <div className="relative">
                      <BuildingIcon className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                      <select
                        value={buildingId}
                        onChange={e => setBuildingId(e.target.value)}
                        className="w-full text-xs pl-9 pr-3 py-2.5 bg-[#09182C] border border-[#1A3860] rounded-lg text-white focus:outline-none focus:border-blue-500"
                      >
                        {buildings.map(b => (
                          <option key={b.id} value={b.id}>
                            {b.name} ({b.code})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Room / Apartment Number *
                    </label>
                    <div className="relative">
                      <Home className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                      <input
                        type="text"
                        required
                        value={roomNumber}
                        onChange={e => setRoomNumber(e.target.value)}
                        placeholder="e.g. Room B-312"
                        className="w-full text-xs pl-9 pr-3 py-2.5 bg-[#09182C] border border-[#1A3860] rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Contact Phone (For Maintenance Callback)
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      placeholder="e.g. +91 98765 43210"
                      className="w-full text-xs pl-9 pr-3 py-2.5 bg-[#09182C] border border-[#1A3860] rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Email Address */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                {activePortal === 'resident' ? 'Resident Email Address *' : 
                 activePortal === 'maintenance' ? 'Authorized Technician Email *' : 'Administrator Email *'}
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder={
                    activePortal === 'resident' ? 'resident.arjun@leaklens.internal' :
                    activePortal === 'maintenance' ? 'tech.rajesh@leaklens.internal' : 'admin@leaklens.internal'
                  }
                  className="w-full text-xs pl-9 pr-3 py-2.5 bg-[#09182C] border border-[#1A3860] rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-300">
                  Password *
                </label>
                {activePortal === 'resident' && residentMode === 'signup' && (
                  <span className="text-[11px] text-slate-400">Minimum 6 characters</span>
                )}
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter secure password"
                  className="w-full text-xs pl-9 pr-10 py-2.5 bg-[#09182C] border border-[#1A3860] rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Notice for Maintenance & Admin portals */}
            {activePortal === 'maintenance' && (
              <div className="p-3 bg-amber-950/40 border border-amber-600/30 rounded-lg text-[11px] text-amber-200/90 leading-relaxed">
                <strong>Campus Security Notice:</strong> Public technician signup is strictly disabled. Maintenance accounts must be provisioned or approved by the Estate Administration Console.
              </div>
            )}

            {activePortal === 'admin' && (
              <div className="p-3 bg-indigo-950/40 border border-indigo-600/30 rounded-lg text-[11px] text-indigo-200/90 leading-relaxed">
                <strong>Restricted Gateway:</strong> Access restricted to authorized estate officers, hydraulic engineers, and campus directors. All access attempts are recorded in the immutable audit log.
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className={`w-full py-2.5 px-4 rounded-lg text-xs font-bold text-white shadow-md transition-all flex items-center justify-center gap-2 ${
                activePortal === 'resident'
                  ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/25'
                  : activePortal === 'maintenance'
                  ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-500/25'
                  : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/25'
              } disabled:opacity-50`}
            >
              {isLoading ? (
                <span>Authenticating with Server...</span>
              ) : (
                <>
                  <span>
                    {activePortal === 'resident' && (residentMode === 'signup' ? 'Create Resident Account' : 'Sign In to Resident Dashboard')}
                    {activePortal === 'maintenance' && 'Enter Maintenance Work Desk'}
                    {activePortal === 'admin' && 'Unlock Admin Console'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Credential Helper Chips */}
          <div className="pt-4 border-t border-[#1A3860] space-y-2">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span className="font-semibold text-slate-300">Quick Testing Credentials:</span>
              <span className="text-[10px] text-blue-300">Click chip to populate</span>
            </div>

            <div className="flex flex-wrap gap-2">
              {activePortal === 'resident' && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setResidentMode('login');
                      handleFillDemo('resident.arjun@leaklens.internal', 'Resident@LeakLens2026!');
                    }}
                    className="px-2.5 py-1.5 rounded-md bg-[#0A1A2F] border border-blue-500/40 text-blue-200 text-[11px] hover:bg-blue-900/30 transition-colors flex items-center gap-1.5"
                  >
                    <UserCheck className="w-3.5 h-3.5 text-blue-400" />
                    <span>Arjun Mehta (Room B-312)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setResidentMode('login');
                      handleFillDemo('aditi.sharma@campus.edu', 'Resident@LeakLens2026!');
                    }}
                    className="px-2.5 py-1.5 rounded-md bg-[#0A1A2F] border border-blue-500/40 text-blue-200 text-[11px] hover:bg-blue-900/30 transition-colors flex items-center gap-1.5"
                  >
                    <UserCheck className="w-3.5 h-3.5 text-blue-400" />
                    <span>Aditi Sharma (Room B-312)</span>
                  </button>
                </>
              )}

              {activePortal === 'maintenance' && (
                <>
                  <button
                    type="button"
                    onClick={() => handleFillDemo('tech.rajesh@leaklens.internal', 'Tech@LeakLens2026!')}
                    className="px-2.5 py-1.5 rounded-md bg-[#0A1A2F] border border-amber-500/40 text-amber-200 text-[11px] hover:bg-amber-900/30 transition-colors flex items-center gap-1.5"
                  >
                    <Wrench className="w-3.5 h-3.5 text-amber-400" />
                    <span>Rajesh Kumar (Senior Plumber)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleFillDemo('amit.d@facility.campus.edu', 'Tech@LeakLens2026!')}
                    className="px-2.5 py-1.5 rounded-md bg-[#0A1A2F] border border-amber-500/40 text-amber-200 text-[11px] hover:bg-amber-900/30 transition-colors flex items-center gap-1.5"
                  >
                    <Wrench className="w-3.5 h-3.5 text-amber-400" />
                    <span>Amit Deshmukh (Civil Maintenance)</span>
                  </button>
                </>
              )}

              {activePortal === 'admin' && (
                <>
                  <button
                    type="button"
                    onClick={() => handleFillDemo('admin@leaklens.internal', 'Admin@LeakLens2026!')}
                    className="px-2.5 py-1.5 rounded-md bg-[#0A1A2F] border border-indigo-500/40 text-indigo-200 text-[11px] hover:bg-indigo-900/30 transition-colors flex items-center gap-1.5"
                  >
                    <Shield className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Estate General Manager</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleFillDemo('estate.officer@campus.edu', 'Admin@LeakLens2026!')}
                    className="px-2.5 py-1.5 rounded-md bg-[#0A1A2F] border border-indigo-500/40 text-indigo-200 text-[11px] hover:bg-indigo-900/30 transition-colors flex items-center gap-1.5"
                  >
                    <Shield className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Vikram Malhotra (Estate Officer)</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* System security footnote */}
        <div className="text-center text-[11px] text-slate-500 space-y-1">
          <p>
            LeakLens Enterprise Architecture • Powered by Express, Mongoose & JWT RBAC
          </p>
          <p className="text-slate-600">
            Passwords hashed with bcrypt (rounds=10) • Zero plaintext storage • Encrypted session tokens
          </p>
        </div>
      </div>
    </div>
  );
};
