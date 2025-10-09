import path from "path";
import { getSubDirs } from "./ls/asyncUtil";
import { walk } from "./ls/walk";
import { getFileImportsMap } from "./parseUtils";
import { isInner, isOutside } from "./utils";

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
  const allImportsMap = {} as Record<string, Record<string, [number, number]>>;
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
}

await main();
