import fs from "fs";
import path from "path";

function hasExtension(filePath: string) {
  return path.extname(filePath) !== "";
}

export function isVueFile(filePath: string) {
  return filePath.endsWith(".vue");
}

export function getRelPath(
  source: string,
  target: string,
  exts = [".ts", ".tsx", ".js", ".jsx"]
) {
  if (hasExtension(target)) {
    const targetPath = path.resolve(path.dirname(source), target);
    if (fs.existsSync(targetPath)) {
      return targetPath;
    } else {
      return undefined;
    }
  }

  for (const ext of exts) {
    const absPath = path.resolve(path.dirname(source), target + ext);
    if (fs.existsSync(absPath)) {
      return absPath;
    }
  }

  return undefined;
}

export function readFile(filePath: string) {
  return fs.readFileSync(filePath, "utf-8");
}
