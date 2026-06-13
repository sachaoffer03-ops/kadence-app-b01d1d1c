import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { z } from "zod";
import { ArrowLeft, ChevronLeft, ChevronRight, CalendarCheck } from "lucide-react";
import { getUserAvailabilitiesForMonth } from "@/lib/availabilities.functions";

const searchSchema = z.object({
  year: z.number().int().optional(),
  month: z.number().int().optional(),
});

export const Route = createFileRoute("/dispo-detail/$userId")({
  validateSearch: (s) => searchSchema.parse(s),
  component: UserDisposPage,
});

const MONTHS_FR = [
  "Janvier","Février","Mars","Avril","Mai","Juin",
  "Juillet","Août","Septembre","Octobre","Novembre","Décembre",
];
const DAYS_FR = ["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"];

function pad(n: number) { return String(n).padStart(2, "0"); }

function UserDisposPage() {
  const { userId } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate();

  const now = new Date();
  const fallback = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const year = search.year ?? fallback.getFullYear();
  const month = search.month ?? fallback.getMonth() + 1;

  const fetchFn = useServerFn(getUserAvailabilitiesForMonth);
  const { data, isLoading } = useQuery({
    queryKey: ["user-dispos", userId, year, month],
    queryFn: () => fetchFn({ data: { userId, year, month } }),
    refetchInterval: 30_000,
  });

  const profile = data?.profile;
  const avails = data?.availabilities ?? [];

  // Group by date
  const byDate = useMemo(() => {
    const m = new Map<string, Array<{ id: string; start_time: string; end_time: string }>>();
    for (const a of avails) {
      const arr = m.get(a.avail_date) ?? [];
      arr.push(a);
      m.set(a.avail_date, arr);
    }
    return m;
  }, [avails]);

  // Calendar grid (Mon-first)
  const cells = useMemo(() => {
    const first = new Date(year, month - 1, 1);
    const last = new Date(year, month, 0);
    const startWeekday = (first.getDay() + 6) % 7; // Mon=0
    const total = startWeekday + last.getDate();
    const rows = Math.ceil(total / 7);
    const out: Array<{ day: number | null; date: string | null }> = [];
    for (let i = 0; i < rows * 7; i++) {
      const dayNum = i - startWeekday + 1;
      if (dayNum < 1 || dayNum > last.getDate()) {
        out.push({ day: null, date: null });
      } else {
        out.push({ day: dayNum, date: `${year}-${pad(month)}-${pad(dayNum)}` });
      }
    }
    return out;
  }, [year, month]);

  const totalSlots = avails.length;
  const totalHours = avails.reduce((sum, a) => {
    const [sh, sm] = a.start_time.split(":").map(Number);
    const [eh, em] = a.end_time.split(":").map(Number);
    return sum + ((eh * 60 + em) - (sh * 60 + sm)) / 60;
  }, 0);
  const daysCovered = byDate.size;

  const goMonth = (delta: number) => {
    const d = new Date(year, month - 1 + delta, 1);
    navigate({
      to: "/dispo-detail/$userId",
      params: { userId },
      search: { year: d.getFullYear(), month: d.getMonth() + 1 },
    });
  };

  const todayIso = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

  return (
    <div className="p-6 max-w-6xl mx-auto" style={{ color: "var(--foreground)" }}>
      {/* Back link */}
      <Link
        to="/dispos-monitoring"
        className="inline-flex items-center gap-1.5 mb-4"
        style={{ fontSize: 12, color: "var(--muted-foreground)" }}
      >
        <ArrowLeft size={14} />
        Retour au monitoring
      </Link>

      {/* Header */}
      <div className="flex items-center gap-3 mb-1">
        <CalendarCheck size={20} style={{ color: "var(--coral)" }} />
        <h1 style={{ fontSize: 22, fontWeight: 500 }}>
          {profile ? `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() : "Employé"}
        </h1>
        {profile?.contract && (
          <span
            className="rounded-full px-2 py-0.5"
            style={{ fontSize: 11, backgroundColor: "var(--muted)", color: "var(--muted-foreground)" }}
          >
            {profile.contract}
          </span>
        )}
      </div>
      <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginBottom: 20 }}>
        Disponibilités saisies pour le mois sélectionné.
      </p>

      {/* Month navigation */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <button
            onClick={() => goMonth(-1)}
            className="rounded-md border h-9 w-9 flex items-center justify-center hover:bg-[var(--muted)]"
            style={{ borderColor: "var(--border)" }}
            aria-label="Mois précédent"
          >
            <ChevronLeft size={16} />
          </button>
          <div style={{ fontSize: 16, fontWeight: 500, minWidth: 180, textAlign: "center" }}>
            {MONTHS_FR[month - 1]} {year}
          </div>
          <button
            onClick={() => goMonth(1)}
            className="rounded-md border h-9 w-9 flex items-center justify-center hover:bg-[var(--muted)]"
            style={{ borderColor: "var(--border)" }}
            aria-label="Mois suivant"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-5" style={{ fontSize: 12 }}>
          <Stat label="Jours" value={daysCovered} />
          <Stat label="Créneaux" value={totalSlots} />
          <Stat label="Heures" value={`${totalHours.toFixed(1)}h`} />
        </div>
      </div>

      {/* Calendar */}
      <div
        className="rounded-lg border overflow-hidden"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--background)" }}
      >
        <div className="grid grid-cols-7" style={{ backgroundColor: "var(--muted)" }}>
          {DAYS_FR.map((d) => (
            <div
              key={d}
              className="px-2 py-2 text-center"
              style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.05em" }}
            >
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((c, idx) => {
            const slots = c.date ? byDate.get(c.date) ?? [] : [];
            const hasSlots = slots.length > 0;
            const isToday = c.date === todayIso;
            return (
              <div
                key={idx}
                className="border-t border-l"
                style={{
                  borderColor: "var(--border)",
                  minHeight: 96,
                  backgroundColor: c.day === null
                    ? "var(--muted)"
                    : hasSlots
                      ? "color-mix(in oklab, var(--coral) 7%, transparent)"
                      : "transparent",
                  ...(idx % 7 === 0 ? { borderLeft: "none" } : {}),
                }}
              >
                {c.day !== null && (
                  <div className="p-1.5 h-full flex flex-col gap-1">
                    <div
                      className="flex items-center justify-between"
                      style={{ fontSize: 12 }}
                    >
                      <span
                        style={{
                          fontWeight: isToday ? 600 : 500,
                          color: isToday ? "var(--coral)" : "var(--foreground)",
                        }}
                      >
                        {c.day}
                      </span>
                      {hasSlots && (
                        <span
                          style={{
                            fontSize: 10,
                            color: "var(--muted-foreground)",
                          }}
                        >
                          {slots.length}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col gap-0.5 flex-1">
                      {slots.map((s) => (
                        <div
                          key={s.id}
                          className="rounded px-1.5 py-0.5"
                          style={{
                            fontSize: 10.5,
                            fontWeight: 500,
                            backgroundColor: "var(--coral)",
                            color: "#fff",
                            lineHeight: 1.3,
                          }}
                        >
                          {s.start_time.slice(0, 5)} – {s.end_time.slice(0, 5)}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {isLoading && (
        <div className="text-center mt-4" style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
          Chargement…
        </div>
      )}
      {!isLoading && totalSlots === 0 && (
        <div className="text-center mt-6 py-8 rounded-lg border"
          style={{ borderColor: "var(--border)", fontSize: 13, color: "var(--muted-foreground)" }}
        >
          Aucune disponibilité saisie pour ce mois.
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span style={{ fontWeight: 600, color: "var(--foreground)" }}>{value}</span>
      <span style={{ color: "var(--muted-foreground)" }}>{label}</span>
    </div>
  );
}
