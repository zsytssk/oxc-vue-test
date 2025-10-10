import { getFileVariables } from "./parseUtils.save";

const file =
  "/home/zsy/Documents/zsy/job/tpm/web/src/plugin/tpm/view/device/hooks/useCreateOrderByDevice.ts";

async function main() {
  const vals = await getFileVariables(file);
  console.log(vals);
}

main();
