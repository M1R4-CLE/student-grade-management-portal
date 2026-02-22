"use client";

import { useState } from "react";
import { supabase } from "@/app/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import LogoutConfirmModal from "./LogoutConfirmModal";

export default function LogoutButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const confirmLogout = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await supabase.auth.signOut();
      router.replace("/login");
    } finally {
      setBusy(false);
      setOpen(false);
    }
  };

  return (
    <>
      {/* icon only */}
      <button
        type="button"
        title="Logout"
        onClick={() => setOpen(true)}
        style={{
          width: 34,
          height: 34,
          borderRadius: 12,
          border: "1px solid rgba(0,0,0,.10)",
          background: "white",
          display: "grid",
          placeItems: "center",
          cursor: "pointer",
        }}
      >
        <LogOut size={18} />
      </button>

      {/* ONLY this modal */}
      <LogoutConfirmModal
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={confirmLogout}
      />
    </>
  );
}