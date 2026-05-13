import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dropdown } from "@/components/Dropdown";
import { useBusinessRoles } from "@/hooks/use-business-roles";

interface Studio { id: string; name: string }
interface Employee { id: string; first_name: string; last_name: string; studio_id: string | null }

interface Props {
  open: boolean;
  onClose: () => void;
  defaultUserId?: string;
  onCreated?: () => void;
}

export function CreateShiftModal({ open, onClose, defaultUserId, onCreated }: Props) {
  const [studios, setStudios] = useState<Studio[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const [userId, setUserId] = useState(defaultUserId || "");
  const [studioId, setStudioId] = useState("");
  const [role, setRole] = useState<typeof BUSINESS_ROLES[number]>("Barista");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState("10:00");
  const [endTime, setEndTime] = useState("15:00");
  const [notes, setNotes] = useState("");
  const [recurrence, setRecurrence] = useState<"none" | "weekly" | "biweekly" | "monthly">("none");
  const [until, setUntil] = useState("");

  useEffect(() => {
    if (!open) return;
    setUserId(defaultUserId || "");
    Promise.all([
      supabase.from("studios").select("id, name"),
      supabase.from("profiles").select("id, first_name, last_name, studio_id").order("first_name"),
    ]).then(([s, e]) => {
      if (s.data) {
        setStudios(s.data);
        if (s.data.length && !studioId) setStudioId(s.data[0].id);
      }
      if (e.data) setEmployees(e.data);
    });
  }, [open, defaultUserId]);

  const reset = () => {
    setNotes("");
    setStartTime("10:00"); setEndTime("15:00");
    setRecurrence("none"); setUntil("");
  };

  const handleClose = () => { reset(); onClose(); };

  const buildDates = (): string[] => {
    const start = new Date(date + "T00:00:00");
    if (recurrence === "none" || !until) return [date];
    const end = new Date(until + "T00:00:00");
    if (end < start) return [date];
    const out: string[] = [];
    const cur = new Date(start);
    let safety = 0;
    while (cur <= end && safety++ < 200) {
      out.push(cur.toISOString().slice(0, 10));
      if (recurrence === "weekly") cur.setDate(cur.getDate() + 7);
      else if (recurrence === "biweekly") cur.setDate(cur.getDate() + 14);
      else if (recurrence === "monthly") cur.setMonth(cur.getMonth() + 1);
    }
    return out;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return toast.error("Sélectionnez un employé");
    if (endTime <= startTime) return toast.error("L'heure de fin doit être après le début");
    if (recurrence !== "none" && !until) return toast.error("Indiquez une date de fin de répétition");

    const dates = buildDates();
    setSubmitting(true);
    const { error } = await supabase.from("shifts").insert(
      dates.map((d) => ({
        user_id: userId,
        studio_id: studioId || null,
        business_role: role,
        shift_date: d,
        start_time: startTime,
        end_time: endTime,
        notes: notes || null,
      }))
    );
    setSubmitting(false);

    if (error) return toast.error(error.message);
    toast.success(dates.length > 1 ? `${dates.length} shifts créés` : "Shift créé");
    onCreated?.();
    handleClose();
  };


  if (!open) return null;

  const labelStyle = { fontSize: 12, fontWeight: 500 as const, color: "var(--muted-foreground)" };
  const inputCls = "mt-1 w-full rounded-md border px-3 py-2 outline-none";
  const inputStyle = { fontSize: 14, borderColor: "var(--border)", backgroundColor: "var(--background)" };

  const chip = (active: boolean) => ({
    fontSize: 12,
    fontWeight: active ? 500 as const : 400 as const,
    backgroundColor: active ? "var(--foreground)" : "transparent",
    color: active ? "var(--card)" : "var(--muted-foreground)",
    border: active ? "none" : "0.5px solid var(--border)",
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ backgroundColor: "rgba(0,0,0,0.4)" }} onClick={handleClose}>
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-lg border" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: "var(--border)" }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 500 }}>Créer un shift</h2>
            <p style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2 }}>
              Visible immédiatement par l'employé dans son app
            </p>
          </div>
          <button onClick={handleClose} className="p-1 rounded hover:bg-[var(--muted)]"><X size={18} /></button>
        </div>

        <form onSubmit={submit} className="p-5 space-y-4">
          {!defaultUserId && (() => {
            const empLabel = (e: Employee) => `${e.first_name} ${e.last_name}`;
            const labels = employees.map(empLabel);
            const selected = employees.find(e => e.id === userId);
            return (
              <div>
                <label style={labelStyle}>Employé *</label>
                <div className="mt-1">
                  <Dropdown
                    fullWidth
                    placeholder="Sélectionner un employé..."
                    value={selected ? empLabel(selected) : ""}
                    options={labels}
                    onChange={(label) => {
                      const emp = employees.find(e => empLabel(e) === label);
                      if (emp) setUserId(emp.id);
                    }}
                  />
                </div>
              </div>
            );
          })()}


          <div>
            <label style={labelStyle}>Studio</label>
            <div className="flex flex-wrap gap-1 mt-2">
              {studios.map((s) => (
                <button key={s.id} type="button" onClick={() => setStudioId(s.id)}
                  className="rounded-full px-2.5 py-1 transition-colors" style={chip(studioId === s.id)}>
                  {s.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={labelStyle}>Poste *</label>
            <div className="flex flex-wrap gap-1 mt-2">
              {BUSINESS_ROLES.map((r) => (
                <button key={r} type="button" onClick={() => setRole(r)}
                  className="rounded-full px-2.5 py-1 transition-colors" style={chip(role === r)}>
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div><label style={labelStyle}>Date *</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} style={inputStyle} required /></div>
            <div><label style={labelStyle}>Début *</label>
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={inputCls} style={inputStyle} required /></div>
            <div><label style={labelStyle}>Fin *</label>
              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={inputCls} style={inputStyle} required /></div>
          </div>

          <div>
            <label style={labelStyle}>Répétition</label>
            <div className="flex flex-wrap gap-1 mt-2">
              {([
                { v: "none", label: "Jamais" },
                { v: "weekly", label: "Chaque semaine" },
                { v: "biweekly", label: "Toutes les 2 semaines" },
                { v: "monthly", label: "Chaque mois" },
              ] as const).map((opt) => (
                <button key={opt.v} type="button" onClick={() => setRecurrence(opt.v)}
                  className="rounded-full px-2.5 py-1 transition-colors" style={chip(recurrence === opt.v)}>
                  {opt.label}
                </button>
              ))}
            </div>
            {recurrence !== "none" && (
              <div className="mt-3">
                <label style={labelStyle}>Jusqu'au *</label>
                <input type="date" value={until} min={date} onChange={(e) => setUntil(e.target.value)}
                  className={inputCls} style={inputStyle} required />
                <p style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 4 }}>
                  Le shift sera dupliqué automatiquement jusqu'à cette date.
                </p>
              </div>
            )}
          </div>

          <div>
            <label style={labelStyle}>Note (optionnel)</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} style={inputStyle} placeholder="Briefing, info particulière..." />
          </div>


          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={handleClose} className="rounded-md border px-4 py-2"
              style={{ fontSize: 13, fontWeight: 500, borderColor: "var(--border)" }}>Annuler</button>
            <button type="submit" disabled={submitting} className="rounded-md px-4 py-2 disabled:opacity-50"
              style={{ fontSize: 13, fontWeight: 500, backgroundColor: "var(--foreground)", color: "var(--card)" }}>
              {submitting ? "Création..." : "Créer le shift"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
