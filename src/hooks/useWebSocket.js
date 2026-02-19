import { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';

/**
 * useWebSocket — Real-time connection to the Live Mode backend via socket.io
 *
 * Connects to the /live namespace with JWT auth.
 * Provides: sendLocation, sendProduction, crewLocations, onlineUsers, connected
 */
export default function useWebSocket() {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [crewLocations, setCrewLocations] = useState(new Map());
  const [onlineUsers, setOnlineUsers] = useState(new Map());

  useEffect(() => {
    const token = localStorage.getItem('fl_access_token');
    if (!token) return;

    // Determine base URL: in dev use the Vite proxy, in prod use relative
    const wsUrl = window.location.origin;

    const socket = io(`${wsUrl}/live`, {
      auth: { token },
      transports: ['websocket'],
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('connect_error', () => {
      setConnected(false);
    });

    // Crew location updates from other users
    socket.on('location:updated', (data) => {
      setCrewLocations((prev) => {
        const next = new Map(prev);
        next.set(data.userId, {
          lat: data.latitude,
          lng: data.longitude,
          accuracy: data.accuracy,
          heading: data.heading,
          email: data.email,
          timestamp: data.timestamp,
        });
        return next;
      });
    });

    // User online/offline
    socket.on('user:online', (data) => {
      setOnlineUsers((prev) => {
        const next = new Map(prev);
        next.set(data.userId, { email: data.email, since: data.timestamp });
        return next;
      });
    });

    socket.on('user:offline', (data) => {
      setOnlineUsers((prev) => {
        const next = new Map(prev);
        next.delete(data.userId);
        return next;
      });
      // Also remove from crew locations
      setCrewLocations((prev) => {
        const next = new Map(prev);
        next.delete(data.userId);
        return next;
      });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  /** Send a GPS location fix to the backend */
  const sendLocation = useCallback((fix) => {
    if (!socketRef.current?.connected) return;
    socketRef.current.emit('location:update', {
      latitude: fix.lat,
      longitude: fix.lng,
      accuracy: fix.accuracy,
      heading: fix.heading,
      speed: fix.speed,
      timestamp: new Date(fix.timestamp).toISOString(),
      jobId: fix.jobId || undefined,
      sessionId: fix.sessionId || undefined,
    });
  }, []);

  /** Send a production update */
  const sendProduction = useCallback((data) => {
    if (!socketRef.current?.connected) return;
    socketRef.current.emit('production:submit', data);
  }, []);

  /** Start a live session — returns sessionId */
  const startSession = useCallback((jobId) => {
    return new Promise((resolve) => {
      if (!socketRef.current?.connected) { resolve(null); return; }
      socketRef.current.emit('session:start', { jobId }, (response) => {
        resolve(response?.sessionId || null);
      });
    });
  }, []);

  /** End a live session */
  const endSession = useCallback((sessionId, totalSpans, totalFootage) => {
    if (!socketRef.current?.connected) return;
    socketRef.current.emit('session:end', { sessionId, totalSpans, totalFootage });
  }, []);

  return {
    connected,
    crewLocations,
    onlineUsers,
    sendLocation,
    sendProduction,
    startSession,
    endSession,
  };
}
