import { Directory, File, Paths } from 'expo-file-system';

function resolveUrl(baseUrl: string, relativePath: string): string {
  try {
    const resolved = new URL(relativePath, baseUrl);
    // 保留 base URL 的 query 参数（如 P2P token），new URL() 会丢弃它们
    const base = new URL(baseUrl);
    base.searchParams.forEach((v, k) => {
      if (!resolved.searchParams.has(k)) resolved.searchParams.set(k, v);
    });
    return resolved.toString();
  } catch {
    if (baseUrl.endsWith('/')) return baseUrl + relativePath;
    return baseUrl + '/' + relativePath;
  }
}

async function ensureDirAsync(dir: string): Promise<void> {
  try {
    const destination = new Directory(dir);
    if (!destination.exists) {
      destination.create();
    }
  } catch (error) {
    console.log('ensureDirAsync error: ', error)
  }
}

async function downloadFileTo(dstPath: string, srcUrl: string): Promise<void> {
  console.log(`loadModelFile ${srcUrl} => ${dstPath}`)
  const dstDir = dstPath.substring(0, dstPath.lastIndexOf('/') + 1);
  await ensureDirAsync(dstDir);
  try {
    // 提取文件名（处理包含子目录的相对路径，如 Nahida_1080.1024/texture_00.png）
    const lastSlashIndex = dstPath.lastIndexOf('/');
    const fileName = dstPath.substring(lastSlashIndex + 1);
    const expectedUri = `${dstDir}${fileName}`;

    // 如果目标文件已存在，跳过下载
    const existingFile = new File(expectedUri);
    if (existingFile.exists) {
      console.log(`skip (exists): ${expectedUri}`);
      return;
    }

    // downloadFileAsync 用 URL 末尾的文件名作为目标，先清理可能残留的同名文件
    const urlFileName = srcUrl.split('?')[0].split('/').pop() ?? fileName;
    const downloadTarget = new File(`${dstDir}${urlFileName}`);
    if (downloadTarget.exists) {
      await downloadTarget.delete();
    }

    const dstFolder = new Directory(dstDir);
    // downloadFileAsync 返回 File 对象，有 .uri 属性
    const downloaded = await File.downloadFileAsync(srcUrl, dstFolder);
    const downloadedUri = downloaded.uri;

    // 如果下载的文件名与目标文件名不同（URL encoded vs decoded），需要重命名
    const normalizedDownloaded = (() => { try { return decodeURIComponent(downloadedUri); } catch { return downloadedUri; } })();
    const normalizedExpected = (() => { try { return decodeURIComponent(expectedUri); } catch { return expectedUri; } })();

    if (normalizedDownloaded !== normalizedExpected) {
      const downloadedFile = new File(downloadedUri);
      const targetFile = new File(expectedUri);
      if (targetFile.exists) {
        targetFile.delete();
      }
      downloadedFile.move(targetFile);
      console.log(`moved file: ${downloadedUri} => ${expectedUri}`);
    } else {
      console.log(`loaded file: ${downloadedUri}`);
    }
  } catch (error) {
    console.error(`❌ downloadFileTo failed: ${dstPath}`, error)
  }
}

export async function removeDownloadedModel(targetDirName: string): Promise<void> {
  const destination = new Directory(Paths.cache, targetDirName);
  console.log('removeDownloadedModel: ', destination.uri);

  if (await destination.exists) {
    console.log('removeDownloadedModel destination.uri: ', destination.uri);

    try {
      // 确保先清空目录
      const files = await destination.list();
      for (const file of files) {
        await file.delete();
      }

      await destination.delete(); // 注意加 await
      console.log("Deleted successfully:", destination.uri);
    } catch (err) {
      console.error("Failed to delete:", destination.uri, err);
    }
  }
}

/**
 * 已经把 model3.json 下载到本地后，继续解析并下载所有依赖到同一目录结构。
 * @param localModelJsonUri 例如: file:///data/user/0/<pkg>/cache/live2d/mao_pro/mao_pro.model3.json
 * @param remoteBaseUrl 远端基地址，例如: https://example.com/live2d/mao_pro/
 * @returns 返回原始的 localModelJsonUri
 */
export async function downloadDependenciesFromLocalModel(
  localModelJsonUri: string,
  remoteBaseUrl: string
): Promise<string> {
  // 读取本地 model3.json
  const file = new File(localModelJsonUri);

  const modelJsonStr = file.textSync()
  const model = JSON.parse(modelJsonStr);

  console.log('downloadDependenciesFromLocalModel model: ', model)

  // 计算本地根目录（保持与 model3.json 同一根目录）
  // e.g. file:///.../live2d/mao_pro/mao_pro.model3.json -> file:///.../live2d/mao_pro/
  const lastSlash = localModelJsonUri.lastIndexOf('/') + 1;
  const targetRoot = localModelJsonUri.substring(0, lastSlash);

  const files: string[] = [];
  if (model.FileReferences) {
    const refs = model.FileReferences;
    if (refs.Moc) files.push(refs.Moc);
    if (refs.Textures) files.push(...refs.Textures);
    if (refs.Physics) files.push(refs.Physics);
    if (refs.Pose) files.push(refs.Pose);
    if (refs.DisplayInfo) files.push(refs.DisplayInfo);
    if (refs.Expressions) files.push(...refs.Expressions.map((e: any) => e.File));
    if (refs.Motions) {
      Object.values(refs.Motions).forEach((arr: unknown) => {
        (arr as any[]).forEach((m) => {
          if (m && m.File) files.push(m.File);
        });
      });
    }
  }

  const uniqueFiles = Array.from(new Set(files.filter(Boolean)));
  console.log('📦 需要下载的依赖文件:', uniqueFiles);

  // 串行下载，避免并发时同名文件冲突
  for (const relPath of uniqueFiles) {
    const src = resolveUrl(remoteBaseUrl, relPath);
    const dst = `${targetRoot}${relPath}`;
    await downloadFileTo(dst, src);
  }

  return localModelJsonUri;
}


