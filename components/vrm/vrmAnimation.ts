import type { VRM } from "@pixiv/three-vrm";
import {
  createVRMAnimationClip,
  VRMAnimationLoaderPlugin,
  VRMLookAtQuaternionProxy,
  type VRMAnimation,
} from "@pixiv/three-vrm-animation";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export type VRMAnimationRuntime = {
  format: "vrma" | "gltf";
  mixer: THREE.AnimationMixer;
  action: THREE.AnimationAction;
  root: THREE.Object3D;
  sourceUrl: string;
  clipName: string;
  trackCount: number;
  restoreAutoUpdateHumanBones?: boolean;
};

const humanBoneNames = [
  "hips",
  "spine",
  "chest",
  "upperChest",
  "neck",
  "head",
  "leftShoulder",
  "leftUpperArm",
  "leftLowerArm",
  "leftHand",
  "rightShoulder",
  "rightUpperArm",
  "rightLowerArm",
  "rightHand",
  "leftUpperLeg",
  "leftLowerLeg",
  "leftFoot",
  "leftToes",
  "rightUpperLeg",
  "rightLowerLeg",
  "rightFoot",
  "rightToes",
] as const;

const boneAliases: Record<(typeof humanBoneNames)[number], string[]> = {
  hips: ["hips", "j_bip_c_hips", "mixamorig_hips", "mixamorig:hips"],
  spine: ["spine", "j_bip_c_spine", "mixamorig_spine", "mixamorig:spine"],
  chest: ["chest", "j_bip_c_chest", "mixamorig_spine1", "mixamorig:spine1"],
  upperChest: ["upperchest", "j_bip_c_upperchest", "mixamorig_spine2", "mixamorig:spine2"],
  neck: ["neck", "j_bip_c_neck", "mixamorig_neck", "mixamorig:neck"],
  head: ["head", "j_bip_c_head", "mixamorig_head", "mixamorig:head"],
  leftShoulder: ["leftshoulder", "j_bip_l_shoulder", "mixamorig_leftshoulder", "mixamorig:leftshoulder"],
  leftUpperArm: ["leftupperarm", "leftarm", "j_bip_l_upperarm", "mixamorig_leftarm", "mixamorig:leftarm"],
  leftLowerArm: ["leftlowerarm", "leftforearm", "j_bip_l_lowerarm", "mixamorig_leftforearm", "mixamorig:leftforearm"],
  leftHand: ["lefthand", "j_bip_l_hand", "mixamorig_lefthand", "mixamorig:lefthand"],
  rightShoulder: ["rightshoulder", "j_bip_r_shoulder", "mixamorig_rightshoulder", "mixamorig:rightshoulder"],
  rightUpperArm: ["rightupperarm", "rightarm", "j_bip_r_upperarm", "mixamorig_rightarm", "mixamorig:rightarm"],
  rightLowerArm: ["rightlowerarm", "rightforearm", "j_bip_r_lowerarm", "mixamorig_rightforearm", "mixamorig:rightforearm"],
  rightHand: ["righthand", "j_bip_r_hand", "mixamorig_righthand", "mixamorig:righthand"],
  leftUpperLeg: ["leftupperleg", "leftupleg", "j_bip_l_upperleg", "mixamorig_leftupleg", "mixamorig:leftupleg"],
  leftLowerLeg: ["leftlowerleg", "leftleg", "j_bip_l_lowerleg", "mixamorig_leftleg", "mixamorig:leftleg"],
  leftFoot: ["leftfoot", "j_bip_l_foot", "mixamorig_leftfoot", "mixamorig:leftfoot"],
  leftToes: ["lefttoes", "lefttoe", "j_bip_l_toe", "mixamorig_lefttoe", "mixamorig:lefttoe"],
  rightUpperLeg: ["rightupperleg", "rightupleg", "j_bip_r_upperleg", "mixamorig_rightupleg", "mixamorig:rightupleg"],
  rightLowerLeg: ["rightlowerleg", "rightleg", "j_bip_r_lowerleg", "mixamorig_rightleg", "mixamorig:rightleg"],
  rightFoot: ["rightfoot", "j_bip_r_foot", "mixamorig_rightfoot", "mixamorig:rightfoot"],
  rightToes: ["righttoes", "righttoe", "j_bip_r_toe", "mixamorig_righttoe", "mixamorig:righttoe"],
};

function getLoaderResourcePath(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    parsed.search = "";
    parsed.pathname = parsed.pathname.slice(0, parsed.pathname.lastIndexOf("/") + 1);
    return parsed.toString();
  } catch {
    const slash = url.lastIndexOf("/");
    return slash >= 0 ? url.slice(0, slash + 1) : "";
  }
}

function readAsciiPreview(buffer: ArrayBuffer, limit = 120): string {
  const bytes = new Uint8Array(buffer, 0, Math.min(buffer.byteLength, limit));
  return Array.from(bytes)
    .map((byte) => (byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : "."))
    .join("");
}

function validateAnimationPayload(buffer: ArrayBuffer, animationUrl: string): void {
  const preview = readAsciiPreview(buffer);
  if (/^\s*</.test(preview)) {
    throw new Error(`动画下载到的是 HTML，不是 glTF/VRMA。开头: ${preview.slice(0, 80)}`);
  }
  if (buffer.byteLength < 20) {
    throw new Error("动画文件太小，无法解析。");
  }
  if (/\.vmd(?:[?#].*)?$/i.test(animationUrl)) {
    throw new Error("当前移动端动画入口只处理 glTF/VRMA，不直接处理 VMD。");
  }
}

function normalizeBoneName(name: string): string {
  return name.replace(/[\s_.-]/g, "").toLowerCase();
}

function getTrackBindingName(trackName: string): { target: string; property: string } | null {
  const dot = trackName.lastIndexOf(".");
  if (dot <= 0 || dot >= trackName.length - 1) return null;
  const target = trackName.slice(0, dot).replace(/^.*\//, "").replace(/^.*\]/, "");
  return { target, property: trackName.slice(dot + 1) };
}

function findHumanBone(vrm: VRM, sourceName: string): THREE.Object3D | null {
  const normalized = normalizeBoneName(sourceName);
  for (const boneName of humanBoneNames) {
    if (normalizeBoneName(boneName) !== normalized && !boneAliases[boneName].some((alias) => normalizeBoneName(alias) === normalized)) {
      continue;
    }

    const humanoid = vrm.humanoid as any;
    return (
      humanoid?.getNormalizedBoneNode?.(boneName) ||
      humanoid?.getRawBoneNode?.(boneName) ||
      null
    );
  }
  return null;
}

function findTrackTarget(vrm: VRM, sourceName: string): THREE.Object3D | null {
  const direct = vrm.scene.getObjectByName(sourceName);
  if (direct) return direct;

  const normalizedSource = normalizeBoneName(sourceName);
  let looseMatch: THREE.Object3D | null = null;
  vrm.scene.traverse((object) => {
    if (looseMatch) return;
    if (normalizeBoneName(object.name) === normalizedSource) {
      looseMatch = object;
    }
  });
  return looseMatch || findHumanBone(vrm, sourceName);
}

function ensureAnimationRoot(vrm: VRM, target: THREE.Object3D): THREE.Object3D {
  const normalizedRoot = (vrm.humanoid as any)?._normalizedHumanBones?.root as THREE.Object3D | undefined;
  if (normalizedRoot && !vrm.scene.getObjectByName(normalizedRoot.name)) {
    vrm.scene.add(normalizedRoot);
  }

  let cursor: THREE.Object3D | null = target;
  while (cursor) {
    if (cursor === vrm.scene) return vrm.scene;
    if (cursor === normalizedRoot) return normalizedRoot;
    cursor = cursor.parent;
  }

  return vrm.scene;
}

function normalizeQuaternionTrackSigns(clip: THREE.AnimationClip): void {
  for (const track of clip.tracks) {
    if (!(track instanceof THREE.QuaternionKeyframeTrack)) continue;
    const values = track.values;
    for (let i = 4; i < values.length; i += 4) {
      const dot =
        values[i - 4] * values[i] +
        values[i - 3] * values[i + 1] +
        values[i - 2] * values[i + 2] +
        values[i - 1] * values[i + 3];
      if (dot >= 0) continue;
      values[i] = -values[i];
      values[i + 1] = -values[i + 1];
      values[i + 2] = -values[i + 2];
      values[i + 3] = -values[i + 3];
    }
  }
}

function pickLongestClip(clips: THREE.AnimationClip[]): THREE.AnimationClip | undefined {
  return clips
    .slice()
    .sort((a, b) => b.duration - a.duration)[0];
}

function pickLongestVrmAnimation(animations: VRMAnimation[]): VRMAnimation | undefined {
  return animations
    .slice()
    .sort((a, b) => b.duration - a.duration)[0];
}

function ensureLookAtProxy(vrm: VRM): void {
  const lookAt = vrm.lookAt;
  if (!lookAt) return;

  const existing = vrm.scene.children.find((child) => (
    child instanceof VRMLookAtQuaternionProxy ||
    child.type === "VRMLookAtQuaternionProxy"
  ));
  if (existing) {
    if (!existing.name) existing.name = "VRMLookAtQuaternionProxy";
    return;
  }

  const proxy = new VRMLookAtQuaternionProxy(lookAt);
  proxy.name = "VRMLookAtQuaternionProxy";
  vrm.scene.add(proxy);
}

function createPlayableClip(clip: THREE.AnimationClip, vrm: VRM): { clip: THREE.AnimationClip; root: THREE.Object3D } {
  const tracks: THREE.KeyframeTrack[] = [];
  let root: THREE.Object3D | null = null;

  for (const sourceTrack of clip.tracks) {
    const binding = getTrackBindingName(sourceTrack.name);
    if (!binding) continue;
    if (!["quaternion", "position", "scale"].includes(binding.property)) continue;

    const target = findTrackTarget(vrm, binding.target);
    if (!target) continue;

    const track = sourceTrack.clone();
    track.name = `${THREE.PropertyBinding.sanitizeNodeName(target.name)}.${binding.property}`;
    tracks.push(track);
    root = root || ensureAnimationRoot(vrm, target);
  }

  if (tracks.length === 0) {
    throw new Error("动画文件已解析，但没有找到可映射到当前 VRM 骨骼的轨道。");
  }

  const nextClip = new THREE.AnimationClip(clip.name || "VRM animation", clip.duration, tracks);
  normalizeQuaternionTrackSigns(nextClip);
  return { clip: nextClip, root: root || vrm.scene };
}

function createRuntime(
  format: VRMAnimationRuntime["format"],
  clip: THREE.AnimationClip,
  root: THREE.Object3D,
  sourceUrl: string,
  vrm: VRM,
  disableAutoUpdateHumanBones: boolean,
): VRMAnimationRuntime {
  const mixer = new THREE.AnimationMixer(root);
  const action = mixer.clipAction(clip);
  const humanoid = vrm.humanoid as any;
  const previousAutoUpdate = typeof humanoid?.autoUpdateHumanBones === "boolean"
    ? humanoid.autoUpdateHumanBones
    : undefined;

  if (disableAutoUpdateHumanBones && humanoid && "autoUpdateHumanBones" in humanoid) {
    humanoid.autoUpdateHumanBones = false;
  }

  action.enabled = true;
  action.setLoop(THREE.LoopRepeat, Infinity);
  action.reset().fadeIn(0.35).play();
  mixer.update(0.001);

  return {
    format,
    mixer,
    action,
    root,
    sourceUrl,
    clipName: clip.name || "VRM animation",
    trackCount: clip.tracks.length,
    restoreAutoUpdateHumanBones: previousAutoUpdate,
  };
}

export async function loadVrmAnimationRuntime(
  animationUrl: string,
  vrm: VRM,
  signal?: AbortSignal,
): Promise<VRMAnimationRuntime> {
  const response = await fetch(animationUrl, signal ? { signal } : undefined);
  if (!response.ok) {
    throw new Error(`动画下载失败: HTTP ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  validateAnimationPayload(arrayBuffer, animationUrl);
  if (signal?.aborted) throw new Error("动画加载已取消");

  const loader = new GLTFLoader();
  loader.register((parser) => new VRMAnimationLoaderPlugin(parser));
  const gltf: any = await new Promise((resolve, reject) => {
    loader.parse(arrayBuffer, getLoaderResourcePath(animationUrl), resolve, reject);
  });

  const vrmAnimation = pickLongestVrmAnimation((gltf?.userData?.vrmAnimations || []) as VRMAnimation[]);
  if (vrmAnimation) {
    ensureLookAtProxy(vrm);
    const clip = createVRMAnimationClip(vrmAnimation, vrm);
    return createRuntime("vrma", clip, vrm.scene, animationUrl, vrm, false);
  }

  const sourceClip = pickLongestClip((gltf?.animations || []) as THREE.AnimationClip[]);
  if (!sourceClip) {
    throw new Error("动画文件已解析，但没有找到 glTF animation clip。");
  }

  const playable = createPlayableClip(sourceClip, vrm);
  return createRuntime("gltf", playable.clip, playable.root, animationUrl, vrm, true);
}

export function advanceVrmAnimation(runtime: VRMAnimationRuntime, delta: number): void {
  runtime.mixer.update(Math.min(delta, 0.1));
}

export function disposeVrmAnimation(runtime: VRMAnimationRuntime, vrm?: VRM): void {
  try {
    runtime.action.stop();
    runtime.mixer.stopAllAction();
    runtime.mixer.uncacheClip(runtime.action.getClip());
    runtime.mixer.uncacheRoot(runtime.root);
  } catch {}

  const humanoid = vrm?.humanoid as any;
  if (typeof runtime.restoreAutoUpdateHumanBones === "boolean" && humanoid) {
    humanoid.autoUpdateHumanBones = runtime.restoreAutoUpdateHumanBones;
  }
}
