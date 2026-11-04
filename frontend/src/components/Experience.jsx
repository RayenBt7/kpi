import React from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import ProcessGalaxy from './galaxy/ProcessGalaxy';

/**
 * Experience - Main 3D Scene Component
 * Renders the Process Galaxy visualization
 */
const Experience = ({ processusData = [], onPlanetClick }) => {
  return (
    <>
      {/* Camera Controls */}
      <OrbitControls
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        minDistance={5}
        maxDistance={50}
        dampingFactor={0.05}
        enableDamping
      />
      
      {/* Lighting */}
      <ambientLight intensity={0.15} />
      <pointLight position={[10, 10, 10]} intensity={0.5} color="#ffffff" />
      <pointLight position={[-10, -10, -10]} intensity={0.3} color="#4ecdc4" />
      <pointLight position={[0, 15, 0]} intensity={0.2} color="#45b7d1" />
      
      {/* Background Stars */}
      <Stars
        radius={100}
        depth={50}
        count={5000}
        factor={4}
        saturation={0}
        fade
        speed={1}
      />
      
      {/* Process Galaxy Visualization */}
      <ProcessGalaxy 
        processusData={processusData} 
        onPlanetClick={onPlanetClick}
      />
      
      {/* Post-processing Effects for Glow */}
      <EffectComposer>
        <Bloom
          luminanceThreshold={0.2}
          luminanceSmoothing={0.9}
          intensity={0.6}
          radius={0.8}
        />
      </EffectComposer>
    </>
  );
};

export default Experience;
