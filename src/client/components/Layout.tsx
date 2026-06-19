import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";

export function Shell({ children, narrow = false }: { children: ReactNode; narrow?: boolean }) {
  return <main className={narrow ? "app app-narrow" : "app"}>{children}</main>;
}

export function Loading() {
  return (
    <Shell>
      <div className="loading"><Loader2 className="spin" />加载中...</div>
    </Shell>
  );
}
