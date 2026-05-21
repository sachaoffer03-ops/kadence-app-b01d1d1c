// Server-only helpers for the admin Pointage page.
export async function assertAdminOrManager(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const ok = data?.some((r: any) => r.role === "admin" || r.role === "manager");
  if (!ok) throw new Error("Réservé aux admins et managers");
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export type PointageStatus = "upcoming" | "in_progress" | "late_no_in" | "late_in" | "completed" | "no_show";

export function computeShiftStatus(args: {
  shiftDate: string;
  startTime: string;
  endTime: string;
  clockedInAt: string | null;
  clockedOutAt: string | null;
  status: string;
  graceMinIn: number;
  minutesLate: number | null;
}): PointageStatus {
  const now = new Date();
  const start = new Date(`${args.shiftDate}T${args.startTime}`);
  const end = new Date(`${args.shiftDate}T${args.endTime}`);
  if (args.status === "cancelled") return "no_show";
  if (args.clockedOutAt) return "completed";
  if (args.clockedInAt) {
    if ((args.minutesLate ?? 0) > args.graceMinIn) return "late_in";
    return "in_progress";
  }
  // not clocked in
  const lateThreshold = new Date(start.getTime() + args.graceMinIn * 60_000);
  if (now > end) return "no_show";
  if (now > lateThreshold) return "late_no_in";
  return "upcoming";
}
