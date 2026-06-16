/**
 * BinViewer.jsx
 * Live 3-D packing visualiser using React Three Fiber.
 *
 * Accepts two equivalent prop shapes:
 *   (A) placements={[{item_idx, bin_id, x, y, z, l, h, d}]}
 *       container={{ L, H, D }}
 *       binsUsed={number}
 *
 *   (B) result={{ items:[...], container:{L,H,D}, bins_used:n }}
 *       (legacy – kept for backward compatibility)
 *
 * Colouring: golden-angle HSL hue per item_idx so every item is visually
 * distinct, even when items of the same type share a bin.
 * Each item gets a thin dark wireframe edge so boxes pop.
 */

import React, { useMemo, useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';

// ── Per-item colour using golden-angle hue ───────────────────────────────────
function itemHSL(itemIdx) {
  const hue = (itemIdx * 137.508) % 360;
  return `hsl(${hue.toFixed(1)}, 70%, 60%)`;
}

// ── Container wireframe ───────────────────────────────────────────────────────
const WireBox = React.memo(function WireBox({ x, y, z, l, h, d }) {
  const geo = useMemo(() => new THREE.BoxGeometry(l, h, d), [l, h, d]);
  return (
    <lineSegments position={[x + l / 2, y + h / 2, z + d / 2]}>
      <edgesGeometry args={[geo]} />
      <lineBasicMaterial color="white" transparent opacity={0.35} />
    </lineSegments>
  );
});

// ── Packed item: solid face + dark edge outline ───────────────────────────────
const ItemBox = React.memo(function ItemBox({ x, y, z, l, h, d, itemIdx, id, showLabels }) {
  const [hovered, setHovered] = useState(false);
  const color   = useMemo(() => itemHSL(itemIdx), [itemIdx]);
  const faceGeo = useMemo(() => new THREE.BoxGeometry(l - 1, h - 1, d - 1), [l, h, d]);
  const edgeGeo = useMemo(() => new THREE.EdgesGeometry(faceGeo), [faceGeo]);
  const cx = x + l / 2, cy = y + h / 2, cz = z + d / 2;
  const boxId = id || `Box-${String(itemIdx + 1).padStart(3, '0')}`;

  return (
    <group position={[cx, cy, cz]} scale={hovered ? 1.03 : 1.0}>
      <mesh
        geometry={faceGeo}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          setHovered(false);
        }}
      >
        <meshStandardMaterial
          color={color}
          transparent
          opacity={hovered ? 0.95 : 0.82}
          emissive={hovered ? color : '#000000'}
          emissiveIntensity={hovered ? 0.45 : 0}
          roughness={0.35}
          metalness={0.08}
        />
      </mesh>
      {(showLabels || hovered) && (
        <Html
          position={[0, h / 2 + 2, 0]}
          center
          style={{
            background: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            color: hovered ? '#f59e0b' : '#f1f5f9',
            padding: '3px 8px',
            borderRadius: '4px',
            fontSize: '11px',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            fontFamily: 'sans-serif',
            fontWeight: 'bold',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.5), 0 2px 4px -1px rgba(0, 0, 0, 0.3)',
            transition: 'all 0.15s ease',
          }}
        >
          {boxId}
        </Html>
      )}
      <lineSegments geometry={edgeGeo}>
        <lineBasicMaterial
          color={hovered ? '#ffffff' : '#000000'}
          transparent
          opacity={hovered ? 0.95 : 0.55}
        />
      </lineSegments>
    </group>
  );
});

// ── Main viewer ───────────────────────────────────────────────────────────────
export default function BinViewer({ result, placements: placementsProp, container: containerProp, binsUsed: binsUsedProp, showLabels, running }) {
  // Normalise to a single internal format
  const items     = result ? result.items      : (placementsProp || []);
  const container = result ? result.container  : containerProp;
  const binsUsed  = result ? result.bins_used  : (binsUsedProp || 0);

  const [currentStep, setCurrentStep] = useState(items.length);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0); // Speed multiplier: 0.5, 1.0, 2.0
  const [isLooping, setIsLooping] = useState(false);

  // Sync currentStep when items count changes (e.g. running new optimization or finishing)
  useEffect(() => {
    setCurrentStep(items.length);
  }, [items.length]);

  // Autoplay handler
  useEffect(() => {
    if (!isPlaying) return;

    const intervalDelay = Math.round(500 / playbackSpeed);
    const interval = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev >= items.length) {
          if (isLooping) {
            return 0; // Restart animation from beginning
          } else {
            setIsPlaying(false);
            return prev;
          }
        }
        return prev + 1;
      });
    }, intervalDelay);

    return () => clearInterval(interval);
  }, [isPlaying, items.length, playbackSpeed, isLooping]);

  // Slice items to current playback step
  const visibleItems = useMemo(() => {
    return items.slice(0, currentStep);
  }, [items, currentStep]);

  // Group items by bin — hook must come before any early return
  const byBin = useMemo(() => {
    const m = {};
    for (const it of visibleItems) {
      if (!m[it.bin_id]) m[it.bin_id] = [];
      m[it.bin_id].push(it);
    }
    return m;
  }, [visibleItems]);

  if (!container || !items || items.length === 0) return null;

  const { L, H, D } = container;
  const BIN_GAP     = L * 0.12;
  const binCount    = Math.max(binsUsed, ...Object.keys(byBin).map(Number)) + 1 || binsUsed;
  const totalWidth  = binCount * L + (binCount - 1) * BIN_GAP;
  const camDist     = Math.max(totalWidth, H, D) * 1.25;

  const targetX = totalWidth / 2;
  const targetY = H / 2;
  const targetZ = D / 2;

  // Enable labels globally when showLabels option is turned on
  const enableLabels = showLabels;

  return (
    <div style={{ width: '100%', borderRadius: 8, overflow: 'hidden' }}>
      <div style={{ width: '100%', height: 520, background: '#111827', position: 'relative' }}>
        <Canvas
          camera={{ position: [targetX, targetY + H * 0.8, targetZ + camDist], fov: 45 }}
          gl={{ antialias: true }}
        >
          <ambientLight intensity={0.65} />
          <directionalLight position={[200, 400, 300]} intensity={0.8} />
          <directionalLight position={[-200, 100, -200]} intensity={0.3} />

          {Array.from({ length: binCount }, (_, binId) => {
            const offsetX  = binId * (L + BIN_GAP);
            const binItems = byBin[binId] || [];
            return (
              <group key={binId} position={[offsetX, 0, 0]}>
                <WireBox x={0} y={0} z={0} l={L} h={H} d={D} />
                {binItems.map((it) => (
                  <ItemBox
                    key={it.item_idx}
                    x={it.x} y={it.y} z={it.z}
                    l={it.l} h={it.h} d={it.d}
                    itemIdx={it.item_idx}
                    id={it.id}
                    showLabels={enableLabels}
                  />
                ))}
              </group>
            );
          })}

          <OrbitControls makeDefault target={[targetX, targetY, targetZ]} />
        </Canvas>

        {/* Playback Controls Overlay */}
        {!running && (
          <div
            style={{
              position: 'absolute',
              bottom: 16,
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'rgba(15, 23, 42, 0.9)',
              border: '1px solid #334155',
              borderRadius: 8,
              padding: '12px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              zIndex: 10,
              width: '90%',
              maxWidth: 580,
              backdropFilter: 'blur(8px)',
              pointerEvents: 'auto',
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onMouseUp={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Row 1: Progress Slider */}
            <div style={{ display: 'flex', width: '100%', alignItems: 'center' }}>
              <input
                type="range"
                min="0"
                max={items.length}
                value={currentStep}
                onChange={(e) => {
                  setCurrentStep(parseInt(e.target.value, 10));
                  setIsPlaying(false);
                }}
                style={{
                  width: '100%',
                  cursor: 'pointer',
                  accentColor: '#3b82f6',
                  height: '6px',
                }}
              />
            </div>

            {/* Row 2: Controls & Settings */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 10,
              width: '100%'
            }}>
              {/* Loop & Speed Options (Left) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {/* Loop Toggle */}
                <button
                  onClick={() => setIsLooping(prev => !prev)}
                  style={{
                    background: isLooping ? '#10b981' : '#475569',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 4,
                    padding: '6px 10px',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                  title="Toggle Loop"
                >
                  🔁 {isLooping ? 'Loop: On' : 'Loop: Off'}
                </button>

                {/* Speed Selector */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#475569', borderRadius: 4, padding: '0 6px' }}>
                  <span style={{ color: '#cbd5e1', fontSize: 11, fontWeight: 'bold' }}>Speed:</span>
                  <select
                    value={String(playbackSpeed)}
                    onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
                    style={{
                      background: 'transparent',
                      color: '#fff',
                      border: 'none',
                      padding: '6px 2px',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      outline: 'none',
                    }}
                    title="Playback Speed"
                  >
                    <option value="0.5" style={{ background: '#1e293b' }}>0.5x</option>
                    <option value="1" style={{ background: '#1e293b' }}>1.0x</option>
                    <option value="2" style={{ background: '#1e293b' }}>2.0x</option>
                    <option value="4" style={{ background: '#1e293b' }}>4.0x</option>
                  </select>
                </div>
              </div>

              {/* Playback Navigation Buttons (Middle) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {/* Step Backward Button */}
                <button
                  onClick={() => {
                    setIsPlaying(false);
                    setCurrentStep((prev) => Math.max(0, prev - 1));
                  }}
                  disabled={currentStep === 0}
                  style={{
                    background: '#475569',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 4,
                    padding: '6px 10px',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: currentStep === 0 ? 'not-allowed' : 'pointer',
                    opacity: currentStep === 0 ? 0.5 : 1,
                  }}
                  title="Previous Box"
                >
                  ⏮
                </button>

                {/* Play/Pause Button */}
                <button
                  onClick={() => {
                    if (currentStep >= items.length) {
                      setCurrentStep(0);
                    }
                    setIsPlaying(prev => !prev);
                  }}
                  style={{
                    background: isPlaying ? '#ef4444' : '#3b82f6',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 4,
                    padding: '6px 12px',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    minWidth: 70,
                  }}
                >
                  {isPlaying ? '⏸ Pause' : '▶ Play'}
                </button>

                {/* Step Forward Button */}
                <button
                  onClick={() => {
                    setIsPlaying(false);
                    setCurrentStep((prev) => Math.min(items.length, prev + 1));
                  }}
                  disabled={currentStep === items.length}
                  style={{
                    background: '#475569',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 4,
                    padding: '6px 10px',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: currentStep === items.length ? 'not-allowed' : 'pointer',
                    opacity: currentStep === items.length ? 0.5 : 1,
                  }}
                  title="Next Box"
                >
                  ⏭
                </button>
              </div>

              {/* Counter Text (Right) */}
              <span style={{ color: '#f1f5f9', fontSize: 12, whiteSpace: 'nowrap', fontWeight: 600 }}>
                Showing {currentStep} of {items.length}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div style={{
        display: 'flex', gap: 14, padding: '8px 16px',
        background: '#1f2937', flexWrap: 'wrap', alignItems: 'center',
      }}>
        <span style={{ color: '#94a3b8', fontSize: 13 }}>
          {binCount} bin{binCount !== 1 ? 's' : ''} · {items.length} items
        </span>
        {Array.from({ length: Math.min(binCount, 8) }, (_, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{
              width: 12, height: 12, borderRadius: 2, border: '1px solid #374151',
              background: `hsl(${((byBin[i]?.[0]?.item_idx ?? i) * 137.508 % 360).toFixed(0)}, 70%, 60%)`,
            }} />
            <span style={{ color: '#9ca3af', fontSize: 12 }}>
              Bin {i} ({(byBin[i] || []).length})
            </span>
          </div>
        ))}
        {binCount > 8 && (
          <span style={{ color: '#6b7280', fontSize: 12 }}>+ {binCount - 8} more</span>
        )}
      </div>
    </div>
  );
}
