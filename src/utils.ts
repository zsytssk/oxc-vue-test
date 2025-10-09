import fs from "fs";
import path from "path";
import { exists } from "./ls/asyncUtil";

function hasExtension(filePath: string) {
  return path.extname(filePath) !== "";
}

export function isVueFile(filePath: string) {
  return filePath.endsWith(".vue");
}

export function resolveAliasPath(p: string, aliasMap: Record<string, string>) {
  for (const [alias, target] of Object.entries(aliasMap)) {
    if (p.startsWith(alias + "/") || p === alias) {
      return p.replace(alias, target);
    }
  }
  return p;
}

export async function getRelPath(
  source: string,
  target: string,
  exts = [".ts", ".tsx", ".js", ".jsx"]
) {
  if (path.isAbsolute(target)) {
    if (hasExtension(target)) {
      if (await exists(target)) {
        return target;
      } else {
        return undefined;
      }
    }

    for (const ext of exts) {
      const absPath = target + ext;
      if (await exists(absPath)) {
        return absPath;
      }
    }
  }
  if (hasExtension(target)) {
    const targetPath = path.resolve(path.dirname(source), target);
    if (await exists(targetPath)) {
      return targetPath;
    } else {
      return undefined;
    }
  }

  for (const ext of exts) {
    const absPath = path.resolve(path.dirname(source), target + ext);
    if (await exists(absPath)) {
      return absPath;
    }
  }

  return undefined;
}

export function isOutside(baseDir: string, targetPath: string) {
  const relative = path.relative(baseDir, targetPath);
  return relative.startsWith("..") || path.isAbsolute(relative);
}
export function isInner(baseDir: string, targetPath: string) {
  return !isOutside(baseDir, targetPath);
}
