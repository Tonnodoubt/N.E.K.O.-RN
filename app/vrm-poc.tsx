import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  isVrmPath,
  NEKO_DEFAULT_VRM_MOTION_CALIBRATION,
  VRMAvatarView,
  type VRMEmotion,
  type VRMGesture,
  type VRMMotionCalibration,
  type VRMMotionDebugTelemetry,
  type VRMRenderMode,
  type VRMRenderPhase,
} from "@/components/vrm/VRMAvatarView";
import { useDevConnectionConfig } from "@/hooks/useDevConnectionConfig";
import { useVrmMotionCalibration } from "@/hooks/useVrmMotionCalibration";
import {
  createPageConfigApiClient,
  type PageConfigResponse,
} from "@/services/api/pageConfig";
import { buildHttpBaseURL } from "@/utils/devConnectionConfig";

type CheckStatus = "pass" | "warn" | "fail";

type CheckItem = {
  id: string;
  label: string;
  detail: string;
  status: CheckStatus;
};

type RenderAttempt = {
  id: number;
  url: string;
  mode: VRMRenderMode;
};

const renderPhaseLabel: Record<VRMRenderPhase, string> = {
  idle: "未开始",
  "canvas-ready": "Canvas 已创建",
  fetching: "正在下载 VRM",
  parsing: "正在解析 VRM",
  loaded: "VRM 已渲染",
  "fallback-loaded": "普通 glTF 降级已渲染",
  failed: "失败",
};

const renderModes: { label: string; value: VRMRenderMode }[] = [
  { label: "色块稳定", value: "compat" },
  { label: "主贴图", value: "texture" },
  { label: "MToon", value: "mtoon" },
];
const debugEmotions: VRMEmotion[] = [
  "neutral",
  "attentive",
  "thinking",
  "happy",
  "surprised",
  "sad",
  "angry",
];
const debugGestures: VRMGesture[] = ["nod", "recoil", "bounce", "tilt", "shake"];
const calibrationRows: { key: keyof VRMMotionCalibration; label: string }[] = [
  { key: "gaze", label: "Gaze" },
  { key: "body", label: "Body" },
  { key: "arms", label: "Arms" },
  { key: "speech", label: "Speech" },
  { key: "gesture", label: "Gesture" },
  { key: "idle", label: "Idle" },
];
const defaultDebugCalibration: Required<VRMMotionCalibration> = NEKO_DEFAULT_VRM_MOTION_CALIBRATION;

const SAMPLE_VRM_PATH = "/static/vrm/sister1.0.vrm";
const POC_PASSED_SUBTITLE =
  "VRM 下载解析、主贴图与 MToon 渲染已在真机跑通；本页保留三种模式用于后续诊断。";

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
  const [renderPhase, setRenderPhase] = useState<VRMRenderPhase>("idle");
  const [renderError, setRenderError] = useState<string | null>(null);
  const [renderNotice, setRenderNotice] = useState<string | null>(null);
  const [renderMode, setRenderMode] = useState<VRMRenderMode>("mtoon");
  const [debugEmotion, setDebugEmotion] = useState<VRMEmotion>("neutral");
  const [debugGesture, setDebugGesture] = useState<VRMGesture>("none");
  const [debugGestureRevision, setDebugGestureRevision] = useState(0);
  const [debugCalibration, setDebugCalibration] = useState<Required<VRMMotionCalibration>>(
    defaultDebugCalibration,
  );
  const debugCalibrationRef = useRef<Required<VRMMotionCalibration>>(defaultDebugCalibration);
  const [debugTelemetry, setDebugTelemetry] = useState<VRMMotionDebugTelemetry | null>(null);
  const {
    calibration: savedDebugCalibration,
    isLoaded: isMotionCalibrationLoaded,
    saveCalibration,
    resetCalibration: resetSavedCalibration,
  } = useVrmMotionCalibration(result?.model_path || modelPathInput);

  useEffect(() => {
    if (!isLoaded) return;
    setCharacterName(config.characterName || "");
  }, [config.characterName, isLoaded]);

  useEffect(() => {
    if (!isMotionCalibrationLoaded) return;
    debugCalibrationRef.current = savedDebugCalibration;
    setDebugCalibration(savedDebugCalibration);
  }, [isMotionCalibrationLoaded, savedDebugCalibration]);

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

  const handleRenderPhase = useCallback((phase: VRMRenderPhase) => {
    setRenderPhase(phase);
  }, []);

  const handleRenderError = useCallback((message: string | null) => {
    setRenderError(message);
  }, []);

  const handleRenderNotice = useCallback((message: string | null) => {
    setRenderNotice(message);
  }, []);

  const triggerDebugGesture = useCallback((gesture: VRMGesture) => {
    setDebugGesture(gesture);
    setDebugGestureRevision((revision) => revision + 1);
  }, []);

  const persistDebugCalibration = useCallback(
    (next: Required<VRMMotionCalibration>) => {
      debugCalibrationRef.current = next;
      setDebugCalibration(next);
      saveCalibration(next).catch(() => {});
    },
    [saveCalibration],
  );

  const adjustCalibration = useCallback((key: keyof VRMMotionCalibration, delta: number) => {
    const current = debugCalibrationRef.current;
    const next = { ...current };
    next[key] = Math.max(0, Math.min(2, Number(((current[key] ?? 1) + delta).toFixed(2))));
    persistDebugCalibration(next);
  }, [persistDebugCalibration]);

  const resetCalibration = useCallback(() => {
    persistDebugCalibration({ ...defaultDebugCalibration });
    resetSavedCalibration().catch(() => {});
    setDebugEmotion("neutral");
    setDebugGesture("none");
    setDebugGestureRevision((revision) => revision + 1);
  }, [persistDebugCalibration, resetSavedCalibration]);

  const handleRenderModeChange = useCallback(
    (nextMode: VRMRenderMode) => {
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
          <View style={styles.debugBox}>
            <View style={styles.debugHeaderRow}>
              <Text style={styles.debugTitle}>Motion Debug</Text>
              <Pressable
                style={({ pressed }) => [
                  styles.debugResetButton,
                  pressed && styles.buttonPressed,
                ]}
                onPress={resetCalibration}
              >
                <Text style={styles.debugResetText}>重置</Text>
              </Pressable>
            </View>
            <Text style={styles.debugHint}>
              {isMotionCalibrationLoaded ? "本地校准已启用，调整会自动保存。" : "正在加载本地校准..."}
            </Text>
            <View style={styles.chipRow}>
              {debugEmotions.map((emotion) => {
                const active = debugEmotion === emotion;
                return (
                  <Pressable
                    key={emotion}
                    style={({ pressed }) => [
                      styles.debugChip,
                      active && styles.debugChipActive,
                      pressed && styles.buttonPressed,
                    ]}
                    onPress={() => setDebugEmotion(emotion)}
                  >
                    <Text
                      style={[
                        styles.debugChipText,
                        active && styles.debugChipTextActive,
                      ]}
                    >
                      {emotion}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.chipRow}>
              {debugGestures.map((gesture) => (
                <Pressable
                  key={gesture}
                  style={({ pressed }) => [
                    styles.debugChip,
                    pressed && styles.buttonPressed,
                  ]}
                  onPress={() => triggerDebugGesture(gesture)}
                >
                  <Text style={styles.debugChipText}>{gesture}</Text>
                </Pressable>
              ))}
            </View>
            {calibrationRows.map((row) => (
              <View key={row.key} style={styles.calibrationRow}>
                <Text style={styles.calibrationLabel}>{row.label}</Text>
                <Pressable
                  style={({ pressed }) => [
                    styles.calibrationButton,
                    pressed && styles.buttonPressed,
                  ]}
                  onPress={() => adjustCalibration(row.key, -0.1)}
                >
                  <Text style={styles.calibrationButtonText}>-</Text>
                </Pressable>
                <Text style={styles.calibrationValue}>
                  {(debugCalibration[row.key] ?? 1).toFixed(1)}
                </Text>
                <Pressable
                  style={({ pressed }) => [
                    styles.calibrationButton,
                    pressed && styles.buttonPressed,
                  ]}
                  onPress={() => adjustCalibration(row.key, 0.1)}
                >
                  <Text style={styles.calibrationButtonText}>+</Text>
                </Pressable>
              </View>
            ))}
            <Text style={styles.debugTelemetry}>
              mode {debugTelemetry?.mode || "-"} | mouth{" "}
              {debugTelemetry ? debugTelemetry.mouthValue.toFixed(2) : "-"} | speech{" "}
              {debugTelemetry ? debugTelemetry.speechEnergy.toFixed(2) : "-"} | gesture{" "}
              {debugTelemetry?.activeGesture || "-"}
            </Text>
          </View>
          {renderAttempt ? (
            <VRMAvatarView
              key={renderAttempt.id}
              modelUrl={renderAttempt.url}
              renderMode={renderAttempt.mode}
              showProbe
              autoRotate
              idleAnimation
              lipSync
              relaxedPose
              emotion={debugEmotion}
              gesture={debugGesture}
              gestureRevision={debugGestureRevision}
              motionCalibration={debugCalibration}
              debugTelemetry
              onPhase={handleRenderPhase}
              onError={handleRenderError}
              onNotice={handleRenderNotice}
              onDebugTelemetry={setDebugTelemetry}
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
            4. 本页可调表情、动作与口型；正式主界面会读取角色配置中的动画文件。
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
  debugBox: {
    borderWidth: 1,
    borderColor: "#dbe4ee",
    backgroundColor: "#f8fafc",
    borderRadius: 14,
    padding: 12,
    gap: 10,
  },
  debugHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  debugTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#111827",
  },
  debugResetButton: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#e5e7eb",
  },
  debugResetText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#111827",
  },
  debugHint: {
    fontSize: 12,
    lineHeight: 17,
    color: "#64748b",
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  debugChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#ffffff",
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  debugChipActive: {
    backgroundColor: "#0f766e",
    borderColor: "#0f766e",
  },
  debugChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#111827",
  },
  debugChipTextActive: {
    color: "#ffffff",
  },
  calibrationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  calibrationLabel: {
    width: 72,
    fontSize: 13,
    fontWeight: "700",
    color: "#374151",
  },
  calibrationButton: {
    width: 32,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#e5e7eb",
  },
  calibrationButtonText: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
  },
  calibrationValue: {
    width: 36,
    textAlign: "center",
    fontSize: 13,
    fontWeight: "700",
    color: "#111827",
  },
  debugTelemetry: {
    fontSize: 12,
    lineHeight: 18,
    color: "#475569",
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
