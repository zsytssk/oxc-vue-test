import { isVueFile, readFile } from "./utils";
import { parse as parseVue } from "@vue/compiler-sfc";
import { parse as babelParse } from "@babel/parser";
export function parseVueScript(filePath: string) {
  const content = readFile(filePath);
  const { descriptor } = parseVue(content);
  return descriptor.script?.content || descriptor.scriptSetup?.content;
}

export function parseFileAst(filePath: string) {
  let content: string;
  if (isVueFile(filePath)) {
    content = parseVueScript(filePath)!;
  } else {
    content = readFile(filePath);
  }
  const ast = babelParse(content, {
    sourceType: "module",
    plugins: ["typescript", "jsx"],
  });

  return { ast, content };
}
