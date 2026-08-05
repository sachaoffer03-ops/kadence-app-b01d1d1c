import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Star, Check, Clock, Search, X } from "lucide-react";
import { RatingInput } from "@/components/RatingInput";
import { useAuth } from "@/hooks/use-auth";

interface ShiftRow {
  id: string; user_id: string | null; shift_date: string;
  start_time: string; end_time: string; business_role: string;
  studio_id: string | null; clocked_out_at: string | null;
}
interface ProfileLite { id: string; first_name: string; last_name: string; }

const fmtTime = (t: string) => (t || "").slice(0, 5);
const fmtDate = (d: string) =>
  new Date(d + "T00:00:00").toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });

/**
 * File d'attente « Shifts à noter » : tous les shifts terminés (pointés) des
 * 30 derniers jours qui n'ont encore reçu aucune note manager.
 */
export function ShiftsToRate({ onRated }: { onRated?: () => void }) {
  const { user } = useAuth();
  const [shifts, setShifts] = useState<ShiftRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileLite>>({});
  const [studios, setStudios] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [value, setValue] = useState(0);
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const from = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);
    const [{ data: sh }, { data: ps }, { data: sts }] = await Promise.all([
      supabase.from("shifts")
        .select("id,user_id,shift_date,start_time,end_time,business_role,studio_id,clocked_out_at")
        .gte("shift_date", from).lte("shift_date", today)
        .not("user_id", "is", null)
        .not("clocked_out_at", "is", null)
        .order("shift_date", { ascending: false }),
      supabase.from("profiles").select("id,first_name,last_name"),
      supabase.from("studios").select("id,name"),
    ]);
    const list = (sh || []) as ShiftRow[];
    const ids = list.map(s => s.id);
    let rated = new Set<string>();
    if (ids.length) {
      const { data: fb } = await supabase.from("feedbacks").select("shift_id,author_id").in("shift_id", ids);
      rated = new Set((fb || [])
        .filter(f => f.shift_id && f.author_id !== list.find(s => s.id === f.shift_id)?.user_id)
        .map(f => f.shift_id as string));
    }
    setShifts(list.filter(s => !rated.has(s.id)));
    setProfiles(Object.fromEntries((ps || []).map(p => [p.id, p as ProfileLite])));
    setStudios(Object.fromEntries((sts || []).map(s => [s.id, s.name])));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return shifts;
    return shifts.filter(s => {
      const p = s.user_id ? profiles[s.user_id] : null;
      const name = p ? `${p.first_name} ${p.last_name}`.toLowerCase() : "";
      return name.includes(q) || s.business_role.toLowerCase().includes(q);
    });
  }, [shifts, search, profiles]);

  const submit = async (s: ShiftRow) => {
    if (!user || value === 0) return;
    setSaving(true);
    const { error } = await supabase.from("feedbacks").insert({
      author_id: user.id, shift_id: s.id, rating: value, message: msg.trim() || null,
    });
    setSaving(false);
    if (error) { toast.error("Erreur lors de l'enregistrement"); return; }
    if (s.user_id && s.user_id !== user.id) {
      await supabase.from("notifications").insert({
        user_id: s.user_id,
        type: "feedback_received",
        title: "Nouveau feedback reçu",
        body: `Tu as reçu une note ${value / 2}/5 sur ton shift du ${fmtDate(s.shift_date)}.`,
        link: `/staff-app?tab=planning&shift=${s.id}`,
        priority: "normal",
        category: "general",
      });
    }
    toast.success("Note enregistrée");
    setShifts(prev => prev.filter(x => x.id !== s.id));
    setOpenId(null); setValue(0); setMsg("");
    onRated?.();
  };

  if (loading) {
    return <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Chargement…</div>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 rounded-lg border px-3 py-2" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
        <Search size={13} style={{ color: "var(--muted-foreground)" }} className="shrink-0" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un employé ou un poste…"
          className="outline-none bg-transparent flex-1" style={{ fontSize: 12 }} />
        {search && <button onClick={() => setSearch("")} style={{ color: "var(--muted-foreground)" }}><X size={13} /></button>}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border p-10 text-center" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
          <div className="mx-auto rounded-full flex items-center justify-center mb-3" style={{ width: 40, height: 40, backgroundColor: "var(--coral-light)" }}>
            <Check size={16} style={{ color: "var(--coral)" }} />
          </div>
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Tout est noté</div>
          <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Aucun shift terminé en attente de note sur les 30 derniers jours.</div>
        </div>
      ) : filtered.map(s => {
        const p = s.user_id ? profiles[s.user_id] : null;
        const initials = p ? `${p.first_name?.[0] || ""}${p.last_name?.[0] || ""}`.toUpperCase() : "—";
        const isOpen = openId === s.id;
        return (
          <div key={s.id} className="rounded-xl border p-4" style={{ backgroundColor: "var(--card)", borderColor: isOpen ? "var(--coral)" : "var(--border)" }}>
            <div className="flex items-center gap-3">
              <div className="rounded-full flex items-center justify-center shrink-0"
                style={{ width: 36, height: 36, backgroundColor: "var(--coral-light)", color: "var(--coral-text)", fontSize: 12, fontWeight: 500 }}>
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="truncate" style={{ fontSize: 13, fontWeight: 500 }}>
                  {p ? `${p.first_name} ${p.last_name}` : "—"}
                </div>
                <div className="truncate" style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                  <Clock size={10} className="inline mr-1" />
                  {fmtDate(s.shift_date)} · {fmtTime(s.start_time)}—{fmtTime(s.end_time)} · {s.business_role}
                  {s.studio_id && studios[s.studio_id] ? ` · ${studios[s.studio_id].replace("Skult ", "")}` : ""}
                </div>
              </div>
              {!isOpen && (
                <button onClick={() => { setOpenId(s.id); setValue(0); setMsg(""); }}
                  className="rounded-md px-3 py-1.5 inline-flex items-center gap-1.5 shrink-0"
                  style={{ fontSize: 12, fontWeight: 500, backgroundColor: "var(--coral)", color: "#fff" }}>
                  <Star size={12} /> Noter
                </button>
              )}
            </div>

            {isOpen && (
              <div className="mt-3 pt-3 flex flex-col gap-2" style={{ borderTop: "0.5px solid var(--border)" }}>
                <RatingInput value={value} onChange={setValue} size="md" />
                <textarea value={msg} onChange={e => setMsg(e.target.value)} rows={2} placeholder="Commentaire (optionnel)"
                  className="rounded-md border px-2 py-1.5 outline-none"
                  style={{ fontSize: 12, borderColor: "var(--border)", backgroundColor: "var(--background)" }} />
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setOpenId(null)} className="rounded-md px-3 py-1.5"
                    style={{ fontSize: 12, border: "0.5px solid var(--border)" }}>Annuler</button>
                  <button onClick={() => submit(s)} disabled={saving || value === 0} className="rounded-md px-3 py-1.5"
                    style={{ fontSize: 12, fontWeight: 500, backgroundColor: "var(--coral)", color: "#fff", opacity: saving || value === 0 ? 0.5 : 1 }}>
                    {saving ? "..." : "Enregistrer"}
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
