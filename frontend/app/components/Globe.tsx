"use client";

import { useRef, useMemo, useState, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

/* ── Constants ── */
const GLOBE_RADIUS = 1;
const DEG2RAD = Math.PI / 180;
const ROTATION_SPEED = 0.002;

// Land/water: simplified continental boundaries (lon_min, lon_max, lat_min, lat_max)
const LAND_REGIONS: [number, number, number, number][] = [
  [ -170, -50, 15, 72 ],   // North America
  [ -120, -35, -55, 12 ],  // South America
  [ -25, 60, 35, 71 ],     // Europe
  [ -20, 52, -35, 37 ],    // Africa
  [ 60, 180, 10, 75 ],     // Asia
  [ 95, 145, -45, 25 ],    // Indonesia / SE Asia
  [ 110, 155, -40, -10 ],  // Australia
  [ -75, -65, -55, -15 ],  // Chile/Argentina strip
  [ -180, -170, -60, -45 ],// New Zealand
  [ -85, -70, 8, 22 ],     // Central America
  [ 25, 45, 25, 42 ],      // Middle East
  [ -60, -35, -35, 5 ],    // Brazil
  [ 70, 95, 5, 35 ],       // India
  [ 100, 125, 20, 50 ],    // China
  [ 125, 145, 25, 50 ],    // Japan
];

function isLand(lon: number, lat: number): boolean {
  for (const [lonMin, lonMax, latMin, latMax] of LAND_REGIONS) {
    if (lon >= lonMin && lon <= lonMax && lat >= latMin && lat <= latMax) return true;
  }
  return false;
}

/* ── Mock activity data (PRs / knowledge graph events) ── */
interface ActivityPoint {
  lon: number;
  lat: number;
  type: "open" | "merged";
  repo?: string;
  title?: string;
  timestamp?: string;
  language?: string;
}

function generateMockActivities(): { arcs: [ActivityPoint, ActivityPoint][]; spikes: ActivityPoint[] } {
  const cities: [number, number, string][] = [
    [-122.4, 37.8, "San Francisco"],
    [-74.0, 40.7, "New York"],
    [-87.6, 41.9, "Chicago"],
    [-118.2, 34.0, "Los Angeles"],
    [2.35, 48.85, "Paris"],
    [-0.13, 51.5, "London"],
    [13.4, 52.5, "Berlin"],
    [139.7, 35.7, "Tokyo"],
    [114.2, 22.3, "Hong Kong"],
    [103.8, 1.35, "Singapore"],
    [151.2, -33.9, "Sydney"],
    [-43.2, -22.9, "Rio"],
    [-99.1, 19.4, "Mexico City"],
    [77.2, 28.6, "Delhi"],
    [-73.6, 45.5, "Montreal"],
  ];
  const arcs: [ActivityPoint, ActivityPoint][] = [];
  const spikes: ActivityPoint[] = [];
  for (let i = 0; i < 20; i++) {
    const a = cities[Math.floor(Math.random() * cities.length)];
    const b = cities[Math.floor(Math.random() * cities.length)];
    if (a === b) continue;
    arcs.push([
      { lon: a[0], lat: a[1], type: "merged", repo: `numen/${["core", "api", "ui", "docs"][i % 4]}`, title: `Merge #${i + 1}`, timestamp: new Date().toISOString(), language: "TypeScript" },
      { lon: b[0], lat: b[1], type: "merged", repo: `numen/${["core", "api", "ui", "docs"][i % 4]}`, title: `Merge #${i + 1}`, timestamp: new Date().toISOString(), language: "TypeScript" },
    ]);
  }
  for (let i = 0; i < 12; i++) {
    const c = cities[Math.floor(Math.random() * cities.length)];
    spikes.push({ lon: c[0], lat: c[1], type: "open", repo: `numen/core`, title: `PR #${i + 1}`, timestamp: new Date().toISOString(), language: "TypeScript" });
  }
  return { arcs, spikes };
}

/* ── Halo shader ── */
const haloVertexShader = `
  varying vec3 vNormal;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const haloFragmentShader = `
  varying vec3 vNormal;
  void main() {
    float intensity = pow(0.7 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.0);
    gl_FragColor = vec4(0.2, 0.4, 0.8, intensity * 0.4);
  }
`;

/* ── Earth: land-only dots (GitHub-style) ── */
function EarthDots({ dotDensity = 0.8, rows = 24 }: { dotDensity?: number; rows?: number }) {
  const ref = useRef<THREE.Points>(null!);
  const { positions } = useMemo(() => {
    const pts: number[] = [];
    for (let lat = -90; lat <= 90; lat += 180 / rows) {
      const radius = Math.cos(Math.abs(lat) * DEG2RAD) * GLOBE_RADIUS;
      const circumference = radius * Math.PI * 2;
      const dotsForLat = Math.max(1, Math.floor(circumference * dotDensity));
      for (let x = 0; x < dotsForLat; x++) {
        const lon = -180 + (x * 360) / dotsForLat;
        if (!isLand(lon, lat)) continue;
        const phi = (90 - lat) * DEG2RAD;
        const theta = (lon + 90) * DEG2RAD;
        pts.push(
          -GLOBE_RADIUS * Math.sin(phi) * Math.cos(theta),
          GLOBE_RADIUS * Math.cos(phi),
          GLOBE_RADIUS * Math.sin(phi) * Math.sin(theta)
        );
      }
    }
    return new Float32Array(pts);
  }, [dotDensity, rows]);

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={positions.length / 3}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.012}
        color="#ffffff"
        transparent
        opacity={0.7}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

/* ── Halo mesh ── */
function Halo() {
  const meshRef = useRef<THREE.Mesh>(null!);
  const geometry = useMemo(() => new THREE.SphereGeometry(GLOBE_RADIUS * 1.15, 32, 32), []);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: haloVertexShader,
        fragmentShader: haloFragmentShader,
        transparent: true,
        depthWrite: false,
        side: THREE.BackSide,
      }),
    []
  );
  return (
    <mesh ref={meshRef} geometry={geometry} material={material} rotation={[Math.PI * 0.03, Math.PI * 0.03, 0]} />
  );
}

/* ── Arc between two points (merged PRs) ── */
function ActivityArc({
  start,
  end,
  color,
}: {
  start: [number, number];
  end: [number, number];
  color: string;
}) {
  const { geometry } = useMemo(() => {
    const latLonToVec = (lon: number, lat: number) => {
      const phi = (90 - lat) * DEG2RAD;
      const theta = (lon + 90) * DEG2RAD;
      return new THREE.Vector3(
        -GLOBE_RADIUS * 1.02 * Math.sin(phi) * Math.cos(theta),
        GLOBE_RADIUS * 1.02 * Math.cos(phi),
        GLOBE_RADIUS * 1.02 * Math.sin(phi) * Math.sin(theta)
      );
    };
    const startVec = latLonToVec(start[0], start[1]);
    const endVec = latLonToVec(end[0], end[1]);
    const mid = new THREE.Vector3().addVectors(startVec, endVec).multiplyScalar(0.5);
    const dist = startVec.distanceTo(endVec);
    mid.normalize().multiplyScalar(GLOBE_RADIUS * 1.0 + dist * 0.15);
    const ctrl1 = new THREE.Vector3().lerpVectors(startVec, mid, 0.5);
    const ctrl2 = new THREE.Vector3().lerpVectors(mid, endVec, 0.5);
    const curve = new THREE.CubicBezierCurve3(startVec, ctrl1, ctrl2, endVec);
    const pts = curve.getPoints(48);
    const arr = new Float32Array(pts.flatMap((p) => [p.x, p.y, p.z]));
    const geo = new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(arr, 3));
    return { geometry: geo };
  }, [start[0], start[1], end[0], end[1]]);

  return (
    <line geometry={geometry}>
      <lineBasicMaterial color={color} transparent opacity={0.85} />
    </line>
  );
}

/* ── Spikes (open PRs) ── */
function ActivitySpike({ lon, lat, color }: { lon: number; lat: number; color: string }) {
  const geometry = useMemo(() => {
    const phi = (90 - lat) * DEG2RAD;
    const theta = (lon + 90) * DEG2RAD;
    const base = new THREE.Vector3(
      -GLOBE_RADIUS * Math.sin(phi) * Math.cos(theta),
      GLOBE_RADIUS * Math.cos(phi),
      GLOBE_RADIUS * Math.sin(phi) * Math.sin(theta)
    );
    const tip = base.clone().normalize().multiplyScalar(GLOBE_RADIUS + 0.08);
    const arr = new Float32Array([base.x, base.y, base.z, tip.x, tip.y, tip.z]);
    const geo = new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(arr, 3));
    return geo;
  }, [lon, lat]);
  return (
    <line geometry={geometry}>
      <lineBasicMaterial color={color} transparent opacity={0.9} />
    </line>
  );
}

/* ── Quality tier (GitHub-style degradation when FPS drops) ── */
const DOT_DENSITY_HIGH = 0.7;
const DOT_DENSITY_LOW = 0.45;
const ROWS_HIGH = 22;
const ROWS_LOW = 16;

/* ── Scene with timezone-based rotation ── */
function Scene() {
  const groupRef = useRef<THREE.Group>(null!);
  const { arcs: mergedPairs, spikes: openPoints } = useMemo(() => generateMockActivities(), []);
  const [visibleCount, setVisibleCount] = useState(0);
  const [qualityTier, setQualityTier] = useState(0); // 0 = high, 1 = low
  const frameTimes = useRef<number[]>([]);
  const lastTime = useRef(performance.now());

  const rotationOffset = useMemo(() => {
    const date = new Date();
    const tzOffset = date.getTimezoneOffset() || 0;
    const tzMax = 60 * 12;
    return Math.PI * (tzOffset / tzMax);
  }, []);

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += ROTATION_SPEED;
    }
    // FPS monitoring for quality degradation (GitHub-style)
    const now = performance.now();
    const frameTime = now - lastTime.current;
    lastTime.current = now;
    const fps = frameTime > 0 ? 1000 / frameTime : 60;
    frameTimes.current.push(Math.min(fps, 120));
    if (frameTimes.current.length > 50) {
      frameTimes.current.shift();
      const avgFps = frameTimes.current.reduce((a, b) => a + b, 0) / frameTimes.current.length;
      if (avgFps < 55.5 && qualityTier === 0) setQualityTier(1);
    }
  });

  useEffect(() => {
    let count = 0;
    const id = setInterval(() => {
      count += 1;
      setVisibleCount((c) => Math.min(c + 1, mergedPairs.length * 2 + openPoints.length));
      if (count > 40) clearInterval(id);
    }, 150);
    return () => clearInterval(id);
  }, [mergedPairs.length, openPoints.length]);

  return (
    <group ref={groupRef} rotation={[0, rotationOffset, 0]}>
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 5, 5]} intensity={1} />
      <directionalLight position={[-5, -5, 5]} intensity={0.5} />
      <directionalLight position={[0, 5, -5]} intensity={0.4} />
      <directionalLight position={[0, -5, -5]} intensity={0.3} />

      <Halo />
      <EarthDots
        dotDensity={qualityTier === 0 ? DOT_DENSITY_HIGH : DOT_DENSITY_LOW}
        rows={qualityTier === 0 ? ROWS_HIGH : ROWS_LOW}
      />

      {mergedPairs
        .slice(0, Math.max(1, Math.floor((visibleCount / 2) * (qualityTier === 0 ? 1 : 0.6))))
        .map(([a, b], i) => (
          <ActivityArc
            key={`arc-${i}`}
            start={[a.lon, a.lat]}
            end={[b.lon, b.lat]}
            color="#ec4899"
          />
        ))}
      {openPoints.slice(0, Math.min(visibleCount, qualityTier === 0 ? 8 : 4)).map((p, i) => (
        <ActivitySpike key={`spike-${i}`} lon={p.lon} lat={p.lat} color="#2563EB" />
      ))}
    </group>
  );
}

/* ── Placeholder SVG (gradient globe) ── */
function GlobePlaceholder() {
  return (
    <svg
      viewBox="0 0 400 400"
      className="absolute inset-0 w-full h-full"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <radialGradient id="globeGrad" cx="30%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#1e3a5f" stopOpacity="0.9" />
          <stop offset="60%" stopColor="#0D0B1A" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#0D0B1A" stopOpacity="1" />
        </radialGradient>
        <radialGradient id="globeHalo" cx="25%" cy="25%" r="80%">
          <stop offset="0%" stopColor="#2563eb" stopOpacity="0.15" />
          <stop offset="100%" stopColor="transparent" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="200" cy="200" r="180" fill="url(#globeHalo)" />
      <circle cx="200" cy="200" r="160" fill="url(#globeGrad)" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
    </svg>
  );
}

/* ── Main Globe ── */
export default function Globe() {
  const containerRef = useRef<HTMLDivElement>(null!);
  const [ready, setReady] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null!);

  useEffect(() => {
    const timer = requestAnimationFrame(() => {
      requestAnimationFrame(() => setReady(true));
    });
    return () => cancelAnimationFrame(timer);
  }, []);

  useEffect(() => {
    if (!ready || !containerRef.current || !canvasRef.current) return;
    const placeholder = containerRef.current.querySelector(".globe-placeholder");
    const canvas = canvasRef.current.querySelector("canvas");
    if (!placeholder || !canvas) return;

    const keyframesIn = [
      { opacity: 0, transform: "scale(0.8)" },
      { opacity: 1, transform: "scale(1)" },
    ];
    const keyframesOut = [
      { opacity: 1, transform: "scale(0.8)" },
      { opacity: 0, transform: "scale(1)" },
    ];
    const options = { fill: "both" as const, duration: 600, easing: "ease" as const };

    (canvas as HTMLCanvasElement).animate(keyframesIn, options);
    const placeHolderAnim = (placeholder as HTMLElement).animate(keyframesOut, options);
    placeHolderAnim.addEventListener("finish", () => placeholder.remove());
  }, [ready]);

  return (
    <div ref={containerRef} className="relative h-[500px] sm:h-[600px] lg:h-[700px] w-full">
      <div className="globe-placeholder absolute inset-0 flex items-center justify-center">
        <GlobePlaceholder />
      </div>
      <div ref={canvasRef} className="absolute inset-0" style={{ opacity: ready ? 1 : 0 }}>
        <Canvas
          camera={{ position: [0, 0, 2.5], fov: 45 }}
          style={{ background: "transparent" }}
          gl={{ alpha: true, antialias: false }}
        >
          <Scene />
        </Canvas>
      </div>
    </div>
  );
}
