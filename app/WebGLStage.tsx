"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { PROJECTS } from "./projectData";

const vertexShader = `
  uniform float uTime;
  uniform float uDistort;
  uniform float uDirection;
  varying vec2 vUv;
  varying float vBend;

  void main() {
    vUv = uv;
    vec3 p = position;
    float envelope = sin(uv.y * 3.14159265);
    float bend = sin((uv.y * 5.0) + (uv.x * 2.4) + (uTime * 0.16));
    p.z += bend * uDistort * 0.2;
    p.x += envelope * uDistort * uDirection * 0.16;
    vBend = abs(bend * uDistort);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const fragmentShader = `
  uniform sampler2D uTexture;
  uniform float uOpacity;
  uniform float uActive;
  uniform float uReveal;
  uniform float uSweep;
  uniform float uTime;
  uniform vec2 uPointer;
  varying vec2 vUv;
  varying float vBend;

  void main() {
    vec2 sampleUv = vUv;
    sampleUv.x += sin(vUv.y * 8.0 + uTime * 0.14) * vBend * 0.012;
    vec4 texel = texture2D(uTexture, sampleUv);

    float pointerLight = 1.0 - smoothstep(0.08, 0.8, distance(vUv, uPointer));
    float edge = 1.0 - smoothstep(0.48, 0.72, distance(vUv, vec2(0.5)));
    float reveal = smoothstep(-0.04, 0.16, uReveal - abs(vUv.x - 0.5) * 0.16);
    float sweep = 1.0 - smoothstep(0.0, 0.036, abs(vUv.x - uSweep));
    sweep *= smoothstep(0.04, 0.22, vUv.y) * (1.0 - smoothstep(0.78, 0.98, vUv.y));

    float exposure = mix(0.24, 1.34, uActive);
    vec3 color = texel.rgb * exposure;
    color += uActive * vec3(0.006, 0.0055, 0.0045);
    color += pointerLight * uActive * vec3(0.035, 0.032, 0.025);
    color += sweep * uActive * vec3(0.13, 0.12, 0.095);

    gl_FragColor = vec4(color, uOpacity * edge * reveal);
  }
`;

type StageProps = {
  detailIndex: number | null;
  entered: boolean;
  onFailure: () => void;
  onReady: () => void;
  reducedMotion: boolean;
  scrollProgress: number;
};

type Uniforms = {
  uActive: { value: number };
  uDirection: { value: number };
  uDistort: { value: number };
  uOpacity: { value: number };
  uPointer: { value: THREE.Vector2 };
  uReveal: { value: number };
  uSweep: { value: number };
  uTexture: { value: THREE.Texture };
  uTime: { value: number };
};

type PlaneRecord = {
  frame: THREE.LineSegments<THREE.EdgesGeometry, THREE.LineBasicMaterial>;
  frameMaterial: THREE.LineBasicMaterial;
  group: THREE.Group;
  material: THREE.ShaderMaterial;
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  targetPosition: THREE.Vector3;
  targetRotation: number;
  targetScale: number;
  uniforms: Uniforms;
};

type StageState = Omit<StageProps, "onFailure" | "onReady">;

const DESKTOP_PROJECT_POSITIONS = [
  new THREE.Vector3(0, -0.04, 0),
  new THREE.Vector3(5.2, 0.34, -5.2),
  new THREE.Vector3(-1.8, -0.24, -10.8),
  new THREE.Vector3(4.5, 0.12, -16),
];

const MOBILE_PROJECT_POSITIONS = [
  new THREE.Vector3(0, 0, 0),
  new THREE.Vector3(0, 0, -5.4),
  new THREE.Vector3(0, 0, -10.8),
  new THREE.Vector3(0, 0, -16.2),
];

const DESKTOP_CAMERA_POINTS = [
  new THREE.Vector3(0, 0.1, 8.7),
  new THREE.Vector3(0, 0.14, 6.45),
  new THREE.Vector3(5.2, 0.2, 1.35),
  new THREE.Vector3(-1.8, 0.08, -4.2),
  new THREE.Vector3(4.5, 0.15, -9.45),
  new THREE.Vector3(0, 0.64, -8.3),
  new THREE.Vector3(0, 0.08, -10.4),
];

const MOBILE_CAMERA_POINTS = [
  new THREE.Vector3(0, 0.08, 7.6),
  new THREE.Vector3(0, 0.08, 6.5),
  new THREE.Vector3(0, 0.08, 1.1),
  new THREE.Vector3(0, 0.08, -4.3),
  new THREE.Vector3(0, 0.08, -9.7),
  new THREE.Vector3(0, 0.38, -8.9),
  new THREE.Vector3(0, 0.08, -10.6),
];

const smoothstep = (value: number) => value * value * (3 - 2 * value);

const damp = (
  current: number,
  target: number,
  lambda: number,
  delta: number,
) => THREE.MathUtils.damp(current, target, lambda, delta);

export function WebGLStage({
  detailIndex,
  entered,
  onFailure,
  onReady,
  reducedMotion,
  scrollProgress,
}: StageProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const latestStateRef = useRef<StageState>({
    detailIndex,
    entered,
    reducedMotion,
    scrollProgress,
  });

  useEffect(() => {
    latestStateRef.current = {
      detailIndex,
      entered,
      reducedMotion,
      scrollProgress,
    };
  }, [detailIndex, entered, reducedMotion, scrollProgress]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: window.innerWidth >= 768,
        powerPreference: "high-performance",
      });
    } catch {
      onFailure();
      return;
    }

    let disposed = false;
    let animationFrame = 0;
    let compact = window.innerWidth < 768;
    let lastDetailIndex: number | null = latestStateRef.current.detailIndex;
    let lastChapter = Math.round(latestStateRef.current.scrollProgress);
    let transitionStarted = 0;
    let transitionDirection = 1;
    let sweepStarted = 0;
    let previousTime = window.performance.now();
    const pointerTarget = new THREE.Vector2(0.5, 0.5);
    const pointerCurrent = new THREE.Vector2(0.5, 0.5);
    const textures: THREE.Texture[] = [];
    const planes: PlaneRecord[] = [];
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x030303, 7, 31);
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 80);
    camera.position.copy(
      compact ? MOBILE_CAMERA_POINTS[0] : DESKTOP_CAMERA_POINTS[0],
    );
    const cameraTarget = camera.position.clone();
    const lookTarget = new THREE.Vector3(0, 0, 0);
    const desiredLook = new THREE.Vector3(0, 0, 0);
    const lineTarget = new THREE.Vector3();

    renderer.setClearColor(0x030303, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setPixelRatio(
      Math.min(window.devicePixelRatio || 1, compact ? 1.15 : 1.65),
    );
    renderer.domElement.setAttribute("aria-hidden", "true");
    renderer.domElement.tabIndex = -1;
    root.appendChild(renderer.domElement);

    const handleContextLost = (event: Event) => {
      event.preventDefault();
      if (!disposed) onFailure();
    };
    renderer.domElement.addEventListener("webglcontextlost", handleContextLost);

    const world = new THREE.Group();
    scene.add(world);

    const grid = new THREE.GridHelper(64, 40, 0x28251f, 0x121210);
    const gridMaterials = Array.isArray(grid.material)
      ? grid.material
      : [grid.material];
    gridMaterials.forEach((material) => {
      material.transparent = true;
      material.opacity = 0.06;
    });
    grid.position.set(0, -2.36, -9);
    world.add(grid);

    const resizePlaneGeometry = (record: PlaneRecord) => {
      record.mesh.geometry.dispose();
      record.mesh.geometry = new THREE.PlaneGeometry(
        compact ? 3.64 : 4.62,
        compact ? 2.48 : 3.08,
        compact ? 20 : 56,
        compact ? 14 : 36,
      );
      record.frame.geometry.dispose();
      record.frame.geometry = new THREE.EdgesGeometry(
        new THREE.PlaneGeometry(
          compact ? 3.72 : 4.7,
          compact ? 2.56 : 3.16,
        ),
      );
    };

    const resize = () => {
      const width = root.clientWidth;
      const height = root.clientHeight;
      if (!width || !height) return;
      const nextCompact = width < 768;
      if (nextCompact !== compact) {
        compact = nextCompact;
        renderer.setPixelRatio(
          Math.min(window.devicePixelRatio || 1, compact ? 1.15 : 1.65),
        );
        planes.forEach(resizePlaneGeometry);
      }
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(root);
    resize();

    const handlePointer = (event: PointerEvent) => {
      if (compact || latestStateRef.current.reducedMotion) return;
      pointerTarget.set(
        THREE.MathUtils.clamp(event.clientX / window.innerWidth, 0, 1),
        THREE.MathUtils.clamp(1 - event.clientY / window.innerHeight, 0, 1),
      );
    };
    window.addEventListener("pointermove", handlePointer, { passive: true });

    const textureLoader = new THREE.TextureLoader();
    Promise.all(PROJECTS.map((item) => textureLoader.loadAsync(item.image)))
      .then((loadedTextures) => {
        if (disposed) {
          loadedTextures.forEach((texture) => texture.dispose());
          return;
        }

        loadedTextures.forEach((texture, index) => {
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.minFilter = THREE.LinearMipmapLinearFilter;
          texture.magFilter = THREE.LinearFilter;
          texture.anisotropy = Math.min(
            8,
            renderer.capabilities.getMaxAnisotropy(),
          );
          textures.push(texture);

          const uniforms: Uniforms = {
            uActive: { value: 0 },
            uDirection: { value: 1 },
            uDistort: { value: 0 },
            uOpacity: { value: 0 },
            uPointer: { value: new THREE.Vector2(0.5, 0.5) },
            uReveal: { value: 0 },
            uSweep: { value: 2 },
            uTexture: { value: texture },
            uTime: { value: 0 },
          };
          const material = new THREE.ShaderMaterial({
            depthWrite: false,
            fragmentShader,
            transparent: true,
            uniforms,
            vertexShader,
          });
          const geometry = new THREE.PlaneGeometry(
            compact ? 3.64 : 4.62,
            compact ? 2.48 : 3.08,
            compact ? 20 : 56,
            compact ? 14 : 36,
          );
          const mesh = new THREE.Mesh(geometry, material);
          const frameMaterial = new THREE.LineBasicMaterial({
            color: 0xb3aa95,
            opacity: 0,
            transparent: true,
          });
          const frameGeometry = new THREE.EdgesGeometry(
            new THREE.PlaneGeometry(
              compact ? 3.72 : 4.7,
              compact ? 2.56 : 3.16,
            ),
          );
          const frame = new THREE.LineSegments(frameGeometry, frameMaterial);
          frame.position.z = -0.028;
          const group = new THREE.Group();
          const base = compact
            ? MOBILE_PROJECT_POSITIONS[index]
            : DESKTOP_PROJECT_POSITIONS[index];
          group.position.copy(base);
          group.add(mesh, frame);
          world.add(group);
          planes.push({
            frame,
            frameMaterial,
            group,
            material,
            mesh,
            targetPosition: base.clone(),
            targetRotation: 0,
            targetScale: 1,
            uniforms,
          });
        });

        sweepStarted = window.performance.now();
        onReady();
      })
      .catch(() => {
        if (!disposed) onFailure();
      });

    const calculateCamera = (
      progress: number,
      currentDetail: number | null,
    ) => {
      const projectPositions = compact
        ? MOBILE_PROJECT_POSITIONS
        : DESKTOP_PROJECT_POSITIONS;
      const cameraPoints = compact
        ? MOBILE_CAMERA_POINTS
        : DESKTOP_CAMERA_POINTS;

      if (currentDetail !== null) {
        const base = projectPositions[currentDetail];
        cameraTarget.set(base.x, base.y, base.z + (compact ? 4.35 : 4.15));
        desiredLook.copy(base);
        return;
      }

      const fromIndex = Math.floor(THREE.MathUtils.clamp(progress, 0, 6));
      const toIndex = Math.min(6, fromIndex + 1);
      const local = smoothstep(progress - fromIndex);
      cameraTarget.lerpVectors(
        cameraPoints[fromIndex],
        cameraPoints[toIndex],
        local,
      );
      const arcDirection = fromIndex % 2 === 0 ? 1 : -1;
      cameraTarget.y +=
        Math.sin(local * Math.PI) * (compact ? 0.08 : 0.34) * arcDirection;

      if (progress < 1) {
        desiredLook.set(0, 0, -0.2);
      } else if (progress < 5) {
        const projectFrom = Math.min(3, Math.max(0, fromIndex - 1));
        const projectTo = Math.min(3, Math.max(0, toIndex - 1));
        desiredLook.lerpVectors(
          projectPositions[projectFrom],
          projectPositions[projectTo],
          local,
        );
      } else {
        desiredLook.set(0, 0, progress < 5.5 ? -19 : -27);
      }
    };

    const calculatePlaneTargets = (
      progress: number,
      currentDetail: number | null,
      journeyEntered: boolean,
    ) => {
      const projectPositions = compact
        ? MOBILE_PROJECT_POSITIONS
        : DESKTOP_PROJECT_POSITIONS;
      const landingBlend = smoothstep(THREE.MathUtils.clamp(progress, 0, 1));
      const lineBlend = smoothstep(THREE.MathUtils.clamp(progress - 4, 0, 1));
      const contactBlend = smoothstep(
        THREE.MathUtils.clamp(progress - 5, 0, 1),
      );
      const activeChapter = Math.round(progress);
      const activeProjectIndex = THREE.MathUtils.clamp(
        activeChapter - 1,
        0,
        3,
      );

      planes.forEach((record, index) => {
        const base = projectPositions[index];
        const landingPositions = compact
          ? [
              new THREE.Vector3(0, 0, 0),
              new THREE.Vector3(-2.5, 0.2, -4),
              new THREE.Vector3(2.5, -0.1, -5),
              new THREE.Vector3(0, 0, -8),
            ]
          : [
              new THREE.Vector3(0, -0.02, 0),
              new THREE.Vector3(-4.9, 0.45, -2.5),
              new THREE.Vector3(4.8, -0.16, -3.15),
              new THREE.Vector3(0.3, 0, -7.5),
            ];
        record.targetPosition.lerpVectors(
          landingPositions[index],
          base,
          landingBlend,
        );

        if (lineBlend > 0) {
          lineTarget.set(
            compact ? 0 : (index - 1.5) * 3.25,
            compact ? (index - 1.5) * 0.12 : 0,
            THREE.MathUtils.lerp(-19, -27, contactBlend),
          );
          record.targetPosition.lerp(lineTarget, lineBlend);
        }

        const isDetail = currentDetail === index;
        const isActive =
          currentDetail === null &&
          activeChapter >= 1 &&
          activeChapter <= 4 &&
          activeProjectIndex === index;
        const heroPrimary = progress < 1 && index === 0;
        const heroSide = progress < 1 && (index === 1 || index === 2);

        record.targetScale = isDetail
          ? compact
            ? 1.18
            : 1.48
          : isActive
            ? 1
            : heroPrimary
              ? compact
                ? 0.93
                : 1.08
              : heroSide
                ? 0.68
                : lineBlend > 0
                  ? compact
                    ? 0.5
                    : 0.58
                  : 0.72;
        record.targetRotation =
          currentDetail !== null || compact
            ? 0
            : progress < 1
              ? index === 1
                ? 0.25
                : index === 2
                  ? -0.24
                  : -0.025
              : (index % 2 === 0 ? -1 : 1) * 0.035;

        const targetOpacity = !journeyEntered
          ? 0
          : isDetail
            ? 1
            : currentDetail !== null
              ? 0.01
              : compact && progress < 1
                ? index === 0
                  ? 0.92
                  : 0
                : heroPrimary
                  ? 0.96
                  : heroSide
                    ? 0.46
                    : progress < 1
                      ? 0.04
                      : isActive
                        ? 1
                        : lineBlend > 0
                          ? THREE.MathUtils.lerp(0.24, 0.045, contactBlend)
                          : Math.abs(index - activeProjectIndex) === 1
                            ? 0.13
                            : 0.025;
        record.uniforms.uOpacity.value = damp(
          record.uniforms.uOpacity.value,
          targetOpacity,
          reducedMotion ? 18 : 4.8,
          1 / 60,
        );
        record.uniforms.uActive.value = damp(
          record.uniforms.uActive.value,
          isActive || isDetail || heroPrimary ? 1 : 0,
          reducedMotion ? 18 : 5.5,
          1 / 60,
        );
        record.uniforms.uReveal.value = damp(
          record.uniforms.uReveal.value,
          journeyEntered ? 1 : 0,
          reducedMotion ? 18 : 4.6,
          1 / 60,
        );
        record.frameMaterial.opacity = damp(
          record.frameMaterial.opacity,
          isActive || isDetail ? 0.5 : heroSide ? 0.13 : 0.035,
          reducedMotion ? 18 : 5,
          1 / 60,
        );
      });
    };

    const render = () => {
      if (disposed) return;
      const now = window.performance.now();
      const delta = Math.min((now - previousTime) / 1000, 0.05);
      previousTime = now;
      const state = latestStateRef.current;
      const currentChapter = Math.round(state.scrollProgress);

      if (state.detailIndex !== lastDetailIndex) {
        transitionDirection = state.detailIndex === null ? -1 : 1;
        transitionStarted = now;
        lastDetailIndex = state.detailIndex;
      }
      if (
        currentChapter !== lastChapter &&
        currentChapter >= 1 &&
        currentChapter <= 4
      ) {
        transitionDirection = Math.sign(currentChapter - lastChapter) || 1;
        sweepStarted = now;
        lastChapter = currentChapter;
      } else if (currentChapter !== lastChapter) {
        lastChapter = currentChapter;
      }

      calculateCamera(state.scrollProgress, state.detailIndex);
      calculatePlaneTargets(
        state.scrollProgress,
        state.detailIndex,
        state.entered,
      );

      pointerCurrent.lerp(
        pointerTarget,
        compact || state.reducedMotion ? 0.22 : 0.075,
      );
      const pointerX =
        compact || state.reducedMotion || state.detailIndex !== null
          ? 0
          : (pointerCurrent.x - 0.5) * 0.2;
      const pointerY =
        compact || state.reducedMotion || state.detailIndex !== null
          ? 0
          : (pointerCurrent.y - 0.5) * 0.12;

      camera.position.x = damp(
        camera.position.x,
        cameraTarget.x + pointerX,
        state.reducedMotion ? 20 : 4.7,
        delta,
      );
      camera.position.y = damp(
        camera.position.y,
        cameraTarget.y + pointerY,
        state.reducedMotion ? 20 : 4.7,
        delta,
      );
      camera.position.z = damp(
        camera.position.z,
        cameraTarget.z,
        state.reducedMotion ? 20 : 4.7,
        delta,
      );
      lookTarget.lerp(
        desiredLook,
        state.reducedMotion ? 0.3 : 1 - Math.exp(-delta * 4.2),
      );
      camera.lookAt(lookTarget);

      const transitionElapsed = (now - transitionStarted) / 1000;
      const transitionPulse =
        !state.reducedMotion && transitionElapsed < 1.05
          ? Math.sin((transitionElapsed / 1.05) * Math.PI)
          : 0;
      const activeIndex = THREE.MathUtils.clamp(
        Math.round(state.scrollProgress) - 1,
        0,
        3,
      );

      planes.forEach((record, index) => {
        record.group.position.lerp(
          record.targetPosition,
          state.reducedMotion ? 0.3 : 1 - Math.exp(-delta * 4.35),
        );
        const currentScale = record.group.scale.x;
        const nextScale = damp(
          currentScale,
          record.targetScale,
          state.reducedMotion ? 20 : 5,
          delta,
        );
        record.group.scale.setScalar(nextScale);
        record.group.rotation.y = damp(
          record.group.rotation.y,
          record.targetRotation,
          state.reducedMotion ? 20 : 5,
          delta,
        );

        const transitionTarget =
          state.detailIndex === index ||
          (state.detailIndex === null && activeIndex === index)
            ? transitionPulse * (state.detailIndex === null ? 0.35 : 0.62)
            : 0;
        record.uniforms.uDistort.value = transitionTarget;
        record.uniforms.uDirection.value = transitionDirection;
        record.uniforms.uTime.value = now / 1000;
        record.uniforms.uPointer.value.lerp(pointerCurrent, 0.08);

        const sweepElapsed = (now - sweepStarted) / 1000;
        const sweepActive =
          state.detailIndex === null &&
          activeIndex === index &&
          currentChapter >= 1 &&
          currentChapter <= 4 &&
          sweepElapsed < 0.95;
        record.uniforms.uSweep.value = sweepActive
          ? -0.18 + (sweepElapsed / 0.95) * 1.36
          : 2;
      });

      gridMaterials.forEach((material) => {
        material.opacity = damp(
          material.opacity,
          state.detailIndex !== null
            ? 0.035
            : state.scrollProgress > 4.5
              ? 0.012
              : 0.055,
          4,
          delta,
        );
      });

      renderer.render(scene, camera);
      animationFrame = window.requestAnimationFrame(render);
    };
    render();

    return () => {
      disposed = true;
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("pointermove", handlePointer);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener(
        "webglcontextlost",
        handleContextLost,
      );
      planes.forEach((record) => {
        record.mesh.geometry.dispose();
        record.frame.geometry.dispose();
        record.material.dispose();
        record.frameMaterial.dispose();
      });
      textures.forEach((texture) => texture.dispose());
      grid.geometry.dispose();
      gridMaterials.forEach((material) => material.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [onFailure, onReady, reducedMotion]);

  return <div className="webgl-stage" ref={rootRef} />;
}
