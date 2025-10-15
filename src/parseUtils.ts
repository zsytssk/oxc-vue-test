import { getRelPath, isVueFile, resolveAliasPath } from "./utils";
import { exists, readFile } from "./ls/asyncUtil";
import { parse as parseVue } from "@vue/compiler-sfc";
import { parse as babelParse } from "@babel/parser";
import traverse, { NodePath } from "@babel/traverse";
import { CodeItem, DiffItem } from "./type";
import { cpFile } from "./ls/cpFile";
import { write } from "./ls/write";
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

export async function getSourceNamesPositions(
  names: string[],
  filePath: string
) {
  const { ast: moduleAST, content } = await parseFileAst(filePath);
  const codePositions = {} as Record<string, CodeItemInfo>;
  traverse(moduleAST, {
    ExportNamedDeclaration(path: any) {
      const decl = path.node.declaration;
      if (!decl) return;

      // 获取 export 的源码
      const codePos = [path.node.start!, path.node.end!] as [number, number];
      if (
        decl.type === "FunctionDeclaration" &&
        names.includes(decl.id?.name || "")
      ) {
        codePositions[decl.id!.name] = {
          code: content.slice(...codePos),
          len: codePos[1] - codePos[0],
          pos: codePos,
        };
      }

      if (decl.type === "VariableDeclaration") {
        decl.declarations.forEach((d: any) => {
          const varName = d.id.name;
          if (names.includes(varName)) {
            codePositions[varName] = {
              code: content.slice(...codePos),
              len: codePos[1] - codePos[0],
              pos: codePos,
            };
          }
        });
      }
    },
    ExportDefaultDeclaration(path: any) {
      if (names.includes("default")) {
        const decl = path.node.declaration;
        const codePos = [decl.start!, decl.end!] as [number, number];
        codePositions["default"] = {
          code: content.slice(...codePos),
          len: codePos[1] - codePos[0],
          pos: codePos,
        };
      }
    },
  });

  return codePositions;
}

export async function getFileImportsMap(
  filePath: string,
  aliasMap?: Record<string, string>
) {
  const imports = await getImports(filePath); // { modulePath: [importName] }

  // 获取每个 import 的源码
  const importsMap: Record<string, Record<string, CodeItemInfo>> = {};

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

    importsMap[absPath] = await getSourceNamesPositions(names, absPath);
  }

  return importsMap;
}

export async function checkFileDiff(
  sourceFile: string,
  targetFile: string,
  sourceIdnMap: Record<string, CodeItemInfo>
) {
  if (!(await exists(targetFile))) {
    await cpFile(sourceFile, targetFile);
    return;
  }
  let targetCon = await readFile(targetFile);
  const findNames = Object.keys(sourceIdnMap);
  const targetVarMap = await getSourceNamesPositions(findNames, targetFile);
  findNames.sort((a, b) => {
    const posStartA = targetVarMap[a]?.pos[0] || 0;
    const posStartB = targetVarMap[b]?.pos[0] || 0;
    return posStartB - posStartA;
  });
  for (const name of findNames) {
    if (!targetVarMap[name]) {
      // 新增
      targetCon += `\n${sourceIdnMap[name].code}`;
    } else if (
      targetVarMap[name].len !== sourceIdnMap[name].len ||
      targetVarMap[name].code !== sourceIdnMap[name].code
    ) {
      // 替换
      targetCon =
        targetCon.slice(0, targetVarMap[name].pos[0]) +
        sourceIdnMap[name].code +
        targetCon.slice(targetVarMap[name].pos[1]);
    }
  }
  await write(targetFile, targetCon);
}

export async function applyChange(diffItem: DiffItem) {
  if (diffItem.diffType === "file") {
    await cpFile(diffItem.sourceFile, diffItem.targetFile);
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

export async function getFileTopIdentifies(filePath: string, withCode = false) {
  const { ast, content } = await parseFileAst(filePath);

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
            code: withCode ? content.slice(node.start!, node.end!) : undefined,
            filePath: modulePath,
          });
        } else {
          const parentNode = parentPath.node;
          defined.add({
            type: "local",
            originType: itemPath.type,
            name: name,
            position: [parentNode.start!, parentNode.end!],
            code: withCode
              ? content.slice(parentNode.start!, parentNode.end!)
              : undefined,
            filePath: "",
          });
        }
      }
    },
  });
}
