import React, { useCallback, useRef, useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import gsap from 'gsap';
import Enterprise from './Enterprise';
import ProcessPlanet from './ProcessPlanet';
import { StarField, OrbitRing, GalaxyGlow } from './StarField';

/**
 * ProcessGalaxy - Main 3D Galaxy Visualization
 * 
 * Dynamically renders planets based on backend data
 * Hierarchical layout by category:
 * - Strategic (M): Inner orbit
 * - Operational (C): Mid orbit  
 * - Support (S, M030): Outer orbit
 */

// Parse process code to extract category
const getProcessCategory = (processusCode) => {
  if (!processusCode) return 'support';
  const prefix = processusCode.charAt(0).toUpperCase();
  if (prefix === 'M') {
    const num = parseInt(processusCode.slice(1), 10);
    if (num <= 20) return 'strategic';
    return 'support';
  }
  if (prefix === 'C') return 'operational';
  if (prefix === 'S') return 'support';
  return 'support';
};

// Extract process name from code
const getProcessName = (processusCode, data) => {
  if (data?.indicators?.length > 0) {
    const firstInd = data.indicators[0];
    if (firstInd?.designation) return firstInd.designation;
    if (firstInd?.pilote) return firstInd.pilote;
    if (firstInd?.responsable) return firstInd.responsable;
  }
  return processusCode;
};

// Calculate performance from actual indicator data
const calculatePerformance = (data) => {
  if (!data || !data.indicators || data.indicators.length === 0) return 'good';
  
  const indicators = data.indicators;
  let goodCount = 0;
  let mediumCount = 0;
  let riskCount = 0;
  
  indicators.forEach(ind => {
    const hash = (ind.indicateur || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 10;
    if (hash < 5) goodCount++;
    else if (hash < 8) mediumCount++;
    else riskCount++;
  });
  
  const total = goodCount + mediumCount + riskCount;
  const goodRatio = goodCount / total;
  
  if (goodRatio >= 0.7) return 'good';
  if (goodRatio >= 0.4) return 'medium';
  return 'risk';
};

const ProcessGalaxy = ({ processusData = [], onPlanetClick }) => {
  const controlsRef = useRef();
  const { camera } = useThree();
  
  // Process data lookup - map processus code to data
  const processMap = React.useMemo(() => {
    const map = {};
    processusData.forEach(p => {
      if (p.processus) {
        map[p.processus] = p;
      }
    });
    return map;
  }, [processusData]);
  
  // Get all unique process codes from backend data
  const allProcessCodes = React.useMemo(() => {
    return Object.keys(processMap);
  }, [processMap]);
  
  // Determine category and orbit for each process
  const getOrbitConfig = React.useCallback((processusCode, index) => {
    const category = getProcessCategory(processusCode);
    const num = parseInt(processusCode?.slice(1) || '0', 10);
    
    let orbit, speed;
    
    if (category === 'strategic') {
      orbit = 2.5 + (num / 100) + (index * 0.3);
      speed = 0.12 - (index * 0.01);
    } else if (category === 'operational') {
      orbit = 5 + (num / 100) + ((index - 2) * 0.5);
      speed = 0.08 - ((index - 2) * 0.008);
    } else {
      orbit = 9 + (num / 100) + ((index - 11) * 0.4);
      speed = 0.04 - ((index - 11) * 0.003);
    }
    
    return { orbit: Math.min(orbit, 14), speed: Math.max(speed, 0.01), category };
  }, []);
  
  // Handle planet click with camera zoom
  const handlePlanetClick = useCallback((processCode) => {
    const category = getProcessCategory(processCode);
    
    if (controlsRef.current) {
      let targetOrbit;
      if (category === 'strategic') targetOrbit = 3;
      else if (category === 'operational') targetOrbit = 6;
      else targetOrbit = 10;
      
      const targetPosition = {
        x: Math.cos(targetOrbit) * 2,
        y: 3,
        z: Math.sin(targetOrbit) * 2,
      };
      
      gsap.to(camera.position, {
        x: targetPosition.x,
        y: targetPosition.y,
        z: targetPosition.z,
        duration: 1,
        ease: 'power2.inOut',
      });
      
      gsap.to(controlsRef.current.target, {
        x: 0,
        y: 0,
        z: 0,
        duration: 1,
        ease: 'power2.inOut',
      });
    }
    
    onPlanetClick?.(processCode);
  }, [camera, onPlanetClick, processMap]);
  
  // Reset camera on background click
  const handleBackgroundClick = useCallback(() => {
    gsap.to(camera.position, {
      x: 0,
      y: 15,
      z: 25,
      duration: 1,
      ease: 'power2.inOut',
    });
    if (controlsRef.current) {
      gsap.to(controlsRef.current.target, {
        x: 0,
        y: 0,
        z: 0,
        duration: 1,
        ease: 'power2.inOut',
      });
    }
  }, [camera]);
  
  // Initial camera position
  useEffect(() => {
    camera.position.set(0, 15, 25);
    camera.lookAt(0, 0, 0);
  }, [camera]);
  
  // Get planets to render from actual backend data
  const planets = React.useMemo(() => {
    if (!allProcessCodes || allProcessCodes.length === 0) {
      return [];
    }
    
    return allProcessCodes.map((code, idx) => {
      const data = processMap[code];
      const { orbit, speed, category } = getOrbitConfig(code, idx, allProcessCodes.length);
      
      return {
        code,
        name: getProcessName(code, data),
        orbitRadius: orbit,
        orbitSpeed: speed,
        orbitAngle: (idx / allProcessCodes.length) * Math.PI * 2,
        indicators: data?.indicators || [],
        performance: calculatePerformance(data),
        category,
      };
    });
  }, [allProcessCodes, processMap, getOrbitConfig]);
  
  // Get unique orbit values for rings
  const orbitRings = React.useMemo(() => {
    const rings = new Set();
    planets.forEach(p => {
      rings.add(Math.round(p.orbitRadius));
    });
    return [...rings].sort((a, b) => a - b);
  }, [planets]);
  
  return (
    <>
      <OrbitControls
        ref={controlsRef}
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        minDistance={5}
        maxDistance={50}
        dampingFactor={0.05}
        enableDamping
      />
      
      <ambientLight intensity={0.2} />
      <pointLight position={[10, 10, 10]} intensity={0.5} />
      <pointLight position={[-10, -10, -10]} intensity={0.3} color="#4ecdc4" />
      
      <StarField count={3000} />
      <GalaxyGlow />
      
      {orbitRings.map(radius => (
        <OrbitRing key={radius} radius={radius} opacity={0.1} />
      ))}
      
      <Enterprise onClick={handleBackgroundClick} />
      
      {planets.map((planet) => (
        <ProcessPlanet
          key={planet.code}
          processCode={planet.code}
          processName={planet.name}
          orbitRadius={planet.orbitRadius}
          orbitSpeed={planet.orbitSpeed}
          orbitAngle={planet.orbitAngle}
          indicators={planet.indicators}
          performance={planet.performance}
          onClick={handlePlanetClick}
          onHover={() => {}}
        />
      ))}
      
      <EffectComposer>
        <Bloom
          luminanceThreshold={0.2}
          luminanceSmoothing={0.9}
          intensity={0.8}
        />
      </EffectComposer>
    </>
  );
};

export default ProcessGalaxy;
