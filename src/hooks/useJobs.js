// ─── useJobs — Load jobs from backend and provide CRUD ──────────────────────
import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api.js';

// Backend JobStatus → Frontend status
const STATUS_MAP = {
  DRAFT: 'Unassigned',
  PENDING: 'Unassigned',
  ACTIVE: 'Assigned',
  IN_PROGRESS: 'Assigned',
  COMPLETED: 'Pending Redlines',
  ON_HOLD: 'Under Client Review',
  CANCELLED: 'Rejected',
};

// Frontend status → Backend JobStatus (for writes)
const STATUS_REVERSE = {
  'Unassigned': 'DRAFT',
  'Assigned': 'ACTIVE',
  'Pending Redlines': 'COMPLETED',
  'Under Client Review': 'ON_HOLD',
  'Ready to Invoice': 'ON_HOLD',
  'Rejected': 'CANCELLED',
  'Billed': 'COMPLETED',
};

/**
 * Map a backend Job object → frontend job shape.
 * Fields that don't exist on backend stay with sensible defaults
 * so the rest of the UI doesn't break.
 */
function mapBackendJob(bj) {
  return {
    // identifiers
    id: bj.id,
    code: bj.code || '',
    jobNumber: bj.name || bj.code || bj.id,

    // classification
    department: 'aerial', // backend doesn't track yet
    subcontractor: 'NextGen Fiber',
    client: bj.project?.clientName || bj.project?.name || 'MasTec',
    customer: bj.project?.name || '',
    region: bj.state || '',
    location: bj.city ? `${bj.city}, ${bj.state || ''}`.trim() : '',
    olt: '',
    feederId: bj.code || '',
    workType: '',
    estimatedFootage: 0,
    poleCount: 0,

    // dates
    scheduledDate: bj.startDate ? bj.startDate.split('T')[0] : '',
    createdAt: bj.createdAt,
    updatedAt: bj.updatedAt,

    // assignment (not tracked on backend yet)
    assignedLineman: null,
    assignedTruck: null,
    truckInvestor: null,
    assignedDrill: null,
    drillInvestor: null,

    // status
    status: STATUS_MAP[bj.status] || 'Unassigned',
    redlineStatus: 'Not Uploaded',
    srNumber: null,

    // production (not on backend yet — built from productionEntries if any)
    production: null,
    confirmedTotals: null,
    billedAt: null,

    // other
    supervisorNotes: bj.description || '',
    redlines: [],
    reviewNotes: '',
    messages: [],
    auditLog: [],
    documents: [],
    mapPdf: null,
    routePoles: null,

    // coordinates
    latitude: bj.latitude ? Number(bj.latitude) : null,
    longitude: bj.longitude ? Number(bj.longitude) : null,

    // link to project
    projectId: bj.projectId,
    _backend: bj, // keep raw backend data for writes
  };
}

/**
 * Map frontend job data → backend DTO for create/update.
 */
function toBackendDto(frontendJob) {
  const dto = {};
  if (frontendJob.jobNumber != null || frontendJob.name != null)
    dto.name = frontendJob.jobNumber || frontendJob.name || '';
  if (frontendJob.code != null) dto.code = frontendJob.code;
  if (frontendJob.supervisorNotes != null || frontendJob.description != null)
    dto.description = frontendJob.supervisorNotes || frontendJob.description || '';
  if (frontendJob.location != null) {
    // try to split "City, ST" into city/state
    const parts = (frontendJob.location || '').split(',').map(s => s.trim());
    if (parts[0]) dto.city = parts[0];
    if (parts[1]) dto.state = parts[1];
  }
  if (frontendJob.region != null && !dto.state) dto.state = frontendJob.region;
  if (frontendJob.scheduledDate != null) dto.startDate = frontendJob.scheduledDate;
  if (frontendJob.latitude != null) dto.latitude = frontendJob.latitude;
  if (frontendJob.longitude != null) dto.longitude = frontendJob.longitude;
  if (frontendJob.projectId != null) dto.projectId = frontendJob.projectId;
  if (frontendJob.status != null && STATUS_REVERSE[frontendJob.status]) {
    dto.status = STATUS_REVERSE[frontendJob.status];
  }
  return dto;
}

export default function useJobs() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const loadedRef = useRef(false);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getJobs({ limit: 200 });
      const mapped = (res.data || []).map(mapBackendJob);
      setJobs(mapped);
      loadedRef.current = true;
    } catch (err) {
      console.error('[useJobs] fetch failed:', err);
      setError(err.message || 'Failed to load jobs');
    } finally {
      setLoading(false);
    }
  }, []);

  // Load on mount
  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const createJob = useCallback(async (frontendData) => {
    const dto = toBackendDto(frontendData);
    const created = await api.createJob(dto);
    const mapped = mapBackendJob(created);
    // Merge any extra frontend-only fields the caller passed
    const merged = { ...mapped, ...frontendData, id: mapped.id, _backend: created };
    setJobs(prev => [merged, ...prev]);
    return merged;
  }, []);

  const updateJob = useCallback(async (id, frontendData) => {
    const dto = toBackendDto(frontendData);
    // Only send if there are backend-relevant fields
    if (Object.keys(dto).length > 0) {
      try {
        await api.updateJob(id, dto);
      } catch (err) {
        console.error('[useJobs] API update failed, updating locally:', err);
      }
    }
    // Always update local state (many frontend fields aren't on backend)
    setJobs(prev => prev.map(j =>
      j.id === id ? { ...j, ...frontendData, updatedAt: new Date().toISOString() } : j
    ));
  }, []);

  const deleteJob = useCallback(async (id) => {
    try {
      await api.deleteJob(id);
    } catch (err) {
      console.error('[useJobs] API delete failed:', err);
    }
    setJobs(prev => prev.filter(j => j.id !== id));
  }, []);

  return {
    jobs,
    setJobs, // expose raw setter for complex local updates (batch ops, etc.)
    loading,
    error,
    fetchJobs,
    createJob,
    updateJob,
    deleteJob,
    loaded: loadedRef.current,
  };
}

export { mapBackendJob, toBackendDto, STATUS_MAP, STATUS_REVERSE };
