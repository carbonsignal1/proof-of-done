"use client";
// Hero 3D: a giant glossy forest-green checkmark with the gold coin (the payment).
// Loop: the coin hovers above (money held) → drops into the check's valley
// (verified, released) → rests → lifts again. Pauses offscreen; static when
// the visitor prefers reduced motion.
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

const LOOP = 8;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const easeOutBounce = (x: number) => {
  const n1 = 7.5625, d1 = 2.75;
  if (x < 1 / d1) return n1 * x * x;
  if (x < 2 / d1) return n1 * (x -= 1.5 / d1) * x + 0.75;
  if (x < 2.5 / d1) return n1 * (x -= 2.25 / d1) * x + 0.9375;
  return n1 * (x -= 2.625 / d1) * x + 0.984375;
};

function checkGeometry() {
  // Thick checkmark outline (short arm on the left, long arm rising to the right).
  const s = new THREE.Shape();
  s.moveTo(-2.7, 0.55);
  s.lineTo(-1.95, 1.3);
  s.lineTo(-0.55, -0.1);
  s.lineTo(2.55, 3.0);
  s.lineTo(3.3, 2.25);
  s.lineTo(-0.55, -1.6);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 1.0, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.1, bevelSegments: 8, curveSegments: 4 });
  g.translate(0, 0, -0.5);
  return g;
}

function coinGeometry() {
  const r = 0.5, profile: THREE.Vector2[] = [];
  for (let i = 0; i <= 12; i++) {
    const x = (i / 12) * r * 0.95;
    profile.push(new THREE.Vector2(x, -0.04 - 0.035 * Math.cos((x / r) * Math.PI * 0.5)));
  }
  profile.push(new THREE.Vector2(r, -0.035), new THREE.Vector2(r, 0.035));
  for (let i = 12; i >= 0; i--) {
    const x = (i / 12) * r * 0.95;
    profile.push(new THREE.Vector2(x, 0.04 + 0.035 * Math.cos((x / r) * Math.PI * 0.5)));
  }
  return new THREE.LatheGeometry(profile, 96);
}

export default function CheckScene() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    } catch {
      return; // no WebGL: the CSS fallback stays visible
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.02).texture;
    scene.environment = env;

    const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(-4, 7, 6);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.radius = 8;
    key.shadow.bias = -0.0005;
    Object.assign(key.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6 });
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xdfffee, 0.9);
    rim.position.set(6, 2, -4);
    scene.add(rim);

    // Lighter green in dark mode so the check doesn't vanish into the background.
    const darkMode = document.documentElement.dataset.theme === "dark" ||
      (document.documentElement.dataset.theme !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    const green = new THREE.MeshPhysicalMaterial({ color: darkMode ? 0x3f8a64 : 0x17382a, metalness: 0.35, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 1.2 });
    const gold = new THREE.MeshPhysicalMaterial({ color: 0xffd27a, metalness: 1, roughness: 0.16, clearcoat: 0.7, clearcoatRoughness: 0.1, envMapIntensity: 1.8 });

    const world = new THREE.Group();
    scene.add(world);

    const checkGeo = checkGeometry();
    const check = new THREE.Mesh(checkGeo, green);
    check.castShadow = check.receiveShadow = true;
    world.add(check);

    const coinGeo = coinGeometry();
    const rimGeo = new THREE.TorusGeometry(0.49, 0.035, 16, 96);
    const coin = new THREE.Group();
    const disc = new THREE.Mesh(coinGeo, gold);
    disc.rotation.x = Math.PI / 2;
    const ring = new THREE.Mesh(rimGeo, gold);
    coin.add(disc, ring);
    coin.traverse((o) => ((o as THREE.Mesh).isMesh ? (o.castShadow = true) : null));
    world.add(coin);

    // Soft shadow catcher behind the check
    const groundGeo = new THREE.PlaneGeometry(30, 30);
    const ground = new THREE.Mesh(groundGeo, new THREE.ShadowMaterial({ opacity: 0.05 }));
    ground.position.z = -1.6;
    ground.receiveShadow = true;
    world.add(ground);

    // Coin sits in the valley of the check (the arms meet at 90°, so its centre is r·√2 above the vertex).
    const rest = new THREE.Vector3(-0.55, -0.1 + 0.5 * Math.SQRT2 + 0.12, 0.05);
    const hover = new THREE.Vector3(-0.2, 2.6, 0.9);

    const resize = () => {
      const w = host.clientWidth, h = host.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      // Frame it big and cropped, like a giant letterform bleeding off the edge.
      const narrow = camera.aspect < 0.9;
      camera.position.set(narrow ? 0.8 : 1.6, narrow ? 0.9 : 0.6, narrow ? 12.5 : 10.5);
      camera.lookAt(narrow ? 0.4 : 1.3, 0.8, 0);
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();

    let px = 0, py = 0;
    const onMove = (e: PointerEvent) => {
      const r = host.getBoundingClientRect();
      px = ((e.clientX - r.left) / r.width - 0.5) * 2;
      py = ((e.clientY - r.top) / r.height - 0.5) * 2;
    };
    window.addEventListener("pointermove", onMove, { passive: true });

    const pose = (t: number, clock: number) => {
      // 0–2.6s hover · 2.6–3.6 drop · 3.6–6.6 rest · 6.6–8 lift
      const drop = t < 2.6 ? 0 : t < 3.6 ? easeOutBounce(clamp01((t - 2.6) / 1.0)) : t < 6.6 ? 1 : 1 - easeInOut(clamp01((t - 6.6) / 1.4));
      const bob = Math.sin(clock * 2) * 0.1 * (1 - drop);
      coin.position.lerpVectors(hover, rest, drop);
      coin.position.y += bob;
      coin.rotation.y = (1 - drop) * (0.5 + Math.sin(clock * 1.1) * 0.6) + drop * 0.35;
      coin.rotation.x = -0.25 * (1 - drop);
      coin.rotation.z = (1 - drop) * Math.sin(clock * 1.4) * 0.08;
    };

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let visible = true;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting), { threshold: 0.01 });
    io.observe(host);

    let raf = 0;
    const start = performance.now();
    let ry = 0, rx = 0;
    const draw = (clock: number) => {
      pose(clock % LOOP, clock);
      ry += (-0.38 + px * 0.12 + Math.sin(clock * 0.3) * 0.05 - ry) * 0.05;
      rx += (0.08 + py * 0.05 - rx) * 0.05;
      world.rotation.set(rx, ry, 0);
      renderer.render(scene, camera);
      host.dataset.ready = "1";
    };
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (!visible || document.hidden) return;
      draw((now - start) / 1000);
    };
    if (reduced) {
      ry = -0.38; rx = 0.08;
      pose(5, 0);
      world.rotation.set(rx, ry, 0);
      renderer.render(scene, camera);
      host.dataset.ready = "1";
    } else {
      raf = requestAnimationFrame(tick);
    }

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener("pointermove", onMove);
      [checkGeo, coinGeo, rimGeo, groundGeo].forEach((g) => g.dispose());
      [green, gold, ground.material as THREE.Material].forEach((m) => m.dispose());
      env.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      delete host.dataset.ready;
    };
  }, []);

  return (
    <div ref={ref} className="ed-scene" aria-hidden="true">
      <div className="scene-fallback"><span className="ed-fallback-check">✓</span></div>
    </div>
  );
}
