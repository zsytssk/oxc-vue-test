import { parse } from "@babel/parser";
import traverse from "@babel/traverse";

const code = `
function foo(x) {
  console.log(a, b, c, util1_1, React, lodash, unknown);
  const d = e + f;
}
`;

const externalRefs = new Set();
const ast = parse(code, {
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

console.log([...externalRefs]);
