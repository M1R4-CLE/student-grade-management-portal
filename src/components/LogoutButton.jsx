"use client";

import { supabase } from "@/app/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  return (
    <button className="ghost" onClick={handleLogout}>
      Logout
    </button>
  );
}