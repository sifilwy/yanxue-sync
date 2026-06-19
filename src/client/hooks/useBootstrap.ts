import { useEffect, useState } from "react";
import type { BootstrapData } from "../../shared/types";
import { getBootstrap } from "../api";

export function useBootstrap() {
  const [data, setData] = useState<BootstrapData | null>(null);
  const [error, setError] = useState("");

  async function reload() {
    setError("");
    try {
      setData(await getBootstrap());
    } catch {
      setError("基础数据加载失败");
    }
  }

  useEffect(() => {
    reload();
  }, []);

  return { data, error, reload };
}
