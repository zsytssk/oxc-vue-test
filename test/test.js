import { util1 as util1_1, util2 } from "./utils";
import { useState } from "react";
import axios from "axios";

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
let b = function () {
  console.log("Clicked");
  fetchData();
};
export class A {
  constructor() {}
  abc() {
    return a;
  }
}
class B {}
const c = {
  a,
  b,
  d: () => {
    return a;
  },
};
