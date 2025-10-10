export type CodeType = "import" | "local";

export type CodeItem = {
  name: string;
  originalName?: string;
  position: [number, number];
  filePath: string;
  originType: string;
  type: CodeType;
};

export type CodeItemInfo = {
  code?: string;
  len: number;
  pos: [number, number];
};

export type DiffsInfo = {
  diffsMap: Record<string, CodeItemInfo>;
  copyFile: boolean;
};
