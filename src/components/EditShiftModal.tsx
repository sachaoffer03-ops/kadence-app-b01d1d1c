import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { updateShift } from "@/lib/shifts.functions";
import { useBusinessRoles } from "@/hooks/use-business-roles";

type EmployeeOpt = {
  id: string;
  first_name: string;
  last_name: string;
  roles: string[];
  studio_ids: string[];
};

interface Props {
  shift: {
    id: string;
    employeeId: string;
    role: string;
    studioId: string;
    shiftDate: string;
    startTime: string; // HH:MM:SS
    endTime: string;
  };
  onClose: () => void;
  onSaved: () => void;
}

const toHHMM = (t: string) => String(t).slice(0, 5);

export function EditShiftModal({ shift, onClose, onSaved }: Props) {
  const updateShiftFn = useServerFn(updateShift);
  const { roles: allRoles } = useBusinessRoles({ onlyActive: true });
  const [date, setDate] = useState(shift.shiftDate);
  const [start, setStart] = useState(toHHMM(shift.startTime));
  const [end, setEnd] = useState(toHHMM(shift.endTime));
  const [userId, setUserId] = useState<string>(shift.employeeId || "");
  const [role, setRole] = useState<string>(shift.role);
  const [studioRoleNames, setStudioRoleNames] = useState<string[] | null>(null);
  const [employees, setEmployees] = useState<EmployeeOpt[]>([]);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, status")
        .eq("status", "active")
        .order("first_name");
      const { data: br } = await supabase.from("user_business_roles").select("user_id, role");
      const { data: us } = await supabase.from("user_studios").select("user_id, studio_id");
      const byRole = new Map<string, string[]>();
      (br ?? []).forEach((r: any) => {
        const a = byRole.get(r.user_id) ?? [];
        a.push(r.role);
        byRole.set(r.user_id, a);
      });
      const byStudio = new Map<string, string[]>();
      (us ?? []).forEach((r: any) => {
        const a = byStudio.get(r.user_id) ?? [];
        a.push(r.studio_id);
        byStudio.set(r.user_id, a);
      });
      setEmployees(
        (profs ?? []).map((p: any) => ({
          id: p.id,
          first_name: p.first_name ?? "",
          last_name: p.last_name ?? "",
          roles: byRole.get(p.id) ?? [],
          studio_ids: byStudio.get(p.id) ?? [],
        })),
      );
    })();
  }, []);

  const eligible = useMemo(() => {
    return employees
      .filter((e) =>
        (e.roles.length === 0 || e.roles.includes(shift.role)) &&
        (e.studio_ids.length === 0 || e.studio_ids.includes(shift.studioId)),
      )
      .filter((e) =>
        search === "" ||
        `${e.first_name} ${e.last_name}`.toLowerCase().includes(search.toLowerCase()),
      );
  }, [employees, search, shift.role, shift.studioId]);

  const durationMin = useMemo(() => {
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    return eh * 60 + em - (sh * 60 + sm);
  }, [start, end]);

  const handleSave = async () => {
    if (durationMin < 60) {
      toast.error("La durée doit être d'au moins 1h");
      return;
    }
    if (durationMin <= 0) {
      toast.error("Heure de fin doit être après le début");
      return;
    }
    setSaving(true);
    try {
      await updateShiftFn({
        data: {
          shiftId: shift.id,
          shiftDate: date,
          startTime: `${start}:00`,
          endTime: `${end}:00`,
          userId: userId === "" ? null : userId,
        },
      });
      toast.success("Shift modifié");
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? "Erreur");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.3)" }}
      onClick={onClose}
    >
      <div
        className="rounded-xl w-full max-w-lg mx-4 overflow-hidden flex flex-col"
        style={{ backgroundColor: "var(--card)", border: "0.5px solid var(--border)", maxHeight: "85vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "0.5px solid var(--border)" }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>Édition complète</div>
            <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 2 }}>
              {shift.role} · {Math.round((durationMin / 60) * 10) / 10}h
            </div>
          </div>
          <button onClick={onClose} className="rounded-md p-1" style={{ color: "var(--muted-foreground)" }}>
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 flex flex-col gap-3 overflow-y-auto">
          <label className="flex flex-col gap-1">
            <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Date</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-md px-3 py-2 outline-none"
              style={{ fontSize: 13, border: "0.5px solid var(--border)", backgroundColor: "var(--background)" }}
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Début</span>
              <input
                type="time"
                step={900}
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="rounded-md px-3 py-2 outline-none"
                style={{ fontSize: 13, border: "0.5px solid var(--border)", backgroundColor: "var(--background)" }}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Fin</span>
              <input
                type="time"
                step={900}
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="rounded-md px-3 py-2 outline-none"
                style={{ fontSize: 13, border: "0.5px solid var(--border)", backgroundColor: "var(--background)" }}
              />
            </label>
          </div>

          <div className="flex flex-col gap-1">
            <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Employé assigné</span>
            <input
              type="text"
              placeholder="Rechercher…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded-md px-3 py-2 outline-none"
              style={{ fontSize: 12, border: "0.5px solid var(--border)", backgroundColor: "var(--background)" }}
            />
            <div
              className="rounded-md mt-1 overflow-y-auto"
              style={{ border: "0.5px solid var(--border)", maxHeight: 220 }}
            >
              <button
                type="button"
                onClick={() => setUserId("")}
                className="w-full text-left px-3 py-2"
                style={{
                  fontSize: 12,
                  borderBottom: "0.5px solid var(--border)",
                  backgroundColor: userId === "" ? "var(--muted)" : "transparent",
                }}
              >
                — Laisser non assigné (trou) —
              </button>
              {eligible.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => setUserId(e.id)}
                  className="w-full text-left px-3 py-2 flex items-center justify-between"
                  style={{
                    fontSize: 12,
                    borderBottom: "0.5px solid var(--border)",
                    backgroundColor: userId === e.id ? "var(--muted)" : "transparent",
                  }}
                >
                  <span>{e.first_name} {e.last_name}</span>
                  <span style={{ fontSize: 10, color: "var(--muted-foreground)" }}>
                    {e.roles.join(" · ") || "—"}
                  </span>
                </button>
              ))}
              {eligible.length === 0 && (
                <div style={{ fontSize: 11, color: "var(--muted-foreground)", padding: 12, textAlign: "center" }}>
                  Aucun employé éligible
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-2 px-5 py-3" style={{ borderTop: "0.5px solid var(--border)" }}>
          <button
            onClick={onClose}
            className="flex-1 rounded-md px-3 py-2"
            style={{ fontSize: 12, fontWeight: 500, border: "0.5px solid var(--border)" }}
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 rounded-md px-3 py-2"
            style={{
              fontSize: 12,
              fontWeight: 500,
              backgroundColor: "var(--coral)",
              color: "#fff",
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}
