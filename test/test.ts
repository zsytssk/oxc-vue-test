import { parse } from "@babel/parser";
import traverse, { NodePath } from "@babel/traverse";

const code = `
const {a, ...other} = {a: 1, b: 2}
`;

const ast = parse(code, { sourceType: "module" });

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

function buildTree(path: NodePath<any>, topPath = [] as string[]) {
  const node = path.node;
  const name = getNodeName(node) || node.type;
  const curPath = [...topPath, name].filter(Boolean);
  const tree: any = {
    type: node.type,
    name: name, // 这里加上名字
    path: curPath.join("."),
    children: [] as any[],
  };
  if (path.parentPath?.isDeclaration() && curPath.length) {
    console.log("Declaration:", curPath.join("."));
  }

  for (const key in node) {
    if (key === "loc" || key === "start" || key === "end") {
      continue;
    }
    const childPath = path.get(key);
    if (Array.isArray(childPath)) {
      childPath.forEach((c: NodePath<any>) => {
        if (typeof c?.node?.type === "string") {
          tree.children.push(buildTree(c, curPath));
        }
      });
    } else if (typeof childPath?.node?.type === "string") {
      tree.children.push(buildTree(childPath, curPath));
    }
  }

  return tree;
}

traverse(ast, {
  Program(path) {
    const tree = buildTree(path);
    Bun.write("./test/test.json", JSON.stringify(tree, null, 2));
    path.stop();
  },
});
