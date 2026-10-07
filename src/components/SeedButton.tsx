"use client";

import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

export function SeedButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function seed() {
    setLoading(true);
    setMsg(null);
    try {
      const r = await fetch("/api/seed", { method: "POST" });
      const j = await r.json();
      setMsg(`Seeded ${j.agents} agents · ${j.workflows} workflows`);
      router.refresh();
    } catch (e) {
      setMsg(`Failed: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button onClick={seed} disabled={loading} className="btn-primary">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {loading ? "Seeding…" : "Seed agents & workflows"}
      </button>
      {msg && <span className="text-xs text-text-secondary">{msg}</span>}
    </div>
  );
}
