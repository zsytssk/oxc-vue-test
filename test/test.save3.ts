import { parse as babelParse } from "@babel/parser";
import traverse from "@babel/traverse";

export interface FunctionDeps {
  name: string;
  type: "function" | "arrow" | "method" | "class";
  dependencies: string[];
  location: {
    start: number;
    end: number;
  };
}

export function getFunExternDeps(code: string): Map<string, FunctionDeps> {
  const functionDeps = new Map<string, FunctionDeps>();
  const ast = babelParse(code, {
    sourceType: "module",
    plugins: ["jsx", "typescript"],
  });

  // 收集所有导入的标识符
  const importedIdentifiers = new Set<string>();

  traverse(ast, {
    // 收集导入声明
    ImportDeclaration(path) {
      path.node.specifiers.forEach((specifier) => {
        if (specifier.type === "ImportSpecifier") {
          importedIdentifiers.add(specifier.local.name);
        } else if (specifier.type === "ImportDefaultSpecifier") {
          importedIdentifiers.add(specifier.local.name);
        } else if (specifier.type === "ImportNamespaceSpecifier") {
          importedIdentifiers.add(specifier.local.name);
        }
      });
    },

    // 收集变量声明（const, let, var）
    VariableDeclaration(path) {
      path.node.declarations.forEach((declaration) => {
        if (declaration.id.type === "Identifier") {
          importedIdentifiers.add(declaration.id.name);
        }
      });
    },
  });

  traverse(ast, {
    // 1. 函数声明
    FunctionDeclaration(path) {
      const functionName =
        path.node.id?.name || `<anonymous-function-${path.node.start}>`;
      const dependencies = analyzeFunctionDependencies(
        path,
        importedIdentifiers
      );

      functionDeps.set(functionName, {
        name: functionName,
        type: "function",
        dependencies,
        location: {
          start: path.node.start!,
          end: path.node.end!,
        },
      });
    },

    // 2. 箭头函数
    VariableDeclarator(path) {
      if (
        path.node.init &&
        (path.node.init.type === "ArrowFunctionExpression" ||
          path.node.init.type === "FunctionExpression")
      ) {
        const variableName =
          path.node.id.type === "Identifier"
            ? path.node.id.name
            : `<anonymous-${path.node.start}>`;
        const dependencies = analyzeFunctionDependencies(
          path.get("init"),
          importedIdentifiers
        );

        functionDeps.set(variableName, {
          name: variableName,
          type: "arrow",
          dependencies,
          location: {
            start: path.node.start!,
            end: path.node.end!,
          },
        });
      }
    },

    // 3. 对象方法
    ObjectMethod(path) {
      const methodName =
        path.node.key.type === "Identifier"
          ? path.node.key.name
          : `<method-${path.node.start}>`;
      const dependencies = analyzeFunctionDependencies(
        path,
        importedIdentifiers
      );

      functionDeps.set(methodName, {
        name: methodName,
        type: "method",
        dependencies,
        location: {
          start: path.node.start!,
          end: path.node.end!,
        },
      });
    },

    // 4. 类方法
    ClassMethod(path) {
      const methodName =
        path.node.key.type === "Identifier"
          ? path.node.key.name
          : `<class-method-${path.node.start}>`;
      const dependencies = analyzeFunctionDependencies(
        path,
        importedIdentifiers
      );

      functionDeps.set(methodName, {
        name: methodName,
        type: "method",
        dependencies,
        location: {
          start: path.node.start!,
          end: path.node.end!,
        },
      });
    },

    // 5. 直接函数表达式
    FunctionExpression(path) {
      // 只有当函数表达式有名字或者有父级变量时才记录
      let functionName = path.node.id?.name;

      if (!functionName) {
        // 尝试从父级获取名字
        const parent = path.parentPath;
        if (
          parent?.isVariableDeclarator() &&
          parent.node.id.type === "Identifier"
        ) {
          functionName = parent.node.id.name;
        } else if (
          parent?.isAssignmentExpression() &&
          parent.node.left.type === "Identifier"
        ) {
          functionName = parent.node.left.name;
        } else {
          functionName = `<function-expr-${path.node.start}>`;
        }
      }

      const dependencies = analyzeFunctionDependencies(
        path,
        importedIdentifiers
      );

      functionDeps.set(functionName, {
        name: functionName,
        type: "function",
        dependencies,
        location: {
          start: path.node.start!,
          end: path.node.end!,
        },
      });
    },
  });

  return functionDeps;
}

function analyzeFunctionDependencies(
  path: any,
  importedIdentifiers: Set<string>
): string[] {
  const usedIdentifiers = new Set<string>();
  const localBindings = new Set<string>();

  // 收集当前函数作用域内的所有绑定
  path.scope?.getBinding()?.forEach((bindings, name) => {
    localBindings.add(name);
  });

  path.traverse({
    Identifier(innerPath) {
      const { name } = innerPath.node;

      // 跳过一些特殊情况
      if (shouldSkipIdentifier(innerPath)) {
        return;
      }

      // 检查标识符的绑定信息
      const binding = innerPath.scope.getBinding(name);

      // 如果没有绑定，或者绑定在当前函数作用域之外，则认为是外部依赖
      if (!binding || isExternalBinding(binding, path)) {
        // 确保是引用的标识符，而不是声明
        if (innerPath.isReferencedIdentifier()) {
          // 检查是否是导入的标识符或者是全局变量
          if (importedIdentifiers.has(name) || isGlobalIdentifier(name)) {
            usedIdentifiers.add(name);
          } else if (!localBindings.has(name)) {
            usedIdentifiers.add(name);
          }
        }
      }
    },

    // 处理模板字符串中的表达式
    TemplateLiteral(innerPath) {
      innerPath.node.expressions.forEach((expr) => {
        if (expr.type === "Identifier") {
          const name = expr.name;
          const binding = innerPath.scope.getBinding(name);

          if (!binding || isExternalBinding(binding, path)) {
            if (importedIdentifiers.has(name) || isGlobalIdentifier(name)) {
              usedIdentifiers.add(name);
            } else if (!localBindings.has(name)) {
              usedIdentifiers.add(name);
            }
          }
        }
      });
    },

    // 处理成员表达式的属性访问
    MemberExpression(innerPath) {
      if (
        innerPath.node.object.type === "Identifier" &&
        !innerPath.node.computed
      ) {
        const objectName = (innerPath.node.object as any).name;
        const binding = innerPath.scope.getBinding(objectName);

        if (!binding || isExternalBinding(binding, path)) {
          if (
            importedIdentifiers.has(objectName) ||
            isGlobalIdentifier(objectName)
          ) {
            usedIdentifiers.add(objectName);
          } else if (!localBindings.has(objectName)) {
            usedIdentifiers.add(objectName);
          }
        }
      }
    },
  });

  return Array.from(usedIdentifiers);
}

function shouldSkipIdentifier(path: any): boolean {
  const parent = path.parentPath;

  // 跳过对象属性的键名
  if (parent?.isObjectProperty() && parent.node.key === path.node) {
    return true;
  }

  // 跳过成员表达式的属性名（非计算属性）
  if (
    parent?.isMemberExpression() &&
    !parent.node.computed &&
    parent.node.property === path.node
  ) {
    return true;
  }

  // 跳过 import 声明中的模块说明符
  if (parent?.isImportDeclaration() && parent.node.source === path.node) {
    return true;
  }

  // 跳过标签语句的标签
  if (parent?.isLabeledStatement() && parent.node.label === path.node) {
    return true;
  }

  return false;
}

function isExternalBinding(binding: any, functionPath: any): boolean {
  let currentScope = binding.scope;

  while (currentScope) {
    if (currentScope === functionPath.scope) {
      return false; // 在当前函数作用域内
    }
    if (currentScope.parent === functionPath.scope) {
      return true; // 在父级作用域，相对于当前函数是外部的
    }
    currentScope = currentScope.parent;
  }

  return true;
}

function isGlobalIdentifier(name: string): boolean {
  // 常见的全局变量和浏览器API
  const globalIdentifiers = new Set([
    "console",
    "window",
    "document",
    "navigator",
    "location",
    "setTimeout",
    "setInterval",
    "clearTimeout",
    "clearInterval",
    "fetch",
    "Promise",
    "JSON",
    "Math",
    "Date",
    "Array",
    "Object",
    "String",
    "Number",
    "Boolean",
    "RegExp",
    "Error",
    "Map",
    "Set",
  ]);

  return globalIdentifiers.has(name);
}

// 辅助函数：获取格式化结果
export function getFormattedDepsResult(
  functionDeps: Map<string, FunctionDeps>
) {
  const result: Record<string, any> = {};

  functionDeps.forEach((deps, name) => {
    result[name] = {
      type: deps.type,
      dependencies: deps.dependencies,
      location: deps.location,
    };
  });

  return result;
}

const code = `
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
`;

const deps = getFunExternDeps(code);
console.log(getFormattedDepsResult(deps));
