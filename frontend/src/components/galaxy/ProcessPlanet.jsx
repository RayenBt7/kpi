/* eslint-disable no-unused-vars */
import React, { useRef, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html, Text } from '@react-three/drei';

/**
 * ProcessPlanet - A planet representing a business process
 * Each planet has orbiting KPI indicator spheres around it
 */
const ProcessPlanet = ({ 
  processCode, 
  processName, 
  orbitRadius, 
  orbitSpeed, 
  orbitAngle, 
  indicators = [],
  performance = 'good', // 'good' | 'medium' | 'risk'
  onClick,
  onHover
}) => {
  const groupRef = useRef();
  const planetRef = useRef();
  const [hovered, setHovered] = useState(false);
  
  // Calculate position based on orbit
  const position = useMemo(() => {
    const x = Math.cos(orbitAngle) * orbitRadius;
    const z = Math.sin(orbitAngle) * orbitRadius;
    const y = Math.sin(orbitAngle * 0.5) * 0.5;
    return [x, y, z];
  }, [orbitRadius, orbitAngle]);
  
  // Colors based on performance
  const colors = {
    good: { primary: '#22c55e', glow: '#4ade80', label: '#16a34a' },
    medium: { primary: '#f59e0b', glow: '#fbbf24', label: '#d97706' },
    risk: { primary: '#ef4444', glow: '#f87171', label: '#dc2626' },
  };
  
  const colorScheme = colors[performance] || colors.good;
  
  // Planet size based on number of indicators
  const planetSize = Math.max(0.3, Math.min(0.8, 0.3 + indicators.length * 0.05));
  
  useFrame(({ clock }) => {
    if (groupRef.current) {
      const angle = orbitAngle + clock.getElapsedTime() * orbitSpeed;
      const x = Math.cos(angle) * orbitRadius;
      const z = Math.sin(angle) * orbitRadius;
      const y = Math.sin(angle * 0.5) * 0.5;
      groupRef.current.position.set(x, y, z);
      
      if (planetRef.current) {
        planetRef.current.rotation.y += 0.01;
      }
    }
  });
  
  const handlePointerOver = (e) => {
    e.stopPropagation();
    setHovered(true);
    onHover?.(processCode);
    document.body.style.cursor = 'pointer';
  };
  
  const handlePointerOut = () => {
    setHovered(false);
    onHover?.(null);
    document.body.style.cursor = 'default';
  };
  
  return (
    <group ref={groupRef} position={position}>
      <mesh 
        ref={planetRef}
        onClick={(e) => {
          e.stopPropagation();
          onClick?.(processCode);
        }}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        <sphereGeometry args={[planetSize, 32, 32]} />
        <meshStandardMaterial
          color={colorScheme.primary}
          emissive={colorScheme.primary}
          emissiveIntensity={hovered ? 0.8 : 0.4}
          metalness={0.4}
          roughness={0.3}
        />
      </mesh>
      
      <mesh scale={hovered ? 1.3 : 1.2}>
        <sphereGeometry args={[planetSize, 16, 16]} />
        <meshBasicMaterial
          color={colorScheme.glow}
          transparent
          opacity={hovered ? 0.4 : 0.2}
        />
      </mesh>
      
      {hovered && (
        <Html position={[0, planetSize + 0.5, 0]} center distanceFactor={10}>
          <div style={{
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(10px)',
            border: `1px solid ${colorScheme.primary}`,
            borderRadius: '12px',
            padding: '12px 18px',
            color: '#fff',
            minWidth: '180px',
            textAlign: 'center',
            boxShadow: `0 0 20px ${colorScheme.primary}40`,
          }}>
            <div style={{ fontWeight: 'bold', fontSize: '16px', marginBottom: '4px' }}>
              {processCode}
            </div>
            <div style={{ fontSize: '12px', opacity: 0.8, marginBottom: '8px' }}>
              {processName || processCode}
            </div>
            <div style={{ 
              fontSize: '11px', 
              color: colorScheme.label,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}>
              <span style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: colorScheme.primary,
                boxShadow: `0 0 8px ${colorScheme.primary}`
              }}></span>
              {indicators.length} Indicateurs
            </div>
          </div>
        </Html>
      )}
      
      {indicators.slice(0, 10).map((ind, idx) => (
        <KPIOrb 
          key={ind.indicateur || idx} 
          indicator={ind}
          planetSize={planetSize} 
          orbitIndex={idx}
          totalIndicators={Math.min(indicators.length, 10)}
        />
      ))}
      
      {indicators.length > 10 && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[planetSize + 0.2, 0.02, 8, 32]} />
          <meshBasicMaterial color="#ffffff" opacity={0.3} transparent />
        </mesh>
      )}
    </group>
  );
};

const KPIOrb = ({ indicator, planetSize, orbitIndex, totalIndicators }) => {
  const orbRef = useRef();
  const orbitRadius = planetSize + 0.4;
  const orbitSpeed = 0.5 + (orbitIndex * 0.17) % 0.5;
  const initialAngle = (orbitIndex / totalIndicators) * Math.PI * 2;
  const verticalOffset = ((orbitIndex % 5) - 2) * 0.06;
  
  useFrame(({ clock }) => {
    if (orbRef.current) {
      const angle = initialAngle + clock.getElapsedTime() * orbitSpeed;
      orbRef.current.position.x = Math.cos(angle) * orbitRadius;
      orbRef.current.position.z = Math.sin(angle) * orbitRadius;
      orbRef.current.position.y = verticalOffset + Math.sin(angle * 2) * 0.1;
    }
  });
  
  return (
    <mesh ref={orbRef}>
      <sphereGeometry args={[0.06, 8, 8]} />
      <meshStandardMaterial
        color="#ffffff"
        emissive="#ffffff"
        emissiveIntensity={0.5}
      />
    </mesh>
  );
};

export default ProcessPlanet;
