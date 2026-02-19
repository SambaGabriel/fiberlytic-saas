// ─── useUsers — Load users from backend ─────────────────────────────────────
import { useState, useEffect, useCallback } from 'react';
import api from '../services/api.js';

// Backend UserRole → Frontend role
const ROLE_MAP = {
  SUPER_ADMIN: 'admin',
  PROJECT_MANAGER: 'supervisor',
  FIELD_SUPERVISOR: 'supervisor',
  FIELD_TECHNICIAN: 'lineman',
  FINANCE: 'billing',
  CLIENT_PORTAL: 'client_manager',
};

/**
 * Map backend User → frontend USERS shape.
 */
function mapBackendUser(bu) {
  return {
    id: bu.id,
    name: `${bu.firstName} ${bu.lastName}`.trim(),
    role: ROLE_MAP[bu.role] || 'lineman',
    email: bu.email,
    phone: bu.phone || null,
    isActive: bu.isActive,
    organizationId: bu.organizationId || null,
    _backendRole: bu.role,
  };
}

export default function useUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getUsers({ limit: 100 });
      const mapped = (res.data || []).map(mapBackendUser);
      setUsers(mapped);
    } catch (err) {
      console.error('[useUsers] fetch failed:', err);
      setError(err.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  return { users, setUsers, loading, error, fetchUsers };
}

export { mapBackendUser, ROLE_MAP };
