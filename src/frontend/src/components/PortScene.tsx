import { useEffect, useRef, useState } from "react";
import type { RecordItem, Register } from "../services/portService";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
interface Props {
  records: Record<Register, RecordItem[]>;
  onSelect: (id: string) => void;
  active: boolean;
  horizon: number;
  paused: boolean;
  reset: number;
}
export default function PortScene({
  records,
  onSelect,
  active,
  horizon,
  paused,
  reset,
}: Props) {
  const mount = useRef<HTMLDivElement>(null);
  const select = useRef(onSelect);
  select.current = onSelect;
  const pause = useRef(paused);
  pause.current = paused;
  const [failed, setFailed] = useState(false);
  const [tip, setTip] = useState<{ id: string; x: number; y: number } | null>(
    null,
  );
  useEffect(() => {
    const host = mount.current!;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    } catch {
      setFailed(true);
      return;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    host.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#bfcfca");
    scene.fog = new THREE.Fog("#bfcfca", 190, 530);
    const camera = new THREE.PerspectiveCamera(40, 1, 1, 850);
    camera.position.set(150, 142, 177);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(-5, 0, -8);
    controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI * 0.46;
    controls.minDistance = 75;
    controls.maxDistance = 300;
    controls.enablePan = true;
    scene.add(new THREE.HemisphereLight("#e7f4ff", "#676151", 2.5));
    const sun = new THREE.DirectionalLight("#fff0cf", 3.7);
    sun.position.set(-80, 160, 65);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, {
      left: -180,
      right: 180,
      top: 160,
      bottom: -160,
      near: 1,
      far: 400,
    });
    sun.shadow.bias = -0.0008;
    scene.add(sun);
    const materials: THREE.Material[] = [];
    const geometries: THREE.BufferGeometry[] = [];
    const mat = (c: string, metal = 0) => {
      const m = new THREE.MeshStandardMaterial({
        color: c,
        roughness: 0.82,
        metalness: metal,
      });
      materials.push(m);
      return m;
    };
    const concrete = mat("#a7a594"),
      road = mat("#666d68"),
      white = mat("#e4dfcc"),
      steel = mat("#c5b889", 0.2),
      dark = mat("#263e44"),
      red = mat("#833e31"),
      waterMat = mat("#447d80", 0.35),
      sand = mat("#b5ae8a");
    const box = (
      w: number,
      h: number,
      d: number,
      x: number,
      y: number,
      z: number,
      m: THREE.Material,
      parent: THREE.Object3D = scene,
    ) => {
      const g = new THREE.BoxGeometry(w, h, d);
      geometries.push(g);
      const o = new THREE.Mesh(g, m);
      o.position.set(x, y, z);
      o.castShadow = true;
      o.receiveShadow = true;
      parent.add(o);
      return o;
    };
    box(1100, 1, 1100, 0, -2, 0, waterMat);
    box(340, 3, 126, -20, -0.2, -108, sand);
    box(225, 4, 68, -12, 0, -53, concrete);
    box(246, 4, 13, -5, 0, -15, concrete);
    box(236, 0.08, 5, -6, 2.1, -31, road);
    box(7, 0.08, 81, -110, 2.1, -69, road);
    for (let i = 0; i < 42; i++)
      box(2, 0.06, 0.12, -118 + i * 5.5, 2.17, -31, white);
    const cargoMats = [
      "#a65137",
      "#c2b993",
      "#335b69",
      "#536a59",
      "#a08145",
      "#798b87",
    ].map((c) => mat(c));
    for (let a = 0; a < 11; a++)
      for (let b = 0; b < 7; b++) {
        const x = -89 + a * 16,
          z = -52 - b * 6.5;
        if (a > 7 && b > 3) continue;
        const levels = 1 + ((a + b) % 3);
        for (let l = 0; l < levels; l++) {
          box(
            11,
            2.2,
            4.2,
            x,
            3.1 + l * 2.3,
            z,
            cargoMats[(a * 3 + b + l) % 6],
          );
          for (let j = 0; j < 8; j++)
            box(
              0.08,
              2.1,
              0.06,
              x - 4.5 + j * 1.3,
              3.1 + l * 2.3,
              z + 2.14,
              dark,
            );
        }
      }
    for (let i = 0; i < 4; i++) {
      box(31, 9, 17, -73 + i * 49, 5, -129, mat("#b1b4a8"));
      box(33, 0.7, 19, -73 + i * 49, 9.8, -129, white);
      for (let w = 0; w < 5; w++)
        box(3, 2, 0.1, -85 + i * 49 + w * 5, 6, -120.4, dark);
    }
    for (let i = 0; i < 7; i++) {
      const g = new THREE.CylinderGeometry(7, 7, 8, 24);
      geometries.push(g);
      const t = new THREE.Mesh(g, white);
      t.position.set(112 + (i % 3) * 18, 4, -62 - Math.floor(i / 3) * 20);
      t.castShadow = true;
      scene.add(t);
    }
    const targets: THREE.Object3D[] = [];
    const markers: THREE.Mesh[] = [];
    const line = (
      a: THREE.Vector3,
      b: THREE.Vector3,
      r: number,
      m: THREE.Material,
      p: THREE.Object3D,
    ) => {
      const dir = b.clone().sub(a);
      const g = new THREE.CylinderGeometry(r, r, dir.length(), 6);
      geometries.push(g);
      const o = new THREE.Mesh(g, m);
      o.position.copy(a.clone().add(b).multiplyScalar(0.5));
      o.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        dir.normalize(),
      );
      o.castShadow = true;
      p.add(o);
    };
    function crane(x: number, id: string) {
      const group = new THREE.Group();
      group.position.set(x, 2, -14);
      scene.add(group);
      const base = box(7, 2, 7, 0, 1, 0, dark, group);
      base.userData.id = id;
      targets.push(base);
      for (const a of [-2, 2])
        for (const b of [-2, 2])
          line(
            new THREE.Vector3(a, 0, b),
            new THREE.Vector3(a * 0.7, 13, b * 0.7),
            0.38,
            steel,
            group,
          );
      box(5, 3, 5, 0, 14, 0, steel, group);
      box(2, 2, 2, 2.5, 14, 1, dark, group);
      line(
        new THREE.Vector3(0, 15, 0),
        new THREE.Vector3(0, 26, 20),
        0.55,
        steel,
        group,
      );
      line(
        new THREE.Vector3(0, 15, -7),
        new THREE.Vector3(0, 26, 20),
        0.1,
        dark,
        group,
      );
      line(
        new THREE.Vector3(0, 26, 20),
        new THREE.Vector3(0, 7, 20),
        0.06,
        dark,
        group,
      );
      for (let s = 0; s < 8; s++)
        line(
          new THREE.Vector3(-0.5, 15 + s * 1.35, s * 2.5),
          new THREE.Vector3(0.5, 16.5 + s * 1.35, (s + 1) * 2.5),
          0.12,
          steel,
          group,
        );
      const hit = box(
        9,
        23,
        9,
        0,
        11,
        0,
        new THREE.MeshBasicMaterial({ visible: false }),
        group,
      );
      hit.userData.id = id;
      targets.push(hit);
    }
    records.Berths.forEach((berth, i) => {
      const x = -82 + i * (165 / Math.max(3, records.Berths.length - 1));
      records.Cranes.filter((c) => c.location === berth.id).forEach((c, j) =>
        crane(x + j * 8, c.id),
      );
      const slab = box(
        46,
        0.18,
        11,
        x,
        2.13,
        -14,
        mat(i === 2 ? "#b79961" : "#adb39d"),
      );
      slab.userData.id = berth.id;
      targets.push(slab);
      const ringG = new THREE.RingGeometry(2.4, 3, 40);
      geometries.push(ringG);
      const ring = new THREE.Mesh(
        ringG,
        new THREE.MeshBasicMaterial({
          color: i === 2 ? "#e8ae47" : "#a2e6c3",
          side: THREE.DoubleSide,
        }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(x, 2.4, -8);
      scene.add(ring);
      markers.push(ring);
    });
    function ship(x: number, z: number, angle: number, index: number) {
      const group = new THREE.Group();
      group.position.set(x, 0, z);
      group.rotation.y = angle;
      scene.add(group);
      const shape = new THREE.Shape();
      shape.moveTo(-6, -24);
      shape.lineTo(6, -24);
      shape.lineTo(6, 17);
      shape.quadraticCurveTo(5, 24, 0, 29);
      shape.quadraticCurveTo(-5, 24, -6, 17);
      shape.closePath();
      const geo = new THREE.ExtrudeGeometry(shape, {
        depth: 4,
        bevelEnabled: true,
        bevelSize: 0.65,
        bevelThickness: 0.6,
        bevelSegments: 2,
        steps: 1,
      });
      geo.rotateX(-Math.PI / 2);
      geometries.push(geo);
      const hull = new THREE.Mesh(geo, index === 1 ? dark : red);
      hull.castShadow = true;
      group.add(hull);
      box(10, 0.6, 42, 0, 4.7, 0, white, group);
      box(9, 5, 6, 0, 7, -18, white, group);
      box(9.2, 1, 6.2, 0, 9, -18, dark, group);
      box(1, 5, 1, 0, 12, -19, white, group);
      for (let a = 0; a < 2; a++)
        for (let b = 0; b < 5; b++)
          box(
            4,
            2.5,
            6,
            -2.1 + a * 4.2,
            6,
            -10 + b * 6.2,
            cargoMats[(a + b + index) % 6],
            group,
          );
      return group;
    }
    ship(-81, 10, Math.PI / 2, 0);
    ship(-27, 10, Math.PI / 2, 1);
    ship(30, 10, Math.PI / 2, 2);
    const moving = ship(68, 92, Math.PI * 0.2, 1);
    ship(-111, 128, -0.3, 0);
    // Batch repeated static cargo geometry into instanced draws. Keep pick targets
    // and moving vessels independent so interaction/animation retain their transforms.
    scene.updateMatrixWorld(true);
    const batches = new Map<string, THREE.Mesh[]>();
    scene.traverse((object) => {
      if (
        !(object instanceof THREE.Mesh) ||
        !(object.geometry instanceof THREE.BoxGeometry) ||
        targets.includes(object)
      )
        return;
      let parent: THREE.Object3D | null = object.parent;
      while (parent) {
        if (parent === moving) return;
        parent = parent.parent;
      }
      const p = object.geometry.parameters;
      const key = `${p.width}/${p.height}/${p.depth}/${(object.material as THREE.Material).uuid}`;
      const group = batches.get(key) || [];
      group.push(object);
      batches.set(key, group);
    });
    batches.forEach((group) => {
      if (group.length < 3) return;
      const batch = new THREE.InstancedMesh(
        group[0].geometry,
        group[0].material,
        group.length,
      );
      group.forEach((mesh, i) => {
        batch.setMatrixAt(i, mesh.matrixWorld);
        mesh.removeFromParent();
      });
      batch.castShadow = true;
      batch.receiveShadow = true;
      scene.add(batch);
    });
    const waveG = new THREE.BufferGeometry();
    const verts = [];
    for (let i = 0; i < 750; i++) {
      const x = Math.sin(i * 72.17) * 290,
        z = 22 + ((i * 17.31) % 300);
      verts.push(x, -1.35, z, x + 1 + (i % 4), -1.35, z - 0.3);
    }
    waveG.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
    geometries.push(waveG);
    const waves = new THREE.LineSegments(
      waveG,
      new THREE.LineBasicMaterial({
        color: "#a8c5ba",
        transparent: true,
        opacity: 0.23,
      }),
    );
    scene.add(waves);
    const ray = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let down = { x: 0, y: 0 };
    function hit(e: PointerEvent) {
      const rect = host.getBoundingClientRect();
      pointer.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        (-(e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      ray.setFromCamera(pointer, camera);
      return ray.intersectObjects(targets)[0]?.object.userData.id;
    }
    const move = (e: PointerEvent) => {
      const id = hit(e);
      renderer.domElement.style.cursor = id ? "pointer" : "grab";
      setTip(
        id
          ? {
              id,
              x: e.clientX - host.getBoundingClientRect().left,
              y: e.clientY - host.getBoundingClientRect().top,
            }
          : null,
      );
    };
    const start = (e: PointerEvent) => {
      down = { x: e.clientX, y: e.clientY };
    };
    const click = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) < 5) {
        const id = hit(e);
        if (id) select.current(id);
      }
    };
    renderer.domElement.addEventListener("pointermove", move);
    renderer.domElement.addEventListener("pointerdown", start);
    renderer.domElement.addEventListener("pointerup", click);
    const leave = () => setTip(null);
    renderer.domElement.addEventListener("pointerleave", leave);
    const resize = new ResizeObserver(() => {
      const { width, height } = host.getBoundingClientRect();
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    });
    resize.observe(host);
    let frame = 0,
      t = 0;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let lastFrame = 0;
    function animate(now = 0) {
      frame = requestAnimationFrame(animate);
      if (document.hidden || now - lastFrame < 32) return;
      lastFrame = now;
      if (!pause.current && !reduced) {
        t += 0.005;
        moving.position.z = 92 - Math.sin(t * 0.3) * 14;
        waves.position.x = Math.sin(t) * 0.5;
      }
      controls.update();
      renderer.render(scene, camera);
    }
    animate();
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      controls.dispose();
      geometries.forEach((g) => g.dispose());
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments) {
          const list = Array.isArray(o.material) ? o.material : [o.material];
          list.forEach((m: THREE.Material) => m.dispose());
        }
      });
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, [reset, records]);
  const tipRecord = tip
    ? Object.values(records)
        .flat()
        .find((r) => r.id === tip.id)
    : null;
  return (
    <div className="scene-wrap">
      <div
        className="three-scene"
        ref={mount}
        aria-label="Interactive illustrative port scene. Drag to orbit, scroll to zoom. Use the berth list for keyboard access."
      />
      {failed && (
        <div className="scene-fallback">
          <h2>Port scene unavailable</h2>
          <p>
            This browser could not start 3D graphics. All operational modules
            and berth controls remain available.
          </p>
        </div>
      )}
      {tip && (
        <div
          className="scene-tooltip"
          style={{
            left: Math.min(
              tip.x + 16,
              (mount.current?.clientWidth || 600) - 225,
            ),
            top: Math.max(10, tip.y - 100),
          }}
        >
          <b>
            {tip.id} ·{" "}
            {tip.id.startsWith("C") ? "Harbour crane" : "Cargo berth"}
          </b>
          <span>
            {tip.id === "B03" || tip.id === "C07"
              ? "Elevated risk · inspection required"
              : "Operational · resources available"}
          </span>
          <span>
            Health {tipRecord?.health ?? 94}% · Workload{" "}
            {tipRecord?.workload ?? 61}%
          </span>
          <span>
            {tipRecord?.location} · {tipRecord?.status}
          </span>
          {tip.id.startsWith("B") ? (
            <span>
              Queue {tip.id === "B03" ? 5 : 1} · Delay{" "}
              {tip.id === "B03" ? "3.2h" : "10m"}
              <br />
              Crane {tip.id === "B03" ? "C07 restricted" : "available"}
            </span>
          ) : (
            <span>
              Assigned {tipRecord?.location} · {tipRecord?.capacity}t capacity
            </span>
          )}
          <small>Click to investigate →</small>
        </div>
      )}
      {active && (
        <div className="scene-horizon">
          {horizon === 0
            ? "Current simulated state"
            : `Illustrative outlook · +${horizon} hours`}
        </div>
      )}
    </div>
  );
}
