import { parse } from "@babel/parser";
import traverse from "@babel/traverse";

const code = `
import * as Test {
  default as Test1,
  DeviceTypeMap,
  useObjectTypeColumns,
} from '../../utils/utils'
`;

const ast = parse(code, {
  sourceType: "module",
  plugins: ["typescript", "jsx"],
});

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

console.log(imports);
