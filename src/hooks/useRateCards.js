// ─── useRateCards — Load rate cards from backend & group for frontend ────────
import { useState, useEffect, useCallback } from 'react';
import api from '../services/api.js';

/**
 * The frontend expects rate cards as an object keyed by "client|customer|region"
 * where each entry has { id, client, customer, region, codes[], profiles{} }.
 *
 * The backend stores flat RateCard rows with: name, category, unit, clientRate,
 * crewRate, materialCost, projectId (→ project.clientName, project.state).
 *
 * This hook fetches all rate cards and groups them into the frontend structure.
 */

// Map backend category suffix → frontend work type description
const CATEGORY_META = {
  LASH:  { desc: 'Overlash', mapsTo: 'Overlash', unit: 'per foot' },
  STRAND: { desc: 'Strand', mapsTo: 'Strand', unit: 'per foot' },
  FBR:   { desc: 'Fiber', mapsTo: 'Fiber', unit: 'per foot' },
  CNDPULL: { desc: 'Fiber Conduit Pulling', mapsTo: 'Fiber Conduit Pulling', unit: 'per foot' },
  ANCHOR: { desc: 'Anchor Install', mapsTo: 'Anchor', unit: 'per each' },
  COIL:  { desc: 'Coil/Snowshoe', mapsTo: 'Coil', unit: 'per each' },
  ENTRY: { desc: 'Building Entry', mapsTo: 'Entry', unit: 'per each' },
  DBI:   { desc: 'Directional Boring Initial', mapsTo: 'DB-Normal', unit: 'per foot' },
  DBIC:  { desc: 'Directional Boring Initial - Cobble', mapsTo: 'DB-Cobble', unit: 'per foot' },
  DBIR:  { desc: 'Directional Boring Initial - Rock', mapsTo: 'DB-Rock', unit: 'per foot' },
  DBIA:  { desc: 'Directional Boring Additional', mapsTo: 'DB-Additional', unit: 'per foot' },
  DBIAR: { desc: 'Directional Boring Additional - Rock', mapsTo: 'DB-Additional-Rock', unit: 'per foot' },
};

function mapBackendRateCard(brc) {
  return {
    backendId: brc.id,
    name: brc.name,
    category: brc.category,
    unit: brc.unit,
    clientRate: Number(brc.clientRate) || 0,
    crewRate: Number(brc.crewRate) || 0,
    materialCost: Number(brc.materialCost) || 0,
    isActive: brc.isActive,
    effectiveFrom: brc.effectiveFrom,
    effectiveTo: brc.effectiveTo,
    projectId: brc.projectId,
    projectName: brc.project?.name || '',
    projectCode: brc.project?.code || '',
  };
}

/**
 * Group flat rate cards into the frontend's { [key]: { id, client, customer, region, codes, profiles } } shape.
 * Since the backend doesn't have the same client/customer/region grouping,
 * we group by project and use the project info to derive the grouping key.
 */
function groupRateCards(flatCards) {
  const grouped = {};

  flatCards.forEach(rc => {
    // Use project-based grouping or a default key
    const key = rc.projectName || rc.projectCode || 'Default';

    if (!grouped[key]) {
      grouped[key] = {
        id: key,
        client: 'MasTec', // default for now
        customer: rc.projectName || 'Default',
        region: '',
        codes: [],
        profiles: { 'NextGen Default': {} },
        uploadedBy: 'System',
        uploadedAt: rc.effectiveFrom || new Date().toISOString(),
        version: 1,
        changeLog: ['Loaded from backend'],
      };
    }

    const group = grouped[key];
    const code = rc.category;
    const meta = CATEGORY_META[code] || { desc: rc.name, mapsTo: rc.name, unit: rc.unit };

    // Add code if not already present
    if (!group.codes.find(c => c.code === code)) {
      group.codes.push({
        code,
        description: meta.desc,
        mapsTo: meta.mapsTo,
        unit: meta.unit,
      });
    }

    // Build profiles with the rate data
    if (!group.profiles['NextGen Default'][code]) {
      group.profiles['NextGen Default'][code] = { nextgenRate: rc.clientRate };
    }
    // Crew rate as generic "Lineman" profile
    if (rc.crewRate > 0) {
      if (!group.profiles['Crew Default']) group.profiles['Crew Default'] = {};
      group.profiles['Crew Default'][code] = { linemanRate: rc.crewRate };
    }
    // Material cost as investor rate
    if (rc.materialCost > 0) {
      if (!group.profiles['Investor Default']) group.profiles['Investor Default'] = {};
      group.profiles['Investor Default'][code] = { investorRate: rc.materialCost };
    }
  });

  return grouped;
}

export default function useRateCards() {
  const [rateCards, setRateCards] = useState({});
  const [flatCards, setFlatCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchRateCards = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getRateCards({ limit: 500 });
      const mapped = (res.data || []).map(mapBackendRateCard);
      setFlatCards(mapped);
      setRateCards(groupRateCards(mapped));
    } catch (err) {
      console.error('[useRateCards] fetch failed:', err);
      setError(err.message || 'Failed to load rate cards');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRateCards();
  }, [fetchRateCards]);

  return {
    rateCards,
    setRateCards, // expose for local edits (profile changes, etc.)
    flatCards,
    loading,
    error,
    fetchRateCards,
  };
}

export { mapBackendRateCard, groupRateCards, CATEGORY_META };
