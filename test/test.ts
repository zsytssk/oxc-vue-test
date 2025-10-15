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
  if (path.parentPath?.isDeclaration()) {
    return getCompletePath(path.parentPath);
  }
  return path;
}

Bun.write("./test/test.json", JSON.stringify([...defined], null, 2));
console.log(defined);
