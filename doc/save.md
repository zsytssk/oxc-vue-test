version1 - 19 个文件修改

## 2025-10-16 14:23:13

- @todo
  - 1. 分析 view 下的文件夹，有相同的就移动整个文件
  - 2. 分析 [1] 中文件的依赖
    - 2-1 如果在 view 中不管
    - 2-2. 如果超出 src/plugin 就不管
    - 2-3. 将所有依赖按照文件列举 -> 文件:>变量列表(name+位置)
    - 2-4. 对比 3 中的文件，
      - 如果目标文件不存在，就是文件依赖 -> 重复到 2
      - 如果目标文件存在，某些变量不存在
        - 分析变量的依赖 -> 重复到 2-1
  - 3. 将所有的不同按照文件进行列举
    - 如果是文件修改 -> 直接复制文件
    - 如果是代码块修改 -> 直接复制代码块
  - 4. 检查修改文件 是否有问题
  - 5. 问问 lyk 修改的对不对

任务的关键是 拆分+组合

## 2025-10-09 10:26:43

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

- 最顶级的变量

```ts
import { parse } from "@babel/parser";
import traverse, { NodePath } from "@babel/traverse";
import { CodeItem } from "../src/type";

const code = `
import { util1 as util1_1, util2 } from './utils'
import { useState } from 'react';
import axios from 'axios';

export function MyComponent() {
  const [data, setData] = useState(null);

  const fetchData = async () => {
    const result = await axios.get('/api/data');
    setData(result.data);
  };

  const handleClick = () => {
    console.log('Clicked');
    fetchData();
  };

  return { handleClick };
}

export const a = axios.get;
export class A {constructor() {} abc() {return a;}}
class B {}
`;

const ast = parse(code, {
  sourceType: "module",
  plugins: ["typescript", "jsx"],
});

const defined = new Set<CodeItem>();

traverse(ast, {
  Program(path) {
    const bindings = path.scope.bindings;
    for (const name in bindings) {
      const item = bindings[name];
      const itemPath = item.path;
      const parentPath = getCompletePath(item.path);
      if (
        itemPath.isImportSpecifier() ||
        itemPath.isImportDefaultSpecifier() ||
        itemPath.isImportNamespaceSpecifier()
      ) {
        const node = itemPath.node;
        const modulePath = parentPath.node.source.value;
        const originalName = (node as any)?.imported?.name;
        defined.add({
          type: "import",
          originType: itemPath.type,
          name: name,
          originalName: originalName,
          position: [node.start!, node.end!],
          code: code.slice(node.start!, node.end!),
          filePath: modulePath,
        });
      } else {
        const parentNode = parentPath.node;
        defined.add({
          type: "local",
          originType: itemPath.type,
          name: name,
          position: [parentNode.start!, parentNode.end!],
          code: code.slice(parentNode.start!, parentNode.end!),
          filePath: "",
        });
      }
    }
  },
});

function getCompletePath(path: NodePath<any>) {
  if (
    path.parentPath?.isExportNamedDeclaration() ||
    path.parentPath?.isVariableDeclaration() ||
    path.parentPath?.isImportDeclaration()
  ) {
    return getCompletePath(path.parentPath);
  }
  return path;
}

console.log(defined);
```

## save

@vue/compiler-sfc
@babel/parser
