"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { removeToken } from "@/lib/auth";

export function useLogout() {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);

  function requestLogout() {
    setConfirmOpen(true);
  }

  function cancelLogout() {
    setConfirmOpen(false);
  }

  function confirmLogout() {
    removeToken();
    setConfirmOpen(false);
    router.push("/");
    router.refresh();
  }

  return { confirmOpen, requestLogout, cancelLogout, confirmLogout };
}
