import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Lock, Check, X as XIcon, Star } from "lucide-react";
import { getShiftDetailFn } from "@/lib/reports.functions";

export function ShiftDetailSheet({ shiftId, onClose }: { shiftId: string | null; onClose: () => void }) {
  const fetchFn = useServerFn(getShiftDetailFn);
  const q = useQuery({
    queryKey: ["report-shift", shiftId],
    queryFn: () => fetchFn({ data: { shiftId: shiftId! } }),
    enabled: !!shiftId,
    staleTime: 5 * 60_000, refetchOnWindowFocus: false,
  });
  const d = q.data;
  return (
    <Sheet open={!!shiftId} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader><SheetTitle>Détail du shift</SheetTitle></SheetHeader>
        {q.isLoading && <div className="py-8 text-sm text-[var(--muted-foreground)]">Chargement…</div>}
        {d && (
          <div className="space-y-4 pt-4">
            <div className="text-sm">
              <div className="font-medium">{d.profile?.firstName} {d.profile?.lastName}</div>
              <div className="text-xs text-[var(--muted-foreground)]">{d.shift.businessRole} · {d.shift.studioName} · {d.shift.date}</div>
            </div>

            <div className="rounded-lg border p-3 text-xs space-y-1" style={{ borderColor: "var(--border)" }}>
              <div className="font-medium text-sm mb-1">Pointages</div>
              <div>Entrée : {d.shift.clockedIn ? new Date(d.shift.clockedIn).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "—"}</div>
              <div>Sortie : {d.shift.clockedOut ? new Date(d.shift.clockedOut).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "—"}</div>
              <div>Retard : {d.shift.minutesLate > 0 ? `${d.shift.minutesLate} min` : "À l'heure"}</div>
            </div>

            {d.checklist.length > 0 && (
              <div>
                <div className="text-xs uppercase tracking-wider text-[var(--muted-foreground)] mb-2">Checklist</div>
                <div className="space-y-1">
                  {d.checklist.map((it) => (
                    <div key={it.id} className="flex items-center gap-2 text-sm py-1.5 border-b last:border-0" style={{ borderColor: "var(--border)" }}>
                      {it.checked ? <Check size={14} className="text-[var(--success-text)]" /> : <XIcon size={14} className="text-[var(--danger-text)]" />}
                      <span className="flex-1">{it.label}</span>
                      {it.photoUrl && <a href={it.photoUrl} target="_blank" className="text-xs text-[var(--coral)]">photo</a>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {d.photos.length > 0 && (
              <div>
                <div className="text-xs uppercase tracking-wider text-[var(--muted-foreground)] mb-2">Photos</div>
                <div className="grid grid-cols-3 gap-2">
                  {d.photos.map((p) => (
                    <div key={p.id} className="aspect-square rounded border overflow-hidden bg-[var(--muted)]" style={{ borderColor: "var(--border)" }}>
                      {p.url ? <a href={p.url} target="_blank"><img src={p.url} alt={p.label} className="w-full h-full object-cover" /></a> : null}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {d.closureResponses.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 text-xs mb-2 px-2 py-1.5 rounded" style={{ backgroundColor: "color-mix(in oklab, var(--coral) 12%, transparent)", color: "var(--coral)" }}>
                  <Lock size={12} /> Réponses confidentielles — admin/manager uniquement
                </div>
                <div className="space-y-2">
                  {d.closureResponses.map((r) => (
                    <div key={r.id} className="text-sm border-b py-2 last:border-0" style={{ borderColor: "var(--border)" }}>
                      <div className="text-xs text-[var(--muted-foreground)] mb-1">{r.text}</div>
                      {!r.answered ? <span className="text-xs text-[var(--muted-foreground)] italic">Non répondu</span>
                        : r.type === "stars_1_5" ? <div className="flex">{[1,2,3,4,5].map((n) => <Star key={n} size={14} fill={n <= (r.stars ?? 0) ? "var(--coral)" : "none"} stroke="var(--coral)" />)}</div>
                        : r.type === "yes_no" ? <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: r.yesno ? "var(--success-bg)" : "var(--danger-bg)" }}>{r.yesno ? "Oui" : "Non"}</span>
                        : <div className="text-sm">{r.free}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-lg border p-3 text-sm" style={{ borderColor: "var(--border)" }}>
              <div className="text-xs uppercase text-[var(--muted-foreground)] mb-1">Score gagné</div>
              <div className="text-xl font-medium">+{d.score.total}</div>
              <div className="text-xs text-[var(--muted-foreground)]">Ponctualité {d.score.ponctualite} · Checklist {d.score.checklist} · Photos {d.score.photos}</div>
            </div>

            <div className="rounded-lg border p-3 text-sm" style={{ borderColor: "var(--border)" }}>
              <div className="text-xs uppercase text-[var(--muted-foreground)] mb-1">Gains</div>
              <div className="text-xl font-medium">{d.earnings != null ? `${d.earnings} €` : "—"}</div>
              <div className="text-xs text-[var(--muted-foreground)]">{d.workedHours} h</div>
            </div>

            <div className="flex gap-2">
              {d.shift.userId && <Link to="/staff/$id" params={{ id: d.shift.userId }} className="text-sm text-[var(--coral)]">Voir l'employé →</Link>}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
