"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import * as THREE from "three";
import { CORRIDOR_MOTION, LAST_SCENE } from "./motionStore";
import { PROJECTS } from "./projectData";

const vertexShader = `
  uniform float uRoute;
  uniform float uDirection;
  varying vec2 vUv;
  varying float vEdge;

  void main() {
    vUv = uv;
    vec3 p = position;
    float edge = abs(uv.x - 0.5) * 2.0;
    p.x += (uv.y - 0.5) * uRoute * uDirection * 0.18;
    p.z += sin(uv.y * 3.14159265) * uRoute * 0.09;
    vEdge = edge;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const fragmentShader = `
  uniform sampler2D uTexture;
  uniform float uOpacity;
  uniform float uIntensity;
  uniform float uRoute;
  uniform vec2 uPointer;
  uniform vec2 uUvScale;
  uniform vec2 uUvOffset;
  varying vec2 vUv;
  varying float vEdge;

  void main() {
    vec2 uv = vUv;
    uv.x += (uv.x - 0.5) * uRoute * 0.045;
    uv = uv * uUvScale + uUvOffset;
    vec4 texel = texture2D(uTexture, uv);
    float pointerLight = 1.0 - smoothstep(0.08, 0.7, distance(vUv, uPointer));
    float edgeFalloff = 1.0 - smoothstep(0.72, 1.0, vEdge);
    vec3 color = texel.rgb * uIntensity;
    color += pointerLight * 0.025;
    color *= mix(0.88, 1.0, edgeFalloff);
    gl_FragColor = vec4(color, uOpacity);
  }
`;

type StageProps = {
  onReady: () => void;
  onFailure: () => void;
};

type Uniforms = {
  uDirection: { value: number };
  uIntensity: { value: number };
  uOpacity: { value: number };
  uPointer: { value: THREE.Vector2 };
  uRoute: { value: number };
  uTexture: { value: THREE.Texture };
  uUvOffset: { value: THREE.Vector2 };
  uUvScale: { value: THREE.Vector2 };
};

type ScreenLayer = {
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  role: "main" | "echo" | "fragment";
  uniforms: Uniforms;
};

type Projection = {
  accent: THREE.Color;
  beam: THREE.Mesh<THREE.ConeGeometry, THREE.MeshBasicMaterial>;
  floor: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>;
  group: THREE.Group;
  layers: ScreenLayer[];
  light: THREE.PointLight;
  main: ScreenLayer;
  sideLeft: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>;
  sideRight: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>;
  wall: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>;
};

const PROJECT_POSITIONS = [
  new THREE.Vector3(0, 0, 0),
  new THREE.Vector3(7.2, 0.3, -9.3),
  new THREE.Vector3(2.1, -4.8, -20.6),
  new THREE.Vector3(-6.8, -1.4, -30.7),
];

const CAMERA_POINTS = [
  new THREE.Vector3(0, 0.1, 6.9),
  new THREE.Vector3(0, 0.05, 4.45),
  new THREE.Vector3(7.2, 0.35, -4.55),
  new THREE.Vector3(2.1, -4.7, -15.65),
  new THREE.Vector3(-6.8, -1.35, -25.75),
  new THREE.Vector3(0, -4.05, -37.1),
  new THREE.Vector3(0, 0.05, -45.65),
];

const LOOK_POINTS = [
  PROJECT_POSITIONS[0],
  PROJECT_POSITIONS[0],
  PROJECT_POSITIONS[1],
  PROJECT_POSITIONS[2],
  PROJECT_POSITIONS[3],
  new THREE.Vector3(0, -4.2, -42.2),
  new THREE.Vector3(0, 0, -51.2),
];

const MOBILE_CAMERA = [
  new THREE.Vector3(0, 0.1, 7.1),
  new THREE.Vector3(0, 0.05, 5.2),
  new THREE.Vector3(7.2, 0.35, -4.0),
  new THREE.Vector3(2.1, -4.7, -15.1),
  new THREE.Vector3(-6.8, -1.35, -25.2),
  new THREE.Vector3(0, -4.05, -36.6),
  new THREE.Vector3(0, 0.05, -45.1),
];

const ARCHIVE_POSITIONS = PROJECTS.map(
  (_, index) =>
    new THREE.Vector3((index - 1.5) * 2.25, -4.15, -42.15 - index * 0.08),
);

const CONVERGENCE_POSITIONS = PROJECTS.map(
  (_, index) =>
    new THREE.Vector3((index - 1.5) * 0.38, 0, -51.08 - index * 0.012),
);

const VS_SCATTER = [
  new THREE.Vector2(-4.6, 2.1),
  new THREE.Vector2(4.3, 2.55),
  new THREE.Vector2(-4.1, -2.45),
  new THREE.Vector2(4.55, -1.9),
] as const;

const VS_ASSEMBLED = [
  new THREE.Vector2(-1.9, 1.1875),
  new THREE.Vector2(1.9, 1.1875),
  new THREE.Vector2(-1.9, -1.1875),
  new THREE.Vector2(1.9, -1.1875),
] as const;

const ease = (value: number) => value * value * (3 - 2 * value);

const clamp = (value: number, minimum = 0, maximum = 1) =>
  Math.max(minimum, Math.min(maximum, value));

const makeFallbackTexture = () => {
  const data = new Uint8Array([6, 7, 7, 255]);
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
        alpha: false,
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
    let currentProgress = 0;
    let lastScene = -1;
    let rewindStarted = 0;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050505);
    scene.fog = new THREE.FogExp2(0x050505, compact ? 0.045 : 0.032);
    const camera = new THREE.PerspectiveCamera(
      compact ? 43 : 38,
      1,
      0.1,
      90,
    );
    const cameraCurrent = new THREE.Vector3();
    const cameraTarget = new THREE.Vector3();
    const lookCurrent = new THREE.Vector3();
    const lookTarget = new THREE.Vector3();
    const pointerTarget = new THREE.Vector2(0.5, 0.5);
    const zeroPointer = new THREE.Vector2(0.5, 0.5);
    const unitScale = new THREE.Vector3(1, 1, 1);
    const world = new THREE.Group();
    const projections: Projection[] = [];
    const loadedTextures: THREE.Texture[] = [];
    const disposableMaterials: THREE.Material[] = [];
    const disposableGeometries: THREE.BufferGeometry[] = [];
    const screenGeometry = new THREE.PlaneGeometry(7.6, 4.75, 26, 18);
    const fragmentGeometry = new THREE.PlaneGeometry(3.8, 2.375, 14, 10);
    const wallGeometry = new THREE.PlaneGeometry(11.8, 7.5);
    const floorGeometry = new THREE.PlaneGeometry(13.5, 12);
    const sideGeometry = new THREE.PlaneGeometry(5.5, 7.5);
    const beamGeometry = new THREE.ConeGeometry(3.45, 8.5, 16, 1, true);
    const nodeGeometry = new THREE.CircleGeometry(0.055, 16);
    const textureLoader = new THREE.TextureLoader();

    disposableGeometries.push(
      screenGeometry,
      fragmentGeometry,
      wallGeometry,
      floorGeometry,
      sideGeometry,
      beamGeometry,
      nodeGeometry,
    );

    renderer.setClearColor(0x050505, 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.88;
    renderer.setPixelRatio(
      Math.min(window.devicePixelRatio || 1, compact ? 1.05 : 1.5),
    );
    renderer.domElement.setAttribute("aria-hidden", "true");
    renderer.domElement.tabIndex = -1;
    root.appendChild(renderer.domElement);
    scene.add(world);
    scene.add(new THREE.AmbientLight(0x171817, 0.55));

    const createUniforms = (
      texture: THREE.Texture,
      uvScale = new THREE.Vector2(1, 1),
      uvOffset = new THREE.Vector2(0, 0),
    ): Uniforms => ({
      uDirection: { value: 1 },
      uIntensity: { value: 0.42 },
      uOpacity: { value: 0 },
      uPointer: { value: new THREE.Vector2(0.5, 0.5) },
      uRoute: { value: 0 },
      uTexture: { value: texture },
      uUvOffset: { value: uvOffset },
      uUvScale: { value: uvScale },
    });

    const createLayer = (
      geometry: THREE.PlaneGeometry,
      texture: THREE.Texture,
      role: ScreenLayer["role"],
      uvScale?: THREE.Vector2,
      uvOffset?: THREE.Vector2,
    ): ScreenLayer => {
      const uniforms = createUniforms(texture, uvScale, uvOffset);
      const material = new THREE.ShaderMaterial({
        depthWrite: true,
        fragmentShader,
        transparent: true,
        uniforms,
        vertexShader,
      });
      disposableMaterials.push(material);
      return {
        mesh: new THREE.Mesh(geometry, material),
        role,
        uniforms,
      };
    };

    PROJECTS.forEach((project, index) => {
      const fallbackTexture = makeFallbackTexture();
      loadedTextures.push(fallbackTexture);
      const group = new THREE.Group();
      group.position.copy(PROJECT_POSITIONS[index]);

      const wallMaterial = new THREE.MeshStandardMaterial({
        color: 0x090a09,
        emissive: new THREE.Color(project.accent).multiplyScalar(0.13),
        emissiveIntensity: 0,
        metalness: 0.02,
        roughness: 0.95,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.3,
      });
      const floorMaterial = wallMaterial.clone();
      const sideMaterialLeft = wallMaterial.clone();
      const sideMaterialRight = wallMaterial.clone();
      disposableMaterials.push(
        wallMaterial,
        floorMaterial,
        sideMaterialLeft,
        sideMaterialRight,
      );

      const wall = new THREE.Mesh(wallGeometry, wallMaterial);
      wall.position.z = -0.22;
      const floor = new THREE.Mesh(floorGeometry, floorMaterial);
      floor.position.set(0, -3.72, 2.2);
      floor.rotation.x = -Math.PI / 2;
      const sideLeft = new THREE.Mesh(sideGeometry, sideMaterialLeft);
      sideLeft.position.set(-5.85, 0, 2.35);
      sideLeft.rotation.y = Math.PI / 2;
      const sideRight = new THREE.Mesh(sideGeometry, sideMaterialRight);
      sideRight.position.set(5.85, 0, 2.35);
      sideRight.rotation.y = -Math.PI / 2;

      const main = createLayer(screenGeometry, fallbackTexture, "main");
      main.mesh.position.z = 0.035;
      const layers = [main];

      if (index === 1) {
        for (let echoIndex = 0; echoIndex < 3; echoIndex += 1) {
          const echo = createLayer(screenGeometry, fallbackTexture, "echo");
          echo.mesh.position.z = -0.04 - echoIndex * 0.055;
          layers.push(echo);
        }
      }

      if (index === 3) {
        const crops = [
          [0, 0.5],
          [0.5, 0.5],
          [0, 0],
          [0.5, 0],
        ] as const;
        crops.forEach(([x, y]) => {
          const fragment = createLayer(
            fragmentGeometry,
            fallbackTexture,
            "fragment",
            new THREE.Vector2(0.5, 0.5),
            new THREE.Vector2(x, y),
          );
          fragment.mesh.position.z = 0.06;
          layers.push(fragment);
        });
      }

      layers.forEach((layer) => group.add(layer.mesh));
      const beamMaterial = new THREE.MeshBasicMaterial({
        blending: THREE.AdditiveBlending,
        color: project.accent,
        depthWrite: false,
        opacity: 0,
        side: THREE.DoubleSide,
        transparent: true,
      });
      disposableMaterials.push(beamMaterial);
      const beam = new THREE.Mesh(beamGeometry, beamMaterial);
      beam.position.set(0, 0, 4.2);
      beam.rotation.x = -Math.PI / 2;
      const light = new THREE.PointLight(project.accent, 0, 11, 2.2);
      light.position.set(0, 0.4, 2.5);

      group.add(wall, floor, sideLeft, sideRight, beam, light);
      world.add(group);
      projections.push({
        accent: new THREE.Color(project.accent),
        beam,
        floor,
        group,
        layers,
        light,
        main,
        sideLeft,
        sideRight,
        wall,
      });
    });

    const oracleGroup = new THREE.Group();
    projections[0].group.add(oracleGroup);
    const oracleLineMaterial = new THREE.LineBasicMaterial({
      color: 0x8b7ab8,
      opacity: 0,
      transparent: true,
    });
    disposableMaterials.push(oracleLineMaterial);
    const oracleLineGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-4.7, 1.7, 0.08),
      new THREE.Vector3(-3.7, 1.7, 0.08),
      new THREE.Vector3(-3.7, 1.7, 0.08),
      new THREE.Vector3(-3.1, 2.55, 0.08),
      new THREE.Vector3(3.25, 2.3, 0.08),
      new THREE.Vector3(4.55, 1.25, 0.08),
      new THREE.Vector3(4.55, 1.25, 0.08),
      new THREE.Vector3(4.1, -1.8, 0.08),
      new THREE.Vector3(-4.35, -1.6, 0.08),
      new THREE.Vector3(-3.45, -2.45, 0.08),
    ]);
    disposableGeometries.push(oracleLineGeometry);
    const oracleLines = new THREE.LineSegments(
      oracleLineGeometry,
      oracleLineMaterial,
    );
    oracleGroup.add(oracleLines);
    const oracleNodeMaterials: THREE.MeshBasicMaterial[] = [];
    [
      [-4.7, 1.7],
      [-3.1, 2.55],
      [4.55, 1.25],
      [4.1, -1.8],
      [-3.45, -2.45],
    ].forEach(([x, y]) => {
      const material = new THREE.MeshBasicMaterial({
        color: 0xbcb1df,
        opacity: 0,
        transparent: true,
      });
      oracleNodeMaterials.push(material);
      disposableMaterials.push(material);
      const node = new THREE.Mesh(nodeGeometry, material);
      node.position.set(x, y, 0.1);
      oracleGroup.add(node);
    });

    const departureGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(4.55, 1.25, 0.11),
      new THREE.Vector3(9.4, 0.7, -2.2),
    ]);
    disposableGeometries.push(departureGeometry);
    const departureMaterial = new THREE.LineBasicMaterial({
      color: 0x7c88ac,
      opacity: 0,
      transparent: true,
    });
    disposableMaterials.push(departureMaterial);
    const departureLine = new THREE.Line(departureGeometry, departureMaterial);
    projections[0].group.add(departureLine);

    const rewindTimelineMaterial = new THREE.LineBasicMaterial({
      color: 0x6d95a7,
      opacity: 0,
      transparent: true,
    });
    disposableMaterials.push(rewindTimelineMaterial);
    const rewindTimelineGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-3.8, -2.72, 0.09),
      new THREE.Vector3(3.8, -2.72, 0.09),
    ]);
    disposableGeometries.push(rewindTimelineGeometry);
    const rewindTimeline = new THREE.Line(
      rewindTimelineGeometry,
      rewindTimelineMaterial,
    );
    projections[1].group.add(rewindTimeline);

    const signalLines: THREE.Line[] = [];
    const signalDots: THREE.Mesh<
      THREE.CircleGeometry,
      THREE.MeshBasicMaterial
    >[] = [];
    const signalStarts = [
      new THREE.Vector3(-5.1, 2.5, 0.09),
      new THREE.Vector3(5.3, 1.5, 0.09),
      new THREE.Vector3(-4.8, -2.5, 0.09),
      new THREE.Vector3(5.2, -2.1, 0.09),
    ];
    const signalEnds: THREE.Vector3[] = [];
    signalStarts.forEach((start, index) => {
      const end = new THREE.Vector3(
        index % 2 === 0 ? -2.6 : 2.6,
        index < 2 ? 1.45 : -1.45,
        0.09,
      );
      signalEnds.push(end);
      const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
      const material = new THREE.LineBasicMaterial({
        color: 0xb89552,
        opacity: 0,
        transparent: true,
      });
      disposableGeometries.push(geometry);
      disposableMaterials.push(material);
      const line = new THREE.Line(geometry, material);
      projections[2].group.add(line);
      signalLines.push(line);

      const dotMaterial = new THREE.MeshBasicMaterial({
        color: 0xd9bc78,
        opacity: 0,
        transparent: true,
      });
      disposableMaterials.push(dotMaterial);
      const dot = new THREE.Mesh(nodeGeometry, dotMaterial);
      dot.position.copy(start);
      projections[2].group.add(dot);
      signalDots.push(dot);
    });

    const aboutBeamMaterial = new THREE.MeshBasicMaterial({
      blending: THREE.AdditiveBlending,
      color: 0xe7dfca,
      depthWrite: false,
      opacity: 0,
      side: THREE.DoubleSide,
      transparent: true,
    });
    disposableMaterials.push(aboutBeamMaterial);
    const aboutBeamGeometry = new THREE.PlaneGeometry(1.6, 9.5);
    disposableGeometries.push(aboutBeamGeometry);
    const aboutBeam = new THREE.Mesh(aboutBeamGeometry, aboutBeamMaterial);
    aboutBeam.position.set(0, 0.15, -42.5);
    aboutBeam.rotation.z = -0.11;
    world.add(aboutBeam);

    const contactSurfaceMaterial = new THREE.MeshBasicMaterial({
      color: 0xf0eee7,
      opacity: 0,
      transparent: true,
    });
    disposableMaterials.push(contactSurfaceMaterial);
    const contactSurfaceGeometry = new THREE.PlaneGeometry(7.2, 4.35);
    disposableGeometries.push(contactSurfaceGeometry);
    const contactSurface = new THREE.Mesh(
      contactSurfaceGeometry,
      contactSurfaceMaterial,
    );
    contactSurface.position.set(0, 0, -51.2);
    world.add(contactSurface);

    const contactBeamMaterials: THREE.LineBasicMaterial[] = [];
    const contactBeams: THREE.Line[] = [];
    PROJECTS.forEach((project, index) => {
      const geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3((index - 1.5) * 3.2, -2.8, -45.8),
        new THREE.Vector3((index - 1.5) * 0.4, 0, -51.08),
      ]);
      const material = new THREE.LineBasicMaterial({
        blending: THREE.AdditiveBlending,
        color: project.accent,
        opacity: 0,
        transparent: true,
      });
      disposableGeometries.push(geometry);
      disposableMaterials.push(material);
      contactBeamMaterials.push(material);
      const line = new THREE.Line(geometry, material);
      contactBeams.push(line);
      world.add(line);
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
      projections[index].layers.forEach((layer) => {
        layer.uniforms.uTexture.value = texture;
      });
      if (index === 0 && !firstTextureReady) {
        firstTextureReady = true;
        onReady();
      }
    };

    const loaded = [false, false, false, false];
    const loadTexture = (index: number) => {
      if (loaded[index]) return;
      loaded[index] = true;
      textureLoader
        .loadAsync(PROJECTS[index].image)
        .then((texture) => applyTexture(index, texture))
        .catch(() => {
          loaded[index] = false;
          if (index === 0 && !firstTextureReady && !disposed) {
            firstTextureReady = true;
            onFailure();
          }
        });
    };
    loadTexture(0);
    window.setTimeout(() => {
      if (!disposed) loadTexture(1);
    }, 220);

    const resize = () => {
      const width = root.clientWidth;
      const height = root.clientHeight;
      if (!width || !height) return;
      const nextCompact = width < 768;
      if (nextCompact !== compact) {
        compact = nextCompact;
        CORRIDOR_MOTION.mobile = compact;
        renderer.setPixelRatio(
          Math.min(window.devicePixelRatio || 1, compact ? 1.05 : 1.5),
        );
        camera.fov = compact ? 43 : 38;
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
      if (!CORRIDOR_MOTION.indexOpen) {
        currentProgress = THREE.MathUtils.damp(
          currentProgress,
          targetProgress,
          compact ? 15 : 11,
          1 / 60,
        );
      }
      const segment = Math.min(LAST_SCENE - 1, Math.floor(currentProgress));
      const segmentProgress = ease(currentProgress - segment);
      const cameraPoints = compact ? MOBILE_CAMERA : CAMERA_POINTS;

      cameraTarget
        .copy(cameraPoints[segment])
        .lerp(cameraPoints[segment + 1], segmentProgress);
      lookTarget
        .copy(LOOK_POINTS[segment])
        .lerp(LOOK_POINTS[segment + 1], segmentProgress);
      const distanceFromArrival = Math.abs(
        currentProgress - Math.round(currentProgress),
      );
      const pointerAllowed =
        !compact &&
        distanceFromArrival < 0.17 &&
        !CORRIDOR_MOTION.indexOpen &&
        currentProgress >= 1 &&
        currentProgress <= 4;
      if (pointerAllowed) {
        cameraTarget.x += CORRIDOR_MOTION.pointerX * 0.11;
        cameraTarget.y -= CORRIDOR_MOTION.pointerY * 0.075;
        lookTarget.x += CORRIDOR_MOTION.pointerX * 0.05;
        lookTarget.y -= CORRIDOR_MOTION.pointerY * 0.04;
        pointerTarget.set(
          0.5 + CORRIDOR_MOTION.pointerX * 0.2,
          0.5 - CORRIDOR_MOTION.pointerY * 0.2,
        );
      } else {
        pointerTarget.lerp(zeroPointer, 0.14);
      }

      cameraCurrent.lerp(cameraTarget, compact ? 0.27 : 0.17);
      lookCurrent.lerp(lookTarget, compact ? 0.3 : 0.19);
      camera.position.copy(cameraCurrent);
      camera.lookAt(lookCurrent);

      const sceneIndex = Math.round(currentProgress);
      if (sceneIndex !== lastScene) {
        if (sceneIndex === 2) rewindStarted = time;
        lastScene = sceneIndex;
      }
      if (targetProgress > 1.2) loadTexture(2);
      if (targetProgress > 2.25) loadTexture(3);

      const arrivals = PROJECTS.map((_, index) =>
        clamp(1 - Math.abs(currentProgress - (index + 1)) * 1.55),
      );
      const heroPresence = clamp(1 - currentProgress * 0.72);
      const entered = CORRIDOR_MOTION.entered ? 1 : 0;
      const indexDim = CORRIDOR_MOTION.indexOpen ? 0.24 : 1;
      const travelEnergy = clamp(
        Math.abs(CORRIDOR_MOTION.velocity) / 1800,
        0,
        0.18,
      );
      const activeProject = Math.max(0, Math.min(3, sceneIndex - 1));

      projections.forEach((projection, index) => {
        projection.group.position.copy(PROJECT_POSITIONS[index]);
        projection.group.scale.copy(unitScale);
        projection.group.rotation.set(0, 0, 0);
        const arrival = arrivals[index];
        let visibility =
          Math.max(arrival, index === 0 ? heroPresence : 0, 0.018) *
          entered *
          indexDim;
        const intermission = ease(clamp(currentProgress - 4));
        const ending = ease(clamp(currentProgress - 5));
        if (currentProgress > 4) {
          projection.group.position.lerp(
            ARCHIVE_POSITIONS[index],
            intermission,
          );
          projection.group.scale.setScalar(
            THREE.MathUtils.lerp(1, 0.19, intermission),
          );
          visibility *= THREE.MathUtils.lerp(1, 0.34, intermission);
        }
        if (currentProgress > 5) {
          projection.group.position.lerp(
            CONVERGENCE_POSITIONS[index],
            ending,
          );
          projection.group.scale.set(
            THREE.MathUtils.lerp(projection.group.scale.x, 0.13, ending),
            THREE.MathUtils.lerp(projection.group.scale.y, 0.07, ending),
            1,
          );
          visibility = THREE.MathUtils.lerp(visibility, 0.11, ending);
        }

        const route =
          index === activeProject ? CORRIDOR_MOTION.routeTransition : 0;
        projection.layers.forEach((layer) => {
          layer.mesh.visible = layer.role === "main";
          layer.uniforms.uOpacity.value = THREE.MathUtils.damp(
            layer.uniforms.uOpacity.value,
            layer.role === "main" ? visibility : 0,
            12,
            1 / 60,
          );
          layer.uniforms.uIntensity.value = THREE.MathUtils.damp(
            layer.uniforms.uIntensity.value,
            0.38 + arrival * 0.74 + heroPresence * (index === 0 ? 0.25 : 0),
            9,
            1 / 60,
          );
          layer.uniforms.uRoute.value = THREE.MathUtils.damp(
            layer.uniforms.uRoute.value,
            route + travelEnergy,
            11,
            1 / 60,
          );
          layer.uniforms.uDirection.value = index % 2 === 0 ? 1 : -1;
          layer.uniforms.uPointer.value.lerp(pointerTarget, 0.12);
        });

        const architectureOpacity =
          (0.1 + arrival * 0.58 + (index === 0 ? heroPresence * 0.2 : 0)) *
          entered *
          indexDim;
        [
          projection.wall.material,
          projection.floor.material,
          projection.sideLeft.material,
          projection.sideRight.material,
        ].forEach((material) => {
          material.opacity = architectureOpacity;
          material.emissiveIntensity = arrival * 0.09;
        });
        projection.beam.material.opacity =
          arrival * (compact ? 0.026 : 0.052) * entered * indexDim;
        projection.light.intensity = arrival * 1.15 * entered * indexDim;
      });

      const oracleArrival = arrivals[0] * indexDim * entered;
      const oracleDeparture = segment === 1 ? segmentProgress : 0;
      oracleLineMaterial.opacity = oracleArrival * (0.18 + (1 - oracleDeparture) * 0.44);
      departureMaterial.opacity = oracleArrival * oracleDeparture * 0.75;
      oracleGroup.scale.setScalar(1 - oracleDeparture * 0.28);
      oracleNodeMaterials.forEach((material, index) => {
        const selected = pointerAllowed
          ? Math.round(
              clamp(CORRIDOR_MOTION.pointerX + 0.5) *
                (oracleNodeMaterials.length - 1),
            )
          : -1;
        material.opacity =
          oracleArrival * (index === selected ? 0.95 : 0.34);
      });

      const rewindArrival = arrivals[1] * indexDim * entered;
      const rewindAge = Math.max(0, time - rewindStarted);
      const rewindPulse =
        sceneIndex === 2
          ? Math.sin(clamp(rewindAge / 2.3) * Math.PI)
          : 0;
      rewindTimelineMaterial.opacity = rewindArrival * 0.5;
      projections[1].layers
        .filter((layer) => layer.role === "echo")
        .forEach((layer, echoIndex) => {
          layer.mesh.visible = rewindArrival > 0.02;
          const depth = echoIndex + 1;
          layer.mesh.position.x =
            -rewindPulse * depth * 0.16 +
            (pointerAllowed && sceneIndex === 2
              ? CORRIDOR_MOTION.pointerX * depth * 0.08
              : 0);
          layer.mesh.position.z = -0.04 - depth * (0.055 + rewindPulse * 0.08);
          layer.uniforms.uOpacity.value = THREE.MathUtils.damp(
            layer.uniforms.uOpacity.value,
            rewindArrival * rewindPulse * (0.19 / depth),
            12,
            1 / 60,
          );
          layer.uniforms.uIntensity.value = 0.56;
          layer.uniforms.uRoute.value = rewindPulse * 0.1;
        });

      const signalArrival = arrivals[2] * indexDim * entered;
      signalLines.forEach((line, index) => {
        (line.material as THREE.LineBasicMaterial).opacity =
          signalArrival * (index < 2 ? 0.48 : 0.28);
      });
      signalDots.forEach((dot, index) => {
        const movement =
          sceneIndex === 3 && index < 2
            ? 0.72 + Math.sin(time * 0.52 + index) * 0.12
            : clamp(0.25 + arrivals[2] * 0.7);
        dot.position.copy(signalStarts[index]).lerp(signalEnds[index], movement);
        dot.material.opacity = signalArrival * (index < 2 ? 0.9 : 0.28);
      });

      const vsProjection = projections[3];
      const vsFragments = vsProjection.layers.filter(
        (layer) => layer.role === "fragment",
      );
      const assemble = ease(clamp((currentProgress - 3.05) / 0.82));
      const vsDeparture = ease(clamp(currentProgress - 4));
      if (assemble > 0.01) {
        vsProjection.main.mesh.visible = false;
        vsProjection.main.uniforms.uOpacity.value = 0;
      }
      vsFragments.forEach((fragment, index) => {
        fragment.mesh.visible = assemble > 0.01;
        fragment.mesh.position.x = THREE.MathUtils.lerp(
          VS_SCATTER[index].x,
          VS_ASSEMBLED[index].x,
          assemble,
        );
        fragment.mesh.position.y = THREE.MathUtils.lerp(
          VS_SCATTER[index].y,
          VS_ASSEMBLED[index].y,
          assemble,
        );
        fragment.mesh.position.z = 0.06 + (1 - assemble) * (index + 1) * 0.12;
        fragment.mesh.scale.set(
          1,
          1 - vsDeparture * 0.68,
          1,
        );
        fragment.uniforms.uOpacity.value = THREE.MathUtils.damp(
          fragment.uniforms.uOpacity.value,
          Math.max(arrivals[3], assemble * 0.16) * indexDim * entered,
          12,
          1 / 60,
        );
        fragment.uniforms.uIntensity.value = 0.48 + arrivals[3] * 0.66;
        fragment.uniforms.uRoute.value =
          CORRIDOR_MOTION.routeTransition + (1 - assemble) * 0.05;
        fragment.uniforms.uPointer.value.lerp(pointerTarget, 0.12);
      });

      const aboutPresence =
        clamp(1 - Math.abs(currentProgress - 5) * 1.4) * entered * indexDim;
      aboutBeamMaterial.opacity = aboutPresence * (compact ? 0.025 : 0.055);
      const contactPresence = ease(clamp(currentProgress - 5)) * entered;
      contactSurfaceMaterial.opacity = contactPresence * 0.92;
      contactBeamMaterials.forEach((material, index) => {
        material.opacity =
          contactPresence * (compact ? 0.035 : 0.075) * (1 - index * 0.08);
      });

      if (CORRIDOR_MOTION.routeTransition > 0) {
        CORRIDOR_MOTION.routeTransition = THREE.MathUtils.damp(
          CORRIDOR_MOTION.routeTransition,
          1.45,
          8,
          1 / 60,
        );
        projections[activeProject].group.scale.multiplyScalar(
          1 + CORRIDOR_MOTION.routeTransition * 0.13,
        );
      }

      renderer.domElement.style.opacity = CORRIDOR_MOTION.indexOpen
        ? "0.34"
        : "1";
      renderer.render(scene, camera);
    };

    cameraCurrent.copy(compact ? MOBILE_CAMERA[0] : CAMERA_POINTS[0]);
    lookCurrent.copy(LOOK_POINTS[0]);
    gsap.ticker.add(render);

    return () => {
      disposed = true;
      gsap.ticker.remove(render);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener("webglcontextlost", contextLost);
      loadedTextures.forEach((texture) => texture.dispose());
      disposableMaterials.forEach((material) => material.dispose());
      disposableGeometries.forEach((geometry) => geometry.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [onFailure, onReady]);

  return <div className="webgl-stage" ref={rootRef} aria-hidden="true" />;
}
