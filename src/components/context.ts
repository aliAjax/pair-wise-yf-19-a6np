import { createContext, useContext } from "react";
import { useAppData } from "../business/state";

export interface AppContextValue {
  data: ReturnType<typeof useAppData>["data"];
  dispatch: ReturnType<typeof useAppData>["dispatch"];
}

export const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("AppContext 缺少 Provider");
  return ctx;
}
