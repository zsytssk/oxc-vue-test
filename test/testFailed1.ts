import { parse } from "@babel/parser";
import traverse, { Node, NodePath } from "@babel/traverse";

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
let b = function () {
  console.log('Clicked');
  fetchData();
};
export class A {constructor() {} abc() {return a;}}
class B {}
const c = { a, b , d: () => {return a;}}
`;

const ast = parse(code, {
  sourceType: "module",
  plugins: ["typescript", "jsx"],
});

const list = [] as { pathTree: string[]; path: NodePath<any> }[];
const listNode = new Set<Node>();
const map = new Map<string, Node>();

traverse(ast, {
  Program(path) {
    const bindings = path.scope.bindings;
    for (const name in bindings) {
      const binding = bindings[name];
      const path = ["Program", name];
      const node = binding.path.node;
      if (listNode.has(node)) {
        continue;
      }
      listNode.add(binding.path.node);
      list.push({
        pathTree: path,
        path: binding.path,
      });
      map.set(path.join("."), node);
    }
  },
});

while (list.length) {
  const { pathTree, path } = list.shift()!;
  const localBindings = path.scope.bindings;
  // if (
  //   path.isFunctionDeclaration() ||
  //   path.isFunctionExpression() ||
  //   path.isArrowFunctionExpression()
  // ) {
  //   list.push({
  //     pathTree: [...pathTree, "body"],
  //     path: path.get("body") as NodePath<Node>,
  //   });
  // }

  if (path.node?.init?.body) {
    const body = path.get("init.body") as NodePath<Node> | undefined;
    if (body) {
      list.push({
        pathTree: [...pathTree],
        path: body,
      });
    }
  }
  if (path.node?.init?.properties) {
    const properties = path.get("init.properties") as
      | NodePath<Node>[]
      | undefined;
    properties?.forEach((propPath) => {
      const value = propPath.get("value");
      if (value.isArrowFunctionExpression()) {
        // 获取箭头函数体内部 bindings
        const bodyBindings = value.get("body").scope.bindings;
        console.log("箭头函数内部绑定:", Object.keys(bodyBindings));
      }
    });
  }

  if (pathTree.join(".") === "Program.c") {
    console.log(pathTree.join("."), path.node?.init);
  }

  for (const name in localBindings) {
    const binding = localBindings[name];
    const path = [...pathTree, name];
    const node = binding.path.node;
    if (listNode.has(node)) {
      continue;
    }
    listNode.add(binding.path.node);
    list.push({
      pathTree: path,
      path: binding.path,
    });
    map.set(path.join("."), node);
  }
}

// console.log(map.keys());

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
