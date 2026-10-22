import React, { useRef, useMemo, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Points, PointMaterial } from "@react-three/drei";
import * as THREE from "three";

function NeuralLattice() {
  const pointsRef = useRef();
  const ringRef = useRef();
  const ringRef2 = useRef();

  const count = 1200;
  const [positions, colors] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const colorBrass = new THREE.Color("#e10600");
    const colorCyan = new THREE.Color("#c0c0c0");
    const colorParchment = new THREE.Color("#c0c0c0");

    for (let i = 0; i < count; i++) {
      // Fibonacci sphere distribution for uniform spherical topology
      const phi = Math.acos(-1 + (2 * i) / count);
      const theta = Math.sqrt(count * Math.PI) * phi;
      const radius = 2.4 + (Math.random() - 0.5) * 0.45;

      pos[i * 3] = radius * Math.cos(theta) * Math.sin(phi);
      pos[i * 3 + 1] = radius * Math.sin(theta) * Math.sin(phi);
      pos[i * 3 + 2] = radius * Math.cos(phi);

      // Color gradients
      const mixedColor = i % 3 === 0 ? colorBrass : i % 3 === 1 ? colorCyan : colorParchment;
      col[i * 3] = mixedColor.r;
      col[i * 3 + 1] = mixedColor.g;
      col[i * 3 + 2] = mixedColor.b;
    }
    return [pos, col];
  }, [count]);

  useFrame((state, delta) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y += delta * 0.12;
      pointsRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.3) * 0.15;
    }
    if (ringRef.current) {
      ringRef.current.rotation.z += delta * 0.18;
      ringRef.current.rotation.x += delta * 0.08;
    }
    if (ringRef2.current) {
      ringRef2.current.rotation.y -= delta * 0.14;
      ringRef2.current.rotation.z -= delta * 0.06;
    }
  });

  return (
    <group>
      {/* 3D Fibonacci Neural Points */}
      <Points ref={pointsRef} positions={positions} colors={colors} stride={3} frustumCulled={false}>
        <PointMaterial
          transparent
          vertexColors
          size={0.065}
          sizeAttenuation={true}
          depthWrite={false}
          opacity={0.88}
          blending={THREE.AdditiveBlending}
        />
      </Points>

      {/* Orbit Ring 1 (Brass Orbital Track) */}
      <mesh ref={ringRef} rotation={[Math.PI / 3, 0, 0]}>
        <torusGeometry args={[2.8, 0.012, 16, 100]} />
        <meshBasicMaterial color="#e10600" transparent opacity={0.45} />
      </mesh>

      {/* Orbit Ring 2 (Cyan Orbital Track) */}
      <mesh ref={ringRef2} rotation={[-Math.PI / 4, Math.PI / 6, 0]}>
        <torusGeometry args={[3.05, 0.009, 16, 100]} />
        <meshBasicMaterial color="#c0c0c0" transparent opacity={0.35} />
      </mesh>
    </group>
  );
}

export function ParticleNeuralGlobe() {
  return (
    <div className="w-full h-full relative cursor-grab active:cursor-grabbing">
      <Canvas
        camera={{ position: [0, 0, 5.2], fov: 50 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
      >
        <ambientLight intensity={0.5} />
        <NeuralLattice />
      </Canvas>
    </div>
  );
}
