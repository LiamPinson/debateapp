"use client";

import { SessionProvider } from "@/lib/SessionContext";
import { ToastProvider } from "./components/Toast";

export function Providers({ children }) {
  return (
    <SessionProvider>
      <ToastProvider>{children}</ToastProvider>
    </SessionProvider>
  );
}
