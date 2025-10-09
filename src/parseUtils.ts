import { getRelPath, isVueFile, resolveAliasPath } from "./utils";
import { readdir, readFile } from "./ls/asyncUtil";
import { parse as parseVue } from "@vue/compiler-sfc";
import { parse as babelParse } from "@babel/parser";
import traverse from "@babel/traverse";
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
  const { ast: moduleAST } = await parseFileAst(filePath);
  const codePositions = {} as Record<string, [number, number]>;
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
        codePositions[decl.id!.name] = codePos;
      }

      if (decl.type === "VariableDeclaration") {
        decl.declarations.forEach((d: any) => {
          const varName = d.id.name;
          if (names.includes(varName)) {
            codePositions[varName] = codePos;
          }
        });
      }
    },
    ExportDefaultDeclaration(path: any) {
      if (names.includes("default")) {
        const decl = path.node.declaration;
        codePositions["default"] = [decl.start!, decl.end!];
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
  const importsMap: Record<string, Record<string, [number, number]>> = {};

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
