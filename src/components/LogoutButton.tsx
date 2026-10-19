"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

export function LogoutButton({ className, children }: { className?: string; children: ReactNode }) {
  const router = useRouter();
  const logout = async () => {
    await fetch("/api/logout", { method: "POST" }).catch(() => null);
    router.replace("/login");
    router.refresh();
  };
  return (
    <button type="button" className={className} onClick={logout}>
      {children}
    </button>
  );
}
