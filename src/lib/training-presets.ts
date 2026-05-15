import {
  BookOpen, Coffee, ChefHat, Shield, Users, Award, Briefcase, Heart,
  GraduationCap, Sparkles, Wrench, Zap, Target, Lightbulb, Compass,
  ClipboardList, MessageSquare, Headphones, Camera, Globe,
  type LucideIcon,
} from "lucide-react";

// Palette cohérente avec le design system Kadence (warm off-white + coral + role colors)
export const FOLDER_COLORS: { name: string; value: string }[] = [
  { name: "Coral",     value: "#F0997B" },
  { name: "Teal",      value: "#5BA89E" },
  { name: "Purple",    value: "#9B7FB8" },
  { name: "Pink",      value: "#D98EA8" },
  { name: "Blue",      value: "#6B9BD2" },
  { name: "Amber",     value: "#D4A857" },
  { name: "Sage",      value: "#8FA87E" },
  { name: "Slate",     value: "#7A8499" },
];

export const FOLDER_ICONS: { name: string; icon: LucideIcon }[] = [
  { name: "BookOpen",       icon: BookOpen },
  { name: "Coffee",         icon: Coffee },
  { name: "ChefHat",        icon: ChefHat },
  { name: "Shield",         icon: Shield },
  { name: "Users",          icon: Users },
  { name: "Award",          icon: Award },
  { name: "Briefcase",      icon: Briefcase },
  { name: "Heart",          icon: Heart },
  { name: "GraduationCap",  icon: GraduationCap },
  { name: "Sparkles",       icon: Sparkles },
  { name: "Wrench",         icon: Wrench },
  { name: "Zap",            icon: Zap },
  { name: "Target",         icon: Target },
  { name: "Lightbulb",      icon: Lightbulb },
  { name: "Compass",        icon: Compass },
  { name: "ClipboardList",  icon: ClipboardList },
  { name: "MessageSquare",  icon: MessageSquare },
  { name: "Headphones",     icon: Headphones },
  { name: "Camera",         icon: Camera },
  { name: "Globe",          icon: Globe },
];

export const DEFAULT_FOLDER_COLOR = FOLDER_COLORS[0].value;
export const DEFAULT_FOLDER_ICON = FOLDER_ICONS[0].name;

export function getFolderIcon(name: string | null | undefined): LucideIcon {
  return FOLDER_ICONS.find((i) => i.name === name)?.icon ?? BookOpen;
}

// --- URL detection / embed helpers ---

export function detectVideoEmbed(url: string): { provider: "youtube" | "vimeo" | "drive" | "other"; embedUrl: string } {
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
  if (yt) return { provider: "youtube", embedUrl: `https://www.youtube.com/embed/${yt[1]}` };
  const vimeo = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeo) return { provider: "vimeo", embedUrl: `https://player.vimeo.com/video/${vimeo[1]}` };
  const drive = url.match(/drive\.google\.com\/file\/d\/([A-Za-z0-9_-]+)/);
  if (drive) return { provider: "drive", embedUrl: `https://drive.google.com/file/d/${drive[1]}/preview` };
  return { provider: "other", embedUrl: url };
}

export function isValidVideoUrl(url: string): boolean {
  return /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be|vimeo\.com|drive\.google\.com)\//i.test(url.trim());
}

export function isValidUrl(url: string): boolean {
  try { new URL(url); return true; } catch { return false; }
}
