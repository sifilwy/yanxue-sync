import { useEffect, useState } from "react";
import type { BootstrapData } from "../../shared/types";
import { getBootstrap } from "../api";

export function useBootstrap() {
  const [data, setData] = useState<BootstrapData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getBootstrap().then(setData).catch(() => setError("基础数据加载失败"));
  }, []);

  return { data, error };
}
