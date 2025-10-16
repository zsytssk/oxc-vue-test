const localName = spec.local.name; // 模块内部原名
        const exportedName = spec.exported.name; // 导出出去的名字
        console.log({
          localName,
          exportedName,
          source: path.node.source?.value,
        });