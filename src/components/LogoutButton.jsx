"use client";

import { supabase } from "@/app/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/Login");
    router.refresh();
  };

  return (
    <button
      onClick={handleLogout}
      style={{
        padding: "6px 12px",
        backgroundColor: "#dc2626",
        color: "white",
        border: "none",
        borderRadius: "4px",
        cursor: "pointer"
      }}
    >
      Logout
    </button>
  );
}