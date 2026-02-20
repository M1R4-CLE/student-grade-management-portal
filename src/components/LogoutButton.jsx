"use client";

import { supabase } from "@/app/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace("/Login");
  };

  return (
    <button
      onClick={handleLogout}
      style={{
        padding: "8px 12px",
        borderRadius: 8,
        border: "1px solid #ccc",
        cursor: "pointer",
        background: "white",
      }}
    >
      Logout
    </button>
  );
}