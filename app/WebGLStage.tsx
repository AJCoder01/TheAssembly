"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import * as THREE from "three";
import {
  ABOUT_SCENE,
  CONTACT_SCENE,
  isProjectScene,
  LANDING_SCENE,
} from "./sceneModel";

const MEDIA = [
  "/media/ayush-project-01-placeholder.webp",
  "/media/ayush-project-02-placeholder.webp",
  "/media/ayush-project-03-placeholder.webp",
  "/media/ayush-project-04-placeholder.webp",
];

const WORLD_POSITIONS = [
  { x: 0, y: -0.05, z: 0, rotation: -0.025 },
  { x: 5.35, y: 0.38, z: -1.45, rotation: 0.055 },
  { x: 10.7, y: -0.32, z: -2.9, rotation: -0.045 },
  { x: 16.05, y: 0.2, z: -4.35, rotation: 0.035 },
];

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
    float wave = sin((uv.y * 7.0) + (uv.x * 3.0) + (uTime * 0.18));
    p.z += wave * uDistort * 0.16;
    p.x += envelope * uDistort * uDirection * 0.12;
    p.y += sin(uv.x * 3.14159265) * uDistort * 0.025;
    vBend = abs(wave * uDistort);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const fragmentShader = `
  uniform sampler2D uTexture;
  uniform float uOpacity;
  uniform float uActive;
  uniform float uReveal;
  uniform float uTime;
  uniform vec2 uPointer;
  varying vec2 vUv;
  varying float vBend;

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  void main() {
    vec2 sampleUv = vUv;
    sampleUv.x += sin(vUv.y * 11.0 + uTime * 0.12) * vBend * 0.008;
    vec4 texel = texture2D(uTexture, sampleUv);

    float distanceFromFocus = distance(vUv, uPointer);
    float focus = 1.0 - smoothstep(0.08, 0.72, distanceFromFocus);
    float edge = 1.0 - smoothstep(0.2, 0.96, distance(vUv, vec2(0.5)));
    float grainWindow = smoothstep(0.015, 0.08, vBend) * (1.0 - smoothstep(0.14, 0.32, vBend));
    float grain = (hash(gl_FragCoord.xy + uTime) - 0.5) * grainWindow * 0.055;

    float luminance = mix(0.085, 0.82, uActive);
    vec3 warmFocus = vec3(0.055, 0.049, 0.038) * focus * uActive;
    vec3 color = texel.rgb * (luminance + focus * uActive * 0.14);
    color += warmFocus + grain;

    float revealMask = smoothstep(-0.04, 0.18, uReveal - abs(vUv.x - 0.5) * 0.2);
    float alpha = uOpacity * edge * revealMask;
    gl_FragColor = vec4(color, alpha);
  }
`;

type StageProps = {
  activeIndex: number;
  detailIndex: number | null;
  entered: boolean;
  reducedMotion: boolean;
  sceneIndex: number;
  onFailure: () => void;
};

type Uniforms = {
  uTime: { value: number };
  uDistort: { value: number };
  uDirection: { value: number };
  uTexture: { value: THREE.Texture };
  uOpacity: { value: number };
  uActive: { value: number };
  uReveal: { value: number };
  uPointer: { value: THREE.Vector2 };
};

type PlaneRecord = {
  frame: THREE.LineSegments<THREE.EdgesGeometry, THREE.LineBasicMaterial>;
  frameMaterial: THREE.LineBasicMaterial;
  group: THREE.Group;
  material: THREE.ShaderMaterial;
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  uniforms: Uniforms;
};

type StageController = {
  update: (state: Omit<StageProps, "onFailure">) => void;
};

export function WebGLStage({
  activeIndex,
  detailIndex,
  entered,
  reducedMotion,
  sceneIndex,
  onFailure,
}: StageProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<StageController | null>(null);
  const latestStateRef = useRef({
    activeIndex,
    detailIndex,
    entered,
    reducedMotion,
    sceneIndex,
  });

  useEffect(() => {
    latestStateRef.current = {
      activeIndex,
      detailIndex,
      entered,
      reducedMotion,
      sceneIndex,
    };
    controllerRef.current?.update(latestStateRef.current);
  }, [activeIndex, detailIndex, entered, reducedMotion, sceneIndex]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: window.innerWidth > 767,
        powerPreference: "high-performance",
      });
    } catch {
      onFailure();
      return;
    }

    let disposed = false;
    let animationFrame = 0;
    let lastProjectIndex = 0;
    let isCompact = window.innerWidth < 768;
    const pointerTarget = new THREE.Vector2(0.5, 0.5);
    const pointerCurrent = new THREE.Vector2(0.5, 0.5);
    const textures: THREE.Texture[] = [];
    const planes: PlaneRecord[] = [];
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x050504, 6.5, 26);

    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 70);
    const motion = {
      cameraX: 0,
      cameraY: 0.15,
      cameraZ: 8.2,
      lookX: 0,
      lookY: 0,
      lookZ: 0,
      gridOpacity: 0.22,
    };

    renderer.setClearColor(0x050504, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setPixelRatio(
      Math.min(window.devicePixelRatio || 1, isCompact ? 1.25 : 1.75),
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

    const createFrameGeometry = (compact: boolean) => {
      const source = new THREE.PlaneGeometry(
        compact ? 3.78 : 4.44,
        compact ? 2.59 : 3.04,
      );
      const edges = new THREE.EdgesGeometry(source);
      source.dispose();
      return edges;
    };

    const grid = new THREE.GridHelper(72, 48, 0x312e27, 0x171612);
    const gridMaterials = Array.isArray(grid.material)
      ? grid.material
      : [grid.material];
    gridMaterials.forEach((material) => {
      material.transparent = true;
      material.opacity = 0.2;
    });
    grid.position.set(8, -2.38, -7);
    world.add(grid);

    const resize = () => {
      const width = root.clientWidth;
      const height = root.clientHeight;
      if (!width || !height) return;
      const nextCompact = width < 768;
      if (nextCompact !== isCompact) {
        isCompact = nextCompact;
        renderer.setPixelRatio(
          Math.min(window.devicePixelRatio || 1, isCompact ? 1.25 : 1.75),
        );
        planes.forEach((record) => {
          record.mesh.geometry.dispose();
          record.mesh.geometry = new THREE.PlaneGeometry(
            isCompact ? 3.55 : 4.2,
            isCompact ? 2.36 : 2.8,
            isCompact ? 24 : 64,
            isCompact ? 16 : 48,
          );
          record.frame.geometry.dispose();
          record.frame.geometry = createFrameGeometry(isCompact);
        });
      }
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(root);
    resize();

    const handlePointer = (event: PointerEvent) => {
      if (isCompact || reducedMotion) return;
      pointerTarget.set(
        THREE.MathUtils.clamp(event.clientX / window.innerWidth, 0, 1),
        THREE.MathUtils.clamp(1 - event.clientY / window.innerHeight, 0, 1),
      );
    };
    window.addEventListener("pointermove", handlePointer, { passive: true });

    const loader = new THREE.TextureLoader();

    const applyState = ({
      activeIndex: nextActiveIndex,
      detailIndex: nextDetailIndex,
      entered: nextEntered,
      reducedMotion: nextReducedMotion,
      sceneIndex: nextSceneIndex,
    }: Omit<StageProps, "onFailure">) => {
      if (!planes.length) return;

      const projectIndex = THREE.MathUtils.clamp(nextActiveIndex, 0, 3);
      const base = WORLD_POSITIONS[projectIndex];
      const isDetail = nextDetailIndex !== null;
      const isLanding =
        nextSceneIndex === LANDING_SCENE && !isDetail;
      const isProject =
        isDetail || isProjectScene(nextSceneIndex);
      const isAbout = nextSceneIndex === ABOUT_SCENE && !isDetail;
      const isContact =
        nextSceneIndex === CONTACT_SCENE && !isDetail;
      const direction = Math.sign(projectIndex - lastProjectIndex) || 1;
      const duration = nextReducedMotion
        ? 0.22
        : isDetail
          ? 1.05
          : isContact
            ? 1.55
            : 1.35;

      const cameraX = isProject
        ? base.x
        : isLanding
          ? -3.6
          : WORLD_POSITIONS[3].x + (isAbout ? 2.8 : 5.4);
      const cameraZ = isProject
        ? base.z + (isDetail ? 4.75 : 8.2)
        : isLanding
          ? 9.6
          : WORLD_POSITIONS[3].z + 8.8;

      gsap.to(motion, {
        cameraX,
        cameraY: isProject ? 0.14 : isAbout ? 0.7 : 0.2,
        cameraZ,
        lookX: isProject ? base.x : isLanding ? -1.2 : cameraX - 1.2,
        lookY: isProject ? base.y * 0.22 : 0,
        lookZ: isProject
          ? base.z
          : isLanding
            ? -0.8
            : WORLD_POSITIONS[3].z - 1.2,
        gridOpacity: isLanding ? 0.08 : isContact ? 0.025 : 0.2,
        duration,
        ease: nextReducedMotion ? "power1.out" : "power3.inOut",
        overwrite: "auto",
      });

      planes.forEach((record, index) => {
        const active = index === projectIndex && isProject;
        const detail = nextDetailIndex === index;
        const scale = detail ? 1.4 : active ? 1 : 0.7;
        const opacity = detail
          ? 1
          : active
            ? 1
            : isProject
              ? 0.2
              : isAbout
                ? 0.07
                : isLanding
                  ? 0
                  : 0.015;
        const reveal = nextEntered ? 1 : 0;
        const frameOpacity =
          active || detail
            ? 0.58
            : isLanding
              ? 0
              : isProject
                ? 0.1
                : isAbout
                  ? 0.04
                  : 0.012;

        gsap.to(record.group.scale, {
          x: scale,
          y: scale,
          z: scale,
          duration,
          ease: nextReducedMotion ? "power1.out" : "power3.inOut",
          overwrite: "auto",
        });
        gsap.to(record.uniforms.uOpacity, {
          value: opacity,
          duration: nextReducedMotion ? 0.2 : active ? 0.7 : 0.5,
          ease: "power2.out",
          overwrite: "auto",
        });
        gsap.to(record.uniforms.uActive, {
          value: active || detail ? 1 : 0,
          duration: nextReducedMotion ? 0.2 : active ? 0.7 : 0.5,
          ease: "power2.out",
          overwrite: "auto",
        });
        gsap.to(record.uniforms.uReveal, {
          value: reveal,
          duration: nextReducedMotion ? 0.22 : 0.72,
          ease: "expo.out",
          overwrite: "auto",
        });
        gsap.to(record.frameMaterial, {
          opacity: frameOpacity,
          duration: nextReducedMotion ? 0.2 : 0.55,
          ease: "power2.out",
          overwrite: "auto",
        });

        record.uniforms.uDirection.value = direction;
        gsap.killTweensOf(record.uniforms.uDistort);
        if (!nextReducedMotion && (active || detail)) {
          gsap
            .timeline()
            .to(record.uniforms.uDistort, {
              value: detail ? 0.58 : 0.38,
              duration: detail ? 0.26 : 0.2,
              ease: "power2.in",
            })
            .to(record.uniforms.uDistort, {
              value: 0,
              duration: detail ? 0.82 : 0.9,
              ease: "expo.out",
            });
        } else {
          record.uniforms.uDistort.value = 0;
        }
      });

      lastProjectIndex = projectIndex;
    };

    controllerRef.current = { update: applyState };

    Promise.all(MEDIA.map((src) => loader.loadAsync(src)))
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
            uTime: { value: 0 },
            uDistort: { value: 0 },
            uDirection: { value: 1 },
            uTexture: { value: texture },
            uOpacity: { value: 0 },
            uActive: { value: 0 },
            uReveal: { value: 0 },
            uPointer: { value: new THREE.Vector2(0.5, 0.5) },
          };
          const material = new THREE.ShaderMaterial({
            uniforms,
            vertexShader,
            fragmentShader,
            transparent: true,
            depthWrite: false,
          });
          const geometry = new THREE.PlaneGeometry(
            isCompact ? 3.55 : 4.2,
            isCompact ? 2.36 : 2.8,
            isCompact ? 24 : 64,
            isCompact ? 16 : 48,
          );
          const mesh = new THREE.Mesh(geometry, material);
          const frameGeometry = createFrameGeometry(isCompact);
          const frameMaterial = new THREE.LineBasicMaterial({
            color: 0x8a806c,
            transparent: true,
            opacity: 0,
          });
          const frame = new THREE.LineSegments(
            frameGeometry,
            frameMaterial,
          );
          frame.position.z = -0.035;

          const group = new THREE.Group();
          const base = WORLD_POSITIONS[index];
          group.position.set(base.x, base.y, base.z);
          group.rotation.y = base.rotation;
          group.add(mesh, frame);
          world.add(group);

          planes.push({
            frame,
            frameMaterial,
            group,
            material,
            mesh,
            uniforms,
          });
        });

        applyState(latestStateRef.current);
      })
      .catch(() => {
        if (!disposed) onFailure();
      });

    const startTime = window.performance.now();
    const render = () => {
      if (disposed) return;

      const elapsed = (window.performance.now() - startTime) / 1000;
      pointerCurrent.lerp(pointerTarget, isCompact || reducedMotion ? 0.2 : 0.08);
      const pointerOffsetX =
        isCompact || reducedMotion ? 0 : (pointerCurrent.x - 0.5) * 0.17;
      const pointerOffsetY =
        isCompact || reducedMotion ? 0 : (pointerCurrent.y - 0.5) * 0.1;
      const cameraDeltaX =
        motion.cameraX + pointerOffsetX - camera.position.x;

      camera.position.x += Math.max(
        -0.22,
        Math.min(0.22, cameraDeltaX * 0.085),
      );
      camera.position.y +=
        (motion.cameraY + pointerOffsetY - camera.position.y) * 0.075;
      camera.position.z += (motion.cameraZ - camera.position.z) * 0.085;
      camera.lookAt(motion.lookX, motion.lookY, motion.lookZ);

      planes.forEach((record) => {
        record.uniforms.uTime.value = elapsed;
        record.uniforms.uPointer.value.lerp(pointerCurrent, 0.08);
      });
      gridMaterials.forEach((material) => {
        material.opacity = motion.gridOpacity;
      });

      renderer.render(scene, camera);
      animationFrame = window.requestAnimationFrame(render);
    };
    render();

    return () => {
      disposed = true;
      controllerRef.current = null;
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("pointermove", handlePointer);
      resizeObserver.disconnect();
      gsap.killTweensOf(motion);
      renderer.domElement.removeEventListener(
        "webglcontextlost",
        handleContextLost,
      );
      planes.forEach((record) => {
        gsap.killTweensOf(record.group.scale);
        gsap.killTweensOf(record.uniforms.uOpacity);
        gsap.killTweensOf(record.uniforms.uActive);
        gsap.killTweensOf(record.uniforms.uReveal);
        gsap.killTweensOf(record.uniforms.uDistort);
        gsap.killTweensOf(record.frameMaterial);
        record.group.traverse((child) => {
          if (child instanceof THREE.Mesh) child.geometry.dispose();
          if (child instanceof THREE.LineSegments) child.geometry.dispose();
        });
        record.material.dispose();
        record.frameMaterial.dispose();
      });
      textures.forEach((texture) => texture.dispose());
      grid.geometry.dispose();
      gridMaterials.forEach((material) => material.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [onFailure, reducedMotion]);

  return <div className="webgl-stage" ref={rootRef} />;
}
