"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Html, Line, OrbitControls, Stars } from "@react-three/drei";
import { Pause, Play, RotateCcw } from "lucide-react";
import { memo, useEffect, useMemo, useRef, useState, type ElementRef, type MutableRefObject } from "react";
import * as THREE from "three";
import { AU_M, celestialBodies } from "@/lib/constants/celestial-bodies";
import type { MissionConfig, TrajectoryResult } from "@/lib/types";

type Props = {
  mission: MissionConfig;
  result: TrajectoryResult;
};

const ORBITING_BODY_NAMES = ["Mercury", "Venus", "Earth", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune"] as const;

export function SolarSystemScene({ mission, result }: Props) {
  const [running, setRunning] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [replayKey, setReplayKey] = useState(0);
  const [camera, setCamera] = useState<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<ElementRef<typeof OrbitControls> | null>(null);
  const probeRef = useRef<THREE.Mesh | null>(null);

  const earthPosition = useMemo(() => getBodyScenePosition(celestialBodies.Earth), []);
  const destinationPosition = useMemo(
    () => getBodyScenePosition(celestialBodies[mission.destination]),
    [mission.destination]
  );

  const jumpTo = (target: THREE.Vector3 | null) => {
    if (!camera || !controlsRef.current || !target) return;
    camera.position.copy(target).add(new THREE.Vector3(10, 7, 18));
    controlsRef.current.target.copy(target);
    controlsRef.current.update();
  };

  return (
    <section className="relative h-[520px] overflow-hidden bg-black/30">
      <Canvas camera={{ position: [0, 20, 44], fov: 48 }} dpr={[1, 1.8]} onCreated={(state) => setCamera(state.camera as THREE.PerspectiveCamera)}>
        <color attach="background" args={["#03050a"]} />
        <ambientLight intensity={0.45} />
        <pointLight position={[0, 0, 0]} intensity={3.2} color="#f7c948" />
        <Stars radius={150} depth={60} count={3600} factor={4} fade speed={0.25} />
        <SolarSystem
          destination={mission.destination}
          result={result}
          running={running}
          speed={speed}
          replayKey={replayKey}
          probeRef={probeRef}
        />
        <OrbitControls ref={controlsRef} enableDamping dampingFactor={0.08} minDistance={5} maxDistance={260} />
      </Canvas>
      <div className="absolute left-3 top-3 flex flex-wrap gap-2">
        <button onClick={() => setRunning((value) => !value)} className="control-button" aria-label={running ? "Pause" : "Play"}>
          {running ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <button onClick={() => setReplayKey((value) => value + 1)} className="control-button" aria-label="Replay">
          <RotateCcw size={16} />
        </button>
        <button onClick={() => jumpTo(earthPosition)} className="control-button control-button-label" aria-label="Jump to Earth">
          Earth
        </button>
        <button
          onClick={() => jumpTo(probeRef.current?.position ?? earthPosition)}
          className="control-button control-button-label"
          aria-label="Jump to probe"
        >
          Probe
        </button>
        <button onClick={() => jumpTo(destinationPosition)} className="control-button control-button-label" aria-label="Jump to destination">
          Destination
        </button>
        <select value={speed} onChange={(event) => setSpeed(Number(event.target.value))} className="h-9 rounded-md border border-white/10 bg-black/60 px-2 text-sm text-white">
          <option value={0.5}>0.5x</option>
          <option value={1}>1x</option>
          <option value={4}>4x</option>
          <option value={12}>12x</option>
        </select>
      </div>
      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-3 rounded-md border border-white/10 bg-black/55 px-3 py-2 text-xs text-slate-300 backdrop-blur">
        <span>{mission.launchBody} {"->"} {mission.destination}</span>
        <span>{result.simulationData.length.toLocaleString()} simulation steps</span>
      </div>
    </section>
  );
}

function SolarSystem({
  destination,
  result,
  running,
  speed,
  replayKey,
  probeRef
}: {
  destination: MissionConfig["destination"];
  result: TrajectoryResult;
  running: boolean;
  speed: number;
  replayKey: number;
  probeRef: MutableRefObject<THREE.Mesh | null>;
}) {
  const clock = useRef(0);
  const destinationBody = celestialBodies[destination];
  const destinationPosition = useMemo(() => getBodyScenePosition(destinationBody), [destinationBody]);
  const points = useMemo(
    () =>
      result.simulationData
        .filter((_, index) => index % Math.max(1, Math.floor(result.simulationData.length / 900)) === 0)
        .map((step) => getScenePositionFromAuVector(step.position.x / AU_M, step.position.z / AU_M, step.position.y / AU_M)),
    [result.simulationData]
  );
  const orbits = useMemo(
    () =>
      ORBITING_BODY_NAMES.map((name) => {
        const body = celestialBodies[name];
        const radius = getSceneRadiusFromAu(body.semiMajorAxisAu);
        return {
          name,
          body,
          radius,
          points: orbitPoints(radius),
          position: [
            Math.cos(body.initialPhaseRad) * radius,
            0,
            Math.sin(body.initialPhaseRad) * radius
          ] as [number, number, number]
        };
      }),
    []
  );

  useFrame((_, delta) => {
    if (!running || !probeRef.current || points.length === 0) return;
    clock.current = (clock.current + delta * speed * 30) % points.length;
    const point = points[Math.floor(clock.current)];
    probeRef.current.position.copy(point);
  });

  useEffect(() => {
    clock.current = 0;
  }, [replayKey]);

  return (
    <group>
      <Body name="Sun" radius={0.48} position={[0, 0, 0]} color={celestialBodies.Sun.color} />
      {orbits.map(({ name, body, points: orbit, position }) => {
        return (
          <group key={name}>
            <Line points={orbit} color="rgba(156,244,255,0.22)" lineWidth={1} transparent opacity={0.4} />
            <Body
              name={name}
              radius={Math.max(0.08, Math.log10(body.radiusKm) * 0.045)}
              position={position}
              color={body.color}
            />
          </group>
        );
      })}
      <DestinationMarker body={destinationBody} position={destinationPosition} />
      {points.length > 1 && <Line points={points} color="#44e6ff" lineWidth={2} transparent opacity={0.86} />}
      <mesh ref={probeRef}>
        <sphereGeometry args={[0.11, 24, 24]} />
        <meshStandardMaterial color="#ffffff" emissive="#44e6ff" emissiveIntensity={1.4} />
      </mesh>
    </group>
  );
}

const DestinationMarker = memo(function DestinationMarker({ body, position }: { body: typeof celestialBodies[keyof typeof celestialBodies]; position: THREE.Vector3 }) {
  const markerRef = useRef<THREE.Group | null>(null);
  const isInterstellar = body.semiMajorAxisAu > 100;
  const markerRadius = isInterstellar ? 1.65 : 0.9;
  const axisLinePoints = useMemo(
    () => [
      new THREE.Vector3(0, -markerRadius * 1.5, 0),
      new THREE.Vector3(0, markerRadius * 1.5, 0)
    ],
    [markerRadius]
  );

  useFrame((state) => {
    if (!markerRef.current) return;
    const pulse = 1 + Math.sin(state.clock.elapsedTime * 2.2) * 0.045;
    markerRef.current.scale.setScalar(pulse);
    markerRef.current.rotation.y += 0.004;
  });

  return (
    <group ref={markerRef} position={position}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[markerRadius, 0.018, 10, 96]} />
        <meshBasicMaterial color="#9cf4ff" transparent opacity={0.92} />
      </mesh>
      <mesh rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[markerRadius * 1.18, 0.014, 10, 96]} />
        <meshBasicMaterial color="#f7c948" transparent opacity={0.72} />
      </mesh>
      <Line
        points={axisLinePoints}
        color="#9cf4ff"
        lineWidth={1}
        transparent
        opacity={0.7}
      />
      <Html distanceFactor={16} position={[0, markerRadius * 1.65, 0]}>
        <div className="pointer-events-none whitespace-nowrap rounded border border-cyan-signal/30 bg-black/70 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-cyan-soft shadow-[0_0_24px_rgba(68,230,255,0.18)]">
          {body.name} marker · {formatScale(body.semiMajorAxisAu)}
        </div>
      </Html>
    </group>
  );
});

const Body = memo(function Body({ name, radius, position, color }: { name: string; radius: number; position: [number, number, number]; color: string }) {
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
});

function orbitPoints(radius: number) {
  return Array.from({ length: 160 }, (_, index) => {
    const angle = (index / 159) * Math.PI * 2;
    return new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
  });
}

function getSceneRadiusFromAu(au: number) {
  if (au <= 2) return au * 5;
  if (au <= 60) return 10 + Math.sqrt(au - 2) * 4.9;
  return 47 + Math.log10(au / 60) * 6.5;
}

function getScenePositionFromAuVector(xAu: number, yAu: number, zAu: number) {
  const source = new THREE.Vector3(xAu, yAu, zAu);
  const radiusAu = source.length();
  if (radiusAu === 0) return source;
  return source.normalize().multiplyScalar(getSceneRadiusFromAu(radiusAu));
}

function getBodyScenePosition(body: typeof celestialBodies[keyof typeof celestialBodies]) {
  return getScenePositionFromAuVector(
    body.positionAtEpoch.x / AU_M,
    body.positionAtEpoch.z / AU_M,
    body.positionAtEpoch.y / AU_M
  );
}

function formatScale(au: number) {
  if (au > 10_000) return `${Math.round(au).toLocaleString()} AU compressed`;
  return `${au.toFixed(au < 10 ? 2 : 1)} AU`;
}
