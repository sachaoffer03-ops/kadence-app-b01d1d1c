import type { getCourseFullStructure } from "@/lib/formation.functions";

export type CourseFull = Awaited<ReturnType<typeof getCourseFullStructure>>;
export type SectionWithChildren = CourseFull["sections"][number];
export type ModuleWithChildren = SectionWithChildren["modules"][number];
export type ContentRow = ModuleWithChildren["contents"][number];
export type QuizWithChildren = NonNullable<ModuleWithChildren["quiz"]>;
export type QuizQuestion = QuizWithChildren["questions"][number];
export type QuizOption = QuizQuestion["options"][number];

export type ContentType = "video" | "pdf" | "image" | "text";

export const TYPE_COLOR: Record<ContentType, string> = {
  video: "#E04545",
  pdf: "#2563EB",
  image: "#16A34A",
  text: "#6B7280",
};

export const TYPE_LABEL: Record<ContentType, string> = {
  video: "Vidéo",
  pdf: "PDF",
  image: "Image",
  text: "Texte",
};

export const COURSE_COLORS = [
  "#F0997B", "#E04545", "#2563EB", "#16A34A",
  "#8B5CF6", "#0EA5E9", "#F59E0B", "#475569",
];

export function fmtDuration(seconds: number | null | undefined): string {
  if (!seconds) return "";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s} s`;
  if (s === 0) return `${m} min`;
  return `${m} min ${s.toString().padStart(2, "0")}`;
}

export function fmtTotalMinutes(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${String(m).padStart(2, "0")}` : `${h}h`;
}
