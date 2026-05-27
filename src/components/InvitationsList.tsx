import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Search,
  Copy,
  Send,
  XCircle,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Mail,
  UserPlus,
  Eye,
  CheckCheck,
} from "lucide-react";

type Status = "pending" | "accepted" | "expired" | "revoked";

interface Invitation {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  studio_id: string | null;
  studio_ids: string[] | null;
  contract: string | null;
  contracts: string[] | null;
  business_roles: string[] | null;
  app_role: string;
  status: Status;
  token: string;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
}

interface Studio {
  id: string;
  name: string;
}

type SubTab = "all" | "pending" | "expired" | "accepted" | "revoked";

const subTabs: { key: SubTab; label: string }[] = [
  { key: "all", label: "Toutes" },
  { key: "pending", label: "En attente" },
  { key: "expired", label: "Expirées" },
  { key: "accepted", label: "Acceptées" },
  { key: "revoked", label: "Révoquées" },
];

export function InvitationsList({ onInviteClick }: { onInviteClick: () => void }) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<SubTab>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [studios, setStudios] = useState<Studio[]>([]);

  const load = async () => {
    setLoading(true);
    const [{ data: invs }, { data: studs }] = await Promise.all([
      supabase
        .from("invitations")
        .select(
          "id, email, first_name, last_name, phone, studio_id, studio_ids, contract, contracts, business_roles, app_role, status, token, created_at, expires_at, accepted_at",
        )
        .order("created_at", { ascending: false }),
      supabase.from("studios").select("id, name"),
    ]);
    // Auto-mark expired
    const now = new Date();
    const cleaned = (invs ?? []).map((i) => {
      const inv = i as Invitation;
      if (inv.status === "pending" && new Date(inv.expires_at) < now) {
        return { ...inv, status: "expired" as Status };
      }
      return inv;
    });
    setInvitations(cleaned);
    setStudios(studs ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel("invitations-list")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "invitations" },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const studioName = (id: string | null) =>
    studios.find((s) => s.id === id)?.name?.replace("Skult ", "") ?? "—";

  const counts = useMemo(() => {
    return {
      all: invitations.length,
      pending: invitations.filter((i) => i.status === "pending").length,
      expired: invitations.filter((i) => i.status === "expired").length,
      accepted: invitations.filter((i) => i.status === "accepted").length,
      revoked: invitations.filter((i) => i.status === "revoked").length,
    };
  }, [invitations]);

  const filtered = useMemo(() => {
    return invitations.filter((i) => {
      if (tab !== "all" && i.status !== tab) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = `${i.first_name} ${i.last_name} ${i.email}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [invitations, tab, search]);

  const copyLink = async (token: string) => {
    // Toujours pointer vers le domaine de production (employé) — le lien sera partagé par email/SMS.
    const APP_URL = "https://app.shyft.flashsite.fr";
    const link = `${APP_URL}/activation?token=${token}`;
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Lien copié");
    } catch {
      toast.error("Impossible de copier");
    }
  };

  const resendEmail = async (inv: Invitation) => {
    const t = toast.loading("Renvoi de l'email...");
    const { error } = await supabase.functions.invoke("send-invitation", {
      body: {
        email: inv.email,
        first_name: inv.first_name,
        last_name: inv.last_name,
        phone: inv.phone,
        studio_ids: inv.studio_ids ?? (inv.studio_id ? [inv.studio_id] : []),
        contracts: inv.contracts ?? (inv.contract ? [inv.contract] : []),
        business_roles: inv.business_roles ?? [],
        app_role: inv.app_role,
      },
    });
    toast.dismiss(t);
    if (error) {
      toast.error("Erreur lors du renvoi");
      return;
    }
    // Revoke the old one (the new one replaces it)
    await supabase.from("invitations").update({ status: "revoked" }).eq("id", inv.id);
    toast.success(`Email renvoyé à ${inv.email}`);
    load();
  };

  const [bulkResending, setBulkResending] = useState(false);
  const resendAllPending = async () => {
    const pendings = invitations.filter((i) => i.status === "pending");
    if (pendings.length === 0) {
      toast.info("Aucune invitation en attente");
      return;
    }
    if (!confirm(`Renvoyer l'email d'activation à ${pendings.length} employé(s) en attente ?`)) return;
    setBulkResending(true);
    const t = toast.loading(`Envoi en cours (0/${pendings.length})...`);
    let ok = 0;
    let fail = 0;
    for (let idx = 0; idx < pendings.length; idx++) {
      const inv = pendings[idx];
      toast.loading(`Envoi en cours (${idx + 1}/${pendings.length})...`, { id: t });
      const { error } = await supabase.functions.invoke("send-invitation", {
        body: {
          email: inv.email,
          first_name: inv.first_name,
          last_name: inv.last_name,
          phone: inv.phone,
          studio_ids: inv.studio_ids ?? (inv.studio_id ? [inv.studio_id] : []),
          contracts: inv.contracts ?? (inv.contract ? [inv.contract] : []),
          business_roles: inv.business_roles ?? [],
          app_role: inv.app_role,
        },
      });
      if (error) {
        fail++;
      } else {
        ok++;
        await supabase.from("invitations").update({ status: "revoked" }).eq("id", inv.id);
      }
    }
    toast.dismiss(t);
    if (fail === 0) toast.success(`${ok} email(s) renvoyé(s)`);
    else toast.error(`${ok} envoyé(s), ${fail} en échec`);
    setBulkResending(false);
    load();
  };

  const revoke = async (inv: Invitation) => {
    if (!confirm(`Révoquer l'invitation de ${inv.first_name} ${inv.last_name} ?`)) return;
    const { error } = await supabase
      .from("invitations")
      .update({ status: "revoked" })
      .eq("id", inv.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Invitation révoquée");
    load();
  };

  const validateManually = async (inv: Invitation) => {
    if (
      !confirm(
        `⚠️ ATTENTION — Cette action CASSERA définitivement le lien d'activation de ${inv.first_name} ${inv.last_name}.\n\nÀ n'utiliser QUE si l'employé a déjà un compte créé hors de l'app (cas exceptionnel).\n\nDans 99% des cas, vous devez plutôt :\n• Renvoyer l'invitation, ou\n• Demander à l'employé de cliquer sur son lien d'activation reçu par email.\n\nConfirmer le marquage manuel comme « déjà inscrit hors-app » ?`,
      )
    )
      return;
    const { error } = await supabase
      .from("invitations")
      .update({ status: "accepted", accepted_at: new Date().toISOString() })
      .eq("id", inv.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Invitation marquée comme déjà inscrit hors-app");
    load();
  };

  return (
    <div>
      {/* Sub-tabs + search */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div
          className="flex items-center gap-2 rounded-md border px-3"
          style={{
            height: 32,
            borderColor: "var(--border)",
            backgroundColor: "var(--card)",
            width: 220,
          }}
        >
          <Search size={14} style={{ color: "var(--muted-foreground)" }} />
          <input
            type="text"
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border-0 bg-transparent outline-none flex-1"
            style={{ fontSize: 12, color: "var(--foreground)" }}
          />
        </div>
        <div className="flex items-center gap-1">
          {subTabs.map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className="rounded-full px-2.5 py-1 transition-colors"
                style={{
                  fontSize: 12,
                  fontWeight: active ? 500 : 400,
                  backgroundColor: active ? "var(--foreground)" : "transparent",
                  color: active ? "var(--card)" : "var(--muted-foreground)",
                  border: active ? "none" : "0.5px solid var(--border)",
                }}
              >
                {t.label} · {counts[t.key]}
              </button>
            );
          })}
        </div>
        <div className="ml-auto flex items-center gap-3">
          <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
            {filtered.length} invitation{filtered.length > 1 ? "s" : ""}
          </span>
          {counts.pending > 0 && (
            <button
              onClick={resendAllPending}
              disabled={bulkResending}
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5"
              style={{
                fontSize: 12,
                fontWeight: 500,
                backgroundColor: "transparent",
                color: "var(--foreground)",
                border: "0.5px solid var(--border)",
                opacity: bulkResending ? 0.5 : 1,
              }}
            >
              <Send size={13} /> {bulkResending ? "Envoi..." : `Renvoyer aux ${counts.pending} en attente`}
            </button>
          )}
          <button
            onClick={onInviteClick}
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5"
            style={{
              fontSize: 12,
              fontWeight: 500,
              backgroundColor: "var(--foreground)",
              color: "var(--card)",
            }}
          >
            <UserPlus size={13} /> Inviter
          </button>
        </div>
      </div>

      {/* Table */}
      <div
        className="rounded-xl border overflow-hidden"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
      >
        {loading ? (
          <div className="p-10 text-center">
            <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Chargement...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <div
              className="mx-auto mb-4 rounded-full flex items-center justify-center"
              style={{
                width: 44,
                height: 44,
                backgroundColor: "var(--muted)",
                color: "var(--muted-foreground)",
              }}
            >
              <Mail size={18} strokeWidth={1.6} />
            </div>
            <p style={{ fontSize: 14, fontWeight: 500 }}>
              Aucune invitation
              {tab !== "all" && ` ${subTabs.find((s) => s.key === tab)?.label.toLowerCase()}`}
            </p>
            <p style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 4 }}>
              {tab === "pending"
                ? "Tous les employés invités ont activé leur compte."
                : "Cliquez sur Inviter pour ajouter un nouvel employé."}
            </p>
          </div>
        ) : (
          <table className="w-full" style={{ fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "0.5px solid var(--border)" }}>
                {["Personne", "Email", "Studio", "Contrat", "Statut", "Envoyée", "Expire", ""].map(
                  (h) => (
                    <th
                      key={h}
                      className="text-left px-4 py-2.5"
                      style={{
                        fontSize: 11,
                        fontWeight: 500,
                        color: "var(--muted-foreground)",
                      }}
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {filtered.map((inv) => {
                const ids = (inv.studio_ids && inv.studio_ids.length > 0)
                  ? inv.studio_ids
                  : (inv.studio_id ? [inv.studio_id] : []);
                const names = ids.map((id) => studioName(id)).filter(Boolean);
                return (
                  <Row
                    key={inv.id}
                    inv={inv}
                    studioNames={names}
                    onCopy={() => copyLink(inv.token)}
                    onResend={() => resendEmail(inv)}
                    onRevoke={() => revoke(inv)}
                    onValidate={() => validateManually(inv)}
                    onPreview={() =>
                      window.open(`/activation?preview=${inv.id}`, "_blank", "noopener")
                    }
                  />
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Row({
  inv,
  studioNames,
  onCopy,
  onResend,
  onRevoke,
  onValidate,
  onPreview,
}: {
  inv: Invitation;
  studioNames: string[];
  onCopy: () => void;
  onResend: () => void;
  onRevoke: () => void;
  onValidate: () => void;
  onPreview: () => void;
}) {
  const initials = `${inv.first_name[0] ?? ""}${inv.last_name[0] ?? ""}`.toUpperCase();
  const contractsList = (inv.contracts && inv.contracts.length > 0)
    ? inv.contracts
    : (inv.contract ? [inv.contract] : []);
  return (
    <tr
      className="transition-colors"
      style={{ borderBottom: "0.5px solid var(--border)" }}
      onMouseEnter={(ev) => {
        (ev.currentTarget as HTMLElement).style.backgroundColor = "var(--muted)";
      }}
      onMouseLeave={(ev) => {
        (ev.currentTarget as HTMLElement).style.backgroundColor = "transparent";
      }}
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div
            className="flex items-center justify-center rounded-full shrink-0"
            style={{
              width: 30,
              height: 30,
              backgroundColor: "var(--muted)",
              color: "var(--muted-foreground)",
              fontSize: 10,
              fontWeight: 500,
            }}
          >
            {initials}
          </div>
          <div>
            <div style={{ fontWeight: 500, color: "var(--foreground)" }}>
              {inv.first_name} {inv.last_name}
            </div>
            {(inv.business_roles ?? []).length > 0 && (
              <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                {(inv.business_roles ?? []).join(" · ")}
              </div>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-3" style={{ color: "var(--muted-foreground)", fontSize: 12 }}>
        {inv.email}
      </td>
      <td className="px-4 py-3" style={{ fontSize: 12 }}>
        {studioNames.length === 0 ? (
          <span style={{ color: "var(--muted-foreground)" }}>—</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {studioNames.slice(0, 2).map((n) => (
              <span key={n} style={{ color: "var(--foreground)" }}>{n}</span>
            )).reduce<React.ReactNode[]>((acc, el, i) => {
              if (i > 0) acc.push(<span key={`sep-${i}`} style={{ color: "var(--muted-foreground)" }}>·</span>);
              acc.push(el);
              return acc;
            }, [])}
            {studioNames.length > 2 && (
              <span style={{ color: "var(--muted-foreground)" }}>+{studioNames.length - 2}</span>
            )}
          </div>
        )}
      </td>
      <td className="px-4 py-3">
        {contractsList.length === 0 ? (
          <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>—</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {contractsList.map((c) => (
              <span
                key={c}
                className="rounded-full px-2 py-0.5"
                style={{
                  fontSize: 11,
                  backgroundColor:
                    c === "CDI" ? "var(--info-bg)" : c === "Flexi" ? "var(--warning-bg)" : "var(--muted)",
                  color:
                    c === "CDI" ? "var(--info-text)" : c === "Flexi" ? "var(--warning-text)" : "var(--muted-foreground)",
                }}
              >
                {c}
              </span>
            ))}
          </div>
        )}
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={inv.status} />
      </td>
      <td className="px-4 py-3" style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
        {formatRelative(inv.created_at)}
      </td>
      <td className="px-4 py-3" style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
        {inv.status === "pending"
          ? formatRelative(inv.expires_at, true)
          : inv.status === "accepted" && inv.accepted_at
          ? `accepté ${formatRelative(inv.accepted_at)}`
          : "—"}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1 justify-end">
          <IconBtn label="Aperçu de l'onboarding" onClick={onPreview}>
            <Eye size={13} />
          </IconBtn>
          {inv.status === "pending" && (
            <>
              <IconBtn label="Copier le lien" onClick={onCopy}>
                <Copy size={13} />
              </IconBtn>
              <IconBtn label="Renvoyer" onClick={onResend}>
                <Send size={13} />
              </IconBtn>
              <IconBtn label="Marquer comme déjà inscrit hors-app (casse le lien)" onClick={onValidate}>
                <CheckCheck size={13} />
              </IconBtn>
              <IconBtn label="Révoquer" onClick={onRevoke} danger>
                <XCircle size={13} />
              </IconBtn>
            </>
          )}
          {inv.status === "expired" && (
            <IconBtn label="Renvoyer une nouvelle invitation" onClick={onResend}>
              <Send size={13} />
            </IconBtn>
          )}
        </div>
      </td>
    </tr>
  );
}

function StatusBadge({ status }: { status: Status }) {
  const cfg: Record<Status, { label: string; bg: string; text: string; Icon: typeof Clock }> = {
    pending: {
      label: "En attente",
      bg: "var(--warning-bg)",
      text: "var(--warning-text)",
      Icon: Clock,
    },
    accepted: {
      label: "Acceptée",
      bg: "var(--success-bg)",
      text: "var(--success-text)",
      Icon: CheckCircle2,
    },
    expired: {
      label: "Expirée",
      bg: "var(--muted)",
      text: "var(--muted-foreground)",
      Icon: AlertTriangle,
    },
    revoked: {
      label: "Révoquée",
      bg: "var(--danger-bg)",
      text: "var(--danger-text)",
      Icon: XCircle,
    },
  };
  const c = cfg[status];
  const Icon = c.Icon;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5"
      style={{ fontSize: 11, backgroundColor: c.bg, color: c.text }}
    >
      <Icon size={11} strokeWidth={1.8} />
      {c.label}
    </span>
  );
}

function IconBtn({
  children,
  onClick,
  label,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className="rounded-md p-1.5 transition-colors"
      style={{
        color: danger ? "var(--danger-text)" : "var(--muted-foreground)",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.backgroundColor = danger
          ? "var(--danger-bg)"
          : "var(--muted)";
        (e.currentTarget as HTMLElement).style.color = danger
          ? "var(--danger-text)"
          : "var(--foreground)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
        (e.currentTarget as HTMLElement).style.color = danger
          ? "var(--danger-text)"
          : "var(--muted-foreground)";
      }}
    >
      {children}
    </button>
  );
}

function formatRelative(iso: string, future = false) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = future ? d.getTime() - now.getTime() : now.getTime() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return future ? "expire bientôt" : "à l'instant";
  if (mins < 60) return future ? `dans ${mins} min` : `il y a ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return future ? `dans ${hours}h` : `il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return future ? `dans ${days}j` : `il y a ${days}j`;
  return d.toLocaleDateString("fr-BE", { day: "numeric", month: "short" });
}
