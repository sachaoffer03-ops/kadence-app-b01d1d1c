import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Clock, Check, Calendar as CalendarIcon, Search, X, Users, AlertTriangle, Ban,
  MoreVertical, LogIn, LogOut, Edit3, FileText, History, Undo2, Loader2,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useStudios } from "@/hooks/use-studios";
import { getRoleStyle, hhmm, initials } from "@/lib/staff-helpers";
import {
  getPointageTodayFn, manualClockInFn, manualClockOutFn, editMinutesLateFn,
  markNoShowFn, undoNoShowFn, setAdminNoteFn, getShiftAuditHistoryFn, editClockTimesFn,
  checkPointageAlertsFn, type PointageShift, type PointageTodayResult, type AuditEntry,
} from "@/lib/pointage.functions";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { formatBrusselsTime } from "@/lib/brussels-time";


export const Route = createFileRoute("/pointage")({
  component: PointagePage,
  head: () => ({ meta: [{ title: "Pointage — Kadence" }] }),
});

type StatusFilter = "all" | "upcoming" | "in_progress" | "late" | "completed" | "no_show";

const STATUS_META: Record<PointageShift["computed_status"], { label: string; dot: string; bg: string; text: string }> = {
  upcoming:    { label: "À venir",   dot: "#9CA3AF", bg: "color-mix(in oklab, #9CA3AF 14%, white)", text: "#374151" },
  in_progress: { label: "Pointé",    dot: "#10B981", bg: "color-mix(in oklab, #10B981 14%, white)", text: "#065F46" },
  late_no_in:  { label: "En retard", dot: "#F59E0B", bg: "color-mix(in oklab, #F59E0B 16%, white)", text: "#92400E" },
  late_in:     { label: "En retard", dot: "#F59E0B", bg: "color-mix(in oklab, #F59E0B 16%, white)", text: "#92400E" },
  completed:   { label: "Terminé",   dot: "#3B82F6", bg: "color-mix(in oklab, #3B82F6 14%, white)", text: "#1E40AF" },
  no_show:     { label: "No-show",   dot: "#EF4444", bg: "color-mix(in oklab, #EF4444 14%, white)", text: "#991B1B" },
};

function fmtTimeIso(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }).replace(":", "h");
}
function fmtMinutes(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}
function nowHHMM(): string {
  return formatBrusselsTime(new Date());
}

function PointagePage() {
  const [tab, setTab] = useState<"today" | "week" | "history">("today");

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 500, marginBottom: 2 }}>Pointage</h1>
          <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Vue temps réel des shifts du jour</p>
        </div>
        <LiveIndicator />
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="w-full">
        <TabsList className="mb-5">
          <TabsTrigger value="today">Aujourd'hui</TabsTrigger>
          <TabsTrigger value="week">Semaine</TabsTrigger>
          <TabsTrigger value="history">Historique</TabsTrigger>
        </TabsList>
        <TabsContent value="today" className="mt-0"><TodayTab /></TabsContent>
        <TabsContent value="week" className="mt-0"><StubTab label="Vue semaine à venir." /></TabsContent>
        <TabsContent value="history" className="mt-0"><StubTab label="Historique de pointage à venir." /></TabsContent>
      </Tabs>
    </div>
  );
}

function LiveIndicator() {
  return (
    <div className="flex items-center gap-1.5 rounded-full px-2.5 py-1" style={{ border: "0.5px solid var(--border)", backgroundColor: "var(--card)" }}>
      <span style={{
        width: 8, height: 8, borderRadius: 999, backgroundColor: "#10B981",
        boxShadow: "0 0 0 0 #10B981", animation: "kdc-pulse 1.8s infinite",
      }} />
      <span style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)" }}>Live</span>
      <style>{`@keyframes kdc-pulse{0%{box-shadow:0 0 0 0 rgba(16,185,129,.5)}70%{box-shadow:0 0 0 8px rgba(16,185,129,0)}100%{box-shadow:0 0 0 0 rgba(16,185,129,0)}}`}</style>
    </div>
  );
}

function StubTab({ label }: { label: string }) {
  return (
    <div className="rounded-xl border p-10 text-center" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)", fontSize: 13, color: "var(--muted-foreground)" }}>
      {label}
    </div>
  );
}

// ============================================================
// TODAY TAB
// ============================================================

function todayIsoLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function isoFromDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function dateFromIso(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}
function shiftIso(iso: string, deltaDays: number): string {
  const d = dateFromIso(iso);
  d.setDate(d.getDate() + deltaDays);
  return isoFromDate(d);
}
function formatLongDate(iso: string): string {
  const d = dateFromIso(iso);
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

function TodayTab() {
  const getToday = useServerFn(getPointageTodayFn);
  const checkAlerts = useServerFn(checkPointageAlertsFn);
  const { studios } = useStudios();
  const [data, setData] = useState<PointageTodayResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [studioFilter, setStudioFilter] = useState<string>("all");
  const [selectedDate, setSelectedDate] = useState<string>(() => todayIsoLocal());
  const [calOpen, setCalOpen] = useState(false);

  const isToday = selectedDate === todayIsoLocal();

  const reload = useCallback(async () => {
    try {
      const payload: { studioIds?: string[]; date?: string } = {};
      if (studioFilter !== "all") payload.studioIds = [studioFilter];
      if (!isToday) payload.date = selectedDate;
      const res = await getToday({ data: payload });
      setData(res);
    } catch (e: any) {
      toast.error(e?.message || "Impossible de charger le pointage");
    } finally {
      setLoading(false);
    }
  }, [getToday, studioFilter, selectedDate, isToday]);

  useEffect(() => { setLoading(true); reload(); }, [reload]);

  // Realtime (only useful for today)
  useEffect(() => {
    if (!isToday) return;
    const ch = supabase
      .channel("pointage-rt-v2")
      .on("postgres_changes", { event: "*", schema: "public", table: "shifts" }, () => reload())
      .on("postgres_changes", { event: "*", schema: "public", table: "shift_clock_audit" }, () => reload())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [reload, isToday]);

  // 30s polling backup (today only)
  useEffect(() => {
    if (!isToday) return;
    const t = window.setInterval(() => reload(), 30_000);
    return () => window.clearInterval(t);
  }, [reload, isToday]);

  // Alerts check on mount (idempotent)
  useEffect(() => {
    checkAlerts().catch(() => { /* silent */ });
  }, [checkAlerts]);


  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.shifts ?? []).filter((s) => {
      if (statusFilter === "late" && !(s.computed_status === "late_no_in" || s.computed_status === "late_in")) return false;
      if (statusFilter !== "all" && statusFilter !== "late" && s.computed_status !== statusFilter) return false;
      if (q && !(s.user_name || "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [data, search, statusFilter]);

  return (
    <div className="flex flex-col gap-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Présents aujourd'hui"
          value={data?.kpis.present_count ?? 0}
          hint={`/ ${data?.kpis.expected_count ?? 0} attendus`}
          tone="success"
          icon={<Users size={14} />}
          loading={loading}
        />
        <KpiCard
          label="En retard"
          value={data?.kpis.late_count ?? 0}
          hint={`cumulé du jour`}
          tone={(data?.kpis.late_count ?? 0) > 0 ? "warning" : "neutral"}
          icon={<AlertTriangle size={14} />}
          loading={loading}
        />
        <KpiCard
          label="No-show"
          value={data?.kpis.no_show_count ?? 0}
          hint=""
          tone={(data?.kpis.no_show_count ?? 0) > 0 ? "danger" : "neutral"}
          icon={<Ban size={14} />}
          loading={loading}
        />
        <KpiCard
          label="Heures cumulées équipe"
          value={fmtMinutes(data?.kpis.worked_minutes ?? 0)}
          hint={`${fmtMinutes(data?.kpis.planned_minutes ?? 0)} prévues`}
          delta={
            data
              ? (() => {
                  const diff = (data.kpis.worked_minutes ?? 0) - (data.kpis.planned_minutes ?? 0);
                  if (Math.abs(diff) < 5) return null;
                  return diff < 0 ? `${fmtMinutes(-diff)} vs prévu` : `+${fmtMinutes(diff)} vs prévu`;
                })()
              : null
          }
          tone="neutral"
          icon={<Clock size={14} />}
          loading={loading}
        />
      </div>

      {/* Date picker (planning-style) */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center rounded-md" style={{ border: "0.5px solid var(--border)" }}>
          <button onClick={() => setSelectedDate((d) => shiftIso(d, -1))} className="p-1.5" style={{ color: "var(--muted-foreground)" }} aria-label="Jour précédent">
            <ChevronLeft size={14} />
          </button>
          <Popover open={calOpen} onOpenChange={setCalOpen}>
            <PopoverTrigger asChild>
              <button className="px-3 py-1.5 hover:bg-[var(--muted)] transition-colors capitalize" style={{ fontSize: 12, fontWeight: 500, borderLeft: "0.5px solid var(--border)", borderRight: "0.5px solid var(--border)", minWidth: 200 }}>
                {isToday ? "Aujourd'hui · " : ""}{formatLongDate(selectedDate)}
              </button>
            </PopoverTrigger>
            <PopoverContent align="center" className="w-auto p-2 pointer-events-auto">
              <div className="flex items-center justify-between px-2 pb-2 gap-2">
                <span style={{ fontSize: 12, fontWeight: 500, color: "var(--muted-foreground)" }}>Choisir une date</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => { setSelectedDate(shiftIso(todayIsoLocal(), -1)); setCalOpen(false); }}
                    className="rounded-md px-2 py-1"
                    style={{ fontSize: 11, fontWeight: 500, backgroundColor: "var(--muted)", color: "var(--foreground)" }}
                  >
                    Hier
                  </button>
                  <button
                    onClick={() => { setSelectedDate(todayIsoLocal()); setCalOpen(false); }}
                    className="rounded-md px-2 py-1"
                    style={{ fontSize: 11, fontWeight: 500, backgroundColor: "var(--coral)", color: "#fff" }}
                  >
                    Aujourd'hui
                  </button>
                </div>
              </div>
              <Calendar
                mode="single"
                weekStartsOn={1}
                selected={dateFromIso(selectedDate)}
                defaultMonth={dateFromIso(selectedDate)}
                onSelect={(d) => { if (d) { setSelectedDate(isoFromDate(d)); setCalOpen(false); } }}
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
          <button onClick={() => setSelectedDate((d) => shiftIso(d, 1))} className="p-1.5" style={{ color: "var(--muted-foreground)" }} aria-label="Jour suivant">
            <ChevronRight size={14} />
          </button>
        </div>
        {!isToday && (
          <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
            Vue historique — temps réel désactivé
          </span>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 rounded-md px-2.5 py-1.5" style={{ border: "0.5px solid var(--border)", backgroundColor: "var(--card)" }}>
          <Search size={13} style={{ color: "var(--muted-foreground)" }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un employé…"
            style={{ fontSize: 12, background: "transparent", outline: "none", border: "none", width: 200 }}
          />
          {search && <X size={12} style={{ cursor: "pointer" }} onClick={() => setSearch("")} />}
        </div>

        <Chips
          value={statusFilter}
          onChange={(v) => setStatusFilter(v as StatusFilter)}
          options={[
            { value: "all", label: "Tous" },
            { value: "upcoming", label: "À venir" },
            { value: "in_progress", label: "En cours" },
            { value: "late", label: "En retard" },
            { value: "completed", label: "Terminé" },
            { value: "no_show", label: "No-show" },
          ]}
        />

        <div className="md:ml-auto w-full md:w-auto">
          <Select value={studioFilter} onValueChange={setStudioFilter}>
            <SelectTrigger className="w-full md:w-[180px] h-8"><SelectValue placeholder="Studio" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les studios</SelectItem>
              {studios.map((s) => <SelectItem key={s.id} value={s.id}>{s.short_name || s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* List */}
      {loading && !data ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2, 3].map((i) => <SkeletonRow key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border p-10 text-center" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)", fontSize: 13, color: "var(--muted-foreground)" }}>
          {isToday ? "Aucun shift correspondant aujourd'hui." : "Aucun shift pour cette date."}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((s) => <ShiftRow key={s.id} shift={s} onChanged={reload} />)}
        </div>
      )}
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="rounded-xl border p-4" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
      <div className="flex items-center gap-3">
        <div style={{ width: 32, height: 32, borderRadius: 999, backgroundColor: "var(--muted)" }} />
        <div className="flex-1">
          <div style={{ width: 140, height: 12, backgroundColor: "var(--muted)", borderRadius: 4, marginBottom: 6 }} />
          <div style={{ width: 220, height: 10, backgroundColor: "var(--muted)", borderRadius: 4 }} />
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, hint, delta, tone, icon, loading }: {
  label: string; value: number | string; hint?: string; delta?: string | null;
  tone: "success" | "warning" | "danger" | "neutral"; icon: React.ReactNode; loading?: boolean;
}) {
  const color =
    tone === "success" ? "#10B981" :
    tone === "warning" ? "#F59E0B" :
    tone === "danger" ? "#EF4444" : "var(--muted-foreground)";
  return (
    <div className="rounded-xl border p-4" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
      <div className="flex items-center gap-1.5 mb-2" style={{ color }}>
        {icon}
        <span style={{ fontSize: 10, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
      </div>
      <div style={{ fontSize: 24, fontWeight: 500, color: tone === "neutral" ? "var(--foreground)" : color, lineHeight: 1 }}>
        {loading ? "…" : value}
      </div>
      <div className="mt-1.5 flex items-center gap-2" style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
        {hint && <span>{hint}</span>}
        {delta && <span style={{ color: delta.startsWith("+") ? "#10B981" : "#F59E0B", fontWeight: 500 }}>{delta}</span>}
      </div>
    </div>
  );
}

function Chips({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {options.map((o) => {
        const a = value === o.value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className="rounded-full px-2.5 py-1"
            style={{
              fontSize: 11, fontWeight: a ? 500 : 400,
              backgroundColor: a ? "var(--foreground)" : "transparent",
              color: a ? "var(--card)" : "var(--muted-foreground)",
              border: a ? "none" : "0.5px solid var(--border)",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ============================================================
// SHIFT ROW
// ============================================================

type DialogKind = null | "clock_in" | "clock_out" | "edit_late" | "edit_times" | "no_show" | "note" | "history";

function ShiftRow({ shift, onChanged }: { shift: PointageShift; onChanged: () => void }) {
  const meta = STATUS_META[shift.computed_status];
  const rs = getRoleStyle(shift.business_role);
  const [dialog, setDialog] = useState<DialogKind>(null);

  const realTimes = (() => {
    if (!shift.clocked_in_at) return "—";
    const inT = fmtTimeIso(shift.clocked_in_at);
    if (shift.clocked_out_at) return `${inT} → ${fmtTimeIso(shift.clocked_out_at)}`;
    return `${inT} → en cours`;
  })();

  const studio = (shift.studio_short || shift.studio_name || "—").replace(/^Skult\s+/i, "");
  const lateBadge = (shift.minutes_late ?? 0) > 0 ? `+${shift.minutes_late} min` : null;

  return (
    <>
      <div
        className="rounded-xl border p-3 md:p-4 flex items-center gap-3"
        style={{ backgroundColor: "var(--card)", borderColor: "var(--border)", borderLeft: `3px solid ${meta.dot}` }}
      >
        {/* Avatar */}
        <div
          className="hidden sm:flex items-center justify-center shrink-0"
          style={{
            width: 36, height: 36, borderRadius: 999,
            backgroundColor: shift.user_avatar ? "transparent" : "var(--muted)",
            backgroundImage: shift.user_avatar ? `url(${shift.user_avatar})` : "none",
            backgroundSize: "cover", fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)",
          }}
        >
          {!shift.user_avatar && initials(shift.user_name?.split(" ")[0], shift.user_name?.split(" ")[1])}
        </div>

        {/* Identity */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span style={{ fontSize: 13, fontWeight: 500 }}>{shift.user_name || "Non assigné"}</span>
            <span className="rounded-full px-1.5 py-0.5" style={{ fontSize: 10, backgroundColor: rs.bg, color: rs.text }}>{shift.business_role}</span>
            <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>·</span>
            <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{studio}</span>
          </div>
          <div className="mt-0.5 flex items-center gap-3 flex-wrap" style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
            <span>Prévu : <span style={{ color: "var(--foreground)", fontFamily: "monospace" }}>{hhmm(shift.start_time)} — {hhmm(shift.end_time)}</span></span>
            <span>Réel : <span style={{ color: "var(--foreground)", fontFamily: "monospace" }}>{realTimes}</span></span>
            {lateBadge && <span style={{ color: "#F59E0B", fontWeight: 500 }}>{lateBadge}</span>}
            {shift.clock_admin_note && <span title={shift.clock_admin_note} className="flex items-center gap-1"><FileText size={11} /> note</span>}
          </div>
        </div>

        {/* Status pill */}
        <span className="rounded-full px-2 py-0.5 shrink-0" style={{ fontSize: 10, fontWeight: 500, backgroundColor: meta.bg, color: meta.text }}>
          {meta.label}
        </span>

        {/* Actions */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="rounded-md p-1.5 shrink-0" style={{ border: "0.5px solid var(--border)" }} aria-label="Actions">
              <MoreVertical size={14} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {!shift.clocked_in_at && shift.user_id && (
              <DropdownMenuItem onClick={() => setDialog("clock_in")} className="gap-2">
                <LogIn size={14} /> Pointer arrivée
              </DropdownMenuItem>
            )}
            {shift.clocked_in_at && !shift.clocked_out_at && (
              <DropdownMenuItem onClick={() => setDialog("clock_out")} className="gap-2">
                <LogOut size={14} /> Pointer sortie
              </DropdownMenuItem>
            )}
            {shift.clocked_in_at && (
              <DropdownMenuItem onClick={() => setDialog("edit_late")} className="gap-2">
                <Edit3 size={14} /> Corriger minutes de retard
              </DropdownMenuItem>
            )}
            {(shift.clocked_in_at || shift.clocked_out_at) && (
              <DropdownMenuItem onClick={() => setDialog("edit_times")} className="gap-2">
                <Clock size={14} /> Modifier les pointages
              </DropdownMenuItem>
            )}
            {shift.status !== "cancelled" && !shift.clocked_in_at && (
              <DropdownMenuItem onClick={() => setDialog("no_show")} className="gap-2" style={{ color: "#991B1B" }}>
                <Ban size={14} /> Marquer no-show
              </DropdownMenuItem>
            )}
            {shift.status === "cancelled" && (
              <DropdownMenuItem onClick={async () => { try { await undoNoShowFn({ data: { shiftId: shift.id } } as any); toast.success("No-show annulé"); onChanged(); } catch (e: any) { toast.error(e?.message); } }} className="gap-2">
                <Undo2 size={14} /> Annuler no-show
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setDialog("note")} className="gap-2">
              <FileText size={14} /> {shift.clock_admin_note ? "Éditer note" : "Ajouter note"}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setDialog("history")} className="gap-2">
              <History size={14} /> Historique
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {dialog && (
        <ActionDialog
          kind={dialog}
          shift={shift}
          onClose={() => setDialog(null)}
          onDone={() => { setDialog(null); onChanged(); }}
        />
      )}
    </>
  );
}

// ============================================================
// DIALOGS
// ============================================================

function ActionDialog({ kind, shift, onClose, onDone }: { kind: Exclude<DialogKind, null>; shift: PointageShift; onClose: () => void; onDone: () => void }) {
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        {kind === "clock_in" && <ClockDialog shift={shift} mode="in" onDone={onDone} />}
        {kind === "clock_out" && <ClockDialog shift={shift} mode="out" onDone={onDone} />}
        {kind === "edit_late" && <EditLateDialog shift={shift} onDone={onDone} />}
        {kind === "edit_times" && <EditTimesDialog shift={shift} onDone={onDone} />}
        {kind === "no_show" && <NoShowDialog shift={shift} onDone={onDone} />}
        {kind === "note" && <NoteDialog shift={shift} onDone={onDone} />}
        {kind === "history" && <HistoryDialog shift={shift} />}
      </DialogContent>
    </Dialog>
  );
}

function ClockDialog({ shift, mode, onDone }: { shift: PointageShift; mode: "in" | "out"; onDone: () => void }) {
  const [time, setTime] = useState(nowHHMM());
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const clockIn = useServerFn(manualClockInFn);
  const clockOut = useServerFn(manualClockOutFn);
  const submit = async () => {
    if (!reason.trim()) { toast.error("Raison obligatoire"); return; }
    setBusy(true);
    try {
      if (mode === "in") await clockIn({ data: { shiftId: shift.id, time, reason } });
      else await clockOut({ data: { shiftId: shift.id, time, reason } });
      toast.success(mode === "in" ? "Arrivée pointée" : "Sortie pointée");
      onDone();
    } catch (e: any) { toast.error(e?.message || "Échec"); }
    finally { setBusy(false); }
  };
  return (
    <>
      <DialogHeader><DialogTitle>{mode === "in" ? "Pointer l'arrivée" : "Pointer la sortie"}</DialogTitle></DialogHeader>
      <div className="flex flex-col gap-3 py-2">
        <FormField label="Heure">
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="rounded-md border px-2.5 py-1.5" style={inputStyle} />
        </FormField>
        <FormField label="Raison (obligatoire)">
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className="rounded-md border px-2.5 py-1.5" style={inputStyle} placeholder="Ex: badge oublié…" />
        </FormField>
      </div>
      <DialogFooter>
        <DialogButton onClick={submit} busy={busy} primary>Confirmer</DialogButton>
      </DialogFooter>
    </>
  );
}

function EditLateDialog({ shift, onDone }: { shift: PointageShift; onDone: () => void }) {
  const [value, setValue] = useState(shift.minutes_late ?? 0);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const fn = useServerFn(editMinutesLateFn);
  const submit = async () => {
    if (!reason.trim()) { toast.error("Raison obligatoire"); return; }
    setBusy(true);
    try {
      await fn({ data: { shiftId: shift.id, newValue: value, reason } });
      toast.success("Retard mis à jour");
      onDone();
    } catch (e: any) { toast.error(e?.message); }
    finally { setBusy(false); }
  };
  return (
    <>
      <DialogHeader><DialogTitle>Corriger les minutes de retard</DialogTitle></DialogHeader>
      <div className="flex flex-col gap-3 py-2">
        <FormField label="Minutes de retard">
          <input type="number" min={0} value={value} onChange={(e) => setValue(parseInt(e.target.value || "0", 10) || 0)} className="rounded-md border px-2.5 py-1.5 w-32" style={inputStyle} />
        </FormField>
        <FormField label="Raison (obligatoire)">
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className="rounded-md border px-2.5 py-1.5" style={inputStyle} />
        </FormField>
      </div>
      <DialogFooter>
        <DialogButton onClick={submit} busy={busy} primary>Enregistrer</DialogButton>
      </DialogFooter>
    </>
  );
}

function isoToHHMM(iso: string | null): string {
  if (!iso) return "";
  return formatBrusselsTime(iso);
}

function EditTimesDialog({ shift, onDone }: { shift: PointageShift; onDone: () => void }) {
  const [inTime, setInTime] = useState(isoToHHMM(shift.clocked_in_at));
  const [outTime, setOutTime] = useState(isoToHHMM(shift.clocked_out_at));
  const [recomputeLate, setRecomputeLate] = useState(true);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const fn = useServerFn(editClockTimesFn);

  const onInChange = (v: string) => {
    setInTime(v);
    if (!v) setOutTime("");
  };

  const submit = async () => {
    if (reason.trim().length < 5) { toast.error("Raison obligatoire (min 5 caractères)"); return; }
    if (outTime && !inTime) { toast.error("Renseigne d'abord l'heure d'arrivée"); return; }
    if (inTime && outTime && outTime < inTime) { toast.error("La sortie doit être après l'arrivée"); return; }
    setBusy(true);
    try {
      await fn({
        data: {
          shiftId: shift.id,
          clockedInTime: inTime || null,
          clockedOutTime: outTime || null,
          recomputeLate,
          reason: reason.trim(),
        },
      });
      toast.success("Pointages mis à jour");
      onDone();
    } catch (e: any) { toast.error(e?.message || "Échec"); }
    finally { setBusy(false); }
  };

  return (
    <>
      <DialogHeader><DialogTitle>Modifier les pointages</DialogTitle></DialogHeader>
      <div className="flex flex-col gap-3 py-2">
        <div className="rounded-md border p-2.5" style={{ borderColor: "var(--border)", fontSize: 12, color: "var(--muted-foreground)" }}>
          <div><span style={{ fontWeight: 500, color: "var(--foreground)" }}>{shift.user_name || "—"}</span> · {shift.studio_short || shift.studio_name || "—"}</div>
          <div>Shift du {new Date(shift.shift_date).toLocaleDateString("fr-FR")} · prévu {hhmm(shift.start_time)} – {hhmm(shift.end_time)}</div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Heure d'arrivée">
            <input type="time" value={inTime} onChange={(e) => onInChange(e.target.value)} className="rounded-md border px-2.5 py-1.5" style={inputStyle} />
          </FormField>
          <FormField label="Heure de sortie">
            <input type="time" value={outTime} onChange={(e) => setOutTime(e.target.value)} disabled={!inTime} className="rounded-md border px-2.5 py-1.5 disabled:opacity-50" style={inputStyle} />
          </FormField>
        </div>
        <label className="flex items-center gap-2" style={{ fontSize: 12 }}>
          <input type="checkbox" checked={recomputeLate} onChange={(e) => setRecomputeLate(e.target.checked)} />
          Recalculer le retard automatiquement
        </label>
        <FormField label="Raison de la modification (obligatoire)">
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={500} className="rounded-md border px-2.5 py-1.5" style={inputStyle} placeholder="Ex: badge oublié, clôture tardive, erreur de scan…" />
        </FormField>
      </div>
      <DialogFooter>
        <DialogButton onClick={submit} busy={busy} primary>Enregistrer</DialogButton>
      </DialogFooter>
    </>
  );
}


function NoShowDialog({ shift, onDone }: { shift: PointageShift; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const fn = useServerFn(markNoShowFn);
  const submit = async () => {
    if (!reason.trim()) { toast.error("Raison obligatoire"); return; }
    setBusy(true);
    try {
      await fn({ data: { shiftId: shift.id, reason } });
      toast.success("Marqué no-show");
      onDone();
    } catch (e: any) { toast.error(e?.message); }
    finally { setBusy(false); }
  };
  return (
    <>
      <DialogHeader><DialogTitle>Marquer no-show</DialogTitle></DialogHeader>
      <p style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: -4 }}>
        Le shift sera annulé. Le score de l'employé sera recalculé.
      </p>
      <div className="flex flex-col gap-3 py-2">
        <FormField label="Raison (obligatoire)">
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className="rounded-md border px-2.5 py-1.5" style={inputStyle} />
        </FormField>
      </div>
      <DialogFooter>
        <DialogButton onClick={submit} busy={busy} primary danger>Confirmer no-show</DialogButton>
      </DialogFooter>
    </>
  );
}

function NoteDialog({ shift, onDone }: { shift: PointageShift; onDone: () => void }) {
  const [note, setNote] = useState(shift.clock_admin_note || "");
  const [busy, setBusy] = useState(false);
  const fn = useServerFn(setAdminNoteFn);
  const submit = async () => {
    setBusy(true);
    try {
      await fn({ data: { shiftId: shift.id, note } });
      toast.success("Note enregistrée");
      onDone();
    } catch (e: any) { toast.error(e?.message); }
    finally { setBusy(false); }
  };
  return (
    <>
      <DialogHeader><DialogTitle>{shift.clock_admin_note ? "Éditer la note" : "Ajouter une note"}</DialogTitle></DialogHeader>
      <div className="flex flex-col gap-3 py-2">
        <FormField label="Note">
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={4} className="rounded-md border px-2.5 py-1.5" style={inputStyle} />
        </FormField>
      </div>
      <DialogFooter>
        <DialogButton onClick={submit} busy={busy} primary>Enregistrer</DialogButton>
      </DialogFooter>
    </>
  );
}

const ACTION_LABELS: Record<string, string> = {
  manual_clock_in: "Pointage arrivée manuel",
  manual_clock_out: "Pointage sortie manuel",
  edit_minutes_late: "Correction retard",
  mark_no_show: "Marqué no-show",
  undo_no_show: "No-show annulé",
  add_note: "Note ajoutée",
  edit_note: "Note modifiée",
  edit_clock_times: "Pointages modifiés",
};

function HistoryDialog({ shift }: { shift: PointageShift }) {
  const fn = useServerFn(getShiftAuditHistoryFn);
  const [rows, setRows] = useState<AuditEntry[] | null>(null);
  useEffect(() => { fn({ data: { shiftId: shift.id } }).then(setRows).catch(() => setRows([])); }, [fn, shift.id]);
  return (
    <>
      <DialogHeader><DialogTitle>Historique du shift</DialogTitle></DialogHeader>
      <div className="max-h-[400px] overflow-y-auto">
        {!rows ? (
          <div className="py-4 text-center" style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Chargement…</div>
        ) : rows.length === 0 ? (
          <div className="py-4 text-center" style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Aucune action enregistrée.</div>
        ) : (
          <ul className="flex flex-col gap-2 py-2">
            {rows.map((r) => (
              <li key={r.id} className="rounded-md border p-3" style={{ borderColor: "var(--border)", fontSize: 12 }}>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span style={{ fontWeight: 500 }}>{ACTION_LABELS[r.action] || r.action}</span>
                  <span style={{ fontSize: 10, color: "var(--muted-foreground)" }}>
                    {new Date(r.created_at).toLocaleString("fr-FR")}
                  </span>
                </div>
                <div style={{ color: "var(--muted-foreground)" }}>par {r.actor_name || "—"}</div>
                {r.note && <div className="mt-1" style={{ fontStyle: "italic" }}>« {r.note} »</div>}
                {(r.before_value || r.after_value) && (
                  <div className="mt-1.5 grid grid-cols-2 gap-2" style={{ fontSize: 11 }}>
                    <div><span style={{ color: "var(--muted-foreground)" }}>Avant : </span>{r.before_value ? JSON.stringify(r.before_value) : "—"}</div>
                    <div><span style={{ color: "var(--muted-foreground)" }}>Après : </span>{r.after_value ? JSON.stringify(r.after_value) : "—"}</div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

// ============================================================
// SHARED
// ============================================================

const inputStyle: React.CSSProperties = { fontSize: 13, backgroundColor: "var(--background)", borderColor: "var(--border)" };

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)" }}>{label}</label>
      {children}
    </div>
  );
}

function DialogButton({ children, onClick, busy, primary, danger }: { children: React.ReactNode; onClick: () => void; busy?: boolean; primary?: boolean; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="rounded-md px-3 py-1.5 flex items-center gap-2"
      style={{
        fontSize: 12, fontWeight: 500,
        backgroundColor: danger ? "#EF4444" : primary ? "var(--foreground)" : "transparent",
        color: danger || primary ? "var(--card)" : "var(--foreground)",
        border: primary || danger ? "none" : "0.5px solid var(--border)",
        opacity: busy ? 0.6 : 1,
      }}
    >
      {busy && <Loader2 size={12} className="animate-spin" />}
      {children}
    </button>
  );
}
