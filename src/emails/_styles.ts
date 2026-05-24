import type { CSSProperties } from "react";

export const h1: CSSProperties = {
  color: "#18181B",
  fontSize: "24px",
  fontWeight: 600,
  margin: "0 0 16px",
  lineHeight: 1.3,
};

export const h3: CSSProperties = {
  color: "#18181B",
  fontSize: "16px",
  fontWeight: 600,
  margin: "24px 0 8px",
};

export const paragraph: CSSProperties = {
  color: "#18181B",
  fontSize: "15px",
  lineHeight: 1.6,
  margin: "0 0 16px",
};

export const muted: CSSProperties = {
  color: "#71717A",
  fontSize: "13px",
  lineHeight: 1.6,
  margin: "12px 0 0",
};

export const mutedCenter: CSSProperties = {
  ...muted,
  textAlign: "center",
};

export const ctaSection: CSSProperties = {
  textAlign: "center",
  padding: "8px 0 16px",
};

export const ctaButton: CSSProperties = {
  backgroundColor: "#FF6B5B",
  color: "#ffffff",
  padding: "14px 28px",
  borderRadius: "12px",
  fontSize: "16px",
  fontWeight: 500,
  textDecoration: "none",
  display: "inline-block",
};

export const card: CSSProperties = {
  border: "1px solid #E4E4E7",
  borderRadius: "12px",
  padding: "16px",
  backgroundColor: "#FAFAFA",
  margin: "16px 0",
};

export const cardCoral: CSSProperties = {
  border: "1px solid #FF6B5B",
  borderRadius: "12px",
  padding: "16px",
  backgroundColor: "#FFF5F4",
  margin: "16px 0",
};

export const cardRed: CSSProperties = {
  border: "1px solid #DC2626",
  borderRadius: "12px",
  padding: "16px",
  backgroundColor: "#FEF2F2",
  margin: "16px 0",
};

export const cardAmber: CSSProperties = {
  border: "1px solid #F59E0B",
  borderRadius: "12px",
  padding: "16px",
  backgroundColor: "#FFFBEB",
  margin: "16px 0",
};

export const cardBlock: CSSProperties = {
  backgroundColor: "#F4F4F5",
  borderRadius: "10px",
  padding: "16px",
  margin: "16px 0",
  fontStyle: "italic",
  color: "#52525B",
  fontSize: "14px",
  lineHeight: 1.6,
};

export const bigDate: CSSProperties = {
  color: "#18181B",
  fontSize: "18px",
  fontWeight: 600,
  margin: "0 0 4px",
};

export const cardLine: CSSProperties = {
  color: "#18181B",
  fontSize: "14px",
  margin: "2px 0",
};

export const hr: CSSProperties = {
  borderColor: "#E4E4E7",
  margin: "24px 0 16px",
};
