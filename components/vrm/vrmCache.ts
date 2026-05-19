import { Directory, File, Paths } from "expo-file-system";

export const NEKO_CACHED_TEXTURE_URI = "nekoCachedTextureUri";

const textureCacheDirectory = new Directory(Paths.cache, "neko-vrm-textures");
let textureCacheCounter = 0;

type WritableExpoFile = File & {
  create(options?: { intermediates?: boolean; overwrite?: boolean }): void | Promise<void>;
  write(content: Uint8Array): void | Promise<void>;
};

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

export async function writeTextureToCache(bytes: Uint8Array, mimeType?: string): Promise<string> {
  textureCacheDirectory.create({ idempotent: true, intermediates: true });
  const file = new File(
    textureCacheDirectory,
    `texture-${Date.now()}-${textureCacheCounter++}.${getTextureExtension(mimeType)}`,
  ) as WritableExpoFile;
  await file.create({ intermediates: true, overwrite: true });
  await file.write(bytes);
  return file.uri;
}

export function deleteCachedTextureUri(uri?: string | null): void {
  if (!uri?.startsWith(textureCacheDirectory.uri)) return;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {}
}

export function cleanupVrmTextureCache(maxFiles = 180, maxBytes = 120 * 1024 * 1024): void {
  try {
    if (!textureCacheDirectory.exists) return;

    const files = textureCacheDirectory
      .list()
      .filter((entry): entry is File => entry instanceof File)
      .map((file) => {
        const fileMeta = file as File & {
          modificationTime?: number | null;
          creationTime?: number | null;
        };
        return {
          file,
          size: file.size || 0,
          mtime: fileMeta.modificationTime || fileMeta.creationTime || 0,
        };
      })
      .sort((a, b) => b.mtime - a.mtime);

    let totalBytes = files.reduce((sum, item) => sum + item.size, 0);
    files.forEach((item, index) => {
      if (index < maxFiles && totalBytes <= maxBytes) return;
      try {
        if (item.file.exists) item.file.delete();
        totalBytes -= item.size;
      } catch {}
    });
  } catch {}
}
