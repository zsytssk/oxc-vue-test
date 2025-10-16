import { parse } from "@babel/parser";
import type { NodePath } from "@babel/traverse";
import traverse from "@babel/traverse";
import type { Identifier } from "@babel/types";
import { CodeItem } from "../src/type";

const code = `
import { util1 as util1_1, util2 } from "./utils";
import { useState } from "react";
import axios from "axios";

export { util1 as util1_1 } from "./utils";

export function MyComponent() {
  const [data, setData] = useState(null);

  const fetchData = async () => {
    const result = await axios.get("/api/data");
    setData(result.data);
  };

  const handleClick = () => {
    console.log("Clicked");
    fetchData();
  };

  return { handleClick };
}

export const a = axios.get;
let b;
export class A {
  constructor() {}
  abc() {
    const test = 1;
    return a;
  }
}
class B {}

type TypeA = {
  a: string;
  b: number;
};

export default a;
// export default function Test() {}
export { B, B as B1 };

`;

const ast = parse(code, {
  sourceType: "module",
  plugins: ["typescript", "jsx"],
});

const defined: CodeItem[] = [];

traverse(ast, {
  ExportDeclaration(path) {
    if (path.isExportAllDeclaration()) {
      // 不管
      return;
    }
    if (path.isExportDefaultDeclaration()) {
      defined.push({
        name: "default",
        type: "local",
        originalName: getNodeName(path.node.declaration),
        filePath: "",
        originType: path.node.type,
        position: [path.node.start!, path.node.end!],
      });
    }
    if (path.isExportNamedDeclaration()) {
      const specifiers = path.node.specifiers || [];

      const exportFIle = path.node.source?.value;
      if (specifiers.length) {
        for (const spec of specifiers) {
          if (spec.type === "ExportSpecifier") {
            const localName = spec.local.name; // 模块内部原名
            const exportedName = (spec.exported as Identifier)!.name; // 导出出去的名字
            defined.push({
              name: exportedName,
              type: exportFIle ? "import" : "local",
              originalName: localName,
              filePath: exportFIle || "",
              originType: path.node.type,
              position: [path.node.start!, path.node.end!],
            });
          }
        }
      } else {
        const decl = path.node.declaration;
        if (!decl) return;
        if (decl.type === "VariableDeclaration") {
          let arr = [] as string[];
          for (const d of decl.declarations) {
            const localName = getNodeName(d);
            defined.push({
              name: localName,
              type: "local",
              originalName: localName,
              filePath: "",
              originType: d.type,
              position: [d.start!, d.end!],
            });
          }
          return arr.length === 1 ? arr[0] : undefined;
        } else if (
          decl.type === "FunctionDeclaration" ||
          decl.type === "ClassDeclaration"
        ) {
          const localName = getNodeName(decl);
          defined.push({
            name: localName,
            type: "local",
            originalName: localName,
            filePath: "",
            originType: decl.type,
            position: [decl.start!, decl.end!],
          });
        }
      }
    }

    // console.log(name);
  },
});

function getNodeName(node: any) {
  // 根据不同类型获取“名字”
  if (!node) return undefined;

  switch (node.type) {
    case "ImportSpecifier":
      return node.local.name;
    case "VariableDeclarator":
      return node.id.name;
    case "FunctionDeclaration":
      return node.id?.name;
    case "Identifier":
      return node.name;
    case "ClassDeclaration":
      return node.id?.name; // ✅ 这里就是 class 名
    case "ClassExpression":
      return node.id?.name; // ✅ 匿名 class 的情况也可兼容
    case "ObjectProperty":
      if (node.key.type === "Identifier") return node.key.name;
      if (node.key.type === "StringLiteral") return node.key.value;
      return undefined;
    case "ClassMethod":
    case "ObjectMethod":
      if (node.key.type === "Identifier") return node.key.name;
      if (node.key.type === "StringLiteral") return node.key.value;
      return undefined;
    default:
      return undefined;
  }
}

Bun.write("./test/test.json", JSON.stringify([...defined], null, 2));
