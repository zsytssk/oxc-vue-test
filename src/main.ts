import path from "path";
import { getSubDirs } from "./ls/asyncUtil";
import { walk } from "./ls/walk";
import { CodeItem, DiffItem } from "./type";
import { getFileImportsMap } from "./parseUtils";

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

  const list = [] as CodeItem[];
  const diffMap = new Map<string, DiffItem>();
  for (const item of matchDir) {
    if (item !== "device") {
      continue;
    }
    const absPath = path.join(tpmViewDir, item);
    const file_list = await walk(absPath);
    list.push(
      ...file_list.map((item) => ({
        filePath: item,
        name: "",
        type: "file" as const,
      }))
    );
  }

  while (list.length) {
    const item = list.shift();
    if (item?.type === "file") {
      diffMap.set(item.filePath, item);
      const itemMap = await getFileImportsMap(item.sourceFile, tpmPathAlias);
      console.log(item.sourceFile, itemMap);
      return;
    }
  }
}

await main();
