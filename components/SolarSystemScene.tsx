"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Html, Line, OrbitControls, Stars } from "@react-three/drei";
import { Pause, Play, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { AU_M, celestialBodies } from "@/lib/constants/celestial-bodies";
import type { MissionConfig, TrajectoryResult } from "@/lib/types";

type Props = {
  mission: MissionConfig;
  result: TrajectoryResult;
};

export function SolarSystemScene({ mission, result }: Props) {
  const [running, setRunning] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [replayKey, setReplayKey] = useState(0);

  return (
    <section className="relative h-[520px] overflow-hidden bg-black/30">
      <Canvas camera={{ position: [0, 13, 22], fov: 48 }} dpr={[1, 1.8]}>
        <color attach="background" args={["#03050a"]} />
        <ambientLight intensity={0.45} />
        <pointLight position={[0, 0, 0]} intensity={3.2} color="#f7c948" />
        <Stars radius={90} depth={40} count={3200} factor={4} fade speed={0.25} />
        <SolarSystem mission={mission} result={result} running={running} speed={speed} replayKey={replayKey} />
        <OrbitControls enableDamping dampingFactor={0.08} minDistance={5} maxDistance={80} />
      </Canvas>
      <div className="absolute left-3 top-3 flex flex-wrap gap-2">
        <button onClick={() => setRunning((value) => !value)} className="control-button" aria-label={running ? "Pause" : "Play"}>
          {running ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <button onClick={() => setReplayKey((value) => value + 1)} className="control-button" aria-label="Replay">
          <RotateCcw size={16} />
        </button>
        <select value={speed} onChange={(event) => setSpeed(Number(event.target.value))} className="h-9 rounded-md border border-white/10 bg-black/60 px-2 text-sm text-white">
          <option value={0.5}>0.5x</option>
          <option value={1}>1x</option>
          <option value={4}>4x</option>
          <option value={12}>12x</option>
        </select>
      </div>
      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-3 rounded-md border border-white/10 bg-black/55 px-3 py-2 text-xs text-slate-300 backdrop-blur">
        <span>{mission.launchBody} -> {mission.destination}</span>
        <span>{result.simulationData.length.toLocaleString()} simulation steps</span>
      </div>
    </section>
  );
}

function SolarSystem({ mission, result, running, speed, replayKey }: Props & { running: boolean; speed: number; replayKey: number }) {
  const probe = useRef<THREE.Mesh>(null);
  const clock = useRef(0);
  const points = useMemo(
    () =>
      result.simulationData
        .filter((_, index) => index % Math.max(1, Math.floor(result.simulationData.length / 900)) === 0)
        .map((step) => new THREE.Vector3(step.position.x / AU_M, step.position.z / AU_M, step.position.y / AU_M).multiplyScalar(scaleForScene(mission.destination))),
    [result.simulationData, mission.destination]
  );

  useFrame((_, delta) => {
    if (!running || !probe.current || points.length === 0) return;
    clock.current = (clock.current + delta * speed * 30) % points.length;
    const point = points[Math.floor(clock.current)];
    probe.current.position.copy(point);
  });

  useEffect(() => {
    clock.current = 0;
  }, [replayKey]);

  return (
    <group>
      <Body name="Sun" radius={0.48} position={[0, 0, 0]} color={celestialBodies.Sun.color} />
      {(["Mercury", "Venus", "Earth", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune"] as const).map((name) => {
        const body = celestialBodies[name];
        const scale = scaleForScene(mission.destination);
        const r = body.semiMajorAxisAu * scale;
        return (
          <group key={name}>
            <Line points={orbitPoints(r)} color="rgba(156,244,255,0.22)" lineWidth={1} transparent opacity={0.4} />
            <Body
              name={name}
              radius={Math.max(0.08, Math.log10(body.radiusKm) * 0.045)}
              position={[Math.cos(body.initialPhaseRad) * r, 0, Math.sin(body.initialPhaseRad) * r]}
              color={body.color}
            />
          </group>
        );
      })}
      {points.length > 1 && <Line points={points} color="#44e6ff" lineWidth={2} transparent opacity={0.86} />}
      <mesh ref={probe}>
        <sphereGeometry args={[0.11, 24, 24]} />
        <meshStandardMaterial color="#ffffff" emissive="#44e6ff" emissiveIntensity={1.4} />
      </mesh>
    </group>
  );
}

function Body({ name, radius, position, color }: { name: string; radius: number; position: [number, number, number]; color: string }) {
  return (
    <group position={position}>
      <mesh>
        <sphereGeometry args={[radius, 32, 32]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={name === "Sun" ? 1.8 : 0.08} roughness={0.7} />
      </mesh>
      <Html distanceFactor={14}>
        <div className="whitespace-nowrap rounded border border-white/10 bg-black/55 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-white">
          {name}
        </div>
      </Html>
    </group>
  );
}

function orbitPoints(radius: number) {
  return Array.from({ length: 160 }, (_, index) => {
    const angle = (index / 159) * Math.PI * 2;
    return new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
  });
}

function scaleForScene(destination: string) {
  return destination.includes("Centauri") || destination.includes("Barnard") ? 0.018 : 0.7;
}
