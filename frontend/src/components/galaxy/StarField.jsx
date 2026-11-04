import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * StarField - Background particle stars for the galaxy
 */
const StarField = ({ count = 2000 }) => {
  const pointsRef = useRef();
  
  // Generate random star positions - use useMemo with empty deps to run once
  const { positions, sizes, randomFactors } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const randomFactors = new Float32Array(count);
    
    // Use a seeded random-like approach based on index for deterministic results
    const pseudoRandom = (idx) => {
      const x = Math.sin(idx * 12.9898) * 43758.5453;
      return x - Math.floor(x);
    };
    
    for (let i = 0; i < count; i++) {
      // Spread stars in a large sphere
      const r = pseudoRandom(i);
      const radius = 50 + r * 100;
      const theta = pseudoRandom(i + 1) * Math.PI * 2;
      const phi = Math.acos(2 * pseudoRandom(i + 2) - 1);
      
      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = radius * Math.cos(phi);
      
      sizes[i] = pseudoRandom(i + 3) * 2 + 0.5;
      randomFactors[i] = pseudoRandom(i + 4);
    }
    
    return { positions, sizes, randomFactors };
  }, [count]);
  
  // Animate stars with subtle twinkling
  useFrame(({ clock }) => {
    if (pointsRef.current) {
      const time = clock.getElapsedTime();
      const sizesAttr = pointsRef.current.geometry.attributes.size;
      
      for (let i = 0; i < count; i++) {
        sizesAttr.array[i] = sizes[i] * (0.8 + Math.sin(time * 2 + randomFactors[i] * 10) * 0.2);
      }
      sizesAttr.needsUpdate = true;
    }
  });
  
  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-size"
          count={count}
          array={sizes}
          itemSize={1}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.15}
        color="#ffffff"
        transparent
        opacity={0.8}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
};

/**
 * OrbitRing - Visual orbit path rings
 */
const OrbitRing = ({ radius, color = '#ffffff', opacity = 0.1 }) => {
  return (
    <mesh rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[radius, 0.01, 8, 64]} />
      <meshBasicMaterial color={color} transparent opacity={opacity} />
    </mesh>
  );
};

/**
 * GalaxyGlow - Central glow effect
 */
const GalaxyGlow = () => {
  return (
    <group>
      <mesh scale={3}>
        <sphereGeometry args={[5, 32, 32]} />
        <meshBasicMaterial
          color="#0a0a20"
          transparent
          opacity={0.5}
          side={THREE.BackSide}
        />
      </mesh>
      
      <mesh scale={5}>
        <sphereGeometry args={[5, 32, 32]} />
        <meshBasicMaterial
          color="#050510"
          transparent
          opacity={0.3}
          side={THREE.BackSide}
        />
      </mesh>
    </group>
  );
};

export { StarField, OrbitRing, GalaxyGlow };
