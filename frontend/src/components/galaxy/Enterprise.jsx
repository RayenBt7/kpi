import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';

/**
 * Enterprise - The central glowing sphere representing the company
 */
const Enterprise = ({ onClick }) => {
  const meshRef = useRef();
  const glowRef = useRef();
  
  useFrame(({ clock }) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.002;
      meshRef.current.rotation.x = Math.sin(clock.getElapsedTime() * 0.5) * 0.1;
    }
    if (glowRef.current) {
      const scale = 1.3 + Math.sin(clock.getElapsedTime() * 2) * 0.05;
      glowRef.current.scale.set(scale, scale, scale);
    }
  });

  return (
    <group position={[0, 0, 0]}>
      {/* Inner core */}
      <mesh ref={meshRef}>
        <sphereGeometry args={[0.5, 32, 32]} />
        <meshStandardMaterial
          color="#00d4ff"
          emissive="#00d4ff"
          emissiveIntensity={0.8}
          metalness={0.3}
          roughness={0.2}
        />
      </mesh>
      
      {/* Outer glow sphere */}
      <mesh ref={glowRef} scale={1.3}>
        <sphereGeometry args={[0.5, 32, 32]} />
        <meshBasicMaterial
          color="#00d4ff"
          transparent
          opacity={0.3}
        />
      </mesh>
      
      {/* Second glow layer */}
      <mesh scale={1.5}>
        <sphereGeometry args={[0.5, 32, 32]} />
        <meshBasicMaterial
          color="#00d4ff"
          transparent
          opacity={0.15}
        />
      </mesh>
      
      {/* Label */}
      <Html position={[0, 1, 0]} center>
        <div style={{
          background: 'rgba(0, 212, 255, 0.15)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(0, 212, 255, 0.4)',
          borderRadius: '20px',
          padding: '8px 20px',
          color: '#00d4ff',
          fontWeight: 'bold',
          fontSize: '14px',
          whiteSpace: 'nowrap',
          textShadow: '0 0 10px rgba(0, 212, 255, 0.8)',
        }}>
          🏢 ENTERPRISE
        </div>
      </Html>
      
      {/* Click hitbox */}
      <mesh position={[0, 0, 0]} onClick={onClick}>
        <sphereGeometry args={[0.8, 16, 16]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
    </group>
  );
};

export default Enterprise;
