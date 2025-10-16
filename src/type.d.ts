export type CodeItem = {
  type: "import" | "local" | "file";
  name: string;
  filePath: string;
  originType?: string;
  position?: [number, number];
  originalName?: string;
};

export type DiffItem = {
  diffType: "file" | "code";
  sourceFile: string;
  targetFile?: string;
  codeName?: string;
  position?: [number, number];
};
