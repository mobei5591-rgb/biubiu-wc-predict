/**
 * biubiu 3D — Elemental Flame Spirit
 * Three.js real-time 3D character
 * Fire hair · translucent body · glowing particles · beam shooting
 */

// Singleton — one biubiu per page
let biubiu3D = null;

function createBiubiu3D(container, opts = {}) {
  if (biubiu3D) biubiu3D.dispose();
  const size = opts.size || 300;

  // ===== Scene setup =====
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 0.3, 5);

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setSize(size, size * 1.25);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  container.appendChild(renderer.domElement);

  // ===== Lighting =====
  const ambient = new THREE.AmbientLight(0x3a2a1a, 1.8);
  const key = new THREE.DirectionalLight(0xffeedd, 4);
  key.position.set(2, 3, 4);
  const rim = new THREE.DirectionalLight(0xff8800, 3);
  rim.position.set(-2, 1, -1);
  const bottom = new THREE.PointLight(0xff9900, 2, 5);
  bottom.position.set(0, -3, 0);
  scene.add(ambient, key, rim, bottom);

  // ===== Body group =====
  const bodyGroup = new THREE.Group();
  scene.add(bodyGroup);

  // === Body: teardrop shape via lathe geometry ===
  const bodyPoints = [];
  const bodySegments = 32;
  for (let i = 0; i <= bodySegments; i++) {
    const t = i / bodySegments;
    const y = 0.8 - t * 2.4;           // top to bottom
    const r = Math.sin(t * Math.PI) * (0.55 + (1 - t) * 0.15); // wider at top
    bodyPoints.push(new THREE.Vector2(r, y));
  }
  const bodyGeo = new THREE.LatheGeometry(bodyPoints, 48);
  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: 0xfff8e1,
    roughness: 0.15,
    clearcoat: 0.6,
    clearcoatRoughness: 0.2,
    transparent: true,
    opacity: 0.82,
    sheen: 0.7,
    sheenColor: new THREE.Color(0xffd700),
    sheenRoughness: 0.4,
    specularIntensity: 0.5,
    specularColor: new THREE.Color(0xffffff),
  });
  const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
  bodyGroup.add(bodyMesh);

  // === Inner glow sphere (fake subsurface scattering) ===
  const innerGeo = new THREE.SphereGeometry(0.4, 32, 32);
  const innerMat = new THREE.MeshBasicMaterial({ color: 0xfff5cc, transparent: true, opacity: 0.15 });
  const innerMesh = new THREE.Mesh(innerGeo, innerMat);
  innerMesh.position.y = -0.2;
  innerMesh.scale.set(0.7, 0.75, 0.7);
  bodyGroup.add(innerMesh);

  // === Eyes ===
  const eyeGeo = new THREE.SphereGeometry(0.13, 32, 32);
  const eyeWhiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.05 });

  function makeEye(x, y, z) {
    const g = new THREE.Group();
    // White
    const white = new THREE.Mesh(eyeGeo, eyeWhiteMat);
    g.add(white);
    // Iris
    const irisGeo = new THREE.SphereGeometry(0.09, 24, 24);
    const irisMat = new THREE.MeshStandardMaterial({ color: 0x1a1008, roughness: 0.1 });
    const iris = new THREE.Mesh(irisGeo, irisMat);
    iris.position.z = 0.1;
    g.add(iris);
    // Highlight
    const hlGeo = new THREE.SphereGeometry(0.04, 16, 16);
    const hlMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const hl = new THREE.Mesh(hlGeo, hlMat);
    hl.position.set(0.04, 0.04, 0.16);
    g.add(hl);
    // Small secondary highlight
    const hl2 = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 8), hlMat);
    hl2.position.set(-0.05, -0.03, 0.14);
    hl2.material = hlMat;
    g.add(hl2);

    g.position.set(x, y, z);
    return g;
  }

  const leftEye = makeEye(-0.18, 0.05, 0.48);
  const rightEye = makeEye(0.18, 0.05, 0.48);
  bodyGroup.add(leftEye, rightEye);

  // === Cheeks (pink glow) ===
  const cheekGeo = new THREE.SphereGeometry(0.1, 16, 16);
  const cheekMat = new THREE.MeshBasicMaterial({ color: 0xffaaaa, transparent: true, opacity: 0.35 });
  const lCheek = new THREE.Mesh(cheekGeo, cheekMat);
  lCheek.position.set(-0.35, -0.12, 0.35);
  lCheek.scale.set(1, 0.7, 0.4);
  const rCheek = new THREE.Mesh(cheekGeo, cheekMat);
  rCheek.position.set(0.35, -0.12, 0.35);
  rCheek.scale.set(1, 0.7, 0.4);
  bodyGroup.add(lCheek, rCheek);

  // === Mouth ===
  const mouthShape = new THREE.Shape();
  mouthShape.absarc(0, 0, 0.08, Math.PI * 0.15, Math.PI * 0.85, false);
  const mouthGeo = new THREE.ExtrudeGeometry(mouthShape, { depth: 0.01, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 3 });
  const mouthMat = new THREE.MeshStandardMaterial({ color: 0x3d2010, roughness: 0.3 });
  const mouth = new THREE.Mesh(mouthGeo, mouthMat);
  mouth.position.set(-0.04, -0.15, 0.51);
  mouth.rotation.set(0, 0, 0);
  bodyGroup.add(mouth);

  // === Lightning bolt ===
  const boltGroup = new THREE.Group();
  boltGroup.position.set(0, 0.65, 0.05);
  const boltShape = new THREE.Shape();
  boltShape.moveTo(0, 0.25);
  boltShape.lineTo(-0.04, 0.08);
  boltShape.lineTo(0.01, 0.1);
  boltShape.lineTo(-0.05, -0.15);
  boltShape.lineTo(0.02, -0.05);
  boltShape.lineTo(-0.02, -0.05);
  boltShape.lineTo(0.05, 0.25);
  boltShape.closePath();
  const boltGeo = new THREE.ExtrudeGeometry(boltShape, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 2 });
  const boltMat = new THREE.MeshStandardMaterial({
    color: 0xffd700, roughness: 0.1, emissive: 0xffaa00, emissiveIntensity: 2
  });
  const boltMesh = new THREE.Mesh(boltGeo, boltMat);
  boltGroup.add(boltMesh);
  // Bolt glow sphere
  const boltGlowGeo = new THREE.SphereGeometry(0.08, 8, 8);
  const boltGlowMat = new THREE.MeshBasicMaterial({ color: 0xffcc00, transparent: true, opacity: 0.5 });
  const boltGlow = new THREE.Mesh(boltGlowGeo, boltGlowMat);
  boltGlow.position.y = 0.28;
  boltGroup.add(boltGlow);
  bodyGroup.add(boltGroup);

  // === Fire hair particle system ===
  const hairParticles = new THREE.Group();
  hairParticles.position.y = 0.55;
  bodyGroup.add(hairParticles);

  const hairCount = 120;
  const hairGeom = new THREE.BufferGeometry();
  const hairPositions = new Float32Array(hairCount * 3);
  const hairSizes = new Float32Array(hairCount);
  const hairColors = new Float32Array(hairCount * 3);
  const hairData = []; // For animation

  for (let i = 0; i < hairCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 0.15 + Math.random() * 0.35;
    const height = 0.08 + Math.random() * 0.4;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius * 0.6;
    const y = height;

    hairPositions[i * 3] = x;
    hairPositions[i * 3 + 1] = y;
    hairPositions[i * 3 + 2] = z;
    hairSizes[i] = 0.025 + Math.random() * 0.05;
    hairData.push({ baseX: x, baseY: y, baseZ: z, speed: 0.5 + Math.random() * 2, phase: Math.random() * Math.PI * 2, radius, angle, height });

    // Fire colors: yellow → orange → red
    const t = height / 0.4;
    const color = new THREE.Color();
    if (t < 0.4) color.setHSL(0.14, 1, 0.45 + t);
    else if (t < 0.7) color.setHSL(0.1, 1, 0.4 + t * 0.3);
    else color.setHSL(0.06, 1, 0.3 + t * 0.3);
    hairColors[i * 3] = color.r;
    hairColors[i * 3 + 1] = color.g;
    hairColors[i * 3 + 2] = color.b;
  }

  hairGeom.setAttribute('position', new THREE.BufferAttribute(hairPositions, 3));
  hairGeom.setAttribute('size', new THREE.BufferAttribute(hairSizes, 1));
  hairGeom.setAttribute('color', new THREE.BufferAttribute(hairColors, 3));

  const hairMat = new THREE.PointsMaterial({
    size: 0.04,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
    opacity: 0.8,
  });
  const hairPoints = new THREE.Points(hairGeom, hairMat);
  hairParticles.add(hairPoints);

  // === Internal floating particles ===
  const innerParticles = new THREE.Group();
  bodyGroup.add(innerParticles);
  const innerCount = 20;
  const innerData = [];
  for (let i = 0; i < innerCount; i++) {
    const geo = new THREE.SphereGeometry(0.015 + Math.random() * 0.025, 8, 8);
    const color = Math.random() > 0.5 ? 0x2ecc71 : 0xffd700;
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.4 + Math.random() * 0.4 });
    const dot = new THREE.Mesh(geo, mat);
    const angle = Math.random() * Math.PI * 2;
    const r = Math.random() * 0.3;
    dot.position.set(Math.cos(angle) * r, -0.5 + Math.random() * 1.0, Math.sin(angle) * r * 0.5);
    dot.userData = {
      baseY: dot.position.y,
      speed: 0.3 + Math.random() * 0.8,
      amplitude: 0.08 + Math.random() * 0.2,
      phase: Math.random() * Math.PI * 2,
    };
    innerParticles.add(dot);
    innerData.push(dot);
  }

  // === Arms (simple stubby shape) ===
  function makeArm(side) {
    const g = new THREE.Group();
    const armGeo = new THREE.CapsuleGeometry(0.07, 0.2, 8, 16);
    const armMat = new THREE.MeshStandardMaterial({ color: 0xfff5e0, roughness: 0.3, metalness: 0.05 });
    const arm = new THREE.Mesh(armGeo, armMat);
    g.add(arm);

    // Hand finger
    const fingerGeo = new THREE.SphereGeometry(0.05, 16, 16);
    const fingerMat = new THREE.MeshStandardMaterial({ color: 0xfff8e7, roughness: 0.2 });
    const finger = new THREE.Mesh(fingerGeo, fingerMat);
    finger.position.set(0, -0.18, 0);
    g.add(finger);

    g.position.set(side * 0.55, 0, 0);
    g.rotation.z = side * 0.5;
    return { group: g, finger };
  }

  const leftArm = makeArm(-1);
  const rightArm = makeArm(1);
  bodyGroup.add(leftArm.group, rightArm.group);

  // === Beam from right finger ===
  const beamGroup = new THREE.Group();
  beamGroup.visible = opts.showBeam !== false;
  bodyGroup.add(beamGroup);

  const beamGeo = new THREE.CylinderGeometry(0.01, 0.025, 0.6, 8);
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xffe566, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false });
  const beam = new THREE.Mesh(beamGeo, beamMat);
  beam.position.set(0.3, -0.3, 0);
  beam.rotation.z = -Math.PI / 3;
  beamGroup.add(beam);

  // Beam end glow
  const beamEndGeo = new THREE.SphereGeometry(0.035, 8, 8);
  const beamEndMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
  const beamEnd = new THREE.Mesh(beamEndGeo, beamEndMat);
  beamEnd.position.set(0.55, -0.52, 0);
  beamGroup.add(beamEnd);

  // ===== Ground light =====
  const groundGeo = new THREE.PlaneGeometry(0.8, 0.8);
  const groundMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      varying vec2 vUv;
      uniform float uTime;
      void main() {
        float d = length(vUv - 0.5) * 2.0;
        float glow = exp(-d * 3.5) * 0.25;
        glow += sin(uTime * 2.0 + d * 5.0) * 0.05;
        gl_FragColor = vec4(1.0, 0.65, 0.1, glow);
      }`,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -1.05;
  scene.add(ground);

  // ===== Animation loop =====
  const clock = new THREE.Clock();
  function animate() {
    const t = clock.getElapsedTime();

    // Body breathing
    const breathe = 1 + Math.sin(t * 2) * 0.02;
    bodyMesh.scale.set(breathe, breathe, breathe);
    innerMesh.scale.set(0.7 * breathe, 0.75 * breathe, 0.7 * breathe);

    // Floating bob
    bodyGroup.position.y = Math.sin(t * 1.5) * 0.05;

    // Hair particles dance
    const posArray = hairPoints.geometry.attributes.position.array;
    for (let i = 0; i < hairCount; i++) {
      const d = hairData[i];
      posArray[i * 3] = d.baseX + Math.sin(t * d.speed + d.phase) * 0.03;
      posArray[i * 3 + 1] = d.baseY + Math.sin(t * d.speed * 1.3 + d.phase) * 0.04;
      posArray[i * 3 + 2] = d.baseZ + Math.cos(t * d.speed * 0.7 + d.phase) * 0.02;
    }
    hairPoints.geometry.attributes.position.needsUpdate = true;
    hairMat.opacity = 0.7 + Math.sin(t * 3) * 0.1;

    // Inner particles
    innerData.forEach(dot => {
      dot.position.y = dot.userData.baseY + Math.sin(t * dot.userData.speed + dot.userData.phase) * dot.userData.amplitude;
      dot.material.opacity = 0.2 + Math.sin(t * dot.userData.speed * 1.5 + dot.userData.phase) * 0.2 + 0.2;
    });

    // Bolt glow
    boltGlow.scale.setScalar(0.8 + Math.sin(t * 4) * 0.3);
    boltMat.emissiveIntensity = 1.5 + Math.sin(t * 4.5) * 0.8;

    // Beam pulse
    if (beamGroup.visible) {
      beam.material.opacity = 0.5 + Math.sin(t * 6) * 0.3;
      beamEnd.scale.setScalar(0.8 + Math.sin(t * 6) * 0.4);
    }

    // Arms sway
    leftArm.group.rotation.z = -0.5 + Math.sin(t * 1.2) * 0.15;
    rightArm.group.rotation.z = 0.5 + Math.cos(t * 1.2) * 0.15;

    // Ground glow
    groundMat.uniforms.uTime.value = t;

    // Subtle body rotation toward mouse
    bodyGroup.rotation.y += (0 - bodyGroup.rotation.y) * 0.05;
    bodyGroup.rotation.x += (0 - bodyGroup.rotation.x) * 0.05;

    renderer.render(scene, camera);
    biubiu3D._animId = requestAnimationFrame(animate);
  }

  // Mouse follow
  renderer.domElement.addEventListener('mousemove', (e) => {
    const rect = renderer.domElement.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
    const my = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    bodyGroup.rotation.y = mx * 0.3;
    bodyGroup.rotation.x = -my * 0.15;
    camera.position.x = mx * 0.3;
  });

  // Touch
  renderer.domElement.addEventListener('touchmove', (e) => {
    const rect = renderer.domElement.getBoundingClientRect();
    const mx = ((e.touches[0].clientX - rect.left) / rect.width - 0.5) * 2;
    camera.position.x = mx * 0.3;
  });

  // Click interaction
  renderer.domElement.style.cursor = 'pointer';
  renderer.domElement.addEventListener('click', () => {
    // Jump!
    bodyGroup.position.y = 0.3;
    const jumpDown = () => {
      bodyGroup.position.y += (0 - bodyGroup.position.y) * 0.15;
      if (Math.abs(bodyGroup.position.y) > 0.01) {
        requestAnimationFrame(jumpDown);
      } else {
        bodyGroup.position.y = 0;
      }
    };
    jumpDown();
    // Flash bolt
    boltMat.emissiveIntensity = 5;
    setTimeout(() => { boltMat.emissiveIntensity = 2; }, 150);
  });

  animate();

  // ===== Public API =====
  biubiu3D = {
    scene, camera, renderer, bodyGroup,
    setMood(mood) {
      // Switch hair color / bolt visibility
      if (mood === 'sad') {
        boltGroup.visible = false;
        hairMat.opacity = 0.4;
        beamGroup.visible = false;
      } else {
        boltGroup.visible = true;
        hairMat.opacity = 0.7;
        beamGroup.visible = opts.showBeam !== false;
      }
    },
    dispose() {
      cancelAnimationFrame(biubiu3D._animId);
      renderer.dispose();
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
      biubiu3D = null;
    },
    resize(s) {
      renderer.setSize(s, s * 1.25);
    },
  };

  return biubiu3D;
}

// Auto-init on elements with data-biubiu-3d attribute
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-biubiu-3d]').forEach(el => {
    const size = parseInt(el.dataset.biubiuSize) || 280;
    const showBeam = el.dataset.biubiuBeam !== 'false';
    createBiubiu3D(el, { size, showBeam });
  });
});
