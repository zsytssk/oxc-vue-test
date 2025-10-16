export const code1 = `
export { default } from "./utils";
`;
export const code2 = `
import def from "./utils";
export default def;
`;
export const code3 = `
export { util1 } from "./utils";
export { util1 as default } from "./utils";
`;
