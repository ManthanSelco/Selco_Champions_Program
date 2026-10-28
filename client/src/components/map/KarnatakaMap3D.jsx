import { Suspense, forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Html, Line, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import gsap from 'gsap';
import { DISTRICTS, project } from '../../lib/geo';
import { vc, tint } from '../../lib/valueChains';
import { assetUrl } from '../../lib/api';

const BASE_H = 0.16;
const SAND = ['#F1E7D6', '#EEE2CD', '#F3EBDD', '#EADDC5', '#F0E5D2'];
const CAMERA_HOME = new THREE.Vector3(0.2, 10.2, 7.4);
// Portrait phones need the camera further back so the whole state fits.
function homeFor(size) {
  const aspect = size.width / Math.max(size.height, 1);
  const k = aspect < 0.62 ? 1.5 : aspect < 0.9 ? 1.3 : aspect < 1.2 ? 1.15 : 1.1;
  return CAMERA_HOME.clone().multiplyScalar(k);
}
const TARGET_HOME = new THREE.Vector3(0, 0, 0.95);

function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function buildShapes(d) {
  return d.polygons.map((poly) => {
    const shape = new THREE.Shape(poly[0].map(([x, y]) => new THREE.Vector2(...project(x, y))));
    shape.holes = poly.slice(1).map((h) => new THREE.Path(h.map(([x, y]) => new THREE.Vector2(...project(x, y)))));
    return shape;
  });
}

/* ------------------------------- District -------------------------------- */
function District({ d, info, mode, selected, dimmed, hovered, setHovered, onSelect, heights }) {
  const mesh = useRef();
  const top = useRef();
  const side = useRef();
  const intro = useRef(0);

  const geom = useMemo(() => new THREE.ExtrudeGeometry(buildShapes(d), { depth: 1, bevelEnabled: false, curveSegments: 1 }), [d]);
  const rings = useMemo(
    () => d.polygons.map((p) => p[0].map(([x, y]) => [...project(x, y), 1.002])),
    [d]
  );

  const count = info?.count || 0;
  const targetH = BASE_H + (count ? 0.1 + Math.min(count, 4) * 0.06 : 0) + (hovered ? 0.05 : 0) + (selected ? 0.12 : 0);

  const sand = SAND[hash(d.name) % SAND.length];
  let color;
  if (selected) color = '#E3242B';
  else if (mode === 'valueChain' && info?.chain) color = tint(vc(info.chain).color, hovered ? 0.2 : 0.38);
  else if (count) color = hovered ? '#F0B65F' : '#E9BE7E';
  else color = hovered ? '#FBF6EE' : sand;
  if (dimmed && !selected) color = '#E6E2DC';

  const targetColor = useMemo(() => new THREE.Color(color), [color]);
  const targetSide = useMemo(() => new THREE.Color(color).multiplyScalar(0.78), [color]);

  useFrame((_, dt) => {
    if (!mesh.current) return;
    intro.current = Math.min(1, intro.current + dt * 0.9);
    const k = 1 - Math.pow(1 - intro.current, 3);
    const h = THREE.MathUtils.damp(mesh.current.scale.z, targetH * k + 0.0001, 8, dt);
    mesh.current.scale.z = h;
    heights.current[d.name] = h;
    top.current.color.lerp(targetColor, 1 - Math.exp(-dt * 8));
    side.current.color.lerp(targetSide, 1 - Math.exp(-dt * 8));
  });

  return (
    <mesh
      ref={mesh}
      geometry={geom}
      scale={[1, 1, 0.0001]}
      castShadow
      receiveShadow
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(d.name);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        setHovered((h) => (h === d.name ? null : h));
        document.body.style.cursor = '';
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(d.name);
      }}
    >
      <meshStandardMaterial ref={top} attach="material-0" color={sand} roughness={0.85} metalness={0} />
      <meshStandardMaterial ref={side} attach="material-1" color={sand} roughness={0.9} metalness={0} />
      {rings.map((r, i) => (
        <Line key={i} points={r} color={selected ? '#ffffff' : '#ffffff'} lineWidth={selected ? 2.2 : 1.1} transparent opacity={0.95} />
      ))}
    </mesh>
  );
}

/* -------------------------------- Marker --------------------------------- */
function Marker({ c, mode, heights, active, onHover, onOpen, index }) {
  const group = useRef();
  const halo = useRef();
  const head = useRef();
  const [x, y] = project(c.lng, c.lat);
  const color = mode === 'valueChain' ? vc(c.valueChain).color : '#E3242B';
  const born = useRef(-index * 0.12);

  useFrame((state, dt) => {
    if (!group.current) return;
    born.current += dt;
    const appear = THREE.MathUtils.clamp((born.current - 1.1) * 2.2, 0, 1);
    const ease = 1 - Math.pow(1 - appear, 3);
    const h = heights.current[c.district] ?? BASE_H;
    group.current.position.z = h;
    const s = THREE.MathUtils.damp(group.current.scale.x, (active ? 1.45 : 1) * ease + 0.0001, 10, dt);
    group.current.scale.setScalar(s);
    const t = (state.clock.elapsedTime * 0.8 + index * 0.37) % 1;
    halo.current.scale.setScalar(1 + t * 2.6);
    halo.current.material.opacity = 0.45 * (1 - t) * ease;
    head.current.position.z = 0.36 + Math.sin(state.clock.elapsedTime * 2 + index) * 0.02;
  });

  return (
    <group ref={group} position={[x, y, BASE_H]} scale={0.0001}>
      {/* pulsing ground halo */}
      <mesh ref={halo} position={[0, 0, 0.01]}>
        <ringGeometry args={[0.07, 0.1, 40]} />
        <meshBasicMaterial color={color} transparent opacity={0.4} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0, 0.005]}>
        <circleGeometry args={[0.065, 32]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.9} />
      </mesh>
      {/* stem */}
      <mesh position={[0, 0, 0.18]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.012, 0.012, 0.36, 8]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* head */}
      <group ref={head} position={[0, 0, 0.36]}>
        <mesh
          castShadow
          onPointerOver={(e) => {
            e.stopPropagation();
            onHover(c.id);
            document.body.style.cursor = 'pointer';
          }}
          onPointerOut={() => {
            onHover(null);
            document.body.style.cursor = '';
          }}
          onClick={(e) => {
            e.stopPropagation();
            onOpen(c);
          }}
        >
          <sphereGeometry args={[0.1, 32, 32]} />
          <meshStandardMaterial color={color} roughness={0.35} emissive={color} emissiveIntensity={0.25} />
        </mesh>
        <mesh position={[-0.03, 0.03, 0.06]}>
          <sphereGeometry args={[0.028, 16, 16]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.85} />
        </mesh>
        {active && (
          <Html position={[0, 0, 0.16]} center zIndexRange={[30, 10]} style={{ pointerEvents: 'none' }}>
            <div className="flex -translate-y-6 items-center gap-2 whitespace-nowrap rounded-full bg-white/95 py-1 pl-1 pr-3 shadow-lift ring-1 ring-black/5">
              {c.photo ? (
                <img src={assetUrl(c.photo)} alt="" className="h-7 w-7 rounded-full object-cover object-[center_25%]" />
              ) : (
                <span className="grid h-7 w-7 place-items-center rounded-full text-[11px] font-bold text-white" style={{ background: color }}>
                  {c.name.split(' ').map((s) => s[0]).slice(0, 2).join('')}
                </span>
              )}
              <span className="text-[12px] font-semibold text-ink">{c.name}</span>
              <span className="text-[11px] text-ink-mute">· {c.valueChain}</span>
            </div>
          </Html>
        )}
      </group>
    </group>
  );
}

/* ----------------------------- District labels --------------------------- */
function DistrictLabel({ d, info, heights, show, selected }) {
  const ref = useRef();
  const [x, y] = project(...d.centroid);
  useFrame(() => {
    if (ref.current) ref.current.position.z = (heights.current[d.name] ?? BASE_H) + 0.05;
  });
  if (!show) return null;
  return (
    <group ref={ref} position={[x, y, BASE_H]}>
      <Html center zIndexRange={[25, 5]} style={{ pointerEvents: 'none' }}>
        <div
          className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[10.5px] font-semibold shadow-sm transition ${
            selected ? 'bg-ink text-white' : 'bg-white/85 text-ink-soft backdrop-blur'
          }`}
        >
          {d.name}
          {info?.count ? <span className={selected ? 'ml-1 text-white/70' : 'ml-1 text-selco'}>· {info.count}</span> : null}
        </div>
      </Html>
    </group>
  );
}

/* ------------------------------- Camera rig ------------------------------ */
const CameraRig = forwardRef(function CameraRig({ focus }, ref) {
  const { camera, controls, size } = useThree();
  const first = useRef(true);
  const home = () => homeFor(size);
  // portrait screens: aim a little nearer so the state sits centred in the box, not low
  const target = () => (size.width / Math.max(size.height, 1) < 0.9 ? new THREE.Vector3(0, 0, 1.25) : TARGET_HOME.clone());
  const zoomK = size.width / Math.max(size.height, 1) < 0.9 ? 1.35 : 1;

  const flyTo = (pos, target, duration = 1.4) => {
    if (!controls) return;
    gsap.to(camera.position, { x: pos.x, y: pos.y, z: pos.z, duration, ease: 'power3.inOut', onUpdate: () => controls.update() });
    gsap.to(controls.target, { x: target.x, y: target.y, z: target.z, duration, ease: 'power3.inOut', onUpdate: () => controls.update() });
  };

  useImperativeHandle(ref, () => ({
    reset: () => flyTo(home(), target()),
    zoom: (k, duration = 0.6) => {
      if (!controls) return;
      const dir = camera.position.clone().sub(controls.target);
      const len = THREE.MathUtils.clamp(dir.length() * k, 3.5, 24);
      const next = controls.target.clone().add(dir.setLength(len));
      gsap.to(camera.position, { x: next.x, y: next.y, z: next.z, duration, ease: 'power2.out', overwrite: 'auto', onUpdate: () => controls.update() });
    },
  }));

  // Intro: swoop down from above.
  useEffect(() => {
    if (!controls || !first.current) return;
    first.current = false;
    camera.position.set(0, 24, 0.5);
    controls.target.copy(target());
    controls.update();
    const h = home();
    // controls.update() keeps the camera aimed at the map while it moves. It must be called
    // explicitly because on phones the controls stay disabled until "Move map" is tapped.
    gsap.to(camera.position, { x: h.x, y: h.y, z: h.z, duration: 2.6, ease: 'expo.out', delay: 0.15, onUpdate: () => controls.update() });
  }, [controls, camera]);

  // Selecting a district no longer zooms in: the whole state stays in view so the
  // visitor can pick another district straight away (the district is highlighted instead).

  return null;
});

/* --------------------------------- Scene --------------------------------- */
function Scene({ champions, mode, selectedDistrict, onSelectDistrict, hoveredId, onHoverChampion, onOpenChampion, dimDistricts, rigRef, interactive, touch }) {
  const [hovered, setHovered] = useState(null);
  const heights = useRef({});
  const { gl, size, controls } = useThree();
  const narrow = size.width < 640;

  // On phones the map must not swallow the page scroll: a one-finger swipe scrolls the
  // page (taps still select districts) until the visitor unlocks the map.
  useEffect(() => {
    // OrbitControls sets touch-action:none on the element it listens to (R3F's wrapper div),
    // so override it on the canvas and its wrappers.
    const apply = () => {
      const v = touch && !interactive ? 'pan-y' : 'none';
      let el = gl.domElement;
      for (let i = 0; i < 3 && el; i++, el = el.parentElement) el.style.touchAction = v;
    };
    apply();
    const t = setTimeout(apply, 50);
    return () => clearTimeout(t);
  }, [gl, touch, interactive, controls]);

  const info = useMemo(() => {
    const m = {};
    for (const c of champions) {
      const e = (m[c.district] ||= { count: 0, chains: {} });
      e.count++;
      e.chains[c.valueChain] = (e.chains[c.valueChain] || 0) + 1;
    }
    for (const e of Object.values(m)) e.chain = Object.entries(e.chains).sort((a, b) => b[1] - a[1])[0][0];
    return m;
  }, [champions]);

  const placed = champions.filter((c) => c.lat != null && c.lng != null);

  return (
    <>
      <ambientLight intensity={0.55} />
      <hemisphereLight args={['#ffffff', '#d8cbb5', 0.4]} />
      <directionalLight
        position={[5, 12, 7]}
        intensity={1.15}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
        shadow-bias={-0.0004}
      />
      <directionalLight position={[-6, 5, -4]} intensity={0.35} />

      <group rotation={[-Math.PI / 2, 0, 0]} onPointerMissed={() => setHovered(null)}>
        {DISTRICTS.map((d) => (
          <District
            key={d.name}
            d={d}
            info={info[d.name]}
            mode={mode}
            selected={selectedDistrict === d.name}
            dimmed={dimDistricts && !info[d.name]}
            hovered={hovered === d.name}
            setHovered={setHovered}
            onSelect={onSelectDistrict}
            heights={heights}
          />
        ))}
        {DISTRICTS.map((d) => (
          <DistrictLabel
            key={d.name}
            d={d}
            info={info[d.name]}
            heights={heights}
            selected={selectedDistrict === d.name}
            show={hovered === d.name || selectedDistrict === d.name || (!narrow && !!info[d.name])}
          />
        ))}
        {placed.map((c, i) => (
          <Marker
            key={c.id}
            c={c}
            index={i}
            mode={mode}
            heights={heights}
            active={hoveredId === c.id}
            onHover={onHoverChampion}
            onOpen={onOpenChampion}
          />
        ))}
      </group>

      <ContactShadows position={[0, -0.01, 0]} opacity={0.35} scale={22} blur={2.6} far={4} color="#5b4a33" />
      <CameraRig ref={rigRef} focus={selectedDistrict} />
      <OrbitControls
        makeDefault
        enabled={!touch || interactive}
        enableZoom={touch && interactive}
        enablePan={!touch || interactive}
        enableDamping
        dampingFactor={0.08}
        minDistance={3.5}
        maxDistance={22}
        maxPolarAngle={1.18}
        rotateSpeed={0.6}
        zoomSpeed={0.8}
        panSpeed={0.8}
        screenSpacePanning={false}
      />
    </>
  );
}

const KarnatakaMap3D = forwardRef(function KarnatakaMap3D(props, ref) {
  const { onWheelHint, ...rest } = props;
  const rigRef = useRef();
  const wrap = useRef(null);
  const [touch] = useState(() => typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches);
  useImperativeHandle(ref, () => ({
    reset: () => rigRef.current?.reset(),
    zoomIn: () => rigRef.current?.zoom(0.75),
    zoomOut: () => rigRef.current?.zoom(1.3),
  }));

  // Desktop: plain mouse-wheel scrolls the page; Ctrl/⌘ + wheel (or trackpad pinch) zooms the map.
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const onWheel = (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        rigRef.current?.zoom(e.deltaY > 0 ? 1.12 : 0.89, 0.25);
      } else onWheelHint?.();
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [onWheelHint]);

  return (
    <div ref={wrap} className="h-full w-full">
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [0, 24, 0.5], fov: 38, near: 0.1, far: 200 }}
      flat
      gl={{ antialias: true, alpha: true }}
    >
      <Suspense fallback={null}>
        <Scene {...rest} rigRef={rigRef} touch={touch} />
      </Suspense>
    </Canvas>
    </div>
  );
});

export default KarnatakaMap3D;
