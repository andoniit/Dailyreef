"use client";
import { useEffect, useState } from "react";

/** True once the client has mounted, so persisted state can be trusted. */
export function useHydrated(): boolean {
  const [ok, setOk] = useState(false);
  useEffect(() => setOk(true), []);
  return ok;
}
