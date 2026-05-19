import { useEffect, useState } from "react";
import { Calendar as CalendarIcon, ChevronDown, Download } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { useStudios } from "@/hooks/use-studios";
import { useBusinessRoles } from "@/hooks/use-business-roles";

export type Preset = "today" | "yesterday" | "week" | "month" | "30d" | "custom";

function iso(d: Date) { return d.toISOString().slice(0, 10); }
function startOfWeek(d: Date) { const x = new Date(d); const day = x.getDay(); x.setDate(x.getDate() - (day === 0 ? 6 : day - 1)); return x; }
function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }

export function presetToRange(p: Preset, custom?: { from: string; to: string }): { from: string; to: string } {
  const today = new Date();
  if (p === "today") return { from: iso(today), to: iso(today) };
  if (p === "yesterday") { const y = new Date(today); y.setDate(y.getDate() - 1); return { from: iso(y), to: iso(y) }; }
  if (p === "week") return { from: iso(startOfWeek(today)), to: iso(today) };
  if (p === "month") return { from: iso(startOfMonth(today)), to: iso(today) };
  if (p === "30d") { const f = new Date(today); f.setDate(f.getDate() - 29); return { from: iso(f), to: iso(today) }; }
  return custom ?? { from: iso(today), to: iso(today) };
}

export function FiltersBar({
  preset, from, to, studioIds, roleIds,
  onChange, onExport,
}: {
  preset: Preset; from: string; to: string;
  studioIds: string[]; roleIds: string[];
  onChange: (next: { preset: Preset; from: string; to: string; studioIds: string[]; roleIds: string[] }) => void;
  onExport: () => void;
}) {
  const { studios } = useStudios();
  const { roles } = useBusinessRoles();

  const [datePopOpen, setDatePopOpen] = useState(false);
  const [draftFrom, setDraftFrom] = useState<Date | undefined>(new Date(from));
  const [draftTo, setDraftTo] = useState<Date | undefined>(new Date(to));
  useEffect(() => { setDraftFrom(new Date(from)); setDraftTo(new Date(to)); }, [from, to]);

  const setPreset = (p: Preset) => {
    if (p === "custom") { setDatePopOpen(true); return; }
    const r = presetToRange(p);
    onChange({ preset: p, from: r.from, to: r.to, studioIds, roleIds });
  };

  const toggleStudio = (id: string) => {
    const next = studioIds.includes(id) ? studioIds.filter((s) => s !== id) : [...studioIds, id];
    onChange({ preset, from, to, studioIds: next, roleIds });
  };
  const toggleRole = (id: string) => {
    const next = roleIds.includes(id) ? roleIds.filter((s) => s !== id) : [...roleIds, id];
    onChange({ preset, from, to, studioIds, roleIds: next });
  };

  const presetLabel: Record<Preset, string> = {
    today: "Aujourd'hui", yesterday: "Hier", week: "Cette semaine",
    month: "Ce mois-ci", "30d": "30 derniers jours", custom: "Personnalisé",
  };

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      {/* Preset dropdown */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-9">
            <CalendarIcon size={14} className="mr-1.5" />
            {presetLabel[preset]} <ChevronDown size={14} className="ml-1" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-44 p-1" align="start">
          {(["today", "yesterday", "week", "month", "30d", "custom"] as Preset[]).map((p) => (
            <button
              key={p}
              onClick={() => setPreset(p)}
              className="w-full text-left text-sm px-2 py-1.5 rounded hover:bg-[var(--muted)]"
              style={{ color: preset === p ? "var(--coral)" : "var(--foreground)", fontWeight: preset === p ? 500 : 400 }}
            >
              {presetLabel[p]}
            </button>
          ))}
        </PopoverContent>
      </Popover>

      {/* Custom range picker */}
      <Popover open={datePopOpen} onOpenChange={setDatePopOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-9 text-xs">
            {from} → {to}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 pointer-events-auto" align="start">
          <div className="flex flex-col sm:flex-row">
            <Calendar mode="single" selected={draftFrom} onSelect={(d) => setDraftFrom(d)} className="p-3 pointer-events-auto" />
            <Calendar mode="single" selected={draftTo} onSelect={(d) => setDraftTo(d)} className="p-3 pointer-events-auto" />
          </div>
          <div className="flex justify-end gap-2 p-2 border-t" style={{ borderColor: "var(--border)" }}>
            <Button variant="ghost" size="sm" onClick={() => setDatePopOpen(false)}>Annuler</Button>
            <Button
              size="sm"
              onClick={() => {
                if (draftFrom && draftTo) {
                  const f = iso(draftFrom <= draftTo ? draftFrom : draftTo);
                  const t = iso(draftFrom <= draftTo ? draftTo : draftFrom);
                  onChange({ preset: "custom", from: f, to: t, studioIds, roleIds });
                  setDatePopOpen(false);
                }
              }}
            >
              Appliquer
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {/* Studios multiselect */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-9">
            Studios{studioIds.length ? ` (${studioIds.length})` : ""} <ChevronDown size={14} className="ml-1" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-2" align="start">
          {(studios ?? []).map((s) => (
            <label key={s.id} className="flex items-center gap-2 px-1 py-1 rounded hover:bg-[var(--muted)] cursor-pointer">
              <Checkbox checked={studioIds.includes(s.id)} onCheckedChange={() => toggleStudio(s.id)} />
              <span className="text-sm" style={{ color: "var(--foreground)" }}>{s.short_name ?? s.name}</span>
            </label>
          ))}
          {studioIds.length > 0 && (
            <button className="text-xs mt-2 px-1" style={{ color: "var(--coral)" }}
              onClick={() => onChange({ preset, from, to, studioIds: [], roleIds })}>
              Effacer
            </button>
          )}
        </PopoverContent>
      </Popover>

      {/* Roles multiselect */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-9">
            Rôles{roleIds.length ? ` (${roleIds.length})` : ""} <ChevronDown size={14} className="ml-1" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-2" align="start">
          {(roles ?? []).map((r) => (
            <label key={r.id} className="flex items-center gap-2 px-1 py-1 rounded hover:bg-[var(--muted)] cursor-pointer">
              <Checkbox checked={roleIds.includes(r.id)} onCheckedChange={() => toggleRole(r.id)} />
              <span className="text-sm" style={{ color: "var(--foreground)" }}>{r.name}</span>
            </label>
          ))}
          {roleIds.length > 0 && (
            <button className="text-xs mt-2 px-1" style={{ color: "var(--coral)" }}
              onClick={() => onChange({ preset, from, to, studioIds, roleIds: [] })}>
              Effacer
            </button>
          )}
        </PopoverContent>
      </Popover>

      <div className="flex-1" />

      <Button variant="outline" size="sm" className="h-9" onClick={onExport}>
        <Download size={14} className="mr-1.5" /> Exporter CSV
      </Button>
    </div>
  );
}
