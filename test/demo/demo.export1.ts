import { util1 as util1_1, util2 } from "./utils";
import { useState } from "react";
import axios from "axios";

export { util1 as util1_1 } from "./utils";

export function MyComponent() {
  const [data, setData] = useState(null);

  const fetchData = async () => {
    const result = await axios.get("/api/data");
    setData(result.data);
  };

  const handleClick = () => {
    console.log("Clicked");
    fetchData();
  };

  return { handleClick };
}

export const a = axios.get;
let b;
export class A {
  constructor() {}
  abc() {
    const test = 1;
    return a;
  }
}
class B {}

type TypeA = {
  a: string;
  b: number;
};

export default a;
// export default function Test() {}
export { B, B as B1 };
