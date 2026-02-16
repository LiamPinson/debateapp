"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/SessionContext";

export default function ProfileRedirect() {
  const router = useRouter();
  const { user, loading } = useSession();

  useEffect(() => {
    if (loading) return;
    if (user?.id) {
      router.replace(`/profile/${user.id}`);
    } else {
      router.replace("/");
    }
  }, [user, loading, router]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-10 h-10 border-4 border-arena-accent border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
