import React, { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Points, PointMaterial } from "@react-three/drei";
import * as THREE from "three";

function FloatingMonolith() {
  const monolithRef = useRef();
  const wireframeRef = useRef();

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    if (monolithRef.current) {
      monolithRef.current.rotation.y += delta * 0.18;
      monolithRef.current.rotation.x = Math.sin(t * 0.45) * 0.08;
      monolithRef.current.position.y = Math.sin(t * 0.9) * 0.1 - 0.05;
    }
    if (wireframeRef.current) {
      wireframeRef.current.rotation.y -= delta * 0.12;
      wireframeRef.current.rotation.z = Math.cos(t * 0.35) * 0.06;
      wireframeRef.current.position.y = Math.sin(t * 0.9) * 0.1 - 0.05;
    }
  });

  return (
    <group>
      {/* Faceted Aerolite / Monolith matching the rock in the demo */}
      <mesh ref={monolithRef}>
        <dodecahedronGeometry args={[1.08, 1]} />
        <meshStandardMaterial
          color="#1e1e24"
          roughness={0.28}
          metalness={0.88}
          flatShading={true}
        />
      </mesh>

      {/* Engineering Wireframe Holographic Aura in Signal Red */}
      <mesh ref={wireframeRef}>
        <dodecahedronGeometry args={[1.12, 1]} />
        <meshBasicMaterial
          color="#e10600"
          wireframe
          transparent
          opacity={0.35}
        />
      </mesh>
    </group>
  );
}

function NeuralLattice() {
  const pointsRef = useRef();
  const ringRef = useRef();
  const ringRef2 = useRef();

  const count = 1000;
  const [positions, colors] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const colorRed = new THREE.Color("#e10600");
    const colorSilver = new THREE.Color("#c0c0c0");
    const colorWhite = new THREE.Color("#ffffff");

    for (let i = 0; i < count; i++) {
      // Fibonacci sphere distribution for uniform spherical topology
      const phi = Math.acos(-1 + (2 * i) / count);
      const theta = Math.sqrt(count * Math.PI) * phi;
      const radius = 2.2 + (Math.random() - 0.5) * 0.4;

      pos[i * 3] = radius * Math.cos(theta) * Math.sin(phi);
      pos[i * 3 + 1] = radius * Math.sin(theta) * Math.sin(phi);
      pos[i * 3 + 2] = radius * Math.cos(phi);

      const mixedColor = i % 4 === 0 ? colorRed : i % 4 === 1 ? colorSilver : colorWhite;
      col[i * 3] = mixedColor.r;
      col[i * 3 + 1] = mixedColor.g;
      col[i * 3 + 2] = mixedColor.b;
    }
    return [pos, col];
  }, [count]);

  useFrame((state, delta) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y += delta * 0.1;
      pointsRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.25) * 0.12;
    }
    if (ringRef.current) {
      ringRef.current.rotation.z += delta * 0.16;
      ringRef.current.rotation.x += delta * 0.07;
    }
    if (ringRef2.current) {
      ringRef2.current.rotation.y -= delta * 0.12;
      ringRef2.current.rotation.z -= delta * 0.05;
    }
  });

  return (
    <group>
      {/* 3D Fibonacci Neural Points */}
      <Points ref={pointsRef} positions={positions} colors={colors} stride={3} frustumCulled={false}>
        <PointMaterial
          transparent
          vertexColors
          size={0.062}
          sizeAttenuation={true}
          depthWrite={false}
          opacity={0.85}
          blending={THREE.AdditiveBlending}
        />
      </Points>

      {/* Orbit Ring 1 (Signal Red Orbital Track) */}
      <mesh ref={ringRef} rotation={[Math.PI / 3, 0, 0]}>
        <torusGeometry args={[2.7, 0.012, 16, 100]} />
        <meshBasicMaterial color="#e10600" transparent opacity={0.5} />
      </mesh>

      {/* Orbit Ring 2 (Moonlit Silver Track) */}
      <mesh ref={ringRef2} rotation={[-Math.PI / 4, Math.PI / 6, 0]}>
        <torusGeometry args={[2.95, 0.009, 16, 100]} />
        <meshBasicMaterial color="#c0c0c0" transparent opacity={0.4} />
      </mesh>
    </group>
  );
}

export function ParticleNeuralGlobe() {
  return (
    <div className="w-full h-full relative cursor-grab active:cursor-grabbing select-none">
      <Canvas
        camera={{ position: [0, 0, 5.2], fov: 48 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
      >
        <ambientLight intensity={0.6} />
        {/* Signal Red Caustic Spotlight from bottom right */}
        <spotLight
          position={[2.5, -2.5, 3]}
          color="#e10600"
          intensity={3.8}
          distance={10}
          angle={0.85}
          penumbra={0.8}
        />
        {/* Moonlit Silver Keylight from top left */}
        <directionalLight position={[-2.5, 3.5, 3]} color="#f0f0f4" intensity={1.8} />

        {/* Central Monolith */}
        <FloatingMonolith />

        {/* Neural Lattice & Rings */}
        <NeuralLattice />
      </Canvas>
    </div>
  );
}
