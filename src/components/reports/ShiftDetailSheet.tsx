import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Lock, Check, X as XIcon, Star, ShieldCheck, AlertTriangle, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { getShiftDetailFn } from "@/lib/reports.functions";
import { overrideRejectedPhotoFn } from "@/lib/closure-flow.functions";

export function ShiftDetailSheet({ shiftId, onClose }: { shiftId: string | null; onClose: () => void }) {
  const fetchFn = useServerFn(getShiftDetailFn);
  const overrideFn = useServerFn(overrideRejectedPhotoFn);
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["report-shift", shiftId],
    queryFn: () => fetchFn({ data: { shiftId: shiftId! } }),
    enabled: !!shiftId,
    staleTime: 5 * 60_000, refetchOnWindowFocus: false,
  });
  const d = q.data;

  const handleOverride = async (submissionPhotoId: string, label: string) => {
    const reason = window.prompt(
      `Valider manuellement la photo « ${label} » ?\n\nRaison (facultatif, ex : "il manquait vraiment du lait, rien à faire")`,
      ""
    );
    if (reason === null) return;
    try {
      await overrideFn({ data: { submissionPhotoId, reason: reason.trim() || null } });
      toast.success("Photo validée manuellement");
      qc.invalidateQueries({ queryKey: ["report-shift", shiftId] });
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur");
    }
  };

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
                    </div>
                  ))}
                </div>
              </div>
            )}

            {d.photos.length > 0 && (
              <div>
                <div className="text-xs uppercase tracking-wider text-[var(--muted-foreground)] mb-2">Photos & analyse IA</div>
                <div className="space-y-3">
                  {d.photos.map((p: any) => {
                    const isRejected = p.status === "rejected";
                    const isManual = !!p.overrideAt;
                    const isValidated = !isRejected && (p.status === "validated" || p.status == null) && p.url;
                    return (
                      <div key={p.id} className="rounded-lg border p-3" style={{ borderColor: "var(--border)" }}>
                        <div className="flex items-start gap-3">
                          {p.reference && (
                            <div className="flex-shrink-0">
                              <div className="text-[10px] uppercase text-[var(--muted-foreground)] mb-1">Réf.</div>
                              <a href={p.reference} target="_blank" rel="noreferrer">
                                <img src={p.reference} alt="référence" className="w-16 h-16 object-cover rounded border" style={{ borderColor: "var(--border)" }} />
                              </a>
                            </div>
                          )}
                          <div className="flex-shrink-0">
                            <div className="text-[10px] uppercase text-[var(--muted-foreground)] mb-1">Soumise</div>
                            {p.url ? (
                              <a href={p.url} target="_blank" rel="noreferrer">
                                <img src={p.url} alt={p.label} className="w-16 h-16 object-cover rounded border" style={{ borderColor: "var(--border)" }} />
                              </a>
                            ) : (
                              <div className="w-16 h-16 rounded border flex items-center justify-center bg-[var(--muted)]" style={{ borderColor: "var(--border)" }}>
                                <span className="text-[10px] text-[var(--muted-foreground)]">—</span>
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium">{p.label}</div>
                            <div className="mt-1">
                              {isManual ? (
                                <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full" style={{ backgroundColor: "var(--coral-light)", color: "var(--coral-text)" }}>
                                  <ShieldCheck size={11} /> Validée manuellement
                                </span>
                              ) : isRejected ? (
                                <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full" style={{ backgroundColor: "var(--danger-bg)", color: "var(--danger-text)" }}>
                                  <AlertTriangle size={11} /> Refusée par l'IA
                                </span>
                              ) : isValidated ? (
                                <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full" style={{ backgroundColor: "var(--success-bg)", color: "var(--success-text)" }}>
                                  <Sparkles size={11} /> Validée IA
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full" style={{ backgroundColor: "var(--muted)", color: "var(--muted-foreground)" }}>
                                  Non envoyée
                                </span>
                              )}
                            </div>
                            {p.reason && (
                              <div className="mt-1.5 text-[11px] text-[var(--muted-foreground)] leading-snug">{p.reason}</div>
                            )}
                            {isRejected && !isManual && p.submissionPhotoId && (
                              <button
                                onClick={() => handleOverride(p.submissionPhotoId, p.label)}
                                className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-md"
                                style={{ backgroundColor: "var(--coral)", color: "var(--coral-text)" }}
                              >
                                <ShieldCheck size={11} /> Valider manuellement
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
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
