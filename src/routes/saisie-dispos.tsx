// =============================================================================
// /saisie-dispos — page admin pour gérer les fenêtres de saisie de dispos.
// =============================================================================
import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import {
  listWindows,
  createWindow,
  openWindow,
  closeWindow,
  reopenWindow,
  deleteWindow,
  getWindowParticipants,
} from "@/lib/availability-windows.functions";

export const Route = createFileRoute("/saisie-dispos")({
  component: SaisieDisposPage,
  head: () => ({ meta: [{ title: "Saisie des dispos — Kadence" }] }),
});

interface Windo {
  id: string;
  title: string;
  period_start: string;
  period_end: string;
  deadline_at: string;
  status: "draft" | "open" | "closed";
  target_user_ids: string[] | null;
  closed_at: string | null;
  created_at: string;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}
function fmtDay(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("fr-FR", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function statusBadge(s: Windo["status"]) {
  if (s === "open") return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Ouverte</Badge>;
  if (s === "closed") return <Badge variant="secondary">Clôturée</Badge>;
  return <Badge variant="outline">Brouillon</Badge>;
}

function SaisieDisposPage() {
  const router = useRouter();
  const list = useServerFn(listWindows);
  const create = useServerFn(createWindow);
  const open = useServerFn(openWindow);
  const close = useServerFn(closeWindow);
  const reopen = useServerFn(reopenWindow);
  const del = useServerFn(deleteWindow);
  const getParts = useServerFn(getWindowParticipants);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["availability_windows"],
    queryFn: () => list(),
  });
  const windows: Windo[] = (data?.windows ?? []) as Windo[];

  const [showCreate, setShowCreate] = React.useState(false);
  const [partsOpen, setPartsOpen] = React.useState<string | null>(null);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-medium" style={{ fontFamily: "Inter" }}>
            Saisie des dispos
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Ouvre une fenêtre pendant laquelle les employés peuvent saisir
            leurs dispos. La fenêtre se ferme automatiquement à la deadline.
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>+ Nouvelle fenêtre</Button>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Chargement…</p>}

      <div className="space-y-3">
        {windows.length === 0 && !isLoading && (
          <Card className="p-8 text-center text-muted-foreground">
            Aucune fenêtre pour le moment.
          </Card>
        )}
        {windows.map((w) => {
          const deadlineMs = new Date(w.deadline_at).getTime();
          const past = deadlineMs <= Date.now();
          return (
            <Card key={w.id} className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {statusBadge(w.status)}
                    <h3 className="font-medium truncate">{w.title}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Période : <strong>{fmtDay(w.period_start)}</strong> → <strong>{fmtDay(w.period_end)}</strong>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Clôture : <strong>{fmtDate(w.deadline_at)}</strong>
                    {past && w.status === "open" && (
                      <span className="ml-2 text-amber-600">(passée — sera fermée au prochain tick)</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Cibles : {w.target_user_ids?.length ? `${w.target_user_ids.length} employé·e·s` : "tous les actifs"}
                  </p>
                </div>
                <div className="flex flex-col gap-2 shrink-0">
                  {w.status === "draft" && (
                    <>
                      <Button size="sm" onClick={async () => {
                        try { await open({ data: { id: w.id } }); toast.success("Fenêtre ouverte — notifs envoyées"); refetch(); }
                        catch (e: any) { toast.error(e.message); }
                      }}>Ouvrir</Button>
                      <Button size="sm" variant="outline" onClick={async () => {
                        if (!confirm("Supprimer cette fenêtre ?")) return;
                        try { await del({ data: { id: w.id } }); toast.success("Supprimée"); refetch(); }
                        catch (e: any) { toast.error(e.message); }
                      }}>Supprimer</Button>
                    </>
                  )}
                  {w.status === "open" && (
                    <Button size="sm" variant="outline" onClick={async () => {
                      if (!confirm("Clôturer maintenant ?")) return;
                      try { await close({ data: { id: w.id } }); toast.success("Clôturée"); refetch(); }
                      catch (e: any) { toast.error(e.message); }
                    }}>Clôturer maintenant</Button>
                  )}
                  {w.status === "closed" && (
                    <Button size="sm" onClick={async () => {
                      const input = prompt("Nouvelle deadline (YYYY-MM-DD HH:MM)", "");
                      if (!input) return;
                      const iso = new Date(input.replace(" ", "T")).toISOString();
                      try { await reopen({ data: { id: w.id, deadline_at: iso } }); toast.success("Fenêtre rouverte"); refetch(); }
                      catch (e: any) { toast.error(e.message); }
                    }}>Rouvrir</Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => setPartsOpen(w.id)}>Voir détails</Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <CreateWindowDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        onCreated={() => refetch()}
        createFn={create}
      />

      <ParticipantsDialog
        windowId={partsOpen}
        onClose={() => setPartsOpen(null)}
        getParts={getParts}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Création
// ---------------------------------------------------------------------------
function CreateWindowDialog({
  open,
  onOpenChange,
  onCreated,
  createFn,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  onCreated: () => void;
  createFn: any;
}) {
  const [title, setTitle] = React.useState("");
  const [periodStart, setPeriodStart] = React.useState("");
  const [periodEnd, setPeriodEnd] = React.useState("");
  const [deadlineDate, setDeadlineDate] = React.useState("");
  const [deadlineTime, setDeadlineTime] = React.useState("23:59");
  const [staff, setStaff] = React.useState<Array<{ id: string; first_name: string; last_name: string }>>([]);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [allTargets, setAllTargets] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    // Pré-remplir : mois prochain
    const d = new Date();
    const m1 = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 2, 0).getDate();
    const m1End = new Date(d.getFullYear(), d.getMonth() + 1, lastDay);
    const iso = (x: Date) =>
      `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
    setPeriodStart(iso(m1));
    setPeriodEnd(iso(m1End));
    setTitle(`Dispos pour ${m1.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}`);
    const deadline = new Date(d.getFullYear(), d.getMonth(), Math.min(20, lastDay));
    setDeadlineDate(iso(deadline));
    setDeadlineTime("23:59");
    setAllTargets(true);
    setSelectedIds(new Set());
    supabase
      .from("profiles")
      .select("id, first_name, last_name")
      .eq("status", "active")
      .order("first_name")
      .then(({ data }) => setStaff((data ?? []) as any));
  }, [open]);

  async function handleCreate() {
    if (!title || !periodStart || !periodEnd || !deadlineDate || !deadlineTime) {
      toast.error("Remplis tous les champs");
      return;
    }
    const deadlineIso = new Date(`${deadlineDate}T${deadlineTime}:00`).toISOString();
    setSubmitting(true);
    try {
      await createFn({
        data: {
          title,
          period_start: periodStart,
          period_end: periodEnd,
          deadline_at: deadlineIso,
          target_user_ids: allTargets ? null : Array.from(selectedIds),
        },
      });
      toast.success("Fenêtre créée (brouillon). Clique sur « Ouvrir » pour notifier.");
      onCreated();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nouvelle fenêtre de saisie</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Titre</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Période — début</Label>
              <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
            </div>
            <div>
              <Label>Période — fin</Label>
              <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Deadline — date</Label>
              <Input type="date" value={deadlineDate} onChange={(e) => setDeadlineDate(e.target.value)} />
            </div>
            <div>
              <Label>Deadline — heure</Label>
              <Input type="time" value={deadlineTime} onChange={(e) => setDeadlineTime(e.target.value)} />
            </div>
          </div>
          <div>
            <Label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={allTargets}
                onChange={(e) => setAllTargets(e.target.checked)}
              />
              Tous les employés actifs
            </Label>
            {!allTargets && (
              <div className="mt-2 border rounded p-2 max-h-48 overflow-y-auto">
                {staff.map((s) => (
                  <label key={s.id} className="flex items-center gap-2 py-1 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(s.id)}
                      onChange={(e) => {
                        const next = new Set(selectedIds);
                        if (e.target.checked) next.add(s.id); else next.delete(s.id);
                        setSelectedIds(next);
                      }}
                    />
                    {s.first_name} {s.last_name}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={handleCreate} disabled={submitting}>
            {submitting ? "…" : "Créer le brouillon"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Détails participants
// ---------------------------------------------------------------------------
function ParticipantsDialog({
  windowId,
  onClose,
  getParts,
}: {
  windowId: string | null;
  onClose: () => void;
  getParts: any;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["window_participants", windowId],
    queryFn: () => getParts({ data: { id: windowId! } }),
    enabled: !!windowId,
  });
  const parts = (data?.participants ?? []) as Array<{
    user_id: string; first_name: string | null; last_name: string | null;
    email: string | null; avail_count: number; status: "rempli" | "partial" | "vide";
  }>;
  return (
    <Dialog open={!!windowId} onOpenChange={(b) => !b && onClose()}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>État du remplissage</DialogTitle>
        </DialogHeader>
        {isLoading && <p className="text-sm text-muted-foreground">Chargement…</p>}
        {!isLoading && (
          <div className="space-y-1">
            {parts.length === 0 && <p className="text-sm text-muted-foreground">Aucun participant.</p>}
            {parts.map((p) => (
              <div key={p.user_id} className="flex items-center justify-between text-sm py-1.5 border-b last:border-0">
                <span>{p.first_name} {p.last_name}</span>
                <span className="flex items-center gap-2">
                  <span className="text-muted-foreground">{p.avail_count} dispos</span>
                  {p.status === "rempli" && <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Rempli</Badge>}
                  {p.status === "partial" && <Badge className="bg-amber-100 text-amber-700 border-amber-200">Partiel</Badge>}
                  {p.status === "vide" && <Badge variant="outline">Vide</Badge>}
                </span>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
