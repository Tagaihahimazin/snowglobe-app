import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

// =========================
// 基本セットアップ
// =========================
const scene = new THREE.Scene();
// scene.background = new THREE.Color(0x101018);

const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);
camera.position.set(0, 1.6, 4);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 1.0, 0);

// =========================
// 星空スカイドーム（タイル対応）
// =========================
// 背景テクスチャ
const textureLoader = new THREE.TextureLoader();
const bgTex = textureLoader.load(
  "/textures/night_sky_tile.jpg",
  () => {
    bgTex.wrapS = THREE.RepeatWrapping;
    bgTex.wrapT = THREE.RepeatWrapping;
    bgTex.repeat.set(8, 4); // ← 好きに調整してOK（横4枚 × 縦2枚）
  }
);

const skyGeo = new THREE.SphereGeometry(50, 32, 32);
const skyMat = new THREE.MeshBasicMaterial({
  map: bgTex,
  side: THREE.BackSide,
  toneMapped: false,
  depthWrite: false,
  depthTest: false,
});

skyMat.color.setScalar(0.2);
const skyMesh = new THREE.Mesh(skyGeo, skyMat);
skyMesh.layers.set(1);
camera.layers.enable(1);
scene.add(skyMesh);


// =========================
// ライティング
// =========================
// 夜の環境光（ちょっと強めに）
const ambient = new THREE.AmbientLight(0x223355, 0.4); // 0.25 → 0.4
scene.add(ambient);

// 空：暗い青、地面側：濃紺 → 夜の空気感
const hemiLight = new THREE.HemisphereLight(0x111122, 0x000000, 0.25);
hemiLight.layers.enable(0);
scene.add(hemiLight);

// 月明かり（モデルをちゃんと見える程度までUP）
const moonLight = new THREE.DirectionalLight(0xddddff, 1.3);
moonLight.position.set(-5, 8, -5);
moonLight.layers.enable(0);
scene.add(moonLight);

// 雪とガラスの縁取り用ライト（少し強く & 広く）
const rimLight = new THREE.PointLight(0xaaaaff, 0.6, 15); // 0.3→0.6 intensity, 10→15 distance
rimLight.position.set(0, 2.2, 2);
rimLight.layers.enable(0);
scene.add(rimLight);

const bottomLight = new THREE.PointLight(0xFFF3B0, 2.2, 25);
bottomLight.position.set(0, 0.5, 0);
scene.add(bottomLight);

// =========================
// スノードーム本体
// =========================
const domeRadius = 1.5;

// ガラス球
const domeGeo = new THREE.SphereGeometry(domeRadius, 64, 64);
const domeMat = new THREE.MeshPhysicalMaterial({
  color: 0xffffff,
  roughness: 0.05,
  metalness: 0.0,
  transmission: 0.9, // 物理ベースのガラスっぽさ（対応GPUなら）
  transparent: true,
  opacity: 0.9,
  thickness: 0.4,
  depthWrite: false,
  // side: THREE.DoubleSide,
  side: THREE.FrontSide,
});
const domeMesh = new THREE.Mesh(domeGeo, domeMat);
domeMesh.position.y = domeRadius;
scene.add(domeMesh);

// 台座
const baseGeo = new THREE.CylinderGeometry(1.2, 1.4, 0.4, 32);
const baseMat = new THREE.MeshStandardMaterial({
  color: 0x333333,
  roughness: 0.5,
  metalness: 0.3,
});
const baseMesh = new THREE.Mesh(baseGeo, baseMat);
baseMesh.position.y = 0.2;
scene.add(baseMesh);

// ドーム内の「地面」
const groundGeo = new THREE.CircleGeometry(1.1, 64);
const groundMat = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  roughness: 0.8,
});
const groundMesh = new THREE.Mesh(groundGeo, groundMat);
groundMesh.rotation.x = -Math.PI / 2;
groundMesh.position.y = 0.405;
scene.add(groundMesh);

// =========================
// 任意モデルを読み込む処理
// =========================
const loader = new GLTFLoader();
let currentModel: THREE.Group | null = null;

function setModel(object: THREE.Object3D) {
  if (currentModel) {
    scene.remove(currentModel);
  }

  const group = new THREE.Group();
  group.add(object);
  scene.add(group);
  currentModel = group;

  const box = new THREE.Box3().setFromObject(group);
  const size = new THREE.Vector3();
  box.getSize(size);
  const maxDim = Math.max(size.x, size.y, size.z);

  const targetDiameter = domeRadius * 2 * 0.6;
  const scale = targetDiameter / maxDim;
  group.scale.setScalar(scale);

  box.setFromObject(group);
  const center = new THREE.Vector3();
  box.getCenter(center);

  group.position.sub(new THREE.Vector3(center.x, 0, center.z));
  box.setFromObject(group);
  const bottomY = box.min.y;
  const groundY = groundMesh.position.y + 0.01;
  group.position.y += groundY - bottomY;

  group.rotation.y = Math.PI / 8;
}

// ▼ ここからメニュー関連 ▼

// HTML の要素を取ってくる
const btnModel1 = document.getElementById("btn-model1") as HTMLButtonElement | null;
const btnModel2 = document.getElementById("btn-model2") as HTMLButtonElement | null;
const btnUpload = document.getElementById("btn-upload") as HTMLButtonElement | null;
const fileInput = document.getElementById("file-input") as HTMLInputElement | null;

// デフォルトモデルをロードする関数
function loadDefaultModel(url: string) {
  loader.load(
    url,
    (gltf) => {
      setModel(gltf.scene);
    },
    undefined,
    (err) => {
      console.error(err);
      alert("デフォルトモデルの読み込みに失敗しました");
    }
  );
}

// デフォルトモデルA
btnModel1?.addEventListener("click", () => {
  // ★ Vite では public/ 配下が / 直下で配信されるので、
  //  public/models/model1.glb に置いたときはこうアクセスできます
  loadDefaultModel("/models/model1.glb");
});

// デフォルトモデルB
btnModel2?.addEventListener("click", () => {
  loadDefaultModel("/models/model2.glb");
});

// 自分のモデルをアップロード
btnUpload?.addEventListener("click", () => {
  fileInput?.click(); // 隠してある input をクリック
});

// ファイル選択されたとき
fileInput?.addEventListener("change", (event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  const url = URL.createObjectURL(file);
  loader.load(
    url,
    (gltf) => {
      setModel(gltf.scene);
      URL.revokeObjectURL(url);
    },
    undefined,
    (err) => {
      console.error(err);
      alert("モデルの読み込みに失敗しました");
    }
  );
});

// =========================
// 雪パーティクル
// =========================
const snowCount = 500;
const snowGeo = new THREE.BufferGeometry();
// const positions = new Float32Array(snowCount * 3);
const snowPositions = new Float32Array(snowCount * 3);
// const speeds = new Float32Array(snowCount);
const snowVelocities = new Float32Array(snowCount * 3);

function randomPointInDome(radius: number) {
  // ドーム内部のランダムな点（球内一様分布）
  const u = Math.random();
  const v = Math.random();
  const theta = 2 * Math.PI * u;
  const phi = Math.acos(2 * v - 1);
  const r = radius * Math.cbrt(Math.random());

  const sinPhi = Math.sin(phi);
  return new THREE.Vector3(
    r * sinPhi * Math.cos(theta),
    r * Math.cos(phi),
    r * sinPhi * Math.sin(theta)
  );
}

for (let i = 0; i < snowCount; i++) {
  const p = randomPointInDome(domeRadius * 0.95);
  const idx = i * 3;

  // 位置
  snowPositions[idx + 0] = p.x;
  snowPositions[idx + 1] = p.y + domeRadius; // ドーム中心に合わせる
  snowPositions[idx + 2] = p.z;

  // ========= 速度 =========
  // 粒ごとに異なる落下速度
  const fallSpeed = 0.05 + Math.random() * 0.5; // 0.5〜1.3 くらい

  // 風向き：少しランダムな横方向ベクトル
  const windAngle = Math.random() * Math.PI * 2;
  const windStrength = 0.1 + Math.random() * 0.15; // 横に流れる強さ

  const vx = Math.cos(windAngle) * windStrength;
  const vz = Math.sin(windAngle) * windStrength;

  snowVelocities[idx + 0] = vx;          // vx
  snowVelocities[idx + 1] = -fallSpeed;  // vy（下向き）
  snowVelocities[idx + 2] = vz;          // vz
}

// =========================
// 暖色の光パーティクル（ライトスノー）
// =========================
const warmCount = 80;
const warmGeo = new THREE.BufferGeometry();
const warmPositions = new Float32Array(warmCount * 3);
const warmVelocities = new Float32Array(warmCount * 3);

for (let i = 0; i < warmCount; i++) {
  const p = randomPointInDome(domeRadius * 0.95);
  const idx = i * 3;

  // 位置
  warmPositions[idx + 0] = p.x;
  warmPositions[idx + 1] = p.y + domeRadius;
  warmPositions[idx + 2] = p.z;

  // ゆっくり落ちる・風弱め
  const fallSpeed = 0.02 + Math.random() * 0.08;
  const windAngle = Math.random() * Math.PI * 2;
  const windStrength = 0.02 + Math.random() * 0.04;

  warmVelocities[idx + 0] = Math.cos(windAngle) * windStrength; // vx
  warmVelocities[idx + 1] = -fallSpeed;                         // vy
  warmVelocities[idx + 2] = Math.sin(windAngle) * windStrength; // vz
}

snowGeo.setAttribute("position", new THREE.BufferAttribute(snowPositions, 3));
warmGeo.setAttribute("position", new THREE.BufferAttribute(warmPositions, 3));


function createSnowTexture(): THREE.Texture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D context not available");

  ctx.clearRect(0, 0, size, size);
  const r = size / 2;

  // 中心が明るくて外側がフェードする白い丸
  const grad = ctx.createRadialGradient(r, r, 0, r, r, r);
  grad.addColorStop(0.0, "rgba(255,255,255,1.0)");
  grad.addColorStop(0.4, "rgba(255,255,255,0.9)");
  grad.addColorStop(1.0, "rgba(255,255,255,0.0)");

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(r, r, r, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.center.set(0.5, 0.5);
  tex.needsUpdate = true;
  return tex;
}

const snowTexture = createSnowTexture();

const snowMat = new THREE.PointsMaterial({
  map: snowTexture,
  color: 0xffffff,
  size: 0.05,             // 粒の大きさ（お好みで調整）
  sizeAttenuation: true,
  transparent: true,
  opacity: 0.95,
  depthWrite: false,
  blending: THREE.AdditiveBlending, // ちょい発光っぽく
  alphaTest: 0.05,       // 0〜0.05くらい。高すぎると消えるので注意
});

const snow = new THREE.Points(snowGeo, snowMat);
snow.position.y = 0; // ドーム中心と合わせてある
scene.add(snow);

const warmMat = new THREE.PointsMaterial({
  map: snowTexture,        // 同じぼかし丸テクスチャを使う
  color: 0xFFF3B0,         // 暖色
  size: 0.14,              // 雪より少し大きめ
  sizeAttenuation: true,
  transparent: true,
  opacity: 0.75,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  alphaTest: 0.05,
});

const warmPoints = new THREE.Points(warmGeo, warmMat);
warmPoints.position.y = 0;
scene.add(warmPoints);

const domeCenter = new THREE.Vector3(0, domeRadius, 0);

// =========================
// レンダーループ
// =========================
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();

  skyMesh.rotation.y += delta * 0.02;

  // 雪を更新（斜め + 速度バラバラ）
  const posAttr = snowGeo.getAttribute("position") as THREE.BufferAttribute;
  const arr = posAttr.array as Float32Array;

  for (let i = 0; i < snowCount; i++) {
    const idx = i * 3;
    const xIdx = idx;
    const yIdx = idx + 1;
    const zIdx = idx + 2;

    // 位置に速度を足す
    arr[xIdx] += snowVelocities[idx + 0] * delta;
    arr[yIdx] += snowVelocities[idx + 1] * delta;
    arr[zIdx] += snowVelocities[idx + 2] * delta;

    // ドーム中心からの距離
    const dx = arr[xIdx] - domeCenter.x;
    const dy = arr[yIdx] - domeCenter.y;
    const dz = arr[zIdx] - domeCenter.z;
    const distSq = dx * dx + dy * dy + dz * dz;
    const limit = domeRadius * 0.98;
    const limitSq = limit * limit;

    const isOutOfDome = distSq > limitSq;
    const isBelowGround = arr[yIdx] < groundMesh.position.y + 0.05;

    if (isOutOfDome || isBelowGround) {
      // ドーム外 or 地面より下に出たら、上の方に再生成
      const p = randomPointInDome(domeRadius * 0.95);
      arr[xIdx] = p.x;
      arr[yIdx] = p.y + domeRadius;
      arr[zIdx] = p.z;

      // 新しい速度も付け直し
      const fallSpeed = 0.2 + Math.random() * 0.8;
      const windAngle = Math.random() * Math.PI * 2;
      const windStrength = 0.1 + Math.random() * 0.15;

      snowVelocities[idx + 0] = Math.cos(windAngle) * windStrength;
      snowVelocities[idx + 1] = -fallSpeed;
      snowVelocities[idx + 2] = Math.sin(windAngle) * windStrength;
    }
  }

  posAttr.needsUpdate = true;

  // 暖色フレークを更新（ゆっくり落ちる）
  const warmPosAttr = warmGeo.getAttribute("position") as THREE.BufferAttribute;
  const warmArr = warmPosAttr.array as Float32Array;

  for (let i = 0; i < warmCount; i++) {
    const idx = i * 3;
    const xIdx = idx;
    const yIdx = idx + 1;
    const zIdx = idx + 2;

    // 位置に速度を足す
    warmArr[xIdx] += warmVelocities[idx + 0] * delta;
    warmArr[yIdx] += warmVelocities[idx + 1] * delta;
    warmArr[zIdx] += warmVelocities[idx + 2] * delta;

    // ドーム中心からの距離
    const dx = warmArr[xIdx] - domeCenter.x;
    const dy = warmArr[yIdx] - domeCenter.y;
    const dz = warmArr[zIdx] - domeCenter.z;
    const distSq = dx * dx + dy * dy + dz * dz;
    const limit = domeRadius * 0.98;
    const limitSq = limit * limit;

    const isOutOfDome = distSq > limitSq;
    const isBelowGround = warmArr[yIdx] < groundMesh.position.y + 0.05;

    if (isOutOfDome || isBelowGround) {
      // ドーム外 or 地面より下に出たら、上の方に再生成
      const p = randomPointInDome(domeRadius * 0.95);
      warmArr[xIdx] = p.x;
      warmArr[yIdx] = p.y + domeRadius;
      warmArr[zIdx] = p.z;

      // 新しい速度も付け直し（ゆっくり・ふわっと）
      const fallSpeed = 0.02 + Math.random() * 0.08;
      const windAngle = Math.random() * Math.PI * 2;
      const windStrength = 0.02 + Math.random() * 0.04;

      warmVelocities[idx + 0] = Math.cos(windAngle) * windStrength;
      warmVelocities[idx + 1] = -fallSpeed;
      warmVelocities[idx + 2] = Math.sin(windAngle) * windStrength;
    }
  }

  warmPosAttr.needsUpdate = true;

  // ドーム全体にゆっくり回転をつけると雰囲気○
  if (currentModel) {
    currentModel.rotation.y += delta * 0.1;
  }

  controls.update();
  renderer.render(scene, camera);
}
animate();

// =========================
// リサイズ対応
// =========================
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});