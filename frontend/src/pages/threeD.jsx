/* eslint-disable no-unused-vars */
import React, { useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import Experience from '../components/Experience';
import api from '../services/api';
import '../styles/Dashboard.css';

const normalizeText = (value) => (typeof value === 'string' ? value.trim() : '');

const buildIndicators = (rows) => {
  const byIndicator = new Map();

  (rows || []).forEach((row) => {
    const indicateur = normalizeText(row?.Indicateur);
    if (!indicateur) return;

    const existing = byIndicator.get(indicateur) || {
      indicateur,
      designation: '',
      pilote: '',
      responsable: '',
      assignedUser: '',
    };

    const designation = normalizeText(row?.Designation);
    const pilote = normalizeText(row?.Pilote);
    const responsable = normalizeText(row?.Responsable);
    const assignedUser = normalizeText(row?.UserName);

    if (!existing.designation && designation) {
      existing.designation = designation;
    }

    if (!existing.pilote && pilote) {
      existing.pilote = pilote;
    }

    if (!existing.responsable && responsable) {
      existing.responsable = responsable;
    }

    if (!existing.assignedUser && assignedUser) {
      existing.assignedUser = assignedUser;
    }

    byIndicator.set(indicateur, existing);
  });

  return [...byIndicator.values()];
};

const PROCESS_CONFIG = {
  M010: { name: 'Stratégie', category: 'strategic' },
  M020: { name: 'Planification', category: 'strategic' },
  C010: { name: 'Gestion Commerciale', category: 'operational' },
  C020: { name: 'Achats', category: 'operational' },
  C030: { name: 'Production', category: 'operational' },
  C040: { name: 'Logistique', category: 'operational' },
  C050: { name: 'Maintenance', category: 'operational' },
  C060: { name: 'Qualité', category: 'operational' },
  S010: { name: 'Ressources Humaines', category: 'support' },
  S020: { name: 'Finance', category: 'support' },
  S040: { name: 'Informatique', category: 'support' },
  S050: { name: 'Administration', category: 'support' },
  M030: { name: 'Amélioration Continue', category: 'support' },
};

const KPIDetailPanel = ({ processCode, processData, onClose }) => {
  if (!processCode) return null;
  
  const config = PROCESS_CONFIG[processCode] || { name: processCode, category: 'unknown' };
  const indicators = processData?.indicators || [];
  
  const categoryColors = {
    strategic: '#8b5cf6',
    operational: '#3b82f6',
    support: '#10b981',
    unknown: '#6b7280',
  };
  
  return (
    <div style={{
      position: 'absolute',
      top: '100px',
      right: '20px',
      width: '350px',
      maxHeight: 'calc(100% - 140px)',
      background: 'rgba(15, 23, 42, 0.95)',
      backdropFilter: 'blur(20px)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '16px',
      overflow: 'hidden',
      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
      zIndex: 1000,
    }}>
      <div style={{
        padding: '20px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        background: `linear-gradient(135deg, ${categoryColors[config.category]}20 0%, transparent 100%)`,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#fff', marginBottom: '4px' }}>
              {processCode}
            </div>
            <div style={{ fontSize: '14px', color: categoryColors[config.category], fontWeight: '600' }}>
              {config.name}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255, 255, 255, 0.1)', border: 'none', borderRadius: '8px', padding: '8px 12px', color: '#fff', cursor: 'pointer', fontSize: '16px' }}>✕</button>
        </div>
        <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ background: `${categoryColors[config.category]}30`, color: categoryColors[config.category], padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' }}>{config.category}</span>
          <span style={{ background: 'rgba(255, 255, 255, 0.1)', color: '#fff', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' }}>{indicators.length} Indicateurs</span>
        </div>
      </div>
      <div style={{ padding: '16px', maxHeight: '400px', overflowY: 'auto' }}>
        {indicators.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#94a3b8', padding: '20px' }}>Aucun indicateur</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {indicators.map((indicator, idx) => (
              <div key={indicator.indicateur || idx} style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '10px', padding: '12px' }}>
                <div style={{ fontWeight: '600', color: '#fff', fontSize: '13px', marginBottom: '4px' }}>{indicator.indicateur}</div>
                {indicator.designation && <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '8px' }}>{indicator.designation}</div>}
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  {indicator.pilote && <span style={{ fontSize: '11px', color: '#60a5fa' }}>👤 {indicator.pilote}</span>}
                  {indicator.responsable && <span style={{ fontSize: '11px', color: '#34d399' }}>👥 {indicator.responsable}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const ThreeD = ({ theme = 'dark' }) => {
  const [processusData, setProcessusData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedProcess, setSelectedProcess] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const processusRes = await api.get('/api/dashboard/processus');
        const processusList = Array.isArray(processusRes.data?.processus)
          ? [...new Set(processusRes.data.processus.map((item) => normalizeText(item)).filter(Boolean))]
          : [];

        const processResponses = await Promise.allSettled(
          processusList.map((processus) => api.get(`/api/dashboard/processus/${encodeURIComponent(processus)}`))
        );

        const dashboardRows = processusList.map((processus, index) => {
          const response = processResponses[index];
          if (response.status !== 'fulfilled') return { processus, indicators: [] };
          const rows = Array.isArray(response.value?.data?.rows) ? response.value.data.rows : [];
          const indicators = buildIndicators(rows);
          return { processus, indicators };
        });

        setProcessusData(dashboardRows);
      } catch (err) {
        setError(err.response?.data?.error || 'Impossible de charger les données 3D');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const handlePlanetClick = (processCode) => {
    const processData = processusData.find(p => p.processus === processCode);
    setSelectedProcess({ code: processCode, data: processData });
  };

  const handleClosePanel = () => setSelectedProcess(null);

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, background: 'linear-gradient(180deg, #0a0a20 0%, #1a1a3e 100%)' }}>
      {/* Header */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100, padding: '20px 30px', background: 'linear-gradient(180deg, rgba(10, 10, 32, 0.9) 0%, transparent 100%)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '28px', color: '#fff', textShadow: '0 0 20px rgba(0, 212, 255, 0.5)', fontWeight: 'bold' }}>Process Galaxy 🌌</h1>
          <p style={{ margin: '5px 0 0', color: '#94a3b8', fontSize: '14px' }}>Visualisation 3D Interactive des Processus et KPI</p>
        </div>
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px #22c55e' }}></div><span style={{ fontSize: '12px', color: '#fff' }}>Objectif atteint</span></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#f59e0b', boxShadow: '0 0 8px #f59e0b' }}></div><span style={{ fontSize: '12px', color: '#fff' }}>Medium</span></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 8px #ef4444' }}></div><span style={{ fontSize: '12px', color: '#fff' }}>Risque</span></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#fff' }}></div><span style={{ fontSize: '12px', color: '#fff' }}>Indicateur</span></div>
        </div>
      </div>
      
      {/* 3D Canvas */}
      {loading ? (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff', gap: '20px' }}>
          <div style={{ width: '60px', height: '60px', border: '4px solid rgba(255,255,255,0.1)', borderTopColor: '#00d4ff', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <span style={{ fontSize: '16px', color: '#00d4ff' }}>Chargement de la galaxie...</span>
        </div>
      ) : error ? (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ff6b6b', fontSize: '18px' }}>{error}</div>
      ) : (
        <>
          <Canvas shadows dpr={[1, 2]} camera={{ fov: 60, position: [0, 15, 25] }} style={{ background: 'transparent' }}>
            <Experience processusData={processusData} onPlanetClick={handlePlanetClick} />
          </Canvas>
          {selectedProcess && <KPIDetailPanel processCode={selectedProcess.code} processData={selectedProcess.data} onClose={handleClosePanel} />}
        </>
      )}
      
      {/* Bottom instructions */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 100, padding: '15px 30px', background: 'linear-gradient(0deg, rgba(10, 10, 32, 0.9) 0%, transparent 100%)', textAlign: 'center' }}>
        <span style={{ fontSize: '12px', color: '#94a3b8' }}>🖱️ <strong>Cliquez</strong> sur une planète pour voir les détails | 🖱️ <strong>Survolez</strong> pour info | 🔄 <strong>Faites glisser</strong> pour rotate | 🔍 <strong>Scroll</strong> pour zoom</span>
      </div>
    </div>
  );
};

export default ThreeD;
