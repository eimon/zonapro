"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, type UserMe } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { ProfileCard } from "@/components/profile-card";
import { ChangePasswordForm } from "@/components/change-password-form";

export default function CuentaPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserMe | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    api.auth
      .me(token)
      .then(setUser)
      .catch(() => router.replace("/login"))
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-16">
        <p className="text-sm text-zinc-500">Cargando cuenta…</p>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="max-w-2xl mx-auto px-6 py-16">
      <ProfileCard user={user} />
      <ChangePasswordForm />
    </div>
  );
}
