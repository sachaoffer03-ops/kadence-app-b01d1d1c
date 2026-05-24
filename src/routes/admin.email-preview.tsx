import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { render } from "@react-email/render";
import { EMAIL_REGISTRY } from "@/emails";

export const Route = createFileRoute("/admin/email-preview")({
  component: EmailPreviewPage,
  head: () => ({ meta: [{ title: "Aperçu des emails — Kadence" }] }),
});

function EmailPreviewPage() {
  const [selectedId, setSelectedId] = useState(EMAIL_REGISTRY[0].id);
  const selected = useMemo(
    () => EMAIL_REGISTRY.find((t) => t.id === selectedId)!,
    [selectedId],
  );
  const [html, setHtml] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    const Component = selected.component as React.ComponentType<any>;
    Promise.resolve(render(React.createElement(Component, selected.mockData)))
      .then((out) => {
        if (!cancelled) setHtml(out as string);
      })
      .catch((e: any) => {
        if (!cancelled) setHtml(`<pre>Erreur rendu: ${e.message}</pre>`);
      });
    return () => {
      cancelled = true;
    };
  }, [selected]);

  const employeeEmails = EMAIL_REGISTRY.filter(
    (t) => t.category === "employee",
  );
  const adminEmails = EMAIL_REGISTRY.filter((t) => t.category === "admin");

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "var(--background)",
        padding: "32px",
      }}
    >
      <div style={{ maxWidth: 1400, margin: "0 auto" }}>
        <h1
          style={{
            fontSize: 28,
            fontWeight: 500,
            color: "var(--foreground)",
            margin: 0,
          }}
        >
          Aperçu des emails
        </h1>
        <p
          style={{
            color: "var(--muted-foreground)",
            margin: "8px 0 24px",
            fontSize: 14,
          }}
        >
          {EMAIL_REGISTRY.length} templates — visualise et teste chacun avant
          qu'ils ne partent en prod.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "240px 1fr 1fr",
            gap: 16,
            alignItems: "start",
          }}
        >
          {/* Sidebar */}
          <div
            style={{
              backgroundColor: "var(--card)",
              border: "0.5px solid var(--border)",
              borderRadius: 12,
              padding: 12,
              position: "sticky",
              top: 16,
            }}
          >
            <SidebarSection
              title="Employé"
              items={employeeEmails}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
            <div style={{ height: 16 }} />
            <SidebarSection
              title="Admin"
              items={adminEmails}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          </div>

          {/* Metadata */}
          <div
            style={{
              backgroundColor: "var(--card)",
              border: "0.5px solid var(--border)",
              borderRadius: 12,
              padding: 20,
            }}
          >
            <h2
              style={{
                fontSize: 18,
                fontWeight: 500,
                margin: 0,
                color: "var(--foreground)",
              }}
            >
              {selected.name}
            </h2>
            <p
              style={{
                color: "var(--muted-foreground)",
                margin: "4px 0 16px",
                fontSize: 13,
              }}
            >
              {selected.description}
            </p>

            <Label>Sujet</Label>
            <div
              style={{
                fontSize: 13,
                color: "var(--foreground)",
                padding: "8px 10px",
                backgroundColor: "var(--muted)",
                borderRadius: 8,
                marginBottom: 16,
              }}
            >
              {selected.subject}
            </div>

            <Label>Variables mock</Label>
            <pre
              style={{
                fontSize: 12,
                color: "var(--foreground)",
                backgroundColor: "var(--muted)",
                padding: 12,
                borderRadius: 8,
                overflow: "auto",
                margin: 0,
                fontFamily:
                  "ui-monospace, SFMono-Regular, Menlo, Monaco, monospace",
              }}
            >
              {JSON.stringify(selected.mockData, null, 2)}
            </pre>
          </div>

          {/* Preview */}
          <div
            style={{
              backgroundColor: "var(--card)",
              border: "0.5px solid var(--border)",
              borderRadius: 12,
              padding: 12,
              minHeight: 600,
            }}
          >
            <iframe
              title={`Preview ${selected.name}`}
              srcDoc={html}
              style={{
                width: "100%",
                height: 720,
                border: "0.5px solid var(--border)",
                borderRadius: 8,
                backgroundColor: "#F4F4F5",
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 500,
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        color: "var(--muted-foreground)",
        margin: "0 0 6px",
      }}
    >
      {children}
    </div>
  );
}

function SidebarSection({
  title,
  items,
  selectedId,
  onSelect,
}: {
  title: string;
  items: typeof EMAIL_REGISTRY;
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div>
      <div
        style={{
          fontSize: 11,
          fontWeight: 500,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          color: "var(--muted-foreground)",
          padding: "4px 8px 8px",
        }}
      >
        {title} ({items.length})
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {items.map((t) => {
          const isActive = selectedId === t.id;
          return (
            <button
              key={t.id}
              onClick={() => onSelect(t.id)}
              className="text-left rounded-lg px-3 py-2"
              style={{
                fontSize: 13,
                color: "var(--foreground)",
                backgroundColor: isActive ? "var(--muted)" : "transparent",
                fontWeight: isActive ? 500 : 400,
                border: isActive
                  ? "0.5px solid var(--border)"
                  : "0.5px solid transparent",
                cursor: "pointer",
              }}
            >
              {t.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
