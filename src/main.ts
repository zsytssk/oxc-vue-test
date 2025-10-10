import path from "path";
import { getSubDirs } from "./ls/asyncUtil";
import { walk } from "./ls/walk";
import { applyChange, checkFileDiff, getFileImportsMap } from "./parseUtils";
import { isInner, isOutside } from "./utils";
import { CodeItemInfo } from "./type";

const tpmPath = {
  pluginPath: "/home/zsy/Documents/zsy/job/tpm/web/src/plugin/tpm/",
  view: "view",
};
const emsPath = {
  pluginPath: "/home/zsy/Documents/zsy/job/ems-background/web/src/plugin/ems",
  view: "view",
};

const tpmPathAlias = {
  "@": "/home/zsy/Documents/zsy/job/tpm/web/src",
  "@tpm": "/home/zsy/Documents/zsy/job/tpm/web/src/plugin/tpm",
};

async function main() {
  const tpmViewDir = path.resolve(tpmPath.pluginPath, tpmPath.view);
  const tpmViews = await getSubDirs(tpmViewDir);
  const emsViewPath = path.resolve(emsPath.pluginPath, emsPath.view);
  const emsViews = await getSubDirs(emsViewPath);

  const matchDir = tpmViews.filter((tpmView) => emsViews.includes(tpmView));
  const allImportsMap = {} as Record<string, Record<string, CodeItemInfo>>;
  for (const item of matchDir) {
    if (item !== "device") {
      continue;
    }
    const absPath = path.join(tpmViewDir, item);
    const file_list = await walk(absPath);
    for (const file of file_list) {
      const itemMap = await getFileImportsMap(file, tpmPathAlias);
      for (const [key, value] of Object.entries(itemMap)) {
        if (!allImportsMap[key]) {
          allImportsMap[key] = value;
        } else {
          allImportsMap[key] = {
            ...allImportsMap[key],
            ...value,
          };
        }
      }
    }
  }

  for (const path in allImportsMap) {
    if (isOutside(tpmPath.pluginPath, path)) {
      delete allImportsMap[path];
    } else if (isInner(tpmViewDir, path)) {
      delete allImportsMap[path];
    }
  }

  console.log(allImportsMap);

  // 对比文件, 看要更新的内容
  for (const filePath in allImportsMap) {
    const relPath = path.relative(tpmPath.pluginPath, filePath);
    const targetPath = path.resolve(emsPath.pluginPath, relPath);
    const diffsInfo = await checkFileDiff(targetPath, allImportsMap[filePath]);
    if (Object.keys(diffsInfo.diffsMap).length || diffsInfo.copyFile) {
      await applyChange(filePath, targetPath, diffsInfo);
    }
  }

  // console.log(allImportsMap);
}

async function checkFileDeps(filePath: string) {
  const tpmViewDir = path.resolve(tpmPath.pluginPath, tpmPath.view);

  const itemMap = await getFileImportsMap(filePath, tpmPathAlias);
  for (const path in itemMap) {
    if (isOutside(tpmPath.pluginPath, path)) {
      delete itemMap[path];
    } else if (isInner(tpmViewDir, path)) {
      delete itemMap[path];
    }
  }

  // 对比文件, 看要更新的内容
  for (const filePath in itemMap) {
    const relPath = path.relative(tpmPath.pluginPath, filePath);
    const targetPath = path.resolve(emsPath.pluginPath, relPath);
    const diffsInfo = await checkFileDiff(targetPath, itemMap[filePath]);
    if (Object.keys(diffsInfo.diffsMap).length || diffsInfo.copyFile) {
      await applyChange(filePath, targetPath, diffsInfo);
    }
  }
}

await main();
