export function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Toutes les dates du créneau récurrent (weekday 0=dimanche) à partir de `from`. */
export function occurrences(rule: {
  weekday: number;
  date_from: string;
  date_to: string;
}, notBefore: string): string[] {
  const start = new Date(`${rule.date_from}T00:00:00`);
  const end = new Date(`${rule.date_to}T00:00:00`);
  const floor = new Date(`${notBefore}T00:00:00`);
  const out: string[] = [];
  const d = new Date(start);
  while (d.getDay() !== rule.weekday) d.setDate(d.getDate() + 1);
  while (d <= end) {
    if (d >= floor) out.push(toDateStr(d));
    d.setDate(d.getDate() + 7);
    if (out.length > 400) break;
  }
  return out;
}

export async function materialize(
  supabase: { from: (t: string) => any },
  rule: {
    id?: string;
    user_id: string;
    studio_id: string;
    business_role: string;
    weekday: number;
    start_time: string;
    end_time: string;
    date_from: string;
    date_to: string;
  },
): Promise<{ created: number; skipped: number; availabilities: number }> {
  const today = toDateStr(new Date());
  const dates = occurrences(rule, today);
  if (dates.length === 0) return { created: 0, skipped: 0, availabilities: 0 };

  // Shifts déjà présents ce jour-là pour cet employé → on ne double pas
  const { data: existing } = await supabase
    .from("shifts")
    .select("shift_date")
    .eq("user_id", rule.user_id)
    .in("shift_date", dates);
  const taken = new Set<string>((existing ?? []).map((s: { shift_date: string }) => s.shift_date));

  const nowIso = new Date().toISOString();
  const toCreate = dates.filter((d) => !taken.has(d));
  if (toCreate.length > 0) {
    const { error } = await supabase.from("shifts").insert(
      toCreate.map((d) => ({
        user_id: rule.user_id,
        studio_id: rule.studio_id,
        business_role: rule.business_role,
        shift_date: d,
        start_time: rule.start_time,
        end_time: rule.end_time,
        status: "scheduled",
        is_manual: true,
        is_locked: true,
        published_at: nowIso,
      })),
    );
    if (error) throw new Error(error.message);
  }

  // Dispos cohérentes
  const { data: existingAvail } = await supabase
    .from("availabilities")
    .select("avail_date")
    .eq("user_id", rule.user_id)
    .eq("studio_id", rule.studio_id)
    .in("avail_date", dates);
  const availTaken = new Set<string>(
    (existingAvail ?? []).map((a: { avail_date: string }) => a.avail_date),
  );
  const availToCreate = dates.filter((d) => !availTaken.has(d));
  if (availToCreate.length > 0) {
    await supabase.from("availabilities").insert(
      availToCreate.map((d) => ({
        user_id: rule.user_id,
        studio_id: rule.studio_id,
        avail_date: d,
        start_time: rule.start_time,
        end_time: rule.end_time,
      })),
    );
  }

  return {
    created: toCreate.length,
    skipped: dates.length - toCreate.length,
    availabilities: availToCreate.length,
  };
}
