import { parse } from "@babel/parser";
import traverse, { NodePath } from "@babel/traverse";

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
let b;
export class A {constructor() {} abc() {
  const test = 1;
  return a;
}}
class B {}
`;

const ast = parse(code, {
  sourceType: "module",
  plugins: ["typescript", "jsx"],
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

traverse(ast, {
  enter(path) {
    const name = getNodeName(path.node);
    if (path.parentPath?.isDeclaration() && name) {
      const parentName = getNodeName(path.parentPath!.node);
      if (parentName === name) {
        return;
      }
      const parentPath = getCompletePath(path);
      const str = code.slice(parentPath.node.start!, parentPath.node.end!);
      console.log(name, getPathTree(path));
    }
  },
});

function getPathTree(path: NodePath<any>): string[] {
  let currentPath = path;
  const pathArr = [];
  while (currentPath) {
    const curName = getNodeName(currentPath.node);
    if (curName) {
      pathArr.push(getNodeName(currentPath.node));
    }
    currentPath = currentPath.parentPath!;
  }

  return pathArr.reverse();
}

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
