import { parse } from "@babel/parser";
import traverse, { NodePath } from "@babel/traverse";
import { CodeItem } from "../src/type";

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

const ast = parse(code, {
  sourceType: "module",
  plugins: ["typescript", "jsx"],
});

traverse(ast, {
  enter(path) {
    if (path.isDeclaration()) {
      if (path.isFunctionDeclaration() || path.isClassDeclaration()) {
        if (path.node.id) {
          console.log(`Function/Class: ${path.node.id.name}`);
        }
      } else if (path.isVariableDeclaration()) {
        path.node.declarations.forEach((declarator) => {
          if (declarator.id.type === "Identifier") {
            console.log(`Variable: ${declarator.id.name}`);
          } else if (declarator.id.type === "ArrayPattern") {
            declarator.id.elements.forEach((element) => {
              if (element && element.type === "Identifier") {
                console.log(`Variable from array: ${element.name}`);
              }
            });
          } else if (declarator.id.type === "ObjectPattern") {
            declarator.id.properties.forEach((prop) => {
              if (prop.type === "ObjectProperty") {
                const key = prop.key;
                if (key.type === "Identifier") {
                  console.log(`Variable from object: ${key.name}`);
                }
              } else if (prop.type === "RestElement") {
                console.log(`Rest variable: ${prop.argument.name}`);
              }
            });
          }
        });
      } else if (path.isImportDeclaration()) {
        path.node.specifiers.forEach((specifier) => {
          if (specifier.type === "ImportDefaultSpecifier") {
            console.log(`Default import: ${specifier.local.name}`);
          } else if (specifier.type === "ImportSpecifier") {
            console.log(`Named import: ${specifier.local.name}`);
          } else if (specifier.type === "ImportNamespaceSpecifier") {
            console.log(`Namespace import: ${specifier.local.name}`);
          }
        });
      }
    }
  },
});
