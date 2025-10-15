分析 code 和他的依赖, 这挺有意思的, 然后对比看看有没有修改

## 2025-10-14 16:30:46

- @ques 分析代码的依赖

- @ques 列举所有的申明

  - 最好是能找到每一个 node 的 path

- @ques 列举所有的引用

- @ques 多变量声明要怎么处理？`const {a, b} = {a: 1, b: 2}`

  - 情况太多了 bindings 要考虑一个个不同的节点
  - `Declaration` 获取名字太复杂了

- @ques 如何获取 binding 对应的路径`Param.MyComponent.fetchData`

```
const a = {}
```

### end

- @ques 最顶级的变量和 function

- @ques 最顶级的声明 -> 变量 + fn + import

## 迁移 ems

- @ques 依赖的类型 -> 文件 | 代码块

  - 文件 -> 直接复制文件
  - 代码块 -> 获取代码块的依赖关系 -> 递归算法
  - 可以一一分析最后再去 复制

- @ques getFunExternDeps -> ...getCodeExternDeps

- @ques 依赖中有依赖的文件需要怎么处理?

  - 有没有办法分析某个文件的依赖
  - 在开始的时候, 就去一个个的遍历 文件, 获取所有的依赖关系, 然后再一个个的文件去处理

- 如果只是`tpm` `ems`的代码不同, 不应用修改

  - transform 逻辑

- @ques 代码块的依赖 如何处理?

- 如果只是以文件为单位的, 就会把这个文件的所有依赖有 import 都 import
  - 如果是 copyFile 需要所有依赖关系
  - 如果只是更新内容, 只需要那部分内容的依赖关系 -> [深入]

```ts
const itemMap = await getFileImportsMap(file, tpmPathAlias);
```

```ts
export async function getFileImportsMap(
  filePath: string,
  aliasMap?: Record<string, string>,
  recursive = false,
  importsMap = {} as Record<string, Record<string, CodeItemInfo>>
) {
  const imports = await getImports(filePath); // { modulePath: [importName] }
  const localAddFile = [] as string[];
  for (const [modulePath, names] of Object.entries(imports)) {
    // 转成绝对路径
    let absPath = modulePath;
    if (aliasMap) {
      absPath = resolveAliasPath(modulePath, aliasMap);
    }
    absPath = (await getRelPath(filePath, absPath))!;
    if (!absPath || importsMap[filePath]) {
      continue;
    }

    const item = await getSourceNamesPositions(names, absPath);
    importsMap[filePath] = item;
    localAddFile.push(filePath);
  }

  if (!recursive) {
    return importsMap;
  }

  for (const filePath of localAddFile) {
    await getFileImportsMap(filePath, aliasMap, recursive, importsMap);
  }

  return importsMap;
}
```

- @ques 如何对比文件 -> ?

- @ques 怎么排除全局 比如 `vue`
- @ques 有没有可能直接用原始的数据格式, 我只对原始的数据进行一些工具操作?
  - 这样的好处是能在后续直接使用 对应的方法, 也能让我了解其结构
  - 不这样的好处是 我自己定义的数据类型, 非常清晰, 自己知道每一部分的作用
- @ques 怎么自动生成从 node 生成 import

- @ques 要不要合并 同一文件下的被 import 的内容

- @ques 如何获取某个 import 的 string

---

- todo

遍历文件夹下所有文件
查找所有不在此文件下的依赖关系, 如果 ems 没有对应的内容, 则需要 copy 此内容
所有超出`src/plugin`全部不管

---

即使是同一文件, 他的内容也可能不一样 -> 对比 len | 或者内容?
如何找到对比文件
ems 中没有改动 device 的内容吗 -> @lyk
清理原来的 script 内容

- 下面这两个路径怎么处理

```
'@/components/showTooltip/showTooltip.vue'
'@tpm/api/deviceFileManager'
```

- @ques 更新文件中的依赖如何处理?
  - 一个递归问题
  - 应用文件之后, 去检查文件的依赖, 再去更新依赖...

### end

- @ques 如何生成 import 语句

- @ques 如何获取某个变量 function 的位置
- todo

查找 view 下的具有相同文件夹名
此类文件需要直接覆盖
