import * as t from "@babel/types";
import generate from "@babel/generator";

export function genImport(modulePath: string, items: [string, string][]) {
  const importItems = [];
  for (const [item, alias] of items) {
    if (alias === "*") {
      importItems.push(t.importNamespaceSpecifier(t.identifier(item)));
    } else if (alias === "default") {
      importItems.push(t.importDefaultSpecifier(t.identifier(item)));
    } else {
      importItems.push(
        t.importSpecifier(t.identifier(item), t.identifier(alias))
      );
    }
  }

  const importDecl = t.importDeclaration(
    [...importItems],
    // from 'react'
    t.stringLiteral(modulePath)
  );

  const { code } = generate(importDecl);

  return code;
}
