// ─── useApi — Generic hook for API calls with loading/error/data states ──────
import { useState, useCallback, useRef } from 'react';
import api from '../services/api.js';

/**
 * Returns helpers to call the API with automatic loading/error tracking.
 *
 * Usage:
 *   const { loading, error, request, clearError } = useApi();
 *   const data = await request(() => api.getJobs({ limit: 200 }));
 */
export default function useApi() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);

  const request = useCallback(async (apiFn) => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiFn();
      if (mountedRef.current) setLoading(false);
      return result;
    } catch (err) {
      if (mountedRef.current) {
        setError(err.message || 'Request failed');
        setLoading(false);
      }
      throw err;
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { loading, error, request, clearError, api };
}
