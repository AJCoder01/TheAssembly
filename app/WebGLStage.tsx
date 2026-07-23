"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import * as THREE from "three";
import { CORRIDOR_MOTION, LAST_SCENE } from "./motionStore";
import { PROJECTS } from "./projectData";

const vertexShader = `
  uniform float uTime;
  uniform float uDistortion;
  uniform float uDirection;
  varying vec2 vUv;
  varying float vDistortion;

  void main() {
    vUv = uv;
    vec3 p = position;
    float envelope = sin(uv.y * 3.14159265);
    float wave = sin(uv.y * 8.0 + uv.x * 3.0 + uTime * 0.28);
    p.z += wave * uDistortion * 0.12;
    p.x += envelope * uDistortion * uDirection * 0.18;
    vDistortion = abs(wave * uDistortion);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const fragmentShader = `
  uniform sampler2D uTexture;
  uniform float uOpacity;
  uniform float uActive;
  uniform float uSweep;
  uniform float uSlice;
  uniform float uDistortion;
  uniform vec2 uPointer;
  varying vec2 vUv;
  varying float vDistortion;

  void main() {
    if (uSlice > 0.5 && uSlice < 1.5 && vUv.y < 0.5) discard;
    if (uSlice > 1.5 && vUv.y >= 0.5) discard;
    vec2 sampleUv = vUv;
    sampleUv.x += sin(vUv.y * 10.0) * vDistortion * 0.014;
    sampleUv.y += uDistortion * (vUv.x - 0.5) * 0.02;
    vec4 texel = texture2D(uTexture, sampleUv);
    float sweep = 1.0 - smoothstep(0.0, 0.045, abs(vUv.x - uSweep));
    sweep *= smoothstep(0.08, 0.24, vUv.y) * (1.0 - smoothstep(0.78, 0.96, vUv.y));
    float pointer = 1.0 - smoothstep(0.12, 0.86, distance(vUv, uPointer));
    float exposure = mix(0.38, 1.08, uActive);
    vec3 color = texel.rgb * exposure;
    color += sweep * uActive * vec3(0.11, 0.10, 0.08);
    color += pointer * uActive * vec3(0.018);
    gl_FragColor = vec4(color, uOpacity);
  }
`;

type StageProps = {
  onReady: () => void;
  onFailure: () => void;
};

type Uniforms = {
  uActive: { value: number };
  uDirection: { value: number };
  uDistortion: { value: number };
  uOpacity: { value: number };
  uPointer: { value: THREE.Vector2 };
  uSlice: { value: number };
  uSweep: { value: number };
  uTexture: { value: THREE.Texture };
  uTime: { value: number };
};

type ProjectPlane = {
  backing: THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>;
  group: THREE.Group;
  main: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  mainUniforms: Uniforms;
  sliceBottom: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial> | null;
  sliceBottomUniforms: Uniforms | null;
  sliceTop: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial> | null;
  sliceTopUniforms: Uniforms | null;
  texture: THREE.Texture;
  loaded: boolean;
};

const DESKTOP_POSITIONS = [
  new THREE.Vector3(0, 0, 0),
  new THREE.Vector3(5.6, 0.25, -5.4),
  new THREE.Vector3(5.5, -4.8, -10.8),
  new THREE.Vector3(-0.2, -4.8, -16.1),
];

const MOBILE_POSITIONS = [
  new THREE.Vector3(0, 0, 0),
  new THREE.Vector3(0, 0, -5.3),
  new THREE.Vector3(0, 0, -10.6),
  new THREE.Vector3(0, 0, -15.9),
];

const DESKTOP_CAMERA = [
  new THREE.Vector3(0, 0.15, 8.8),
  new THREE.Vector3(0, 0.08, 5.9),
  new THREE.Vector3(5.6, 0.18, 0.45),
  new THREE.Vector3(5.5, -4.72, -4.95),
  new THREE.Vector3(-0.2, -4.72, -10.2),
  new THREE.Vector3(0, -4.15, -7.8),
  new THREE.Vector3(0, -4.15, -9.5),
];

const MOBILE_CAMERA = [
  new THREE.Vector3(0, 0.08, 7.8),
  new THREE.Vector3(0, 0.06, 5.8),
  new THREE.Vector3(0, 0.06, 0.5),
  new THREE.Vector3(0, 0.06, -4.8),
  new THREE.Vector3(0, 0.06, -10.1),
  new THREE.Vector3(0, 0.3, -7.9),
  new THREE.Vector3(0, 0.06, -9.4),
];

const ease = (value: number) =>
  value * value * (3 - 2 * value);

const clamp = (value: number, minimum = 0, maximum = 1) =>
  Math.max(minimum, Math.min(maximum, value));

const makeFallbackTexture = () => {
  const data = new Uint8Array([8, 9, 9, 255]);
  const texture = new THREE.DataTexture(data, 1, 1);
  texture.needsUpdate = true;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
};

export function WebGLStage({ onFailure, onReady }: StageProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: window.innerWidth >= 900,
        powerPreference: "high-performance",
      });
    } catch {
      onFailure();
      return;
    }

    let disposed = false;
    let compact = window.innerWidth < 768;
    let firstTextureReady = false;
    let lastActive = -1;
    let sweepStarted = 0;
    let currentProgress = 0;
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x030404, 7, 30);
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 80);
    const cameraCurrent = new THREE.Vector3();
    const cameraTarget = new THREE.Vector3();
    const lookCurrent = new THREE.Vector3();
    const lookTarget = new THREE.Vector3();
    const pointer = new THREE.Vector2(0.5, 0.5);
    const unitScale = new THREE.Vector3(1, 1, 1);
    const world = new THREE.Group();
    const planes: ProjectPlane[] = [];
    const loadedTextures: THREE.Texture[] = [];
    const planeGeometry = new THREE.PlaneGeometry(4.78, 3.18, 52, 34);
    const backingGeometry = new THREE.BoxGeometry(4.82, 3.22, 0.11);
    const textureLoader = new THREE.TextureLoader();

    renderer.setClearColor(0x030404, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setPixelRatio(
      Math.min(window.devicePixelRatio || 1, compact ? 1.1 : 1.55),
    );
    renderer.domElement.setAttribute("aria-hidden", "true");
    renderer.domElement.tabIndex = -1;
    root.appendChild(renderer.domElement);
    scene.add(world);

    const grid = new THREE.GridHelper(70, 42, 0x22302d, 0x111817);
    const gridMaterials = Array.isArray(grid.material)
      ? grid.material
      : [grid.material];
    gridMaterials.forEach((material) => {
      material.transparent = true;
      material.opacity = 0.08;
    });
    grid.position.set(0, -2.25, -9);
    world.add(grid);

    const createUniforms = (
      texture: THREE.Texture,
      slice: number,
    ): Uniforms => ({
      uActive: { value: 0 },
      uDirection: { value: 1 },
      uDistortion: { value: 0 },
      uOpacity: { value: 0 },
      uPointer: { value: new THREE.Vector2(0.5, 0.5) },
      uSlice: { value: slice },
      uSweep: { value: -1 },
      uTexture: { value: texture },
      uTime: { value: 0 },
    });

    const makeMaterial = (uniforms: Uniforms) =>
      new THREE.ShaderMaterial({
        depthWrite: true,
        fragmentShader,
        transparent: true,
        uniforms,
        vertexShader,
      });

    PROJECTS.forEach((_, index) => {
      const texture = makeFallbackTexture();
      loadedTextures.push(texture);
      const mainUniforms = createUniforms(texture, 0);
      const main = new THREE.Mesh(planeGeometry, makeMaterial(mainUniforms));
      main.position.z = 0.061;
      const backing = new THREE.Mesh(
        backingGeometry,
        new THREE.MeshBasicMaterial({
          color: 0x0e1211,
          fog: true,
        }),
      );
      const group = new THREE.Group();
      group.add(backing, main);

      let sliceTop: ProjectPlane["sliceTop"] = null;
      let sliceBottom: ProjectPlane["sliceBottom"] = null;
      let sliceTopUniforms: ProjectPlane["sliceTopUniforms"] = null;
      let sliceBottomUniforms: ProjectPlane["sliceBottomUniforms"] = null;
      if (index === 1) {
        sliceTopUniforms = createUniforms(texture, 1);
        sliceBottomUniforms = createUniforms(texture, 2);
        sliceTop = new THREE.Mesh(
          planeGeometry,
          makeMaterial(sliceTopUniforms),
        );
        sliceBottom = new THREE.Mesh(
          planeGeometry,
          makeMaterial(sliceBottomUniforms),
        );
        sliceTop.position.z = 0.07;
        sliceBottom.position.z = 0.07;
        group.add(sliceTop, sliceBottom);
      }

      const base = compact
        ? MOBILE_POSITIONS[index]
        : DESKTOP_POSITIONS[index];
      group.position.copy(base);
      world.add(group);
      planes.push({
        backing,
        group,
        loaded: false,
        main,
        mainUniforms,
        sliceBottom,
        sliceBottomUniforms,
        sliceTop,
        sliceTopUniforms,
        texture,
      });
    });

    const applyTexture = (index: number, texture: THREE.Texture) => {
      if (disposed) {
        texture.dispose();
        return;
      }
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.anisotropy = Math.min(
        8,
        renderer.capabilities.getMaxAnisotropy(),
      );
      loadedTextures.push(texture);
      const plane = planes[index];
      plane.texture = texture;
      plane.loaded = true;
      plane.mainUniforms.uTexture.value = texture;
      if (plane.sliceTopUniforms) plane.sliceTopUniforms.uTexture.value = texture;
      if (plane.sliceBottomUniforms) {
        plane.sliceBottomUniforms.uTexture.value = texture;
      }
      if (index === 0 && !firstTextureReady) {
        firstTextureReady = true;
        onReady();
      }
    };

    const loadTexture = (index: number) => {
      if (planes[index]?.loaded) return;
      textureLoader
        .loadAsync(PROJECTS[index].image)
        .then((texture) => applyTexture(index, texture))
        .catch(() => {
          if (index === 0 && !firstTextureReady && !disposed) {
            firstTextureReady = true;
            onFailure();
          }
        });
    };
    loadTexture(0);
    window.setTimeout(() => {
      if (!disposed) loadTexture(1);
    }, 250);

    const resize = () => {
      const width = root.clientWidth;
      const height = root.clientHeight;
      if (!width || !height) return;
      const nextCompact = width < 768;
      if (nextCompact !== compact) {
        compact = nextCompact;
        CORRIDOR_MOTION.mobile = compact;
        renderer.setPixelRatio(
          Math.min(window.devicePixelRatio || 1, compact ? 1.1 : 1.55),
        );
      }
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(root);
    resize();

    const contextLost = (event: Event) => {
      event.preventDefault();
      if (!disposed) onFailure();
    };
    renderer.domElement.addEventListener("webglcontextlost", contextLost);

    const render = (time: number) => {
      if (disposed || document.hidden) return;
      const targetProgress = clamp(CORRIDOR_MOTION.progress, 0, LAST_SCENE);
      currentProgress = THREE.MathUtils.damp(
        currentProgress,
        targetProgress,
        compact ? 14 : 10,
        1 / 60,
      );
      const segment = Math.min(LAST_SCENE - 1, Math.floor(currentProgress));
      const segmentProgress = ease(currentProgress - segment);
      const cameraPoints = compact ? MOBILE_CAMERA : DESKTOP_CAMERA;
      const positions = compact ? MOBILE_POSITIONS : DESKTOP_POSITIONS;

      cameraTarget
        .copy(cameraPoints[segment])
        .lerp(cameraPoints[segment + 1], segmentProgress);
      cameraTarget.x += compact ? 0 : CORRIDOR_MOTION.pointerX * 0.12;
      cameraTarget.y -= compact ? 0 : CORRIDOR_MOTION.pointerY * 0.08;
      cameraCurrent.lerp(cameraTarget, compact ? 0.26 : 0.16);
      camera.position.copy(cameraCurrent);

      const sceneIndex = Math.round(currentProgress);
      const activeProject = Math.max(0, Math.min(3, sceneIndex - 1));
      if (sceneIndex >= 1 && sceneIndex <= 4) {
        lookTarget.copy(positions[activeProject]);
      } else if (sceneIndex === 0) {
        lookTarget.copy(positions[0]);
      } else {
        lookTarget.set(0, compact ? 0 : -4.6, -13.5);
      }
      lookTarget.x += compact ? 0 : CORRIDOR_MOTION.pointerX * 0.05;
      lookTarget.y -= compact ? 0 : CORRIDOR_MOTION.pointerY * 0.035;
      lookCurrent.lerp(lookTarget, compact ? 0.3 : 0.18);
      camera.lookAt(lookCurrent);

      if (sceneIndex !== lastActive && sceneIndex >= 1 && sceneIndex <= 4) {
        lastActive = sceneIndex;
        sweepStarted = time;
      }

      if (targetProgress > 1.25) loadTexture(2);
      if (targetProgress > 2.25) loadTexture(3);

      planes.forEach((plane, index) => {
        const base = positions[index];
        plane.group.position.lerp(base, 0.16);
        plane.group.rotation.x = THREE.MathUtils.damp(
          plane.group.rotation.x,
          0,
          10,
          1 / 60,
        );
        plane.group.rotation.y = THREE.MathUtils.damp(
          plane.group.rotation.y,
          0,
          9,
          1 / 60,
        );
        plane.group.scale.lerp(unitScale, 0.18);

        const distance = Math.abs(currentProgress - (index + 1));
        const active = clamp(1 - distance * 1.35);
        const entered = CORRIDOR_MOTION.entered ? 1 : 0;
        const heroPresence =
          index === 0 ? clamp(1 - Math.abs(currentProgress) * 0.78) : 0;
        const opacity = Math.max(active, heroPresence * 0.96, 0.09) * entered;
        const routeDistortion =
          index === activeProject ? CORRIDOR_MOTION.routeTransition : 0;
        const travelDistortion = clamp(
          Math.abs(CORRIDOR_MOTION.velocity) / 1600,
          0,
          0.28,
        );
        const uniforms = [
          plane.mainUniforms,
          plane.sliceTopUniforms,
          plane.sliceBottomUniforms,
        ].filter((value): value is Uniforms => value !== null);
        uniforms.forEach((uniform) => {
          uniform.uTime.value = time;
          uniform.uActive.value = THREE.MathUtils.damp(
            uniform.uActive.value,
            active,
            8,
            1 / 60,
          );
          uniform.uOpacity.value = THREE.MathUtils.damp(
            uniform.uOpacity.value,
            opacity,
            10,
            1 / 60,
          );
          uniform.uDistortion.value = THREE.MathUtils.damp(
            uniform.uDistortion.value,
            routeDistortion + travelDistortion,
            11,
            1 / 60,
          );
          uniform.uDirection.value = index % 2 === 0 ? 1 : -1;
          pointer.set(
            0.5 + CORRIDOR_MOTION.pointerX * 0.35,
            0.5 - CORRIDOR_MOTION.pointerY * 0.35,
          );
          uniform.uPointer.value.lerp(pointer, 0.12);
          const sweepElapsed = time - sweepStarted;
          uniform.uSweep.value =
            sceneIndex === index + 1 && sweepElapsed < 1.15
              ? -0.18 + sweepElapsed * 1.16
              : -1;
        });
        plane.backing.material.opacity = opacity;
        plane.backing.material.transparent = true;
      });

      // Project 01 → 02: reveal thickness while the camera passes the first edge.
      if (segment === 1) {
        planes[0].group.rotation.y = -segmentProgress * 0.56;
        planes[0].group.position.x = baseLerp(
          positions[0].x,
          positions[0].x - 1.15,
          segmentProgress,
        );
        planes[1].group.rotation.y = (1 - segmentProgress) * 0.18;
      }

      // Project 02 → 03: separate the real image into two restrained depth layers.
      const split = segment === 2 ? Math.sin(segmentProgress * Math.PI) : 0;
      const splitPlane = planes[1];
      if (splitPlane.sliceTop && splitPlane.sliceBottom) {
        splitPlane.main.visible = split < 0.025;
        splitPlane.sliceTop.visible = split >= 0.025;
        splitPlane.sliceBottom.visible = split >= 0.025;
        splitPlane.sliceTop.position.y = split * 0.36;
        splitPlane.sliceTop.position.z = 0.07 + split * 0.24;
        splitPlane.sliceBottom.position.y = -split * 0.36;
        splitPlane.sliceBottom.position.z = 0.07 - split * 0.18;
      }

      // Project 03 → 04: flatten prior work into a brief contact sheet.
      if (segment === 3 && !compact) {
        const contact = Math.sin(segmentProgress * Math.PI);
        [0, 1, 2].forEach((index) => {
          const plane = planes[index];
          const cellX = positions[2].x + (index - 1) * 2.05;
          plane.group.position.x = THREE.MathUtils.lerp(
            plane.group.position.x,
            cellX,
            contact,
          );
          plane.group.position.y = THREE.MathUtils.lerp(
            plane.group.position.y,
            positions[2].y,
            contact,
          );
          plane.group.position.z = THREE.MathUtils.lerp(
            plane.group.position.z,
            positions[2].z + 0.8,
            contact,
          );
          const scale = THREE.MathUtils.lerp(1, 0.38, contact);
          plane.group.scale.setScalar(scale);
        });
        planes[3].group.scale.setScalar(
          THREE.MathUtils.lerp(0.38, 1, segmentProgress),
        );
      }

      if (currentProgress > 4) {
        const intermission = clamp(currentProgress - 4);
        planes.forEach((plane, index) => {
          plane.group.position.z -= intermission * (3 + index * 0.35);
          plane.group.scale.multiplyScalar(1 - intermission * 0.16);
        });
      }

      if (currentProgress > 5) {
        const ending = ease(clamp(currentProgress - 5));
        planes.forEach((plane, index) => {
          plane.group.position.set(
            THREE.MathUtils.lerp(plane.group.position.x, (index - 1.5) * 2.25, ending),
            THREE.MathUtils.lerp(plane.group.position.y, -4.55, ending),
            THREE.MathUtils.lerp(plane.group.position.z, -15.8, ending),
          );
          plane.group.scale.set(
            THREE.MathUtils.lerp(plane.group.scale.x, 0.44, ending),
            THREE.MathUtils.lerp(plane.group.scale.y, 0.08, ending),
            1,
          );
        });
      }

      if (CORRIDOR_MOTION.routeTransition > 0) {
        CORRIDOR_MOTION.routeTransition = THREE.MathUtils.damp(
          CORRIDOR_MOTION.routeTransition,
          1.5,
          8,
          1 / 60,
        );
        planes[activeProject].group.scale.multiplyScalar(
          1 + CORRIDOR_MOTION.routeTransition * 0.14,
        );
      }

      grid.position.z = camera.position.z - 12;
      const gridOpacity =
        currentProgress >= 1 && currentProgress <= 4 ? 0.08 : 0.035;
      gridMaterials.forEach((material) => {
        material.opacity = gridOpacity;
      });
      renderer.render(scene, camera);
    };

    cameraCurrent.copy(compact ? MOBILE_CAMERA[0] : DESKTOP_CAMERA[0]);
    lookCurrent.copy(compact ? MOBILE_POSITIONS[0] : DESKTOP_POSITIONS[0]);
    gsap.ticker.add(render);

    return () => {
      disposed = true;
      gsap.ticker.remove(render);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener("webglcontextlost", contextLost);
      planes.forEach((plane) => {
        plane.main.material.dispose();
        plane.sliceTop?.material.dispose();
        plane.sliceBottom?.material.dispose();
        plane.backing.material.dispose();
      });
      planeGeometry.dispose();
      backingGeometry.dispose();
      loadedTextures.forEach((texture) => texture.dispose());
      grid.geometry.dispose();
      gridMaterials.forEach((material) => material.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [onFailure, onReady]);

  return <div className="webgl-stage" ref={rootRef} aria-hidden="true" />;
}

function baseLerp(start: number, end: number, progress: number) {
  return THREE.MathUtils.lerp(start, end, progress);
}
