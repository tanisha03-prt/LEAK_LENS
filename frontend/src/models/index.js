/**
 * Frontend Client-Side Model Descriptors & Enums (JavaScript)
 */

export const USER_ROLES = ['resident', 'maintenance', 'admin'];

export const LEAK_SEVERITIES = ['minor', 'moderate', 'severe', 'critical'];

export const LEAK_TYPES = [
  'pipe_joint',
  'burst_pipe',
  'faucet_fixture',
  'flush_tank',
  'drain_overflow',
  'ceiling_seepage',
  'main_riser',
  'valve_failure'
];

export const INCIDENT_STATUSES = [
  'reported',
  'acknowledged',
  'assigned',
  'in_progress',
  'resolved',
  'closed'
];

export const BUILDING_TYPES = ['hostel', 'academic', 'mess', 'sports', 'admin', 'faculty'];
