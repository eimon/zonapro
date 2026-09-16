"use client";

import { useEffect, useState } from "react";
import { api, type UserMe } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { ProfileCard } from "@/components/profile-card";
import { ChangePasswordForm } from "@/components/change-password-form";

export default function PerfilPage() {
  const [user, setUser] = useState<UserMe | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    api.auth
      .me(token)
      .then(setUser)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">Cargando perfil...</p>;
  }

  if (!user) return null;

  return (
    <div>
      <ProfileCard user={user} />
      <ChangePasswordForm />
    </div>
  );
}
