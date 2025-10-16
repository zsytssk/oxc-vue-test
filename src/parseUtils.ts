import { parse as babelParse } from "@babel/parser";
import traverse, { NodePath } from "@babel/traverse";
import { parse as parseVue } from "@vue/compiler-sfc";
import { readFile } from "./ls/asyncUtil";
import { cpFile } from "./ls/cpFile";
import { CodeItem, DiffItem } from "./type";
import { getRelPath, isVueFile, resolveAliasPath } from "./utils";
import { Identifier } from "@babel/types";

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
export async function parseVueScript(filePath: string) {
  const content = await readFile(filePath);
  const { descriptor } = parseVue(content);
  return descriptor.script?.content || descriptor.scriptSetup?.content;
}

export async function parseFileAst(filePath: string) {
  let content: string;
  if (isVueFile(filePath)) {
    content = (await parseVueScript(filePath))!;
  } else {
    content = await readFile(filePath);
  }
  const ast = babelParse(content, {
    sourceType: "module",
    plugins: ["typescript", "jsx"],
  });

  return { ast, content };
}

export async function getImports(filePath: string) {
  const { ast } = await parseFileAst(filePath);
  const imports: Record<string, string[]> = {};
  traverse(ast, {
    ImportDeclaration(path: any) {
      const modulePath = path.node.source.value;
      const specifiers = [] as any[];
      for (const item of path.node.specifiers) {
        let importedName = item?.imported?.name;
        if (item.type === "ImportDefaultSpecifier") {
          importedName = "default";
        } else if (item.type === "ImportNamespaceSpecifier") {
          importedName = "*";
        }
        specifiers.push(importedName);
      }
      imports[modulePath] = specifiers;
    },
  });

  return imports;
}

export async function getSourceNamesDeps(names: string[], filePath: string) {
  if (names.includes("*")) {
    return {
      "*": { type: "file" as const, name: "*", filePath },
    };
  }
  const codePositions = {} as Record<string, CodeItem>;
  const fileExports = await getFileExports(filePath);
  for (const item of fileExports) {
    const matchName = names.find((name) => item.name === name);
    if (matchName) {
      codePositions[matchName] = item;
    }
  }

  return codePositions;
}

export async function getFileImportsMap(
  filePath: string,
  aliasMap?: Record<string, string>
) {
  const imports = await getImports(filePath);

  // 获取每个 import 的源码
  const importsMap: Record<string, Record<string, CodeItem>> = {};

  for (const [modulePath, names] of Object.entries(imports)) {
    // 转成绝对路径
    let absPath = modulePath;
    if (aliasMap) {
      absPath = resolveAliasPath(modulePath, aliasMap);
    }
    absPath = (await getRelPath(filePath, absPath))!;
    if (!absPath) {
      continue;
    }

    importsMap[absPath] = await getSourceNamesDeps(names, absPath);
  }

  return importsMap;
}

// export async function checkFileDiff(
//   sourceFile: string,
//   targetFile: string,
//   sourceIdnMap: Record<string, DiffItem>
// ) {
//   if (!(await exists(targetFile))) {
//     await cpFile(sourceFile, targetFile);
//     return;
//   }
//   let targetCon = await readFile(targetFile);
//   const findNames = Object.keys(sourceIdnMap);
//   const targetVarMap = await getSourceNamesPositions(findNames, targetFile);
//   findNames.sort((a, b) => {
//     const posStartA = targetVarMap[a]?.pos[0] || 0;
//     const posStartB = targetVarMap[b]?.pos[0] || 0;
//     return posStartB - posStartA;
//   });
//   for (const name of findNames) {
//     if (!targetVarMap[name]) {
//       // 新增
//       targetCon += `\n${sourceIdnMap[name].code}`;
//     } else if (
//       targetVarMap[name].len !== sourceIdnMap[name].len ||
//       targetVarMap[name].code !== sourceIdnMap[name].code
//     ) {
//       // 替换
//       targetCon =
//         targetCon.slice(0, targetVarMap[name].pos[0]) +
//         sourceIdnMap[name].code +
//         targetCon.slice(targetVarMap[name].pos[1]);
//     }
//   }
//   await write(targetFile, targetCon);
// }

export async function applyChange(diffItem: DiffItem) {
  if (diffItem.diffType === "file") {
    await cpFile(diffItem.sourceFile, diffItem.targetFile!);
    return;
  }
  // 从后向前修改目标文件内容: 替换 + 新增
}

export function getCodeExternDeps(code: string) {
  const externalRefs = new Set();
  const ast = babelParse(code, {
    sourceType: "module",
    plugins: ["jsx", "typescript"],
  });

  traverse(ast, {
    Program(path) {
      path.traverse({
        ReferencedIdentifier(path) {
          const binding = path.scope.getBinding(path.node.name);
          if (!binding) {
            externalRefs.add(path.node.name);
          }
        },
      });
    },
  });
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

export async function getFileExports(filePath: string) {
  const { ast } = await parseFileAst(filePath);

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

  return defined;
}
