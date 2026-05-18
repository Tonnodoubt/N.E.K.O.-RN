/* eslint-disable react/no-unknown-property */
import { VRMLoaderPlugin, VRMUtils, type VRM } from "@pixiv/three-vrm";
import { Canvas, useFrame, useThree } from "@react-three/fiber/native";
import { useEffect, useRef, useState } from "react";
import {
  Image,
  StyleSheet,
  type StyleProp,
  View,
  type ViewStyle,
} from "react-native";
import PCMStream, {
  type OnAmplitudeUpdateEventPayload,
} from "react-native-pcm-stream";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  NEKO_CACHED_TEXTURE_URI,
  cleanupVrmTextureCache,
  deleteCachedTextureUri,
  writeTextureToCache,
} from "./vrmCache";
import {
  advanceVrmAnimation,
  disposeVrmAnimation,
  loadVrmAnimationRuntime,
  type VRMAnimationRuntime,
} from "./vrmAnimation";

export type VRMRenderMode = "compat" | "texture" | "mtoon";
export type VRMEmotion =
  | "neutral"
  | "attentive"
  | "thinking"
  | "happy"
  | "surprised"
  | "sad"
  | "angry";
export type VRMGesture = "none" | "nod" | "recoil" | "bounce" | "tilt" | "shake";
type VRMMotionMode =
  | "idle"
  | "attentive"
  | "thinking"
  | "speaking"
  | "happy"
  | "surprised"
  | "sad"
  | "angry";

export type VRMMotionCalibration = {
  gaze?: number;
  body?: number;
  arms?: number;
  speech?: number;
  gesture?: number;
  idle?: number;
};

export type VRMMotionDebugTelemetry = {
  mode: VRMMotionMode;
  fromMode: VRMMotionMode;
  transition: number;
  emotion: VRMEmotion;
  mouthValue: number;
  playbackPresence: number;
  speechEnergy: number;
  isPlaying: boolean;
  activeGesture: VRMGesture;
  gestureQueue: VRMGesture[];
  focusYaw: number;
  focusPitch: number;
  calibration: Required<VRMMotionCalibration>;
};

export type VRMLightingConfig = {
  ambient?: number;
  main?: number;
  fill?: number;
  rim?: number;
  top?: number;
  bottom?: number;
  exposure?: number;
  toneMapping?: number;
  outlineWidthScale?: number;
};

export type VRMRenderPhase =
  | "idle"
  | "canvas-ready"
  | "fetching"
  | "parsing"
  | "loaded"
  | "fallback-loaded"
  | "failed";

export type VRMAvatarViewProps = {
  modelUrl: string;
  animationUrl?: string;
  renderMode?: VRMRenderMode;
  showProbe?: boolean;
  autoRotate?: boolean;
  idleAnimation?: boolean;
  lipSync?: boolean;
  emotion?: VRMEmotion;
  gesture?: VRMGesture;
  gestureRevision?: number;
  lighting?: VRMLightingConfig;
  motionCalibration?: VRMMotionCalibration;
  debugTelemetry?: boolean;
  relaxedPose?: boolean;
  modelScale?: number;
  modelPosition?: { x: number; y: number };
  backgroundColor?: string;
  transparentBackground?: boolean;
  style?: StyleProp<ViewStyle>;
  onPhase?: (phase: VRMRenderPhase) => void;
  onError?: (message: string | null) => void;
  onNotice?: (message: string | null) => void;
  onDebugTelemetry?: (telemetry: VRMMotionDebugTelemetry) => void;
};

type LoadedAvatar =
  | {
      kind: "vrm";
      scene: THREE.Object3D;
      vrm: VRM;
    }
  | {
      kind: "gltf-fallback";
      scene: THREE.Object3D;
    };

type IdleAnimationState = {
  elapsed: number;
  nextBlinkAt: number;
  blinkStartedAt: number;
  blinkDuration: number;
};

type MouthSyncState = {
  target: number;
  value: number;
  isPlaying: boolean;
  playbackPresence: number;
};

type ExpressionKey = "happy" | "relaxed" | "surprised" | "sad" | "angry";
type LookExpressionKey = "lookLeft" | "lookRight" | "lookUp" | "lookDown";

type EmotionExpressionState = {
  current: Record<ExpressionKey, number>;
};

type EmotionPoseBias = {
  spineX: number;
  chestX: number;
  neckX: number;
  neckY: number;
  headX: number;
  headY: number;
  headZ: number;
  leftShoulderZ: number;
  rightShoulderZ: number;
  leftUpperArmX: number;
  leftUpperArmY: number;
  leftUpperArmZ: number;
  rightUpperArmX: number;
  rightUpperArmY: number;
  rightUpperArmZ: number;
  leftLowerArmX: number;
  leftLowerArmY: number;
  leftLowerArmZ: number;
  rightLowerArmX: number;
  rightLowerArmY: number;
  rightLowerArmZ: number;
  leftHandX: number;
  leftHandY: number;
  leftHandZ: number;
  rightHandX: number;
  rightHandY: number;
  rightHandZ: number;
};

type GestureMotionState = {
  kind: VRMGesture;
  elapsed: number;
  duration: number;
};

type FocusMotionState = {
  yaw: number;
  pitch: number;
  targetYaw: number;
  targetPitch: number;
  nextTargetAt: number;
};

type MotionMachineState = {
  fromMode: VRMMotionMode;
  toMode: VRMMotionMode;
  transitionElapsed: number;
  transitionDuration: number;
  activeGesture: GestureMotionState;
  gestureQueue: VRMGesture[];
  lastGestureRevision: number;
  focus: FocusMotionState;
};

const expressionKeys: ExpressionKey[] = [
  "happy",
  "relaxed",
  "surprised",
  "sad",
  "angry",
];
const lookExpressionKeys: LookExpressionKey[] = [
  "lookLeft",
  "lookRight",
  "lookUp",
  "lookDown",
];
const poseBiasKeys = [
  "spineX",
  "chestX",
  "neckX",
  "neckY",
  "headX",
  "headY",
  "headZ",
  "leftShoulderZ",
  "rightShoulderZ",
  "leftUpperArmX",
  "leftUpperArmY",
  "leftUpperArmZ",
  "rightUpperArmX",
  "rightUpperArmY",
  "rightUpperArmZ",
  "leftLowerArmX",
  "leftLowerArmY",
  "leftLowerArmZ",
  "rightLowerArmX",
  "rightLowerArmY",
  "rightLowerArmZ",
  "leftHandX",
  "leftHandY",
  "leftHandZ",
  "rightHandX",
  "rightHandY",
  "rightHandZ",
] as const satisfies readonly (keyof EmotionPoseBias)[];
const bodyPoseBiasKeys = [
  "spineX",
  "chestX",
  "neckX",
  "neckY",
  "headX",
  "headY",
  "headZ",
] as const satisfies readonly (keyof EmotionPoseBias)[];
const armPoseBiasKeys = [
  "leftShoulderZ",
  "rightShoulderZ",
  "leftUpperArmX",
  "leftUpperArmY",
  "leftUpperArmZ",
  "rightUpperArmX",
  "rightUpperArmY",
  "rightUpperArmZ",
  "leftLowerArmX",
  "leftLowerArmY",
  "leftLowerArmZ",
  "rightLowerArmX",
  "rightLowerArmY",
  "rightLowerArmZ",
  "leftHandX",
  "leftHandY",
  "leftHandZ",
  "rightHandX",
  "rightHandY",
  "rightHandZ",
] as const satisfies readonly (keyof EmotionPoseBias)[];
const neutralPoseBias: EmotionPoseBias = {
  spineX: 0,
  chestX: 0,
  neckX: 0,
  neckY: 0,
  headX: 0,
  headY: 0,
  headZ: 0,
  leftShoulderZ: 0,
  rightShoulderZ: 0,
  leftUpperArmX: 0,
  leftUpperArmY: 0,
  leftUpperArmZ: 0,
  rightUpperArmX: 0,
  rightUpperArmY: 0,
  rightUpperArmZ: 0,
  leftLowerArmX: 0,
  leftLowerArmY: 0,
  leftLowerArmZ: 0,
  rightLowerArmX: 0,
  rightLowerArmY: 0,
  rightLowerArmZ: 0,
  leftHandX: 0,
  leftHandY: 0,
  leftHandZ: 0,
  rightHandX: 0,
  rightHandY: 0,
  rightHandZ: 0,
};
export const NEKO_DEFAULT_VRM_MOTION_CALIBRATION: Required<VRMMotionCalibration> = {
  gaze: 0.82,
  body: 0.78,
  arms: 0.62,
  speech: 0.74,
  gesture: 0.86,
  idle: 0.72,
};
const defaultVrmLighting: Required<VRMLightingConfig> = {
  ambient: 0.83,
  main: 1.91,
  fill: 0,
  rim: 0,
  top: 0,
  bottom: 0,
  exposure: 1.1,
  toneMapping: 7,
  outlineWidthScale: 1,
};

function resolveVrmLighting(lighting?: VRMLightingConfig): Required<VRMLightingConfig> {
  const next = { ...defaultVrmLighting };
  if (!lighting) return next;

  for (const key of Object.keys(defaultVrmLighting) as (keyof VRMLightingConfig)[]) {
    const value = lighting[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      switch (key) {
        case "ambient":
          next.ambient = value;
          break;
        case "main":
          next.main = value;
          break;
        case "fill":
          next.fill = value;
          break;
        case "rim":
          next.rim = value;
          break;
        case "top":
          next.top = value;
          break;
        case "bottom":
          next.bottom = value;
          break;
        case "exposure":
          next.exposure = value;
          break;
        case "toneMapping":
          next.toneMapping = value;
          break;
        case "outlineWidthScale":
          next.outlineWidthScale = value;
          break;
      }
    }
  }

  return next;
}

function resolveToneMapping(value: number): THREE.ToneMapping {
  const normalized = Math.round(value);
  if (normalized >= 0 && normalized <= 7) {
    return normalized as THREE.ToneMapping;
  }
  return THREE.NeutralToneMapping;
}

function clampCalibrationValue(value: number): number {
  return Math.max(0, Math.min(2, value));
}

function resolveMotionCalibration(
  calibration?: VRMMotionCalibration,
): Required<VRMMotionCalibration> {
  const next = { ...NEKO_DEFAULT_VRM_MOTION_CALIBRATION };
  if (!calibration) return next;

  for (const key of Object.keys(NEKO_DEFAULT_VRM_MOTION_CALIBRATION) as (keyof VRMMotionCalibration)[]) {
    const value = calibration[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      next[key] = clampCalibrationValue(value);
    }
  }

  return next;
}

function createPoseBias(values: Partial<EmotionPoseBias> = {}): EmotionPoseBias {
  return { ...neutralPoseBias, ...values };
}

function addPoseBias(...biases: EmotionPoseBias[]): EmotionPoseBias {
  const next = { ...neutralPoseBias };
  for (const bias of biases) {
    for (const key of poseBiasKeys) {
      next[key] += bias[key];
    }
  }
  return next;
}

function scalePoseBias(
  bias: EmotionPoseBias,
  scale: number,
  keys: readonly (keyof EmotionPoseBias)[] = poseBiasKeys,
): EmotionPoseBias {
  const next = { ...bias };
  for (const key of keys) {
    next[key] *= scale;
  }
  return next;
}

function scalePoseBiasGroups(
  bias: EmotionPoseBias,
  calibration: Required<VRMMotionCalibration>,
): EmotionPoseBias {
  const next = { ...bias };
  for (const key of bodyPoseBiasKeys) {
    next[key] *= calibration.body;
  }
  for (const key of armPoseBiasKeys) {
    next[key] *= calibration.arms;
  }
  return next;
}

function mixPoseBias(
  from: EmotionPoseBias,
  to: EmotionPoseBias,
  alpha: number,
): EmotionPoseBias {
  const t = Math.max(0, Math.min(1, alpha));
  const next = { ...neutralPoseBias };
  for (const key of poseBiasKeys) {
    next[key] = from[key] + (to[key] - from[key]) * t;
  }
  return next;
}

function easeMotionTransition(value: number): number {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
}

export function isVrmPath(path: string): boolean {
  return /\.vrm(?:[?#].*)?$/i.test(path.trim());
}

function isMmdPath(path: string): boolean {
  return /\.(?:pmx|pmd|vmd)(?:[?#].*)?$/i.test(path.trim());
}

function readAsciiPreview(buffer: ArrayBuffer, limit = 120): string {
  const bytes = new Uint8Array(buffer, 0, Math.min(buffer.byteLength, limit));
  return Array.from(bytes)
    .map((byte) =>
      byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : ".",
    )
    .join("");
}

function decodeUtf8(buffer: ArrayBuffer): string {
  if (typeof TextDecoder !== "undefined") {
    return new TextDecoder("utf-8").decode(buffer);
  }
  return readAsciiPreview(buffer, buffer.byteLength);
}

function validateVrmPayload(buffer: ArrayBuffer, modelUrl: string): void {
  if (isMmdPath(modelUrl)) {
    throw new Error("当前 URL 是 MMD 文件，VRM PoC 只支持 .vrm。");
  }

  if (buffer.byteLength < 20) {
    throw new Error("下载到的文件太小，不像 VRM。");
  }

  const preview = readAsciiPreview(buffer);
  if (preview.startsWith("glTF")) {
    const version = new DataView(buffer).getUint32(4, true);
    if (version < 2) {
      throw new Error(`下载到的是 glTF ${version}，VRM 需要 glTF 2.0。`);
    }
    return;
  }

  if (/^\s*</.test(preview)) {
    throw new Error(`下载到的是 HTML，不是 VRM。开头: ${preview.slice(0, 80)}`);
  }

  if (preview.startsWith("PMX") || preview.startsWith("Pmd")) {
    throw new Error("下载到的是 MMD 模型，不是 VRM。");
  }

  if (/^\s*\{/.test(preview)) {
    try {
      const json = JSON.parse(decodeUtf8(buffer));
      const version = String(json?.asset?.version || "");
      if (!version) {
        throw new Error(
          `下载到的是 JSON，但不是 glTF/VRM。开头: ${preview.slice(0, 80)}`,
        );
      }
      if (Number.parseFloat(version) < 2) {
        throw new Error(`下载到的是 glTF ${version}，VRM 需要 glTF 2.0。`);
      }
      return;
    } catch (err: any) {
      throw new Error(err?.message || "下载到的 JSON 不能作为 VRM 解析。");
    }
  }

  throw new Error(`下载内容不像 VRM/GLB。开头: ${preview.slice(0, 80)}`);
}

function getLoaderResourcePath(modelUrl: string): string {
  try {
    const url = new URL(modelUrl);
    url.hash = "";
    url.search = "";
    url.pathname = url.pathname.slice(0, url.pathname.lastIndexOf("/") + 1);
    return url.toString();
  } catch {
    const slash = modelUrl.lastIndexOf("/");
    return slash >= 0 ? modelUrl.slice(0, slash + 1) : "";
  }
}

function guessMimeType(uri: string, mimeType?: string): string | undefined {
  if (mimeType) return mimeType;
  if (/\.jpe?g(?:[?#].*)?$/i.test(uri)) return "image/jpeg";
  if (/\.webp(?:[?#].*)?$/i.test(uri)) return "image/webp";
  if (/\.png(?:[?#].*)?$/i.test(uri)) return "image/png";
  return undefined;
}

function resolveTextureUri(uri: string, resourcePath: string): string {
  if (/^(?:blob|content|data|file|https?):/i.test(uri)) return uri;
  try {
    return new URL(uri, resourcePath).toString();
  } catch {
    return `${resourcePath}${uri}`;
  }
}

function getImageSize(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    Image.getSize(uri, (width, height) => resolve({ width, height }), reject);
  });
}

function prepareTextureForExpo(texture: THREE.Texture): THREE.Texture {
  texture.colorSpace = THREE.NoColorSpace;
  texture.flipY = false;
  texture.generateMipmaps = false;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.unpackAlignment = 1;
  texture.needsUpdate = true;
  return texture;
}

async function createNativeTextureFromUri(
  uri: string,
  mimeType?: string,
): Promise<THREE.Texture> {
  let localUri = uri;
  let cachedUri: string | null = null;
  const resolvedMimeType = guessMimeType(uri, mimeType);

  if (/^(?:blob|data|https?):/i.test(uri)) {
    const response = await fetch(uri);
    const bytes = new Uint8Array(await response.arrayBuffer());
    localUri = writeTextureToCache(bytes, resolvedMimeType);
    cachedUri = localUri;
  }

  const { width, height } = await getImageSize(localUri);
  const texture = new THREE.Texture();
  texture.image = {
    uri: localUri,
    localUri,
    width,
    height,
  };
  prepareTextureForExpo(texture);
  texture.userData.mimeType = resolvedMimeType;
  if (cachedUri) texture.userData[NEKO_CACHED_TEXTURE_URI] = cachedUri;
  return texture;
}

async function createNativeTextureFromBuffer(
  buffer: ArrayBuffer,
  mimeType?: string,
): Promise<THREE.Texture> {
  const localUri = writeTextureToCache(new Uint8Array(buffer), mimeType);
  const texture = await createNativeTextureFromUri(localUri, mimeType);
  texture.userData[NEKO_CACHED_TEXTURE_URI] = localUri;
  return texture;
}

function cloneNativeTexture(texture: THREE.Texture): THREE.Texture {
  const clone = texture.clone();
  clone.image = texture.image;
  prepareTextureForExpo(clone);
  return clone;
}

function registerNativeTextureSource(loader: GLTFLoader): void {
  loader.register((parser: any) => {
    parser.loadImageSource = (sourceIndex: number) => {
      if (parser.sourceCache[sourceIndex] !== undefined) {
        return parser.sourceCache[sourceIndex].then(cloneNativeTexture);
      }

      const sourceDef = parser.json.images?.[sourceIndex];
      if (!sourceDef) {
        return Promise.reject(
          new Error(`GLTF image ${sourceIndex} does not exist`),
        );
      }

      const promise =
        sourceDef.bufferView !== undefined
          ? parser
              .getDependency("bufferView", sourceDef.bufferView)
              .then((bufferView: ArrayBuffer) =>
                createNativeTextureFromBuffer(bufferView, sourceDef.mimeType),
              )
          : typeof sourceDef.uri === "string"
            ? createNativeTextureFromUri(
                resolveTextureUri(sourceDef.uri, parser.options?.path || ""),
                sourceDef.mimeType,
              )
            : Promise.reject(
                new Error(
                  `GLTF image ${sourceIndex} is missing URI and bufferView`,
                ),
              );

      parser.sourceCache[sourceIndex] = promise;
      return promise;
    };

    return { name: "NEKO_native_texture_source" };
  });
}

function disposeObject3D(object: THREE.Object3D): void {
  const deletedTextureUris = new Set<string>();
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    mesh.geometry?.dispose?.();
    const material = mesh.material;
    if (Array.isArray(material)) {
      material.forEach((item) => disposeMaterial(item, deletedTextureUris));
    } else {
      disposeMaterial(material, deletedTextureUris);
    }
  });
}

function disposeMaterial(
  material: THREE.Material | undefined,
  deletedTextureUris: Set<string>,
): void {
  if (!material) return;

  for (const value of Object.values(material as any)) {
    disposeTexture(value, deletedTextureUris);
  }

  const uniforms = (material as THREE.ShaderMaterial).uniforms;
  if (uniforms) {
    for (const uniform of Object.values(uniforms)) {
      disposeTexture((uniform as { value?: unknown }).value, deletedTextureUris);
    }
  }

  material.dispose?.();
}

function disposeTexture(value: unknown, deletedTextureUris: Set<string>): void {
  const texture = value as THREE.Texture | undefined;
  if (!texture?.isTexture) return;

  const cachedUri = texture.userData?.[NEKO_CACHED_TEXTURE_URI];
  texture.dispose?.();
  if (typeof cachedUri === "string" && !deletedTextureUris.has(cachedUri)) {
    deletedTextureUris.add(cachedUri);
    deleteCachedTextureUri(cachedUri);
  }
}

function disposeVRM(vrm: VRM): void {
  disposeObject3D(vrm.scene);
  try {
    VRMUtils.deepDispose(vrm.scene);
  } catch {}
}

function disposeAvatar(avatar: LoadedAvatar): void {
  if (avatar.kind === "vrm") {
    disposeVRM(avatar.vrm);
    return;
  }
  disposeObject3D(avatar.scene);
}

function fitVRMScene(scene: THREE.Object3D): void {
  const box = new THREE.Box3().setFromObject(scene);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const height = size.y || 1.7;
  const scale = 1.75 / height;

  if (Number.isFinite(scale) && scale > 0) {
    scene.scale.setScalar(scale);
  }

  scene.position.set(
    -center.x * scale,
    -box.min.y * scale - 0.95,
    -center.z * scale,
  );
}

function poseRotation(x: number, y: number, z: number): number[] {
  return new THREE.Quaternion()
    .setFromEuler(new THREE.Euler(x, y, z, "XYZ"))
    .toArray();
}

function applyRelaxedPose(vrm: VRM): void {
  try {
    (vrm.humanoid as any)?.setNormalizedPose({
      leftUpperArm: { rotation: poseRotation(0, 0, -1.05) },
      rightUpperArm: { rotation: poseRotation(0, 0, 1.05) },
      leftLowerArm: { rotation: poseRotation(0, 0, -0.28) },
      rightLowerArm: { rotation: poseRotation(0, 0, 0.28) },
      leftHand: { rotation: poseRotation(0, 0, -0.08) },
      rightHand: { rotation: poseRotation(0, 0, 0.08) },
    });
    vrm.humanoid?.update();
  } catch {}
}

function createIdleAnimationState(): IdleAnimationState {
  return {
    elapsed: 0,
    nextBlinkAt: 1.2 + Math.random() * 1.8,
    blinkStartedAt: -1,
    blinkDuration: 0.12,
  };
}

function createMouthSyncState(): MouthSyncState {
  return {
    target: 0,
    value: 0,
    isPlaying: false,
    playbackPresence: 0,
  };
}

function createEmotionExpressionState(): EmotionExpressionState {
  return {
    current: {
      happy: 0,
      relaxed: 0,
      surprised: 0,
      sad: 0,
      angry: 0,
    },
  };
}

function applyBlink(vrm: VRM, state: IdleAnimationState): void {
  const manager = vrm.expressionManager;
  if (!manager) return;

  if (state.blinkStartedAt < 0 && state.elapsed >= state.nextBlinkAt) {
    state.blinkStartedAt = state.elapsed;
    state.blinkDuration = 0.11 + Math.random() * 0.05;
  }

  let weight = 0;
  if (state.blinkStartedAt >= 0) {
    const progress = (state.elapsed - state.blinkStartedAt) / state.blinkDuration;
    if (progress >= 1) {
      state.blinkStartedAt = -1;
      state.nextBlinkAt = state.elapsed + 2.0 + Math.random() * 3.0;
    } else {
      weight = Math.sin(progress * Math.PI);
    }
  }

  if (manager.getExpression("blink")) {
    manager.setValue("blink", weight);
    return;
  }

  manager.setValue("blinkLeft", weight);
  manager.setValue("blinkRight", weight);
}

function getEmotionPoseBias(
  emotion: VRMEmotion,
  elapsed: number,
): EmotionPoseBias {
  const thinkingSway = Math.sin(elapsed * 1.05);

  if (emotion === "thinking") {
    return createPoseBias({
      spineX: -0.004,
      chestX: -0.006,
      neckX: 0.012,
      neckY: -0.012 + 0.005 * thinkingSway,
      headX: 0.022,
      headY: -0.02 + 0.008 * thinkingSway,
      headZ: -0.014,
      rightUpperArmX: -0.018,
      rightUpperArmY: -0.012,
      rightLowerArmZ: -0.035,
      rightHandZ: 0.018,
    });
  }

  if (emotion === "attentive") {
    return createPoseBias({
      spineX: 0.005,
      chestX: 0.006,
      neckX: -0.004,
      neckY: 0,
      headX: -0.006,
      headY: 0,
      headZ: 0,
      leftUpperArmZ: -0.012,
      rightUpperArmZ: 0.012,
    });
  }

  if (emotion === "happy") {
    return createPoseBias({
      spineX: 0.004,
      chestX: 0.006,
      neckX: -0.006,
      neckY: 0,
      headX: -0.01,
      headY: 0,
      headZ: 0,
      leftUpperArmX: -0.018,
      rightUpperArmX: -0.018,
      leftUpperArmZ: -0.018,
      rightUpperArmZ: 0.018,
      leftHandZ: -0.015,
      rightHandZ: 0.015,
    });
  }

  if (emotion === "surprised") {
    return createPoseBias({
      spineX: 0.006,
      chestX: 0.01,
      neckX: -0.012,
      neckY: 0,
      headX: -0.018,
      headY: 0,
      headZ: 0,
      leftShoulderZ: -0.02,
      rightShoulderZ: 0.02,
      leftUpperArmX: -0.025,
      rightUpperArmX: -0.025,
      leftLowerArmZ: -0.025,
      rightLowerArmZ: 0.025,
    });
  }

  return neutralPoseBias;
}

function getGestureDuration(gesture: VRMGesture): number {
  if (gesture === "nod") return 0.58;
  if (gesture === "recoil") return 0.46;
  if (gesture === "bounce") return 0.52;
  if (gesture === "tilt") return 0.72;
  if (gesture === "shake") return 0.62;
  return 0;
}

function createGestureMotionState(gesture: VRMGesture): GestureMotionState {
  return {
    kind: gesture,
    elapsed: 0,
    duration: getGestureDuration(gesture),
  };
}

function createFocusMotionState(): FocusMotionState {
  return {
    yaw: 0,
    pitch: 0,
    targetYaw: 0,
    targetPitch: 0,
    nextTargetAt: 0,
  };
}

function createMotionMachineState(): MotionMachineState {
  return {
    fromMode: "idle",
    toMode: "idle",
    transitionElapsed: 1,
    transitionDuration: 0.32,
    activeGesture: createGestureMotionState("none"),
    gestureQueue: [],
    lastGestureRevision: -1,
    focus: createFocusMotionState(),
  };
}

function emotionToMotionMode(emotion: VRMEmotion): VRMMotionMode {
  return emotion === "neutral" ? "idle" : emotion;
}

function motionModeToEmotion(mode: VRMMotionMode): VRMEmotion {
  if (mode === "idle" || mode === "speaking") return "neutral";
  return mode;
}

function deriveMotionMode(
  currentMode: VRMMotionMode,
  emotion: VRMEmotion,
  mouthState: MouthSyncState,
  lipSync: boolean,
): VRMMotionMode {
  const activeSpeaking = currentMode === "speaking";
  const presenceThreshold = activeSpeaking ? 0.08 : 0.18;
  const mouthThreshold = activeSpeaking ? 0.022 : 0.045;

  if (
    lipSync &&
    (mouthState.playbackPresence > presenceThreshold || mouthState.value > mouthThreshold)
  ) {
    return "speaking";
  }
  return emotionToMotionMode(emotion);
}

function getMotionTransitionDuration(
  from: VRMMotionMode,
  to: VRMMotionMode,
): number {
  if (from === to) return 0.01;
  if (to === "speaking") return 0.22;
  if (from === "speaking") return 0.34;
  if (to === "surprised" || from === "surprised") return 0.2;
  if (to === "thinking") return 0.34;
  if (to === "idle") return 0.52;
  return 0.3;
}

function getMotionModePoseBias(
  mode: VRMMotionMode,
  elapsed: number,
): EmotionPoseBias {
  if (mode === "speaking") {
    const talkSway = Math.sin(elapsed * 4.2);
    return createPoseBias({
      spineX: 0.003,
      chestX: 0.006,
      neckX: -0.003 + 0.003 * talkSway,
      headX: -0.005 + 0.004 * talkSway,
      headY: 0.004 * Math.sin(elapsed * 3.1),
      leftUpperArmX: -0.007,
      rightUpperArmX: -0.007,
    });
  }

  if (mode === "attentive") {
    const listenPulse = Math.pow(Math.max(0, Math.sin(elapsed * 1.72 + 0.4)), 9);
    const settle = Math.sin(elapsed * 0.62 + 0.3);
    return createPoseBias({
      spineX: 0.005 + 0.0015 * settle,
      chestX: 0.006 + 0.004 * listenPulse,
      neckX: -0.004 + 0.011 * listenPulse,
      neckY: 0.003 * settle,
      headX: -0.006 + 0.022 * listenPulse,
      headY: 0.004 * settle,
      headZ: -0.002 * settle,
      leftUpperArmZ: -0.012 - 0.004 * listenPulse,
      rightUpperArmZ: 0.012 + 0.004 * listenPulse,
      leftLowerArmZ: -0.006 * listenPulse,
      rightLowerArmZ: 0.006 * listenPulse,
    });
  }

  if (mode === "sad") {
    return createPoseBias({
      spineX: -0.008,
      chestX: -0.01,
      neckX: 0.014,
      neckY: -0.006,
      headX: 0.022,
      headY: -0.01,
      leftUpperArmZ: 0.012,
      rightUpperArmZ: -0.012,
      leftHandZ: 0.008,
      rightHandZ: -0.008,
    });
  }

  if (mode === "angry") {
    const tension = Math.sin(elapsed * 2.4);
    return createPoseBias({
      spineX: 0.004,
      chestX: 0.01,
      neckX: -0.009,
      headX: -0.014,
      headY: 0.008 * tension,
      headZ: 0.007 * tension,
      leftShoulderZ: -0.012,
      rightShoulderZ: 0.012,
      leftUpperArmX: -0.012,
      rightUpperArmX: -0.012,
      leftHandZ: -0.012,
      rightHandZ: 0.012,
    });
  }

  return getEmotionPoseBias(motionModeToEmotion(mode), elapsed);
}

function getFocusBaseForMode(
  mode: VRMMotionMode,
  speechEnergy: number,
): { yaw: number; pitch: number; wander: number; interval: number; speed: number } {
  const speech = Math.max(0, Math.min(1, speechEnergy));

  if (mode === "speaking") {
    return {
      yaw: 0.004 * Math.sin(speech * Math.PI),
      pitch: -0.012 - 0.008 * speech,
      wander: 0.26,
      interval: 1.35,
      speed: 4.8,
    };
  }

  if (mode === "thinking") {
    return { yaw: -0.02, pitch: 0.014, wander: 0.38, interval: 2.0, speed: 2.4 };
  }

  if (mode === "attentive") {
    return { yaw: 0, pitch: -0.01, wander: 0.34, interval: 2.2, speed: 3.0 };
  }

  if (mode === "happy") {
    return { yaw: 0.006, pitch: -0.016, wander: 0.48, interval: 1.9, speed: 3.6 };
  }

  if (mode === "surprised") {
    return { yaw: 0, pitch: -0.02, wander: 0.2, interval: 1.0, speed: 5.2 };
  }

  if (mode === "sad") {
    return { yaw: -0.016, pitch: 0.02, wander: 0.24, interval: 2.7, speed: 2.0 };
  }

  if (mode === "angry") {
    return { yaw: 0, pitch: -0.004, wander: 0.16, interval: 1.7, speed: 4.0 };
  }

  return { yaw: 0, pitch: -0.004, wander: 0.66, interval: 3.0, speed: 1.9 };
}

function advanceFocusMotion(
  state: FocusMotionState,
  mode: VRMMotionMode,
  delta: number,
  elapsed: number,
  speechEnergy: number,
  calibration: Required<VRMMotionCalibration>,
): EmotionPoseBias {
  const base = getFocusBaseForMode(mode, speechEnergy);

  if (elapsed >= state.nextTargetAt) {
    const yawRange = 0.042 * base.wander;
    const pitchRange = 0.026 * base.wander;
    state.targetYaw = base.yaw + (Math.random() - 0.5) * yawRange;
    state.targetPitch = base.pitch + (Math.random() - 0.5) * pitchRange;
    state.nextTargetAt = elapsed + base.interval + Math.random() * base.interval * 0.65;
  }

  const alpha = 1 - Math.exp(-Math.min(delta, 0.1) * base.speed);
  state.yaw += (state.targetYaw - state.yaw) * alpha;
  state.pitch += (state.targetPitch - state.pitch) * alpha;

  return createPoseBias({
    neckY: state.yaw * 0.32 * calibration.gaze,
    headY: state.yaw * 0.68 * calibration.gaze,
    neckX: state.pitch * 0.3 * calibration.gaze,
    headX: state.pitch * 0.7 * calibration.gaze,
  });
}

function advanceMotionMachine(
  state: MotionMachineState,
  emotion: VRMEmotion,
  mouthState: MouthSyncState,
  lipSync: boolean,
  delta: number,
  elapsed: number,
): { poseBias: EmotionPoseBias; ambientEmotion: VRMEmotion; mode: VRMMotionMode } {
  const targetMode = deriveMotionMode(state.toMode, emotion, mouthState, lipSync);
  if (targetMode !== state.toMode) {
    const previousProgress = state.transitionDuration > 0
      ? Math.min(1, state.transitionElapsed / state.transitionDuration)
      : 1;
    state.fromMode = previousProgress < 0.5 ? state.fromMode : state.toMode;
    state.toMode = targetMode;
    state.transitionElapsed = 0;
    state.transitionDuration = getMotionTransitionDuration(state.fromMode, state.toMode);
  }

  state.transitionElapsed = Math.min(
    state.transitionDuration,
    state.transitionElapsed + Math.min(delta, 0.1),
  );

  const progress = state.transitionDuration > 0
    ? state.transitionElapsed / state.transitionDuration
    : 1;
  const eased = easeMotionTransition(progress);

  if (progress >= 1) {
    state.fromMode = state.toMode;
  }

  return {
    poseBias: mixPoseBias(
      getMotionModePoseBias(state.fromMode, elapsed),
      getMotionModePoseBias(state.toMode, elapsed),
      eased,
    ),
    ambientEmotion: motionModeToEmotion(state.toMode),
    mode: state.toMode,
  };
}

function enqueueGestureMotion(
  state: MotionMachineState,
  gesture: VRMGesture,
  revision: number,
): void {
  if (gesture === "none" || revision === state.lastGestureRevision) return;
  state.lastGestureRevision = revision;

  const lastQueued = state.gestureQueue[state.gestureQueue.length - 1];
  if (state.activeGesture.kind === gesture || lastQueued === gesture) return;

  if (state.gestureQueue.length >= 3) {
    state.gestureQueue.shift();
  }
  state.gestureQueue.push(gesture);
}

function advanceQueuedGestureMotion(
  state: MotionMachineState,
  delta: number,
): EmotionPoseBias {
  if (state.activeGesture.kind === "none" && state.gestureQueue.length > 0) {
    state.activeGesture = createGestureMotionState(state.gestureQueue.shift() || "none");
  }

  const gestureBias = advanceGestureMotion(state.activeGesture, delta);
  if (state.activeGesture.kind === "none" && state.gestureQueue.length > 0) {
    state.activeGesture = createGestureMotionState(state.gestureQueue.shift() || "none");
  }
  return gestureBias;
}

function advanceGestureMotion(
  state: GestureMotionState,
  delta: number,
): EmotionPoseBias {
  if (state.kind === "none" || state.duration <= 0) {
    return neutralPoseBias;
  }

  state.elapsed += Math.min(delta, 0.1);
  const progress = Math.min(1, state.elapsed / state.duration);
  const pulse = Math.sin(progress * Math.PI);

  if (progress >= 1) {
    state.kind = "none";
  }

  if (state.kind === "nod") {
    return createPoseBias({
      spineX: 0.008 * pulse,
      chestX: 0.014 * pulse,
      neckX: 0.035 * pulse,
      neckY: 0,
      headX: 0.07 * pulse,
      headY: 0,
      headZ: 0,
      leftLowerArmZ: -0.018 * pulse,
      rightLowerArmZ: 0.018 * pulse,
    });
  }

  if (state.kind === "recoil") {
    return createPoseBias({
      spineX: -0.01 * pulse,
      chestX: -0.02 * pulse,
      neckX: -0.034 * pulse,
      neckY: 0,
      headX: -0.06 * pulse,
      headY: 0,
      headZ: 0,
      leftShoulderZ: -0.024 * pulse,
      rightShoulderZ: 0.024 * pulse,
      leftUpperArmX: -0.028 * pulse,
      rightUpperArmX: -0.028 * pulse,
    });
  }

  if (state.kind === "bounce") {
    const bounce = Math.sin(progress * Math.PI * 2.2) * (1 - progress);
    return createPoseBias({
      spineX: 0.008 * bounce,
      chestX: -0.022 * bounce,
      neckX: -0.026 * bounce,
      neckY: 0,
      headX: -0.04 * bounce,
      headY: 0,
      headZ: 0.012 * bounce,
      leftUpperArmX: -0.03 * bounce,
      rightUpperArmX: -0.03 * bounce,
      leftHandZ: -0.02 * bounce,
      rightHandZ: 0.02 * bounce,
    });
  }

  if (state.kind === "tilt") {
    const settle = Math.sin(progress * Math.PI);
    const glance = Math.sin(progress * Math.PI * 1.4) * (1 - progress * 0.25);
    return createPoseBias({
      spineX: 0.004 * settle,
      chestX: 0.006 * settle,
      neckX: -0.01 * settle,
      neckY: 0.018 * glance,
      headX: -0.014 * settle,
      headY: 0.032 * glance,
      headZ: -0.026 * settle,
      leftUpperArmY: 0.006 * settle,
      rightUpperArmY: -0.006 * settle,
    });
  }

  if (state.kind === "shake") {
    const fade = 1 - progress;
    const shake = Math.sin(progress * Math.PI * 5.2) * fade;
    return createPoseBias({
      spineX: -0.004 * pulse,
      chestX: -0.006 * pulse,
      neckX: -0.012 * pulse,
      neckY: 0.04 * shake,
      headX: -0.018 * pulse,
      headY: 0.075 * shake,
      headZ: -0.01 * shake,
      leftShoulderZ: -0.01 * pulse,
      rightShoulderZ: 0.01 * pulse,
    });
  }

  return neutralPoseBias;
}

function getAmbientArmPoseBias(
  elapsed: number,
  speechEnergy: number,
  emotion: VRMEmotion,
  calibration: Required<VRMMotionCalibration>,
): EmotionPoseBias {
  const speech = Math.max(0, Math.min(1, speechEnergy)) * calibration.speech;
  const breath = Math.sin(elapsed * 1.35);
  const slowSway = Math.sin(elapsed * 0.52 + 0.3);
  const talkBeat = Math.sin(elapsed * 7.4);
  const talkFlick = Math.sin(elapsed * 11.2 + 0.5);

  const base = createPoseBias({
    leftShoulderZ: -0.006 * breath,
    rightShoulderZ: 0.006 * breath,
    leftUpperArmX: 0.008 * breath + 0.016 * speech * talkBeat,
    rightUpperArmX: 0.007 * breath - 0.016 * speech * talkBeat,
    leftUpperArmY: 0.004 * slowSway,
    rightUpperArmY: -0.004 * slowSway,
    leftLowerArmZ: -0.007 * speech * talkFlick,
    rightLowerArmZ: 0.007 * speech * talkFlick,
    leftHandZ: -0.006 * speech * talkBeat,
    rightHandZ: 0.006 * speech * talkBeat,
  });

  if (emotion === "thinking") {
    return scalePoseBias(addPoseBias(base, createPoseBias({
      rightUpperArmY: -0.01,
      rightLowerArmY: 0.012 * slowSway,
      rightHandY: 0.01 * slowSway,
    })), calibration.arms, armPoseBiasKeys);
  }

  if (emotion === "happy") {
    return scalePoseBias(addPoseBias(base, createPoseBias({
      leftUpperArmX: -0.008 + 0.008 * talkFlick,
      rightUpperArmX: -0.008 - 0.008 * talkFlick,
      leftLowerArmY: 0.008 * slowSway,
      rightLowerArmY: -0.008 * slowSway,
    })), calibration.arms, armPoseBiasKeys);
  }

  return scalePoseBias(base, calibration.arms, armPoseBiasKeys);
}

function applyIdlePose(
  vrm: VRM,
  elapsed: number,
  speechEnergy: number,
  ambientEmotion: VRMEmotion,
  motionBias: EmotionPoseBias,
  gestureBias: EmotionPoseBias,
  relaxedPose: boolean,
  calibration: Required<VRMMotionCalibration>,
): void {
  const breath = Math.sin(elapsed * 1.45) * calibration.idle;
  const slowSway = Math.sin(elapsed * 0.48) * calibration.idle;
  const headSway = Math.sin(elapsed * 0.62 + 0.7) * calibration.idle;
  const speech = Math.max(0, Math.min(1, speechEnergy)) * calibration.speech;
  const speechPulse = Math.sin(elapsed * 9.2);
  const speechSway = Math.sin(elapsed * 4.4 + 0.4);
  const poseBias = addPoseBias(
    scalePoseBiasGroups(motionBias, calibration),
    getAmbientArmPoseBias(elapsed, speech, ambientEmotion, calibration),
    scalePoseBias(gestureBias, calibration.gesture),
  );

  try {
    const pose: Record<string, { rotation: number[] }> = {
      spine: {
        rotation: poseRotation(
          0.012 * breath + 0.003 * speech * speechPulse + poseBias.spineX,
          0,
          0.006 * slowSway + 0.003 * speech * speechSway,
        ),
      },
      chest: {
        rotation: poseRotation(
          0.018 * breath + 0.007 * speech + 0.004 * speech * speechPulse + poseBias.chestX,
          0.004 * slowSway + 0.003 * speech * speechSway,
          0,
        ),
      },
      upperChest: {
        rotation: poseRotation(
          0.012 * breath + 0.005 * speech,
          0.003 * slowSway,
          0,
        ),
      },
      neck: {
        rotation: poseRotation(
          0.003 * breath - 0.004 * speech + 0.008 * speech * speechPulse + poseBias.neckX,
          0.006 * headSway + 0.004 * speech * speechSway + poseBias.neckY,
          -0.003 * slowSway,
        ),
      },
      head: {
        rotation: poseRotation(
          0.004 * breath - 0.006 * speech + 0.012 * speech * speechPulse + poseBias.headX,
          0.01 * headSway + 0.005 * speech * speechSway + poseBias.headY,
          -0.004 * slowSway + poseBias.headZ,
        ),
      },
    };

    if (relaxedPose) {
      pose.leftShoulder = {
        rotation: poseRotation(0, 0, -0.03 + poseBias.leftShoulderZ),
      };
      pose.rightShoulder = {
        rotation: poseRotation(0, 0, 0.03 + poseBias.rightShoulderZ),
      };
      pose.leftUpperArm = {
        rotation: poseRotation(
          0.018 * breath + poseBias.leftUpperArmX,
          0.004 * slowSway + poseBias.leftUpperArmY,
          -1.05 + poseBias.leftUpperArmZ,
        ),
      };
      pose.rightUpperArm = {
        rotation: poseRotation(
          0.016 * breath + poseBias.rightUpperArmX,
          -0.004 * slowSway + poseBias.rightUpperArmY,
          1.05 + poseBias.rightUpperArmZ,
        ),
      };
      pose.leftLowerArm = {
        rotation: poseRotation(
          poseBias.leftLowerArmX,
          poseBias.leftLowerArmY,
          -0.28 + poseBias.leftLowerArmZ,
        ),
      };
      pose.rightLowerArm = {
        rotation: poseRotation(
          poseBias.rightLowerArmX,
          poseBias.rightLowerArmY,
          0.28 + poseBias.rightLowerArmZ,
        ),
      };
      pose.leftHand = {
        rotation: poseRotation(
          poseBias.leftHandX,
          poseBias.leftHandY,
          -0.08 + poseBias.leftHandZ,
        ),
      };
      pose.rightHand = {
        rotation: poseRotation(
          poseBias.rightHandX,
          poseBias.rightHandY,
          0.08 + poseBias.rightHandZ,
        ),
      };
    }

    (vrm.humanoid as any)?.setNormalizedPose(pose);
  } catch {}
}

function applyIdleAnimation(
  vrm: VRM,
  state: IdleAnimationState,
  delta: number,
  speechEnergy = 0,
  ambientEmotion: VRMEmotion = "neutral",
  motionBias: EmotionPoseBias = neutralPoseBias,
  gestureBias: EmotionPoseBias = neutralPoseBias,
  relaxedPose = false,
  calibration: Required<VRMMotionCalibration> = NEKO_DEFAULT_VRM_MOTION_CALIBRATION,
): void {
  state.elapsed += Math.min(delta, 0.1);
  applyBlink(vrm, state);
  applyIdlePose(
    vrm,
    state.elapsed,
    speechEnergy,
    ambientEmotion,
    motionBias,
    gestureBias,
    relaxedPose,
    calibration,
  );
}

function normalizeMouthAmplitude(raw: number): number {
  if (!Number.isFinite(raw) || raw < 0.008) return 0;
  return Math.min(1, Math.pow(Math.min(raw * 1.05, 1), 0.55));
}

function applyMouthExpression(vrm: VRM, value: number): void {
  const manager = vrm.expressionManager;
  if (!manager) return;

  const open = Math.max(0, Math.min(1, value));
  manager.setValue("aa", open);
  manager.setValue("oh", open * 0.18);
  manager.setValue("ou", open * 0.1);
  manager.setValue("ih", open * 0.06);
}

function applyMouthSync(
  vrm: VRM,
  state: MouthSyncState,
  delta: number,
): void {
  const rateMs = state.target > state.value ? 25 : 90;
  const alpha = Math.min(1, (Math.min(delta, 0.1) * 1000) / rateMs);
  state.value += (state.target - state.value) * alpha;

  const presenceTarget = state.isPlaying || state.value > 0.025 ? 1 : 0;
  const presenceRateMs = presenceTarget > state.playbackPresence ? 140 : 420;
  const presenceAlpha = Math.min(
    1,
    (Math.min(delta, 0.1) * 1000) / presenceRateMs,
  );
  state.playbackPresence +=
    (presenceTarget - state.playbackPresence) * presenceAlpha;

  applyMouthExpression(vrm, state.value);
}

function getSpeechEnergy(state: MouthSyncState): number {
  return Math.min(1, state.value * 0.95 + state.playbackPresence * 0.18);
}

function getEmotionTargets(
  emotion: VRMEmotion,
  mouthValue: number,
  playbackPresence: number,
): Record<ExpressionKey, number> {
  const speakingSmile = Math.min(0.13, playbackPresence * 0.07 + mouthValue * 0.05);
  const targets: Record<ExpressionKey, number> = {
    happy: speakingSmile,
    relaxed: 0,
    surprised: 0,
    sad: 0,
    angry: 0,
  };

  if (emotion === "happy") {
    targets.happy = Math.max(targets.happy, 0.3);
    targets.relaxed = 0.08;
  } else if (emotion === "attentive") {
    targets.relaxed = 0.16;
    targets.surprised = 0.04;
  } else if (emotion === "thinking") {
    targets.relaxed = 0.12;
  } else if (emotion === "surprised") {
    targets.surprised = 0.38;
  } else if (emotion === "sad") {
    targets.sad = 0.28;
  } else if (emotion === "angry") {
    targets.angry = 0.24;
  }

  return targets;
}

function applyEmotionExpressions(
  vrm: VRM,
  state: EmotionExpressionState,
  emotion: VRMEmotion,
  mouthValue: number,
  playbackPresence: number,
  delta: number,
): void {
  const manager = vrm.expressionManager;
  if (!manager) return;

  const targets = getEmotionTargets(emotion, mouthValue, playbackPresence);
  if (!manager.getExpression("happy") && manager.getExpression("relaxed")) {
    targets.relaxed = Math.max(targets.relaxed, targets.happy * 0.7);
    targets.happy = 0;
  }

  const alpha = Math.min(1, (Math.min(delta, 0.1) * 1000) / 180);
  for (const key of expressionKeys) {
    state.current[key] += (targets[key] - state.current[key]) * alpha;
    if (manager.getExpression(key)) {
      manager.setValue(key, state.current[key]);
    }
  }
}

function applyLookExpressions(
  vrm: VRM,
  focus: FocusMotionState,
  calibration: Required<VRMMotionCalibration>,
): void {
  const manager = vrm.expressionManager;
  if (!manager) return;

  const gazeScale = Math.max(0, calibration.gaze);
  const yawWeight = Math.min(0.38, Math.abs(focus.yaw) * 8.5 * gazeScale);
  const pitchWeight = Math.min(0.32, Math.abs(focus.pitch) * 8 * gazeScale);
  const targets: Record<LookExpressionKey, number> = {
    lookLeft: focus.yaw < -0.002 ? yawWeight : 0,
    lookRight: focus.yaw > 0.002 ? yawWeight : 0,
    lookUp: focus.pitch < -0.002 ? pitchWeight : 0,
    lookDown: focus.pitch > 0.002 ? pitchWeight : 0,
  };

  for (const key of lookExpressionKeys) {
    if (manager.getExpression(key)) {
      manager.setValue(key, targets[key]);
    }
  }
}

function getMaterialMap(
  material: THREE.Material | undefined,
): THREE.Texture | null {
  const map = (material as THREE.MeshBasicMaterial | undefined)?.map;
  return map?.isTexture ? prepareTextureForExpo(map) : null;
}

function getCompatMaterialColor(
  material: THREE.Material | undefined,
  index: number,
): THREE.Color {
  const sourceColor = (material as THREE.MeshBasicMaterial | undefined)?.color;
  if (sourceColor?.isColor && sourceColor.getHex() !== 0xffffff) {
    return sourceColor.clone();
  }

  const name = material?.name?.toLowerCase() || "";
  if (/skin|face|body|hand|leg|neck|arm/.test(name)) {
    return new THREE.Color("#f2c7b6");
  }
  if (/hair|bang|tail/.test(name)) {
    return new THREE.Color("#4b5563");
  }
  if (/eye|iris|pupil/.test(name)) {
    return new THREE.Color("#1f2937");
  }
  if (/mouth|lip/.test(name)) {
    return new THREE.Color("#b4535a");
  }
  if (/cloth|top|shirt|dress|skirt|sleeve|uniform|ribbon/.test(name)) {
    return new THREE.Color("#64748b");
  }
  if (/shoe|boot|sock/.test(name)) {
    return new THREE.Color("#334155");
  }

  const palette = ["#f8fafc", "#cbd5e1", "#94a3b8", "#a5b4fc", "#7dd3fc"];
  return new THREE.Color(palette[index % palette.length]);
}

function createCompatMaterial(
  material: THREE.Material | undefined,
  index = 0,
  mode: VRMRenderMode,
): THREE.MeshBasicMaterial {
  const map = mode === "texture" ? getMaterialMap(material) : null;
  const nextMaterial = new THREE.MeshBasicMaterial({
    color: map ? "#ffffff" : getCompatMaterialColor(material, index),
    map,
    transparent: false,
    opacity: 1,
    side: THREE.DoubleSide,
    depthTest: true,
    depthWrite: true,
  });
  nextMaterial.toneMapped = false;
  nextMaterial.name = material?.name ? `${material.name} (RN Compat)` : "";
  return nextMaterial;
}

function replaceMaterialsForCompat(
  scene: THREE.Object3D,
  mode: VRMRenderMode,
): void {
  scene.traverse((child) => {
    const mesh = child as THREE.Mesh & { isMesh?: boolean };
    if (!mesh.isMesh) return;

    const oldMaterial = mesh.material;
    mesh.material = Array.isArray(oldMaterial)
      ? oldMaterial.map((material, index) =>
          createCompatMaterial(material, index, mode),
        )
      : createCompatMaterial(oldMaterial, 0, mode);
  });
}

function isMToonMaterial(material: any): boolean {
  return !!material && (
    material.version === "mtoon" ||
    material.isMToonMaterial ||
    material.isMToonNodeMaterial ||
    !!material.userData?.vrmMaterialProperties
  );
}

function isThreeColor(value: any): value is THREE.Color {
  return !!value && value.isColor === true;
}

function optimizeMToonMaterial(material: any, lighting: Required<VRMLightingConfig>): void {
  if (!isMToonMaterial(material)) return;

  if (material.shadingToonyFactor !== undefined) {
    material.shadingToonyFactor = 0.3;
  }
  if (material.shadingShiftFactor !== undefined) {
    material.shadingShiftFactor = 0.15;
  }
  if (material.rimLightingMixFactor !== undefined) {
    material.rimLightingMixFactor = 0.3;
  }
  if (material.parametricRimFresnelPowerFactor !== undefined) {
    material.parametricRimFresnelPowerFactor = 3;
  }
  if (material.parametricRimLiftFactor !== undefined) {
    material.parametricRimLiftFactor = 0.1;
  }
  if (material.outlineWidthMode !== undefined) {
    material.outlineWidthMode = "screenCoordinates";
  }
  if (material.outlineWidthFactor !== undefined) {
    const outlineScale = Math.max(0.2, Math.min(2.5, lighting.outlineWidthScale));
    material.outlineWidthFactor = 0.005 * outlineScale;
  }

  const litColor = material.uniforms?.litFactor?.value ?? material.litFactor ?? material.color;
  const shadeColor = material.shadeColorFactor;
  if (isThreeColor(litColor) && isThreeColor(shadeColor)) {
    const litBrightness = (litColor.r + litColor.g + litColor.b) / 3;
    const shadeBrightness = (shadeColor.r + shadeColor.g + shadeColor.b) / 3;
    if (litBrightness > 0 && shadeBrightness < litBrightness * 0.6) {
      const factor = (litBrightness * 0.75) / Math.max(shadeBrightness, 0.01);
      shadeColor.r = Math.min(1, shadeColor.r * factor * 0.8 + litColor.r * 0.2);
      shadeColor.g = Math.min(1, shadeColor.g * factor * 0.8 + litColor.g * 0.2);
      shadeColor.b = Math.min(1, shadeColor.b * factor * 0.8 + litColor.b * 0.2);
    }
  }

  material.needsUpdate = true;
}

function optimizeVrmHubMaterials(
  scene: THREE.Object3D,
  lighting?: VRMLightingConfig,
): void {
  const resolved = resolveVrmLighting(lighting);
  scene.traverse((child) => {
    const mesh = child as THREE.Mesh & { isMesh?: boolean; isSkinnedMesh?: boolean };
    if (!mesh.isMesh && !mesh.isSkinnedMesh) return;

    mesh.castShadow = false;
    mesh.receiveShadow = false;

    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    materials.forEach((material) => optimizeMToonMaterial(material, resolved));
  });
}

async function parseVRMAvatar(
  arrayBuffer: ArrayBuffer,
  modelUrl: string,
  mode: VRMRenderMode,
  relaxedPose: boolean,
): Promise<LoadedAvatar> {
  const loader = new GLTFLoader();
  registerNativeTextureSource(loader);
  loader.register((parser) => new VRMLoaderPlugin(parser));

  const gltf: any = await new Promise((resolve, reject) => {
    loader.parse(arrayBuffer, getLoaderResourcePath(modelUrl), resolve, reject);
  });

  const nextVRM = gltf?.userData?.vrm as VRM | undefined;
  if (!nextVRM) {
    throw new Error("GLTF 已解析，但没有找到 VRM 数据");
  }

  try {
    VRMUtils.removeUnnecessaryVertices(nextVRM.scene);
  } catch {}
  try {
    VRMUtils.combineSkeletons(nextVRM.scene);
  } catch {}
  try {
    VRMUtils.rotateVRM0(nextVRM);
  } catch {}
  if (relaxedPose) {
    applyRelaxedPose(nextVRM);
  }

  fitVRMScene(nextVRM.scene);
  if (mode !== "mtoon") {
    replaceMaterialsForCompat(nextVRM.scene, mode);
    (nextVRM as any).materials = undefined;
  }
  return {
    kind: "vrm",
    scene: nextVRM.scene,
    vrm: nextVRM,
  };
}

async function parseGltfFallbackAvatar(
  arrayBuffer: ArrayBuffer,
  modelUrl: string,
): Promise<LoadedAvatar> {
  const loader = new GLTFLoader();
  registerNativeTextureSource(loader);
  const gltf: any = await new Promise((resolve, reject) => {
    loader.parse(arrayBuffer, getLoaderResourcePath(modelUrl), resolve, reject);
  });

  if (!gltf?.scene) {
    throw new Error("GLTF 已解析，但没有找到可渲染场景");
  }

  replaceMaterialsForCompat(gltf.scene, "compat");
  fitVRMScene(gltf.scene);
  return {
    kind: "gltf-fallback",
    scene: gltf.scene,
  };
}

function SpinningProbe() {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    meshRef.current.rotation.x += delta * 0.8;
    meshRef.current.rotation.y += delta * 0.6;
  });

  return (
    <mesh ref={meshRef} position={[-1.1, 0.2, 0]}>
      <boxGeometry args={[0.28, 0.28, 0.28]} />
      <meshStandardMaterial color="#14b8a6" roughness={0.45} metalness={0.1} />
    </mesh>
  );
}

function VRMLightingRig({ lighting }: { lighting?: VRMLightingConfig }) {
  const resolved = resolveVrmLighting(lighting);
  const { gl, camera } = useThree();
  const mainLightRef = useRef<THREE.DirectionalLight>(null);
  const mainTargetRef = useRef<THREE.Object3D>(null);
  const lightOffsetRef = useRef(new THREE.Vector3());

  useEffect(() => {
    gl.toneMapping = resolveToneMapping(resolved.toneMapping);
    gl.toneMappingExposure = resolved.exposure;
  }, [gl, resolved.exposure, resolved.toneMapping]);

  useFrame(() => {
    const mainLight = mainLightRef.current;
    const target = mainTargetRef.current;
    if (!mainLight || !target) return;

    lightOffsetRef.current.set(0.2, 0.5, 1.5).applyQuaternion(camera.quaternion);
    mainLight.position.copy(camera.position).add(lightOffsetRef.current);
    target.position.set(0, 0.9, 0);
    target.updateMatrixWorld();
    mainLight.target = target;
  });

  return (
    <>
      <hemisphereLight args={["#ffffff", "#f0f0f0", resolved.ambient]} />
      <directionalLight ref={mainLightRef} intensity={resolved.main} castShadow={false} />
      <object3D ref={mainTargetRef} />
      <directionalLight position={[-2, 1, 2]} intensity={resolved.fill} castShadow={false} />
      <directionalLight position={[0, 1, -2]} intensity={resolved.rim} castShadow={false} />
      <directionalLight position={[0, 3, 0]} intensity={resolved.top} castShadow={false} />
      <directionalLight position={[0, -1, 1]} intensity={resolved.bottom} castShadow={false} />
    </>
  );
}

function VRMModel({
  modelUrl,
  animationUrl,
  mode,
  autoRotate,
  idleAnimation,
  lipSync,
  emotion,
  gesture,
  gestureRevision,
  lighting,
  motionCalibration,
  debugTelemetry,
  relaxedPose,
  modelScale,
  modelPosition,
  onPhase,
  onError,
  onNotice,
  onDebugTelemetry,
}: {
  modelUrl: string;
  animationUrl?: string;
  mode: VRMRenderMode;
  autoRotate: boolean;
  idleAnimation: boolean;
  lipSync: boolean;
  emotion: VRMEmotion;
  gesture: VRMGesture;
  gestureRevision: number;
  lighting?: VRMLightingConfig;
  motionCalibration?: VRMMotionCalibration;
  debugTelemetry: boolean;
  relaxedPose: boolean;
  modelScale: number;
  modelPosition: { x: number; y: number };
  onPhase: (phase: VRMRenderPhase) => void;
  onError: (message: string | null) => void;
  onNotice: (message: string | null) => void;
  onDebugTelemetry?: (telemetry: VRMMotionDebugTelemetry) => void;
}) {
  const [avatar, setAvatar] = useState<LoadedAvatar | null>(null);
  const avatarRef = useRef<LoadedAvatar | null>(null);
  const idleStateRef = useRef(createIdleAnimationState());
  const mouthSyncRef = useRef<MouthSyncState>(createMouthSyncState());
  const emotionStateRef = useRef<EmotionExpressionState>(createEmotionExpressionState());
  const motionMachineRef = useRef<MotionMachineState>(createMotionMachineState());
  const animationRuntimeRef = useRef<VRMAnimationRuntime | null>(null);
  const lightingRef = useRef<VRMLightingConfig | undefined>(lighting);
  const debugTelemetryAtRef = useRef(0);
  lightingRef.current = lighting;
  const debugTelemetryRef = useRef(onDebugTelemetry);
  debugTelemetryRef.current = onDebugTelemetry;
  const resolvedCalibration = resolveMotionCalibration(motionCalibration);

  useFrame((_, delta) => {
    const current = avatarRef.current;
    if (!current) return;
    if (current.kind === "vrm") {
      const animationRuntime = animationRuntimeRef.current;
      if (animationRuntime) {
        advanceVrmAnimation(animationRuntime, delta);
      }
      if (lipSync) {
        applyMouthSync(current.vrm, mouthSyncRef.current, delta);
      }
      applyEmotionExpressions(
        current.vrm,
        emotionStateRef.current,
        emotion,
        lipSync ? mouthSyncRef.current.value : 0,
        lipSync ? mouthSyncRef.current.playbackPresence : 0,
        delta,
      );
      if (animationRuntime) {
        idleStateRef.current.elapsed += Math.min(delta, 0.1);
        applyBlink(current.vrm, idleStateRef.current);
      } else if (idleAnimation) {
        const speechEnergy = lipSync ? getSpeechEnergy(mouthSyncRef.current) : 0;
        const machine = motionMachineRef.current;
        const motionFrame = advanceMotionMachine(
          machine,
          emotion,
          mouthSyncRef.current,
          lipSync,
          delta,
          idleStateRef.current.elapsed,
        );
        const focusBias = advanceFocusMotion(
          machine.focus,
          motionFrame.mode,
          delta,
          idleStateRef.current.elapsed,
          speechEnergy,
          resolvedCalibration,
        );
        applyLookExpressions(current.vrm, machine.focus, resolvedCalibration);
        const gestureBias = advanceQueuedGestureMotion(machine, delta);
        applyIdleAnimation(
          current.vrm,
          idleStateRef.current,
          delta,
          speechEnergy,
          motionFrame.ambientEmotion,
          addPoseBias(motionFrame.poseBias, focusBias),
          gestureBias,
          relaxedPose,
          resolvedCalibration,
        );
        if (debugTelemetry && debugTelemetryRef.current) {
          const now = Date.now();
          if (now - debugTelemetryAtRef.current > 180) {
            debugTelemetryAtRef.current = now;
            debugTelemetryRef.current({
              mode: motionFrame.mode,
              fromMode: machine.fromMode,
              transition: machine.transitionDuration > 0
                ? Math.min(1, machine.transitionElapsed / machine.transitionDuration)
                : 1,
              emotion,
              mouthValue: mouthSyncRef.current.value,
              playbackPresence: mouthSyncRef.current.playbackPresence,
              speechEnergy,
              isPlaying: mouthSyncRef.current.isPlaying,
              activeGesture: machine.activeGesture.kind,
              gestureQueue: [...machine.gestureQueue],
              focusYaw: machine.focus.yaw,
              focusPitch: machine.focus.pitch,
              calibration: resolvedCalibration,
            });
          }
        }
      }
      current.vrm.update(delta);
    }
    if (autoRotate) {
      current.scene.rotation.y += delta * 0.12;
    }
  });

  useEffect(() => {
    let cancelled = false;
    let loadedAvatar: LoadedAvatar | null = null;
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;

    setAvatar(null);
    avatarRef.current = null;
    if (animationRuntimeRef.current) {
      disposeVrmAnimation(animationRuntimeRef.current);
      animationRuntimeRef.current = null;
    }
    idleStateRef.current = createIdleAnimationState();
    mouthSyncRef.current = createMouthSyncState();
    emotionStateRef.current = createEmotionExpressionState();
    motionMachineRef.current = createMotionMachineState();
    onError(null);
    onNotice(null);

    const load = async () => {
      try {
        cleanupVrmTextureCache();
        onPhase("fetching");
        const response = await fetch(modelUrl, controller ? { signal: controller.signal } : undefined);
        if (!response.ok) {
          throw new Error(`下载失败: HTTP ${response.status}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        if (cancelled) return;

        validateVrmPayload(arrayBuffer, modelUrl);

        onPhase("parsing");
        try {
          loadedAvatar = await parseVRMAvatar(
            arrayBuffer,
            modelUrl,
            mode,
            relaxedPose,
          );
          if (mode === "compat") {
            onNotice("VRM 已解析；当前使用色块稳定模式作为材质诊断基线。");
          } else if (mode === "texture") {
            onNotice("VRM 已解析；当前使用主贴图模式，MToon shader 已绕过。");
          } else {
            onNotice("VRM 已解析；当前使用完整 MToon 材质。");
          }
        } catch (parseError: any) {
          const message = parseError?.message || "VRM 解析失败";
          if (!/colorspace|colorSpace|texture|material/i.test(message)) {
            throw parseError;
          }

          loadedAvatar = await parseGltfFallbackAvatar(arrayBuffer, modelUrl);
          onNotice(`VRM 材质解析失败，已用普通 glTF 材质降级显示：${message}`);
        }

        if (cancelled) {
          disposeAvatar(loadedAvatar);
          return;
        }

        if (loadedAvatar.kind === "vrm") {
          optimizeVrmHubMaterials(loadedAvatar.vrm.scene, lightingRef.current);
        }

        avatarRef.current = loadedAvatar;
        setAvatar(loadedAvatar);
        onPhase(loadedAvatar.kind === "vrm" ? "loaded" : "fallback-loaded");
      } catch (err: any) {
        if (cancelled) return;
        if (err?.name === "AbortError") return;
        onPhase("failed");
        onError(err?.message || "VRM 加载失败");
      }
    };

    load().catch(() => {});

    return () => {
      cancelled = true;
      controller?.abort();
      if (animationRuntimeRef.current) {
        disposeVrmAnimation(animationRuntimeRef.current, avatarRef.current?.kind === "vrm" ? avatarRef.current.vrm : undefined);
        animationRuntimeRef.current = null;
      }
      if (loadedAvatar) {
        disposeAvatar(loadedAvatar);
      }
      avatarRef.current = null;
      cleanupVrmTextureCache();
    };
  }, [autoRotate, idleAnimation, lipSync, mode, modelUrl, onError, onNotice, onPhase, relaxedPose]);

  useEffect(() => {
    const current = avatarRef.current;
    if (animationRuntimeRef.current) {
      disposeVrmAnimation(animationRuntimeRef.current, current?.kind === "vrm" ? current.vrm : undefined);
      animationRuntimeRef.current = null;
    }

    if (!animationUrl || current?.kind !== "vrm") return;

    let cancelled = false;
    let runtime: VRMAnimationRuntime | null = null;
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;

    const loadAnimation = async () => {
      try {
        runtime = await loadVrmAnimationRuntime(animationUrl, current.vrm, controller?.signal);
        if (cancelled || avatarRef.current !== current) {
          disposeVrmAnimation(runtime, current.vrm);
          return;
        }
        animationRuntimeRef.current = runtime;
        onNotice(`${runtime.format === "vrma" ? "VRMA" : "glTF"} 动画已启用：${runtime.trackCount} 条轨道`);
      } catch (err: any) {
        if (cancelled || err?.name === "AbortError") return;
        onNotice(`VRM 动画暂不可用，已保持基础动作：${err?.message || "解析失败"}`);
      }
    };

    loadAnimation().catch(() => {});

    return () => {
      cancelled = true;
      controller?.abort();
      if (runtime) {
        disposeVrmAnimation(runtime, current.vrm);
      }
      if (animationRuntimeRef.current === runtime) {
        animationRuntimeRef.current = null;
      }
    };
  }, [animationUrl, avatar, onNotice]);

  useEffect(() => {
    const current = avatarRef.current;
    if (current?.kind === "vrm") {
      optimizeVrmHubMaterials(current.vrm.scene, lighting);
    }
  }, [lighting]);

  useEffect(() => {
    enqueueGestureMotion(motionMachineRef.current, gesture, gestureRevision);
  }, [gesture, gestureRevision]);

  useEffect(() => {
    const state = mouthSyncRef.current;
    state.target = 0;
    state.value = 0;
    state.isPlaying = false;
    state.playbackPresence = 0;

    if (!lipSync) return;

    const startSub = PCMStream.addListener("onPlaybackStart", () => {
      state.isPlaying = true;
    });
    const pausedSub = PCMStream.addListener("onPlaybackPaused", () => {
      state.isPlaying = false;
    });
    const resumedSub = PCMStream.addListener("onPlaybackResumed", () => {
      state.isPlaying = true;
    });
    const ampSub = PCMStream.addListener(
      "onAmplitudeUpdate",
      (event: OnAmplitudeUpdateEventPayload) => {
        state.target = normalizeMouthAmplitude(event?.amplitude);
      },
    );
    const stopSub = PCMStream.addListener("onPlaybackStop", () => {
      state.isPlaying = false;
      state.target = 0;
    });

    return () => {
      startSub?.remove();
      pausedSub?.remove();
      resumedSub?.remove();
      ampSub?.remove();
      stopSub?.remove();
      state.target = 0;
      state.value = 0;
      state.isPlaying = false;
      state.playbackPresence = 0;
    };
  }, [lipSync, modelUrl]);

  if (!avatar) return null;
  return (
    <group
      position={[modelPosition.x, modelPosition.y, 0]}
      scale={[modelScale, modelScale, modelScale]}
    >
      <primitive object={avatar.scene} />
    </group>
  );
}

export function VRMAvatarView({
  modelUrl,
  animationUrl,
  renderMode = "mtoon",
  showProbe = false,
  autoRotate = false,
  idleAnimation = false,
  lipSync = false,
  emotion = "neutral",
  gesture = "none",
  gestureRevision = 0,
  lighting,
  motionCalibration,
  debugTelemetry = false,
  relaxedPose = false,
  modelScale = 1,
  modelPosition = { x: 0, y: 0 },
  backgroundColor = "#111827",
  transparentBackground = false,
  style,
  onPhase = () => {},
  onError = () => {},
  onNotice = () => {},
  onDebugTelemetry,
}: VRMAvatarViewProps) {
  return (
    <View
      style={[
        styles.canvasShell,
        transparentBackground && styles.transparentCanvasShell,
        style,
      ]}
    >
      <Canvas
        style={styles.canvas}
        camera={{ position: [0, 0.8, 3.2], fov: 28 }}
        gl={transparentBackground ? { alpha: true } : undefined}
        onCreated={({ gl }) => {
          if (transparentBackground) {
            gl.setClearColor(0x000000, 0);
          }
          onPhase("canvas-ready");
        }}
      >
        {!transparentBackground ? (
          <color attach="background" args={[backgroundColor]} />
        ) : null}
        <VRMLightingRig lighting={lighting} />
        {showProbe ? <SpinningProbe /> : null}
        <VRMModel
          modelUrl={modelUrl}
          animationUrl={animationUrl}
          mode={renderMode}
          autoRotate={autoRotate}
          idleAnimation={idleAnimation}
          lipSync={lipSync}
          emotion={emotion}
          gesture={gesture}
          gestureRevision={gestureRevision}
          lighting={lighting}
          motionCalibration={motionCalibration}
          debugTelemetry={debugTelemetry}
          relaxedPose={relaxedPose}
          modelScale={modelScale}
          modelPosition={modelPosition}
          onPhase={onPhase}
          onError={onError}
          onNotice={onNotice}
          onDebugTelemetry={onDebugTelemetry}
        />
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  canvasShell: {
    height: 420,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  transparentCanvasShell: {
    backgroundColor: "transparent",
    borderWidth: 0,
  },
  canvas: {
    flex: 1,
    width: "100%",
    backgroundColor: "transparent",
  },
});
