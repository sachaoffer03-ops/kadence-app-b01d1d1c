import type { getMyAssignedCourses, getCourseForEmployee } from "@/lib/formation.functions";

export type AssignedCourses = Awaited<ReturnType<typeof getMyAssignedCourses>>;
export type CourseCard = AssignedCourses["courses"][number];
export type CourseDetail = Awaited<ReturnType<typeof getCourseForEmployee>>;
export type DetailSection = CourseDetail["sections"][number];
export type DetailModule = DetailSection["modules"][number];
export type DetailContent = DetailModule["contents"][number];
export type DetailQuiz = NonNullable<DetailModule["quiz"]>;
