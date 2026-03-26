/**
 * expo-file-system compat typings (Directory/File/Paths)
 *
 * 说明：
 * - 当前工程代码在多处使用 `expo-file-system` 中的 `Directory` / `File` / `Paths`（含 `.exists/.uri/.create/.list` 等成员）。
 * - 这些成员在运行时可用，但在 TS 类型定义中可能缺失，导致类型检查报错。
 * - 这里用 module augmentation 补齐最小成员集合，避免影响运行逻辑。
 */
declare module "expo-file-system" {
  export const Paths: {
    cache: string | Directory;
  };

  export class Directory {
    constructor(pathOrParent: string | Directory | File, childName?: string);
    name: string;
    uri: string;
    /**
     * 运行时兼容：不同实现可能是 boolean / Promise<boolean>。
     * 这里用 any 避免在业务代码里引入大量类型分支。
     */
    exists: any;
    create(options?: unknown): void;
    list(): Array<Directory | File>;
    delete(): void | Promise<void>;
    move(target: Directory | File): void;
  }

  export class File {
    constructor(pathOrParent: string | Directory | File, childName?: string);
    name: string;
    size: number | null;
    uri: string;
    exists: any;
    textSync(): string;
    delete(): void | Promise<void>;
    move(targetFile: File | Directory): void;
    moveAsync(targetFile: File): Promise<void>;

    static downloadFileAsync(srcUrl: string, dstDir: Directory | File): Promise<File | { uri: string }>;
  }
}
