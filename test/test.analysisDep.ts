import { parse } from "@babel/parser";
import traverse from "@babel/traverse";
import { CodeItem } from "../src/type";
import { genImport } from "../src/genUtils";

const code = `
import { util1 as util1_1, util2 } from './utils'
import React from 'react'
import * as lodash from 'lodash'

const a = 1;
let b = 2;
var c = 3;

function foo(x) {
  console.log(a, b, c, util1_1, React, lodash, unknown);
  const d = e + f;
}
`;

const ast = parse(code, {
  sourceType: "module",
  plugins: ["jsx", "typescript"],
});

// 收集所有导入的标识符
const importedIdentifiers: CodeItem[] = [];
// 收集所有顶层作用域定义的标识符（非导入）
const topLevelLocalIdentifiers: CodeItem[] = [];

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
      importedIdentifiers.push({
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
        console.log(`test:>VariableDeclaration`, name);
        topLevelLocalIdentifiers.push({
          name,
          position: [declaration.start!, declaration.end!],
          filePath: "",
          originType: declaration.type,
          type: "local",
        });
      }
    });
  },

  FunctionDeclaration(path) {
    if (!path.parentPath.isProgram()) return; // 只处理顶层函数声明

    const name = path.node.id?.name;
    if (name && !hasCodeItem(topLevelLocalIdentifiers, name)) {
      topLevelLocalIdentifiers.push({
        name,
        position: [path.node.start!, path.node.end!],
        filePath: "",
        originType: path.node.type,
        type: "local",
      });
    }
  },
});

const externalDeps = new Map();

// 第二次遍历：分析函数依赖
traverse(ast, {
  FunctionDeclaration(path) {
    const functionName = path.node.id?.name || "<anonymous>";
    const dependencies = {
      imports: new Set(), // 从其他文件导入的
      locals: new Set(), // 当前文件顶层定义的
      globals: new Set(), // 全局变量（未定义也未导入）
      unknowns: new Set(), // 无法确定的
    };

    path.traverse({
      Identifier(innerPath) {
        const { name } = innerPath.node;

        // 检查标识符的绑定信息
        const binding = innerPath.scope.getBinding(name);

        // 如果没有绑定，或者绑定在当前函数作用域之外，则认为是外部依赖
        if (!binding || binding.scope !== path.scope) {
          // 确保是引用的标识符，而不是声明
          if (
            innerPath.isReferencedIdentifier() &&
            !innerPath.parentPath.isMemberExpression({
              object: innerPath.node,
            })
          ) {
            // 分类依赖
            if (hasCodeItem(importedIdentifiers, name)) {
              dependencies.imports.add(name);
            } else if (hasCodeItem(topLevelLocalIdentifiers, name)) {
              dependencies.locals.add(name);
            } else {
              dependencies.unknowns.add(name);
            }
          }
        }
      },
    });

    // 转换为数组格式
    externalDeps.set(functionName, {
      imports: Array.from(dependencies.imports),
      locals: Array.from(dependencies.locals),
      globals: Array.from(dependencies.globals),
      unknowns: Array.from(dependencies.unknowns),
    });
  },
});

console.log("导入的标识符:", importedIdentifiers);
// console.log("顶层本地标识符:", topLevelLocalIdentifiers);
console.log("函数依赖分析:");
externalDeps.forEach((deps, funcName) => {
  console.log(`\n函数 ${funcName}:`);
  //   console.log("  从其他文件导入:", deps.imports);
  //   console.log("  当前文件顶层定义:", deps.locals);
  //   console.log("  全局变量:", deps.globals);
  //   console.log("  未知依赖:", deps.unknowns);
  const imports = {} as Record<string, [string, string][]>;
  const locals = [] as [number, number][];
  for (const item of deps.imports) {
    const importItem = importedIdentifiers.find((_item) => _item.name === item);
    if (!importItem) {
      continue;
    }
    if (!imports[importItem.filePath]) {
      imports[importItem.filePath] = [];
    }
    imports[importItem.filePath].push([
      importItem.name,
      importItem.originalName || item.name,
    ]);
  }

  console.log(imports);

  for (const item of deps.locals) {
    const localItem = topLevelLocalIdentifiers.find(
      (_item) => _item.name === item
    );
    if (!localItem) {
      continue;
    }
    locals.push([localItem.position[0], localItem.position[1]]);
  }
  for (const key in imports) {
    const code = genImport(key, imports[key]);
    console.log(code);
  }
});

function hasCodeItem(codeItem: CodeItem[], name: string) {
  return codeItem.some((item) => item.name === name);
}
