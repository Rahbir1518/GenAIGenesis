"use client";

import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Points, PointMaterial, Line } from "@react-three/drei";
import * as THREE from "three";

/* ── Dotted Sphere ── */
function DottedSphere({ count = 2000 }: { count?: number }) {
  const ref = useRef<THREE.Points>(null!);

  const positions = useMemo(() => {
    const pts = new Float32Array(count * 3);
    const golden = Math.PI * (3 - Math.sqrt(5)); // golden angle

    for (let i = 0; i < count; i++) {
      const y = 1 - (i / (count - 1)) * 2; // y goes from 1 to -1
      const radius = Math.sqrt(1 - y * y);
      const theta = golden * i;

      pts[i * 3] = Math.cos(theta) * radius;
      pts[i * 3 + 1] = y;
      pts[i * 3 + 2] = Math.sin(theta) * radius;
    }
    return pts;
  }, [count]);

  useFrame(() => {
    if (ref.current) {
      ref.current.rotation.y += 0.002;
    }
  });

  return (
    <Points ref={ref} positions={positions} stride={3} frustumCulled={false}>
      <PointMaterial
        transparent
        color="#ffffff"
        size={0.015}
        sizeAttenuation
        depthWrite={false}
        opacity={0.6}
      />
    </Points>
  );
}

/* ── Single orbital ring (ellipse) ── */
function OrbitalRing({
  color,
  opacity,
  rotation,
  radiusX = 1.3,
  radiusY = 1.3,
}: {
  color: string;
  opacity: number;
  rotation: [number, number, number];
  radiusX?: number;
  radiusY?: number;
}) {
  const points = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    const segments = 128;
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      pts.push(
        new THREE.Vector3(
          Math.cos(angle) * radiusX,
          0,
          Math.sin(angle) * radiusY
        )
      );
    }
    return pts;
  }, [radiusX, radiusY]);

  return (
    <group rotation={rotation}>
      <Line
        points={points}
        color={color}
        lineWidth={0.5}
        transparent
        opacity={opacity}
      />
    </group>
  );
}

/* ── Scene contents ── */
function Scene() {
  return (
    <>
      <ambientLight intensity={0.5} />
      <DottedSphere />

      {/* Three orbital rings at different tilts */}
      <OrbitalRing
        color="#ffffff"
        opacity={0.15}
        rotation={[0.35, 0, 0.1]}
        radiusX={1.35}
        radiusY={1.3}
      />
      <OrbitalRing
        color="#2563EB"
        opacity={0.2}
        rotation={[-0.5, 0.3, -0.15]}
        radiusX={1.4}
        radiusY={1.25}
      />
      <OrbitalRing
        color="#ec4899"
        opacity={0.2}
        rotation={[0.15, -0.2, 0.3]}
        radiusX={1.3}
        radiusY={1.35}
      />
    </>
  );
}

/* ── Exported Globe wrapper ── */
export default function Globe() {
  return (
    <div className="relative h-[500px] sm:h-[600px] lg:h-[700px] w-full">
      <Canvas
        camera={{ position: [0, 0, 2.5], fov: 45 }}
        style={{ background: "transparent" }}
        gl={{ alpha: true }}
      >
        <Scene />
      </Canvas>
    </div>
  );
}
