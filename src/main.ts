import path from "path";
import { getSubDirs } from "./ls/asyncUtil";
import { walk } from "./ls/walk";
import { DiffItem } from "./type";

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

  const diffList = [] as DiffItem[];
  const diffMap = new Map<string, DiffItem>();
  for (const item of matchDir) {
    if (item !== "device") {
      continue;
    }
    const absPath = path.join(tpmViewDir, item);
    const file_list = await walk(absPath);
    diffList.push(
      ...file_list.map((item) => ({
        sourceFile: item,
        diffType: "file" as const,
      }))
    );
  }

  while (diffList.length) {}
}

await main();
