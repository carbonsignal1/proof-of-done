"use client";
// Hero 3D scene: chrome blocks stack up (the work getting done) while a gold
// coin (the payment) hovers above, held. When the stack is complete the coin
// lands on top: released. Loops; pauses offscreen; static for reduced motion.
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

export type Phase = 0 | 1 | 2; // 0 held, 1 work being verified, 2 released

const LOOP = 9.6;
const DROP_START = 0.7;
const DROP_GAP = 0.42;
const DROP_DUR = 0.75;
const COIN_DOWN = [4.0, 5.1] as const;
const OUTRO = [8.4, 9.4] as const;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const easeOutBack = (x: number) => {
  const c1 = 1.25, c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};
const easeInOutCubic = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const easeInCubic = (x: number) => x * x * x;

function gearGeometry(outer: number, inner: number, teeth: number, depth: number) {
  const shape = new THREE.Shape();
  const steps = teeth * 4;
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const r = i % 4 === 0 || i % 4 === 1 ? outer : inner;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 3, curveSegments: 4 });
  g.center();
  return g;
}

export default function HeroScene({ onPhase }: { onPhase?: (p: Phase) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const phaseCb = useRef(onPhase);
  phaseCb.current = onPhase;

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
    renderer.toneMappingExposure = 1.05;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    host.appendChild(renderer.domElement);


    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.03).texture;
    scene.environment = envTex;

    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    const target = new THREE.Vector3(0.2, 1.75, 0);

    const sun = new THREE.DirectionalLight(0xffffff, 1.4);
    sun.position.set(3.5, 9, 5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -5; sun.shadow.camera.right = 5;
    sun.shadow.camera.top = 5; sun.shadow.camera.bottom = -5;
    sun.shadow.radius = 6;
    sun.shadow.bias = -0.0005;
    scene.add(sun);
    scene.add(new THREE.HemisphereLight(0xffffff, 0xdcdce6, 0.5));
    const key = new THREE.DirectionalLight(0xfff4e0, 1.1);
    key.position.set(-2, 4, 10);
    scene.add(key);

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShadowMaterial({ opacity: 0.1 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const chrome = new THREE.MeshPhysicalMaterial({ color: 0xd8d9e6, metalness: 1, roughness: 0.17, clearcoat: 0.4, clearcoatRoughness: 0.2, envMapIntensity: 1.15 });
    const chromeSoft = chrome.clone();
    chromeSoft.roughness = 0.32;
    const gold = new THREE.MeshPhysicalMaterial({ color: 0xffd47a, metalness: 1, roughness: 0.16, clearcoat: 0.7, clearcoatRoughness: 0.1, envMapIntensity: 1.9 });

    const world = new THREE.Group();
    scene.add(world);

    const geos: THREE.BufferGeometry[] = [];
    const track = <T extends THREE.BufferGeometry>(g: T) => (geos.push(g), g);

    type Piece = { obj: THREE.Object3D; rest: THREE.Vector3; delay: number };
    const pieces: Piece[] = [];
    const add = (obj: THREE.Object3D, rest: THREE.Vector3) => {
      obj.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
      });
      world.add(obj);
      pieces.push({ obj, rest, delay: DROP_START + pieces.length * DROP_GAP });
    };

    // half cylinder lying down (left)
    {
      const m = new THREE.Mesh(track(new THREE.CylinderGeometry(0.78, 0.78, 1.5, 64, 1, false, 0, Math.PI)), chrome);
      m.rotation.z = Math.PI / 2;
      const g = new THREE.Group();
      g.add(m);
      g.rotation.y = -0.25;
      add(g, new THREE.Vector3(-1.6, 0, 0.35));
    }
    // base cube
    {
      const m = new THREE.Mesh(track(new RoundedBoxGeometry(1.1, 1.1, 1.1, 5, 0.06)), chrome);
      m.rotation.y = 0.18;
      add(m, new THREE.Vector3(0.35, 0.55, 0));
    }
    // sphere (front)
    add(new THREE.Mesh(track(new THREE.SphereGeometry(0.34, 48, 32)), chrome), new THREE.Vector3(-0.6, 0.34, 1.3));
    // arch (right), half-disc facing the camera
    {
      const m = new THREE.Mesh(track(new THREE.CylinderGeometry(0.62, 0.62, 0.55, 64, 1, false, 0, Math.PI)), chromeSoft);
      m.rotation.z = Math.PI / 2;
      const g = new THREE.Group();
      g.add(m);
      g.rotation.y = Math.PI / 2 - 0.2;
      add(g, new THREE.Vector3(1.9, 0, 0.15));
    }
    // cube balanced on its edge
    {
      const m = new THREE.Mesh(track(new RoundedBoxGeometry(0.9, 0.9, 0.9, 5, 0.05)), chrome);
      m.rotation.set(0, 0.32, Math.PI / 4);
      add(m, new THREE.Vector3(0.35, 1.1 + 0.9 * Math.SQRT1_2, 0));
    }
    // gear on the arch
    {
      const m = new THREE.Mesh(track(gearGeometry(0.42, 0.36, 16, 0.16)), chromeSoft);
      m.rotation.y = -0.2;
      add(m, new THREE.Vector3(1.9, 0.62 + 0.42, 0.15));
    }

    // the coin = the payment
    const coin = new THREE.Group();
    {
      // Slightly domed faces so the metal picks up a gradient instead of one flat colour.
      const profile: THREE.Vector2[] = [];
      for (let i = 0; i <= 12; i++) {
        const r = (i / 12) * 0.42;
        profile.push(new THREE.Vector2(r, 0.035 + 0.035 * Math.cos((r / 0.42) * Math.PI * 0.5)));
      }
      profile.push(new THREE.Vector2(0.445, 0.03), new THREE.Vector2(0.445, -0.03));
      for (let i = 12; i >= 0; i--) {
        const r = (i / 12) * 0.42;
        profile.push(new THREE.Vector2(r, -0.035 - 0.035 * Math.cos((r / 0.42) * Math.PI * 0.5)));
      }
      profile.reverse(); // Lathe expects bottom-to-top order for outward-facing normals
      const disc = new THREE.Mesh(track(new THREE.LatheGeometry(profile, 96)), gold);
      disc.rotation.x = Math.PI / 2;
      const rim = new THREE.Mesh(track(new THREE.TorusGeometry(0.43, 0.03, 16, 96)), gold);
      coin.add(disc, rim);
      coin.rotation.x = -0.3; // tip the face up toward the light
      coin.traverse((o) => ((o as THREE.Mesh).isMesh ? (o.castShadow = true) : null));
    }
    const coinRest = new THREE.Vector3(0.35, 1.1 + 0.9 * Math.SQRT2 + 0.44, 0);
    const coinHover = coinRest.clone().add(new THREE.Vector3(0, 0.9, 0.25));
    world.add(coin);

    // --- sizing ---
    const resize = () => {
      const w = host.clientWidth, h = host.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      const dist = camera.aspect < 1 ? 12 / Math.max(camera.aspect, 0.6) : 12;
      camera.position.set(1.7, 3.9, dist);
      camera.lookAt(target);
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();

    // --- pointer parallax ---
    let px = 0, py = 0;
    const onMove = (e: PointerEvent) => {
      const r = host.getBoundingClientRect();
      px = ((e.clientX - r.left) / r.width - 0.5) * 2;
      py = ((e.clientY - r.top) / r.height - 0.5) * 2;
    };
    window.addEventListener("pointermove", onMove, { passive: true });

    // --- animation ---
    let lastPhase: Phase | -1 = -1;
    const setPhase = (p: Phase) => {
      if (p !== lastPhase) {
        lastPhase = p;
        phaseCb.current?.(p);
      }
    };

    const pose = (t: number, clock: number) => {
      const outro = clamp01((t - OUTRO[0]) / (OUTRO[1] - OUTRO[0]));
      for (const p of pieces) {
        const k = clamp01((t - p.delay) / DROP_DUR);
        const y = p.rest.y + (1 - easeOutBack(k)) * 2.6;
        const s = (0.55 + 0.45 * Math.min(1, k * 1.6)) * (1 - easeInCubic(outro));
        p.obj.position.set(p.rest.x, y, p.rest.z);
        p.obj.scale.setScalar(Math.max(0.0001, k > 0 ? s : 0.0001));
        p.obj.visible = k > 0 && s > 0.001;
      }
      const down = easeInOutCubic(clamp01((t - COIN_DOWN[0]) / (COIN_DOWN[1] - COIN_DOWN[0])));
      const up = easeInOutCubic(outro);
      const blend = down * (1 - up);
      const bob = Math.sin(clock * 2.2) * 0.08 * (1 - blend);
      coin.position.lerpVectors(coinHover, coinRest, blend);
      coin.position.y += bob;
      coin.rotation.y = 0.55 + (1 - blend) * Math.sin(clock * 0.9) * 0.7 - 0.2 * blend;
      coin.rotation.z = (1 - blend) * Math.sin(clock * 1.3) * 0.08;

      setPhase(t < DROP_START ? 0 : t < COIN_DOWN[0] ? 1 : t < OUTRO[0] ? 2 : 0);
    };

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let visible = true;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting), { threshold: 0.01 });
    io.observe(host);

    let raf = 0;
    const start = performance.now();
    let rotY = 0, rotX = 0;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (!visible || document.hidden) return;
      const clock = (now - start) / 1000;
      pose(clock % LOOP, clock);
      rotY += (px * 0.18 + Math.sin(clock * 0.25) * 0.06 - rotY) * 0.05;
      rotX += (py * 0.05 - rotX) * 0.05;
      world.rotation.set(rotX, rotY, 0);
      renderer.render(scene, camera);
      host.dataset.ready = "1"; // hide the placeholder only once a frame is drawn
    };

    if (reduced) {
      pose(6.5, 0);
      renderer.render(scene, camera);
      host.dataset.ready = "1";
      ro.disconnect();
      const ro2 = new ResizeObserver(() => {
        resize();
        renderer.render(scene, camera);
      });
      ro2.observe(host);
      return () => {
        ro2.disconnect();
        io.disconnect();
        window.removeEventListener("pointermove", onMove);
        geos.forEach((g) => g.dispose());
        [chrome, chromeSoft, gold].forEach((m) => m.dispose());
        envTex.dispose();
        pmrem.dispose();
        renderer.dispose();
        renderer.domElement.remove();
      };
    }

    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener("pointermove", onMove);
      geos.forEach((g) => g.dispose());
      [chrome, chromeSoft, gold].forEach((m) => m.dispose());
      (ground.material as THREE.Material).dispose();
      ground.geometry.dispose();
      envTex.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      delete host.dataset.ready;
    };
  }, []);

  return (
    <div ref={ref} className="hero-scene" aria-hidden="true">
      <div className="scene-fallback">
        <span className="coin" style={{ width: 120, height: 120 }} />
      </div>
    </div>
  );
}
