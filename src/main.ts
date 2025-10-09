import traverse from "@babel/traverse";
import { parseFileAst } from "./parseUtils";
import { getRelPath } from "./utils";

const filePath =
  "/home/zsy/Documents/zsy/job/tpm/web/src/plugin/tpm/view/device/device.vue";

async function main() {
  const { ast } = parseFileAst(filePath);

  const imports: Record<string, string[]> = {}; // { modulePath: [importName] }

  traverse(ast, {
    ImportDeclaration(path: any) {
      const modulePath = path.node.source.value;
      const specifiers = path.node.specifiers.map((spec: any) => {
        if (spec.type === "ImportSpecifier") return spec.imported.name;
        if (spec.type === "ImportDefaultSpecifier") return "default";
        if (spec.type === "ImportNamespaceSpecifier") return "*";
      });
      imports[modulePath] = specifiers;
    },
  });

  // 获取每个 import 的源码
  const importedSourceCodes: Record<string, Record<string, string>> = {};

  for (const [modulePath, names] of Object.entries(imports)) {
    // 转成绝对路径
    const absPath = getRelPath(filePath, modulePath);
    if (!absPath) {
      continue;
    }
    const { ast: moduleAST, content: moduleCode } = parseFileAst(absPath);

    importedSourceCodes[absPath] = {};

    traverse(moduleAST, {
      ExportNamedDeclaration(path: any) {
        const decl = path.node.declaration;
        if (!decl) return;
        if (
          decl.type === "FunctionDeclaration" &&
          names.includes(decl.id?.name || "")
        ) {
          importedSourceCodes[absPath][decl.id!.name] = moduleCode.slice(
            decl.start!,
            decl.end!
          );
        }
        if (decl.type === "VariableDeclaration") {
          decl.declarations.forEach((d: any) => {
            const varName = (d.id as any).name;
            if (names.includes(varName)) {
              importedSourceCodes[absPath][varName] = moduleCode.slice(
                d.start!,
                d.end!
              );
            }
          });
        }
      },
      ExportDefaultDeclaration(path: any) {
        if (names.includes("default")) {
          const decl = path.node.declaration;
          importedSourceCodes[absPath]["default"] = moduleCode.slice(
            decl.start!,
            decl.end!
          );
        }
      },
    });
  }

  console.log(importedSourceCodes);
}

await main();
