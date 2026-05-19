import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { getEmployeeDetailFn } from "@/lib/reports.functions";
import { Sparkline } from "./Sparkline";

export function EmployeeDetailSheet({ userId, from, to, onClose }: {
  userId: string | null; from: string; to: string; onClose: () => void;
}) {
  const fetchFn = useServerFn(getEmployeeDetailFn);
  const q = useQuery({
    queryKey: ["report-employee", userId, from, to],
    queryFn: () => fetchFn({ data: { userId: userId!, from, to } }),
    enabled: !!userId,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
  const d = q.data;
  return (
    <Sheet open={!!userId} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader><SheetTitle>Détail employé</SheetTitle></SheetHeader>
        {q.isLoading && <div className="py-8 text-sm text-[var(--muted-foreground)]">Chargement…</div>}
        {d && (
          <div className="space-y-4 pt-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-[var(--muted)] flex items-center justify-center text-sm font-medium">
                {d.profile.firstName?.[0]}{d.profile.lastName?.[0]}
              </div>
              <div>
                <div className="text-base font-medium">{d.profile.firstName} {d.profile.lastName}</div>
                <div className="text-xs text-[var(--muted-foreground)]">{d.profile.roles.join(" · ") || "—"}</div>
              </div>
            </div>
            <div className="rounded-lg border p-3" style={{ borderColor: "var(--border)" }}>
              <div className="flex justify-between items-baseline mb-2">
                <span className="text-xs text-[var(--muted-foreground)] uppercase tracking-wider">Score 90j</span>
                <span className="text-xl font-medium">{d.profile.score.toFixed(2)}</span>
              </div>
              <Sparkline data={d.sparkline} height={40} />
            </div>
            <div className="space-y-2">
              {[
                { label: "Ponctualité", val: d.breakdown.punctuality },
                { label: "Note manager", val: d.breakdown.manager },
                { label: "Checklist", val: d.breakdown.checklist },
              ].map((r) => (
                <div key={r.label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span>{r.label}</span><span className="font-medium">{r.val.toFixed(1)}/10</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[var(--muted)] overflow-hidden">
                    <div className="h-full" style={{ width: `${(r.val / 10) * 100}%`, background: "var(--coral)" }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="rounded-lg border p-3" style={{ borderColor: "var(--border)" }}>
              <div className="text-xs text-[var(--muted-foreground)] uppercase tracking-wider mb-1">Gains période</div>
              <div className="text-xl font-medium">{d.earnings != null ? `${d.earnings} €` : "Tarif non renseigné"}</div>
              <div className="text-xs text-[var(--muted-foreground)]">{d.totalHours} h</div>
            </div>
            {d.studentQuota && (
              <div className="rounded-lg border p-3" style={{ borderColor: "var(--border)" }}>
                <div className="text-xs text-[var(--muted-foreground)] uppercase tracking-wider mb-1">Quota étudiant (semaine)</div>
                <div className="text-sm">{d.studentQuota.used} h / {d.studentQuota.max} h max</div>
                <div className="h-1.5 rounded-full bg-[var(--muted)] overflow-hidden mt-1">
                  <div className="h-full" style={{ width: `${Math.min(100, (d.studentQuota.used / d.studentQuota.max) * 100)}%`, background: d.studentQuota.used > d.studentQuota.max ? "var(--danger-text)" : "var(--success-text)" }} />
                </div>
              </div>
            )}
            <div>
              <div className="text-xs uppercase tracking-wider text-[var(--muted-foreground)] mb-2">Derniers shifts</div>
              <div className="space-y-1">
                {d.lastShifts.map((s) => (
                  <div key={s.id} className="flex items-center justify-between text-xs py-1.5 border-b last:border-0" style={{ borderColor: "var(--border)" }}>
                    <span>{s.date}</span>
                    <span className="text-[var(--muted-foreground)]">{s.studio} · {s.role}</span>
                    <span>{s.minutesLate > 0 ? `+${s.minutesLate}min` : "à l'heure"}</span>
                  </div>
                ))}
                {!d.lastShifts.length && <div className="text-xs text-[var(--muted-foreground)]">Aucun shift</div>}
              </div>
            </div>
            <Link to="/staff/$id" params={{ id: d.profile.id }} className="block text-sm text-[var(--coral)]">Voir profil complet →</Link>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
