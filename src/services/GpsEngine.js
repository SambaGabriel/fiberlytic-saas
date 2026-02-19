/**
 * GpsEngine — High-precision GPS motor with Kalman filter
 *
 * Pipeline: Raw Fix → Accuracy Gate (≤25m) → Teleportation Detection (≤50 m/s)
 *           → Kalman Filter (smooth lat/lng) → Heading Calc → Quality Classify → callback
 */

const ACCURACY_GATE = 25; // meters — reject fixes worse than this
const TELEPORT_SPEED = 50; // m/s — reject implausible jumps
const QUALITY_LEVELS = [
  { max: 3,  level: 'rtk',       label: 'RTK',       color: '#22C55E' },
  { max: 5,  level: 'excellent',  label: 'Excellent',  color: '#4ADE80' },
  { max: 10, level: 'good',       label: 'Good',       color: '#FACC15' },
  { max: 20, level: 'fair',       label: 'Fair',       color: '#FB923C' },
  { max: Infinity, level: 'poor', label: 'Poor',       color: '#F87171' },
];

/** Convert meters to degrees for latitude */
function metersToDegreesLat(meters) {
  return meters / 111320;
}

/** Convert meters to degrees for longitude at a given latitude */
function metersToDegreesLng(meters, latDeg) {
  return meters / (111320 * Math.cos(latDeg * Math.PI / 180));
}

/** Haversine distance in meters between two lat/lng points */
function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Classify GPS quality based on accuracy in meters */
function classifyQuality(accuracy) {
  for (const q of QUALITY_LEVELS) {
    if (accuracy <= q.max) return { level: q.level, label: q.label, color: q.color };
  }
  return QUALITY_LEVELS[QUALITY_LEVELS.length - 1];
}

/**
 * 1D Kalman Filter for a single coordinate axis.
 */
class KalmanFilter1D {
  constructor() {
    this.x = null;   // estimated position
    this.P = null;    // estimation variance
    this.lastTime = null;
  }

  /**
   * Process a new measurement.
   * @param {number} measurement - raw coordinate (degrees)
   * @param {number} R - measurement noise variance (degrees²)
   * @param {number} timestamp - ms since epoch
   * @returns {number} filtered coordinate
   */
  update(measurement, R, timestamp) {
    if (this.x === null) {
      // First measurement — initialize
      this.x = measurement;
      this.P = R;
      this.lastTime = timestamp;
      return this.x;
    }

    const dt = Math.max((timestamp - this.lastTime) / 1000, 0.01); // seconds
    this.lastTime = timestamp;

    // Process noise: assumes ~3 m/s walking/driving speed
    // Convert 3 m/s to degrees/s, then square and multiply by dt
    const Q_meters = 3; // m/s process noise
    const Q_deg = metersToDegreesLat(Q_meters * dt);
    const Q = Q_deg * Q_deg;

    // Predict
    this.P = this.P + Q;

    // Update
    const K = this.P / (this.P + R);
    this.x = this.x + K * (measurement - this.x);
    this.P = (1 - K) * this.P;

    return this.x;
  }

  reset() {
    this.x = null;
    this.P = null;
    this.lastTime = null;
  }
}

export default class GpsEngine {
  constructor() {
    this._watchId = null;
    this._listeners = [];
    this._kalmanLat = new KalmanFilter1D();
    this._kalmanLng = new KalmanFilter1D();
    this._lastFix = null;
    this._lastRawTime = null;
    this._lastRawLat = null;
    this._lastRawLng = null;

    // Stats
    this._totalFixes = 0;
    this._rejectedFixes = 0;
    this._accuracySum = 0;
    this._bestAccuracy = Infinity;
  }

  /**
   * Register a callback for filtered GPS fixes.
   * @param {Function} callback - receives fix object
   * @returns {Function} unsubscribe function
   */
  onUpdate(callback) {
    this._listeners.push(callback);
    return () => {
      this._listeners = this._listeners.filter(cb => cb !== callback);
    };
  }

  /** Start GPS tracking */
  start() {
    if (this._watchId !== null) return;
    if (!navigator.geolocation) {
      this._emit({ error: 'GPS not available' });
      return;
    }

    this._watchId = navigator.geolocation.watchPosition(
      (pos) => this._processRawFix(pos),
      (err) => this._emit({ error: err.message }),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
    );
  }

  /** Stop GPS tracking */
  stop() {
    if (this._watchId !== null) {
      navigator.geolocation.clearWatch(this._watchId);
      this._watchId = null;
    }
    this._kalmanLat.reset();
    this._kalmanLng.reset();
    this._lastFix = null;
    this._lastRawTime = null;
    this._lastRawLat = null;
    this._lastRawLng = null;
  }

  /** Get last filtered fix */
  getLastFix() {
    return this._lastFix;
  }

  /** Get engine statistics */
  getStats() {
    return {
      totalFixes: this._totalFixes,
      rejectedFixes: this._rejectedFixes,
      avgAccuracy: this._totalFixes - this._rejectedFixes > 0
        ? this._accuracySum / (this._totalFixes - this._rejectedFixes)
        : null,
      bestAccuracy: this._bestAccuracy === Infinity ? null : this._bestAccuracy,
    };
  }

  /** @private Process a raw GeolocationPosition */
  _processRawFix(pos) {
    const rawLat = pos.coords.latitude;
    const rawLng = pos.coords.longitude;
    const accuracy = pos.coords.accuracy;
    const speed = pos.coords.speed;
    const timestamp = pos.timestamp || Date.now();

    this._totalFixes++;

    // 1) Accuracy gate
    if (accuracy > ACCURACY_GATE) {
      this._rejectedFixes++;
      return;
    }

    // 2) Teleportation detection
    if (this._lastRawTime !== null) {
      const dt = (timestamp - this._lastRawTime) / 1000;
      if (dt > 0) {
        const dist = haversineMeters(this._lastRawLat, this._lastRawLng, rawLat, rawLng);
        const impliedSpeed = dist / dt;
        if (impliedSpeed > TELEPORT_SPEED) {
          this._rejectedFixes++;
          return;
        }
      }
    }

    this._lastRawTime = timestamp;
    this._lastRawLat = rawLat;
    this._lastRawLng = rawLng;

    // 3) Kalman filter
    const R_lat = metersToDegreesLat(accuracy) ** 2;
    const R_lng = metersToDegreesLng(accuracy, rawLat) ** 2;

    const filteredLat = this._kalmanLat.update(rawLat, R_lat, timestamp);
    const filteredLng = this._kalmanLng.update(rawLng, R_lng, timestamp);

    // 4) Heading calculation
    let heading = null;
    if (this._lastFix) {
      const dLat = filteredLat - this._lastFix.lat;
      const dLng = filteredLng - this._lastFix.lng;
      const dist = Math.sqrt(dLat * dLat + dLng * dLng);
      // Only calculate heading if moved enough (> ~1m)
      if (dist > metersToDegreesLat(1)) {
        heading = (Math.atan2(dLng, dLat) * 180 / Math.PI + 360) % 360;
      } else {
        heading = this._lastFix.heading;
      }
    }

    // 5) Quality classification
    const quality = classifyQuality(accuracy);

    // Stats
    this._accuracySum += accuracy;
    if (accuracy < this._bestAccuracy) this._bestAccuracy = accuracy;

    // Build fix
    const fix = {
      lat: filteredLat,
      lng: filteredLng,
      rawLat,
      rawLng,
      accuracy,
      heading,
      speed: speed != null ? speed : null,
      quality,
      timestamp,
    };

    this._lastFix = fix;
    this._emit(fix);
  }

  /** @private Notify all listeners */
  _emit(data) {
    for (const cb of this._listeners) {
      try { cb(data); } catch (e) { console.error('GpsEngine listener error:', e); }
    }
  }
}
