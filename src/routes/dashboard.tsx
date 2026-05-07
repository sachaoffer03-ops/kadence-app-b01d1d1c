import { createFileRoute } from "@tanstack/react-router";
import { todayShifts, roleColors, getStatusColor, type TodayShift } from "@/lib/mock-data";
import { ArrowRight, AlertTriangle, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
  head: () => ({
    meta: [{ title: "Dashboard — Shifty" }],
  }),
});

function DashboardPage() {
  return (
    <div className="p-6" style={{ maxWidth: 1200 }}>
      {/* Hero */}
      <div
        className="rounded-xl p-6"
        style={{
          background: "linear-gradient(135deg, var(--hero), var(--hero-end))",
          borderRadius: 14,
        }}
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span
                className="animate-pulse-dot rounded-full"
                style={{ width: 8, height: 8, backgroundColor: "var(--coral)" }}
              />
              <span style={{ fontSize: 11, fontWeight: 500, color: "var(--coral)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Shifts du jour
              </span>
            </div>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", marginBottom: 16 }}>
              12 shifts au total · 2 studios · 8 employés actifs
            </p>
            <div className="flex items-center gap-6">
              <HeroStat value="5" label="En cours" />
              <HeroStat value="4" label="Terminés" />
              <HeroStat value="3" label="À venir" />
            </div>
          </div>
          <div className="text-right">
            <div style={{ fontSize: 42, fontWeight: 500, color: "#7EC77B", lineHeight: 1 }}>
              100%
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 4 }}>
              Taux de couverture
            </div>
            <div style={{ fontSize: 11, color: "#7EC77B", marginTop: 2 }}>
              Aucun trou aujourd'hui
            </div>
          </div>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-4 gap-4 mt-5">
        <KpiCard label="Cette semaine" value="68" unit="shifts" change="↑ 12% vs sem. dern." changeColor="var(--success-text)" />
        <KpiCard label="Heures prestées" value="476" unit="h" change="Cible mois : 1 840h" changeColor="var(--muted-foreground)" />
        <KpiCard label="Score staff moyen" value="8.6" unit="/10" change="+0.2 ce mois" changeColor="var(--success-text)" />
        <KpiCard label="Retards" value="2" unit="cette semaine" change="À surveiller" changeColor="var(--warning-text)" />
      </div>

      {/* Two columns */}
      <div className="grid grid-cols-5 gap-5 mt-5">
        {/* Left: activity */}
        <div className="col-span-3">
          <div
            className="rounded-xl border p-5"
            style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
          >
            <h2 style={{ fontSize: 14, fontWeight: 500, marginBottom: 16 }}>
              Activité du jour
            </h2>
            <div className="flex flex-col gap-1">
              {todayShifts.map((shift) => (
                <ShiftRow key={shift.employeeId} shift={shift} />
              ))}
            </div>
          </div>
        </div>

        {/* Right: action panels */}
        <div className="col-span-2 flex flex-col gap-5">
          {/* Actions en attente */}
          <div
            className="rounded-xl p-5"
            style={{ backgroundColor: "var(--coral-light)" }}
          >
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle size={15} style={{ color: "var(--coral-dark)" }} />
              <span style={{ fontSize: 14, fontWeight: 500, color: "var(--coral-text)" }}>
                Actions en attente
              </span>
              <span
                className="rounded-full inline-flex items-center justify-center"
                style={{
                  width: 20, height: 20, fontSize: 10, fontWeight: 500,
                  backgroundColor: "var(--danger-bg)", color: "var(--danger-text)",
                }}
              >
                5
              </span>
            </div>
            <div className="flex flex-col gap-3">
              <ActionRow title="3 inscriptions à valider" subtitle="Reçues hier et aujourd'hui" />
              <ActionRow title="2 Dimona à envoyer" subtitle="Pour les shifts de demain" />
              <ActionRow title="1 demande de modif shift" subtitle="Léa Berger · vendredi 16 mai" />
            </div>
          </div>

          {/* Planning du mois */}
          <div
            className="rounded-xl border p-5"
            style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 style={{ fontSize: 14, fontWeight: 500 }}>Planning du mois</h2>
              <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Mai 2026</span>
            </div>
            <div className="flex items-center gap-2 mb-3">
              <span
                className="rounded-full px-2 py-0.5"
                style={{ fontSize: 10, fontWeight: 500, backgroundColor: "var(--success-bg)", color: "var(--success-text)" }}
              >
                Publié · 28 avril
              </span>
            </div>
            <div className="flex flex-col gap-2" style={{ fontSize: 13, color: "var(--foreground)" }}>
              <div>Shifts attribués : <span style={{ fontWeight: 500 }}>182 / 184</span></div>
              <div style={{ color: "var(--muted-foreground)" }}>Prochaine génération : 26 mai</div>
            </div>
            <button
              className="mt-4 w-full flex items-center justify-center gap-1.5 rounded-md border py-2 transition-colors"
              style={{
                fontSize: 12, fontWeight: 500,
                borderColor: "var(--border)", color: "var(--foreground)",
                backgroundColor: "transparent",
              }}
            >
              Voir le planning complet
              <ArrowRight size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function HeroStat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div style={{ fontSize: 22, fontWeight: 500, color: "#FFFFFF" }}>{value}</div>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>{label}</div>
    </div>
  );
}

function KpiCard({
  label, value, unit, change, changeColor,
}: {
  label: string; value: string; unit: string; change: string; changeColor: string;
}) {
  return (
    <div
      className="rounded-xl border p-4"
      style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
    >
      <div style={{ fontSize: 10, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
        {label}
      </div>
      <div className="flex items-baseline gap-1">
        <span style={{ fontSize: 24, fontWeight: 500, color: "var(--foreground)" }}>{value}</span>
        <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{unit}</span>
      </div>
      <div style={{ fontSize: 11, color: changeColor, marginTop: 4 }}>
        {change}
      </div>
    </div>
  );
}

function ShiftRow({ shift }: { shift: TodayShift }) {
  const roleColor = roleColors[shift.role];
  const statusColor = getStatusColor(shift.status);

  return (
    <div
      className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors"
      style={{ cursor: "pointer" }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "var(--muted)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
    >
      {/* Avatar */}
      <div
        className="flex items-center justify-center rounded-full shrink-0"
        style={{
          width: 32, height: 32,
          backgroundColor: roleColor.bg,
          color: roleColor.text,
          fontSize: 11, fontWeight: 500,
        }}
      >
        {shift.name.split(" ").map((n) => n[0]).join("")}
      </div>
      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span style={{ fontSize: 13, fontWeight: 500, color: "var(--foreground)" }}>
            {shift.name}
          </span>
          <span
            className="rounded-full px-1.5 py-0.5"
            style={{ fontSize: 10, backgroundColor: roleColor.bg, color: roleColor.text }}
          >
            {shift.role}
          </span>
        </div>
        <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 1 }}>
          {shift.studio} · {shift.startHour} — {shift.endHour}
          {shift.checkedIn && " · pointée"}
        </div>
      </div>
      {/* Status pill */}
      <span
        className="rounded-full px-2.5 py-1 shrink-0"
        style={{
          fontSize: 11, fontWeight: 500,
          backgroundColor: statusColor.bg,
          color: statusColor.text,
        }}
      >
        {shift.statusLabel}
      </span>
    </div>
  );
}

function ActionRow({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div
      className="flex items-center justify-between rounded-lg px-3 py-2 transition-colors"
      style={{ cursor: "pointer", backgroundColor: "rgba(255,255,255,0.5)" }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(255,255,255,0.8)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(255,255,255,0.5)"; }}
    >
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--coral-text)" }}>{title}</div>
        <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 1 }}>{subtitle}</div>
      </div>
      <ChevronRight size={14} style={{ color: "var(--coral-dark)" }} />
    </div>
  );
}
