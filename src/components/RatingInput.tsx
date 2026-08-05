import { Star } from "lucide-react";

/**
 * Notation manager sur 5 étoiles.
 * ⚠️ Le stockage en base (`feedbacks.rating`) et le calcul du score restent sur
 * une échelle 0..10 : `value` et `onChange` manipulent donc toujours le 0..10,
 * l'UI n'affiche que des étoiles sur 5 (1 étoile = 2 points).
 */

export const RATING_LABELS: Record<number, string> = {
  1: "Insuffisant",
  2: "À améliorer",
  3: "Correct",
  4: "Très bien",
  5: "Excellent",
};

const RATING_HINTS: Record<number, string> = {
  1: "Problèmes sérieux sur le shift",
  2: "Quelques manquements à corriger",
  3: "Shift conforme aux attentes",
  4: "Bon shift, rien à signaler",
  5: "Exemplaire, à mettre en avant",
};

export function starsFromRating(value: number) {
  return Math.max(0, Math.min(5, Math.round((value || 0) / 2)));
}

interface RatingInputProps {
  value: number;          // 0..10
  onChange: (v: number) => void;
  size?: "sm" | "md" | "lg";
  readOnly?: boolean;
  showNumber?: boolean;
}

export function RatingInput({ value, onChange, size = "md", readOnly = false, showNumber = true }: RatingInputProps) {
  const stars = starsFromRating(value);
  const px = size === "sm" ? 18 : size === "lg" ? 36 : 28;

  if (readOnly) {
    return (
      <span className="inline-flex items-center" style={{ gap: 3 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Star key={n} size={size === "sm" ? 12 : 16}
            fill={n <= stars ? "var(--coral)" : "transparent"}
            color={n <= stars ? "var(--coral)" : "rgba(0,0,0,0.22)"} strokeWidth={1.4} />
        ))}
        {showNumber && (
          <span style={{ fontSize: 12, fontWeight: 500, color: "var(--muted-foreground)", marginLeft: 6 }}>{stars}/5</span>
        )}
      </span>
    );
  }

  return (
    <div className="flex flex-col" style={{ gap: 8 }}>
      <div
        className="flex items-center justify-center rounded-xl"
        style={{ gap: 6, padding: "12px 8px", backgroundColor: "var(--card)", border: "0.5px solid var(--border)" }}
      >
        {[1, 2, 3, 4, 5].map((n) => {
          const filled = n <= stars;
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n * 2)}
              aria-label={`${n} étoile${n > 1 ? "s" : ""} — ${RATING_LABELS[n]}`}
              className="rounded-lg transition-transform"
              style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                padding: 6, border: "none", cursor: "pointer",
                background: filled ? "color-mix(in oklab, var(--coral) 12%, transparent)" : "transparent",
                transform: filled && n === stars ? "scale(1.08)" : "none",
              }}
            >
              <Star
                size={px}
                fill={filled ? "var(--coral)" : "transparent"}
                color={filled ? "var(--coral)" : "rgba(0,0,0,0.22)"}
                strokeWidth={1.4}
              />
            </button>
          );
        })}
      </div>
      <div className="text-center" style={{ minHeight: 30 }}>
        {stars > 0 ? (
          <>
            <div style={{ fontSize: 13, fontWeight: 500, color: "var(--coral)" }}>
              {RATING_LABELS[stars]} · {stars}/5
            </div>
            <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{RATING_HINTS[stars]}</div>
          </>
        ) : (
          <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Choisis une note de 1 à 5 étoiles</div>
        )}
      </div>
    </div>
  );
}

/** Rendu compact en lecture seule (pour listes denses). */
export function RatingBadge({ value }: { value: number }) {
  const stars = starsFromRating(value);
  const color = stars >= 4 ? "var(--coral)" : stars >= 3 ? "var(--muted-foreground)" : "var(--danger-text, #b94c4c)";
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5"
      style={{ fontSize: 11, fontWeight: 500, color, backgroundColor: "color-mix(in oklab, var(--muted) 70%, transparent)" }}>
      <Star size={11} fill={color} color={color} strokeWidth={1.4} />
      {stars}/5
    </span>
  );
}
