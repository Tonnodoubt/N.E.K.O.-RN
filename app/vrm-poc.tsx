/* eslint-disable react/no-unknown-property */
import { VRMLoaderPlugin, VRMUtils, type VRM } from "@pixiv/three-vrm";
import { Canvas, useFrame } from "@react-three/fiber/native";
import { Directory, File, Paths } from "expo-file-system";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

import { useDevConnectionConfig } from "@/hooks/useDevConnectionConfig";
import {
  createPageConfigApiClient,
  type PageConfigResponse,
} from "@/services/api/pageConfig";
import { buildHttpBaseURL } from "@/utils/devConnectionConfig";

type CheckStatus = "pass" | "warn" | "fail";
type RenderPhase =
  | "idle"
  | "canvas-ready"
  | "fetching"
  | "parsing"
  | "loaded"
  | "fallback-loaded"
  | "failed";

type CheckItem = {
  id: string;
  label: string;
  detail: string;
  status: CheckStatus;
};

type RenderAttempt = {
  id: number;
  url: string;
  mode: RenderMode;
};

type RenderMode = "compat" | "texture" | "mtoon";

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

const renderPhaseLabel: Record<RenderPhase, string> = {
  idle: "未开始",
  "canvas-ready": "Canvas 已创建",
  fetching: "正在下载 VRM",
  parsing: "正在解析 VRM",
  loaded: "VRM 已渲染",
  "fallback-loaded": "普通 glTF 降级已渲染",
  failed: "失败",
};

const renderModes: { label: string; value: RenderMode }[] = [
  { label: "色块稳定", value: "compat" },
  { label: "主贴图", value: "texture" },
  { label: "MToon", value: "mtoon" },
];

const SAMPLE_VRM_PATH = "/static/vrm/sister1.0.vrm";
const POC_PASSED_SUBTITLE =
  "VRM 下载解析、主贴图与 MToon 渲染已在真机跑通；本页保留三种模式用于后续诊断。";
const textureCacheDirectory = new Directory(Paths.cache, "neko-vrm-textures");
let textureCacheCounter = 0;

function isVrmPath(path: string): boolean {
  return /\.vrm(?:[?#].*)?$/i.test(path.trim());
}

function isMmdPath(path: string): boolean {
  return /\.(?:pmx|pmd|vmd)(?:[?#].*)?$/i.test(path.trim());
}

function resolveModelUrl(
  modelPath: string,
  apiBase: string,
  p2pToken?: string,
): string {
  const raw = modelPath.trim();
  if (!raw) return "";
  if (raw.startsWith("file://") || raw.startsWith("content://")) return raw;

  try {
    const base = apiBase.endsWith("/") ? apiBase : `${apiBase}/`;
    const url = new URL(raw, base);
    if (p2pToken && !url.searchParams.has("token")) {
      url.searchParams.set("token", p2pToken);
    }
    return url.toString();
  } catch {
    return raw;
  }
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
      throw new Error(err?.message || `下载到的 JSON 不能作为 VRM 解析。`);
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

function getTextureExtension(mimeType?: string): string {
  switch (mimeType) {
    case "image/jpeg":
      return "jpg";
    case "image/webp":
      return "webp";
    default:
      return "png";
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

function writeTextureToCache(bytes: Uint8Array, mimeType?: string): string {
  textureCacheDirectory.create({ idempotent: true, intermediates: true });
  const file = new File(
    textureCacheDirectory,
    `texture-${Date.now()}-${textureCacheCounter++}.${getTextureExtension(
      mimeType,
    )}`,
  );
  (file as any).create({ intermediates: true, overwrite: true });
  (file as any).write(bytes);
  return file.uri;
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
  const resolvedMimeType = guessMimeType(uri, mimeType);

  if (/^(?:blob|data|https?):/i.test(uri)) {
    const response = await fetch(uri);
    const bytes = new Uint8Array(await response.arrayBuffer());
    localUri = writeTextureToCache(bytes, resolvedMimeType);
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
  return texture;
}

async function createNativeTextureFromBuffer(
  buffer: ArrayBuffer,
  mimeType?: string,
): Promise<THREE.Texture> {
  const localUri = writeTextureToCache(new Uint8Array(buffer), mimeType);
  return createNativeTextureFromUri(localUri, mimeType);
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
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    mesh.geometry?.dispose?.();
    const material = mesh.material;
    if (Array.isArray(material)) {
      material.forEach((item) => item.dispose?.());
    } else {
      material?.dispose?.();
    }
  });
}

function disposeVRM(vrm: VRM): void {
  try {
    VRMUtils.deepDispose(vrm.scene);
  } catch {
    disposeObject3D(vrm.scene);
  }
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

async function parseVRMAvatar(
  arrayBuffer: ArrayBuffer,
  modelUrl: string,
  mode: RenderMode,
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

function createCompatMaterial(
  material: THREE.Material | undefined,
  index = 0,
  mode: RenderMode,
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

function replaceMaterialsForCompat(
  scene: THREE.Object3D,
  mode: RenderMode,
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

function VRMModel({
  modelUrl,
  mode,
  onPhase,
  onError,
  onNotice,
}: {
  modelUrl: string;
  mode: RenderMode;
  onPhase: (phase: RenderPhase) => void;
  onError: (message: string | null) => void;
  onNotice: (message: string | null) => void;
}) {
  const [avatar, setAvatar] = useState<LoadedAvatar | null>(null);
  const avatarRef = useRef<LoadedAvatar | null>(null);

  useFrame((_, delta) => {
    const current = avatarRef.current;
    if (!current) return;
    if (current.kind === "vrm") {
      current.vrm.update(delta);
    }
    current.scene.rotation.y += delta * 0.12;
  });

  useEffect(() => {
    let cancelled = false;
    let loadedAvatar: LoadedAvatar | null = null;

    setAvatar(null);
    avatarRef.current = null;
    onError(null);
    onNotice(null);

    const load = async () => {
      try {
        onPhase("fetching");
        const response = await fetch(modelUrl);
        if (!response.ok) {
          throw new Error(`下载失败: HTTP ${response.status}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        if (cancelled) return;

        validateVrmPayload(arrayBuffer, modelUrl);

        onPhase("parsing");
        try {
          loadedAvatar = await parseVRMAvatar(arrayBuffer, modelUrl, mode);
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

        avatarRef.current = loadedAvatar;
        setAvatar(loadedAvatar);
        onPhase(loadedAvatar.kind === "vrm" ? "loaded" : "fallback-loaded");
      } catch (err: any) {
        if (cancelled) return;
        onPhase("failed");
        onError(err?.message || "VRM 加载失败");
      }
    };

    load().catch(() => {});

    return () => {
      cancelled = true;
      if (loadedAvatar) {
        disposeAvatar(loadedAvatar);
      }
      avatarRef.current = null;
    };
  }, [mode, modelUrl, onError, onNotice, onPhase]);

  if (!avatar) return null;
  return <primitive object={avatar.scene} />;
}

function VRMPreviewCanvas({
  modelUrl,
  mode,
  onPhase,
  onError,
  onNotice,
}: {
  modelUrl: string;
  mode: RenderMode;
  onPhase: (phase: RenderPhase) => void;
  onError: (message: string | null) => void;
  onNotice: (message: string | null) => void;
}) {
  return (
    <View style={styles.canvasShell}>
      <Canvas
        style={styles.canvas}
        camera={{ position: [0, 0.8, 3.2], fov: 28 }}
        onCreated={() => onPhase("canvas-ready")}
      >
        <color attach="background" args={["#111827"]} />
        <ambientLight intensity={1.15} />
        <directionalLight position={[2, 3, 4]} intensity={2.4} />
        <hemisphereLight args={["#ffffff", "#344054", 1.1]} />
        <SpinningProbe />
        <VRMModel
          modelUrl={modelUrl}
          mode={mode}
          onPhase={onPhase}
          onError={onError}
          onNotice={onNotice}
        />
      </Canvas>
    </View>
  );
}

function getBadgeStyle(status: CheckStatus) {
  switch (status) {
    case "pass":
      return styles.badge_pass;
    case "warn":
      return styles.badge_warn;
    case "fail":
      return styles.badge_fail;
  }
}

function buildChecks(
  data: PageConfigResponse | null,
  error: string | null,
): CheckItem[] {
  if (error) {
    return [
      {
        id: "api",
        label: "page_config 可访问",
        detail: error,
        status: "fail",
      },
    ];
  }

  if (!data) {
    return [
      {
        id: "pending",
        label: "等待拉取 page_config",
        detail: "进入页面后会自动请求一次，也可以手动点击刷新。",
        status: "warn",
      },
    ];
  }

  const isLive3D = data.model_type === "live3d";
  const isVrm = isLive3D && data.live3d_sub_type === "vrm";
  const hasModelPath = !!String(data.model_path || "").trim();

  return [
    {
      id: "api",
      label: "page_config 可访问",
      detail: data.success
        ? "服务端已返回 page_config。"
        : data.error || "服务端返回 success=false",
      status: data.success ? "pass" : "fail",
    },
    {
      id: "type",
      label: "当前角色为 VRM 候选",
      detail: isVrm
        ? "当前角色是 live3d/vrm，可进入后续渲染 PoC。"
        : `当前返回 model_type=${data.model_type || "(empty)"}, live3d_sub_type=${data.live3d_sub_type || "(empty)"}`,
      status: isVrm ? "pass" : isLive3D ? "warn" : "fail",
    },
    {
      id: "path",
      label: "模型路径存在",
      detail: hasModelPath
        ? data.model_path
        : "model_path 为空，无法进入模型加载验证。",
      status: hasModelPath ? "pass" : "fail",
    },
    {
      id: "scope",
      label: "当前页面验证范围",
      detail: "R3F/native、VRM 下载解析、主贴图与 MToon 渲染已在真机验证通过。",
      status: "pass",
    },
  ];
}

export default function VRMPocScreen() {
  const { config, isLoaded } = useDevConnectionConfig();
  const apiBase = useMemo(
    () => buildHttpBaseURL({ host: config.host, port: config.port }),
    [config.host, config.port],
  );
  const client = useMemo(
    () => createPageConfigApiClient(apiBase, config.p2p?.token),
    [apiBase, config.p2p?.token],
  );

  const [characterName, setCharacterName] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PageConfigResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modelPathInput, setModelPathInput] = useState("");
  const [renderAttempt, setRenderAttempt] = useState<RenderAttempt | null>(
    null,
  );
  const [renderPhase, setRenderPhase] = useState<RenderPhase>("idle");
  const [renderError, setRenderError] = useState<string | null>(null);
  const [renderNotice, setRenderNotice] = useState<string | null>(null);
  const [renderMode, setRenderMode] = useState<RenderMode>("mtoon");

  useEffect(() => {
    if (!isLoaded) return;
    setCharacterName(config.characterName || "");
  }, [config.characterName, isLoaded]);

  const loadPageConfig = async (targetName?: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await client.getPageConfig(targetName?.trim() || undefined);
      setResult(data);
      if (!data.success) {
        setError(data.error || "服务端返回 success=false");
      }
    } catch (err: any) {
      setResult(null);
      setError(err?.message || "请求 page_config 失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isLoaded) return;
    loadPageConfig(config.characterName).catch(() => {});
  }, [client, config.characterName, isLoaded]);

  useEffect(() => {
    if (!result?.model_path) return;
    const pageConfigPath = result.model_path.trim();
    const nextPath =
      result.model_type === "live3d" &&
      result.live3d_sub_type === "vrm" &&
      isVrmPath(pageConfigPath)
        ? pageConfigPath
        : SAMPLE_VRM_PATH;

    setModelPathInput((prev) => {
      const current = prev.trim();
      if (!current || current === pageConfigPath || !isVrmPath(current)) {
        return nextPath;
      }
      return prev;
    });
  }, [result?.live3d_sub_type, result?.model_path, result?.model_type]);

  const checks = buildChecks(result, error);
  const resolvedModelUrl = useMemo(
    () =>
      resolveModelUrl(
        modelPathInput || result?.model_path || "",
        apiBase,
        config.p2p?.token,
      ),
    [apiBase, config.p2p?.token, modelPathInput, result?.model_path],
  );

  const startRender = useCallback(() => {
    if (!resolvedModelUrl) return;
    setRenderError(null);
    setRenderNotice(null);
    setRenderPhase("idle");
    setRenderAttempt({
      id: Date.now(),
      mode: renderMode,
      url: resolvedModelUrl,
    });
  }, [renderMode, resolvedModelUrl]);

  const stopRender = useCallback(() => {
    setRenderAttempt(null);
    setRenderPhase("idle");
    setRenderError(null);
    setRenderNotice(null);
  }, []);

  const handleRenderPhase = useCallback((phase: RenderPhase) => {
    setRenderPhase(phase);
  }, []);

  const handleRenderError = useCallback((message: string | null) => {
    setRenderError(message);
  }, []);

  const handleRenderNotice = useCallback((message: string | null) => {
    setRenderNotice(message);
  }, []);

  const handleRenderModeChange = useCallback(
    (nextMode: RenderMode) => {
      setRenderMode(nextMode);
      setRenderError(null);
      setRenderNotice(null);
      if (!renderAttempt || !resolvedModelUrl) return;
      setRenderPhase("idle");
      setRenderAttempt({
        id: Date.now(),
        mode: nextMode,
        url: resolvedModelUrl,
      });
    },
    [renderAttempt, resolvedModelUrl],
  );

  const summary = useMemo(() => {
    const passCount = checks.filter((item) => item.status === "pass").length;
    const failCount = checks.filter((item) => item.status === "fail").length;
    return { passCount, failCount, total: checks.length };
  }, [checks]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>VRM R3F PoC</Text>
        <Text style={styles.subtitle}>{POC_PASSED_SUBTITLE}</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>当前连接</Text>
          <Text style={styles.meta}>Base URL: {apiBase}</Text>
          <Text style={styles.meta}>
            P2P: {config.p2p?.token ? "开启" : "关闭"}
          </Text>
          <Text style={styles.meta}>
            默认角色: {config.characterName || "(empty)"}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>目标角色</Text>
          <TextInput
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="输入角色名，留空则按服务端当前角色"
            placeholderTextColor="#7d8590"
            value={characterName}
            onChangeText={setCharacterName}
          />
          <Pressable
            style={({ pressed }) => [
              styles.button,
              pressed && styles.buttonPressed,
            ]}
            onPress={() => {
              loadPageConfig(characterName).catch(() => {});
            }}
          >
            <Text style={styles.buttonText}>
              {loading ? "刷新中..." : "刷新 page_config"}
            </Text>
          </Pressable>
          {loading ? <ActivityIndicator style={styles.loader} /> : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>预检摘要</Text>
          <Text style={styles.summary}>
            通过 {summary.passCount}/{summary.total}，失败 {summary.failCount}{" "}
            项
          </Text>
          {checks.map((item) => (
            <View key={item.id} style={styles.checkRow}>
              <View style={[styles.badge, getBadgeStyle(item.status)]}>
                <Text style={styles.badgeText}>
                  {item.status.toUpperCase()}
                </Text>
              </View>
              <View style={styles.checkBody}>
                <Text style={styles.checkLabel}>{item.label}</Text>
                <Text style={styles.checkDetail}>{item.detail}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>VRM 渲染 PoC</Text>
          <TextInput
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="/static/vrm/sister1.0.vrm 或完整 URL"
            placeholderTextColor="#7d8590"
            value={modelPathInput}
            onChangeText={setModelPathInput}
          />
          <Text selectable style={styles.meta}>
            Resolved URL: {resolvedModelUrl || "-"}
          </Text>
          <View style={styles.modeRow}>
            {renderModes.map((mode) => {
              const active = renderMode === mode.value;
              return (
                <Pressable
                  key={mode.value}
                  style={({ pressed }) => [
                    styles.modeButton,
                    active && styles.modeButtonActive,
                    pressed && styles.buttonPressed,
                  ]}
                  onPress={() => handleRenderModeChange(mode.value)}
                >
                  <Text
                    style={[
                      styles.modeButtonText,
                      active && styles.modeButtonTextActive,
                    ]}
                  >
                    {mode.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.buttonRow}>
            <Pressable
              disabled={!resolvedModelUrl}
              style={({ pressed }) => [
                styles.button,
                !resolvedModelUrl && styles.buttonDisabled,
                pressed && styles.buttonPressed,
              ]}
              onPress={startRender}
            >
              <Text style={styles.buttonText}>加载 VRM</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed && styles.buttonPressed,
              ]}
              onPress={stopRender}
            >
              <Text style={styles.secondaryButtonText}>卸载</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed && styles.buttonPressed,
              ]}
              onPress={() => setModelPathInput(SAMPLE_VRM_PATH)}
            >
              <Text style={styles.secondaryButtonText}>测试 VRM</Text>
            </Pressable>
          </View>
          <Text style={styles.summary}>
            状态: {renderPhaseLabel[renderPhase]}
          </Text>
          {renderNotice ? (
            <Text style={styles.noticeText}>{renderNotice}</Text>
          ) : null}
          {renderError ? (
            <Text style={styles.errorText}>{renderError}</Text>
          ) : null}
          {renderAttempt ? (
            <VRMPreviewCanvas
              key={renderAttempt.id}
              modelUrl={renderAttempt.url}
              mode={renderAttempt.mode}
              onPhase={handleRenderPhase}
              onError={handleRenderError}
              onNotice={handleRenderNotice}
            />
          ) : (
            <View style={styles.canvasPlaceholder}>
              <Text style={styles.placeholderText}>
                点击“加载 VRM”后创建 Canvas。
              </Text>
            </View>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>最近一次 page_config 结果</Text>
          <Text style={styles.code}>
            {result ? JSON.stringify(result, null, 2) : error || "暂无结果"}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>验证结论</Text>
          <Text style={styles.listItem}>
            1. R3F Canvas、VRM 二进制下载与 three-vrm 解析已跑通。
          </Text>
          <Text style={styles.listItem}>
            2. 主贴图与完整 MToon 均可正常显示。
          </Text>
          <Text style={styles.listItem}>
            3. 色块稳定与主贴图模式保留为材质链路诊断开关。
          </Text>
          <Text style={styles.listItem}>
            4. 本页暂不接表情、口型与 VRMA，后续在正式角色渲染层继续接入。
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f3f4f6",
  },
  content: {
    padding: 16,
    gap: 14,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#111827",
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 22,
    color: "#4b5563",
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    gap: 10,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  meta: {
    fontSize: 14,
    color: "#374151",
  },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: "#111827",
  },
  button: {
    backgroundColor: "#0f766e",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
  buttonRow: {
    flexDirection: "row",
    gap: 10,
  },
  modeRow: {
    flexDirection: "row",
    gap: 8,
  },
  modeButton: {
    flex: 1,
    backgroundColor: "#e5e7eb",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#d1d5db",
  },
  modeButtonActive: {
    backgroundColor: "#0f766e",
    borderColor: "#0f766e",
  },
  modeButtonText: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "700",
  },
  modeButtonTextActive: {
    color: "#ffffff",
  },
  secondaryButton: {
    backgroundColor: "#e5e7eb",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "700",
  },
  loader: {
    marginTop: 4,
  },
  summary: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1f2937",
  },
  checkRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  badge: {
    minWidth: 56,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: "center",
  },
  badge_pass: {
    backgroundColor: "#dcfce7",
  },
  badge_warn: {
    backgroundColor: "#fef3c7",
  },
  badge_fail: {
    backgroundColor: "#fee2e2",
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#111827",
  },
  checkBody: {
    flex: 1,
    gap: 4,
  },
  checkLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
  },
  checkDetail: {
    fontSize: 14,
    lineHeight: 21,
    color: "#4b5563",
  },
  code: {
    fontFamily: "Courier",
    fontSize: 12,
    lineHeight: 18,
    color: "#111827",
  },
  errorText: {
    fontSize: 13,
    lineHeight: 20,
    color: "#b91c1c",
  },
  noticeText: {
    fontSize: 13,
    lineHeight: 20,
    color: "#0f766e",
  },
  canvasShell: {
    height: 420,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  canvas: {
    flex: 1,
    width: "100%",
  },
  canvasPlaceholder: {
    height: 220,
    borderRadius: 14,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  placeholderText: {
    color: "#cbd5e1",
    fontSize: 14,
    textAlign: "center",
  },
  listItem: {
    fontSize: 14,
    lineHeight: 22,
    color: "#374151",
  },
});
