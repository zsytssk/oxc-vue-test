import { parse as babelParse } from "@babel/parser";
import traverse from "@babel/traverse";
import { parseFileAst } from "./parseUtils";
import { CodeItem } from "./type";
import { getRelPath } from "./utils";

function isClosest(binding: any, functionPath: any): boolean {
  let currentScope = binding.scope;

  while (currentScope) {
    if (currentScope === functionPath.scope) {
      return true; // 在当前函数作用域内
    }
    currentScope = currentScope.parent;
  }

  return false;
}
export function getFunExternDeps(code: string) {
  const externalDeps = new Map();
  const ast = babelParse(code, {
    sourceType: "module",
    plugins: ["jsx", "typescript"],
  });

  traverse(ast, {
    FunctionDeclaration(path) {
      const functionName = path.node.id?.name || "<anonymous>";
      const usedIdentifiers = new Set();

      path.traverse({
        Identifier(innerPath) {
          const { name } = innerPath.node;
          // 检查标识符的绑定信息
          const binding = innerPath.scope.getBinding(name);
          // 如果没有绑定，或者绑定在当前函数作用域之外，则认为是外部依赖
          if (!binding || !isClosest(binding, path)) {
            // 确保是引用的标识符，而不是声明
            if (innerPath.isReferencedIdentifier()) {
              usedIdentifiers.add(name);
            }
          }
        },
      });

      externalDeps.set(functionName, Array.from(usedIdentifiers));
    },
  });

  return externalDeps;
}

export async function getFileVariables(filePath: string) {
  // 收集所有导入的标识符
  const imports = new Set<CodeItem>();
  // 收集所有顶层作用域定义的标识符（非导入）
  const identifiers = new Set();
  const { ast } = await parseFileAst(filePath);
  // 第一次遍历：收集导入和顶层定义
  traverse(ast, {
    ImportDeclaration(path) {
      const modulePath = path.node.source.value;
      path.node.specifiers.forEach((specifier) => {
        let importedName = (specifier as any)?.imported?.name;
        if (specifier.type === "ImportDefaultSpecifier") {
          importedName = "default";
        } else if (specifier.type === "ImportNamespaceSpecifier") {
          importedName = "*";
        }
        imports.add({
          name: specifier.local.name,
          originalName: importedName,
          position: [specifier.start!, specifier.end!],
          filePath: modulePath,
          originType: specifier.type,
          type: "import",
        });
      });
    },

    VariableDeclaration(path) {
      if (!path.parentPath.isProgram()) return; // 只处理顶层变量声明

      path.node.declarations.forEach((declaration) => {
        if (declaration.id.type === "Identifier") {
          const name = declaration.id.name;
          identifiers.add({
            name,
            position: [declaration.start, declaration.end],
            filePath: filePath,
            originType: declaration.type,
            type: "local",
          });
        }
      });
    },

    FunctionDeclaration(path) {
      if (
        !path.parentPath.isProgram() &&
        !path.parentPath.isExportNamedDeclaration()
      )
        return; // 只处理顶层函数声明

      const name = path.node.id?.name;
      identifiers.add({
        name,
        position: [path.node.start, path.node.end],
        filePath: filePath,
        originType: path.type,
        type: "local",
      });
    },
  });

  for (const item of imports) {
    item.filePath =
      (await getRelPath(filePath, item.filePath)) || item.filePath;
  }

  return {
    imports: Array.from(imports),
    identifiers: Array.from(identifiers),
  };
}
