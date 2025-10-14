import * as t from "@babel/types";
import generate from "@babel/generator";

// 创建：import React, { useState } from 'react'
const importDecl = t.importDeclaration(
  [
    // 默认导入 React
    t.importSpecifier(t.identifier("util2"), t.identifier("util2")),
    // 命名导入 useState
    t.importSpecifier(t.identifier("util1"), t.identifier("util1_1")),
  ],
  // from 'react'
  t.stringLiteral("./utils")
);

// 生成代码
const { code } = generate(importDecl);
console.log(code);
// 输出：import React, { useState } from "react";
