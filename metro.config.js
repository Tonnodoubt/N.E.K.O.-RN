const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);
const defaultCustomizeFrame = config.symbolicator?.customizeFrame;

config.symbolicator = {
  ...(config.symbolicator || {}),
  customizeFrame: async (frame) => {
    if (frame.file && /(?:^|\/)InternalBytecode\.js$/.test(frame.file)) {
      return {
        ...frame,
        lineNumber: null,
        column: null,
        collapse: true,
      };
    }

    return defaultCustomizeFrame ? defaultCustomizeFrame(frame) : frame;
  },
};

// 添加其他可能需要的文件扩展名，但不包括 .js 以避免与 HMR 冲突
config.resolver.assetExts.push('moc3', 'motion3', 'exp3', 'physics3', 'pose3', 'cdi3', 'txt', 'html', 'pcm', 'wav', 'vrm', 'vrma', 'glb', 'gltf', 'bin');

// 确保 .js 文件不在 assetExts 中，以免干扰 HMR
config.resolver.assetExts = config.resolver.assetExts.filter(ext => ext !== 'js');

// 配置源文件扩展名优先级
// 保持默认配置，Metro 会根据平台自动选择正确的扩展名
// 默认顺序：平台特定 (.native.*, .ios.*, .android.*, .web.*) > 通用 (.tsx, .ts, .jsx, .js)
const defaultSourceExts = config.resolver.sourceExts || ['js', 'jsx', 'json', 'ts', 'tsx'];
config.resolver.sourceExts = [...defaultSourceExts];

// 解决 Web 平台上 React Native 内部模块导入问题
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // 在 Web 平台上，跳过或重定向 React Native 的内部模块
  if (platform === 'web') {
    // 将 react-native 导入重定向到我们的扩展包装器（包含 TurboModuleRegistry）
    if (moduleName === 'react-native') {
      return {
        type: 'sourceFile',
        filePath: path.resolve(__dirname, 'react-native-web-extended.js'),
      };
    }
    
    // 不要 shim react-native-web 的任何模块
    if (moduleName.includes('react-native-web')) {
      return context.resolveRequest(context, moduleName, platform);
    }
    
    // 不要 shim 相对路径导入 - 让 react-native-web 内部的相对导入正常工作
    if (moduleName.startsWith('./') || moduleName.startsWith('../')) {
      return context.resolveRequest(context, moduleName, platform);
    }
    
    // 处理 React Native 内部模块 - 只匹配绝对路径导入
    if (
      moduleName.startsWith('react-native/Libraries') ||
      moduleName.startsWith('react-native/src/private') ||
      moduleName.startsWith('react-native/src/') ||
      moduleName.includes('ReactDevToolsSettingsManager') ||
      moduleName.includes('setUpReactDevTools') ||
      moduleName.startsWith('@expo/metro-runtime/src/location/install.native') ||
      moduleName.includes('NativeReactNativeFeatureFlags')
    ) {
      console.log('🔄 [Metro] Shimming module for web:', moduleName);
      // 返回一个空的 shim 模块
      return {
        type: 'sourceFile',
        filePath: path.resolve(__dirname, 'metro-web-shims.js'),
      };
    }
  }
  
  // 使用默认的解析逻辑
  return context.resolveRequest(context, moduleName, platform);
};

// 支持 monorepo 结构
const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '.');

config.watchFolders = [workspaceRoot];
config.resolver.platforms = ['native', 'android', 'ios', 'web'];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// 关键：在 workspace 依赖未被正确链接/或尚未 build 时，仍能让 Metro 解析到本地 packages
// 这样 `import 'react-native-live2d'` 会直接指向 `packages/react-native-live2d`（同理 pcm-stream）
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  'react-native-live2d': path.resolve(projectRoot, 'packages/react-native-live2d'),
  'react-native-pcm-stream': path.resolve(projectRoot, 'packages/react-native-pcm-stream'),
  '@project_neko/common': path.resolve(projectRoot, 'packages/project-neko-common'),
  '@project_neko/request': path.resolve(projectRoot, 'packages/project-neko-request'),
  '@project_neko/components': path.resolve(projectRoot, 'packages/project-neko-components'),
  '@project_neko/audio-service': path.resolve(projectRoot, 'packages/project-neko-audio-service'),
  '@project_neko/live2d-service': path.resolve(projectRoot, 'packages/project-neko-live2d-service'),
  '@project_neko/realtime': path.resolve(projectRoot, 'packages/project-neko-realtime'),
};

module.exports = config;
