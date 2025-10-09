## 2025-10-09 10:26:43

@vue/compiler-sfc
@babel/parser

- 匹配要覆盖的文件夹

```ts
import { getImports, getSourceNamesPositions } from "./parseUtils";
import { getRelPath, getSubDirs } from "./utils";

const tpmPath = "/home/zsy/Documents/zsy/job/tpm/web/src/plugin/tpm/view/";
const emsPath =
  "/home/zsy/Documents/zsy/job/ems-background/web/src/plugin/ems/view";

async function main() {
  const tpmViews = getSubDirs(tpmPath);
  const emsViews = getSubDirs(emsPath);

  const matchDir = tpmViews.filter((tpmView) => emsViews.includes(tpmView));
  console.log(matchDir.length, tpmViews.length, emsViews.length);
}

await main();
```
