export type CodeType = "import" | "local";

export type CodeItem = {
  name: string;
  originalName?: string;
  position: [number, number];
  filePath: string;
  originType: string;
  type: CodeType;
  code?: string;
};

export type DiffItem = {
  diffType: "file" | "code";
  sourceFile: string;
  targetFile?: string;
  codeName?: string;
  pos?: [number, number];
};
