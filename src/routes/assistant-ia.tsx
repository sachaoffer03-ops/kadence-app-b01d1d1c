import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Bot, Plus, Search, Pencil, Trash2, Power, Sparkles, BookOpen, Tag, X,
  Loader2, CheckCircle2, Circle, MessageSquare, BarChart3, ThumbsUp, ThumbsDown,
  Type, HelpCircle, Link2, FileUp, Table2, Send, User, Download, ExternalLink, Wand2, ChevronDown,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import {
  listKnowledgeEntries, upsertKnowledgeEntry, toggleKnowledgeEntry, deleteKnowledgeEntry,
  getKnowledgeFileUrl, KNOWLEDGE_CATEGORIES, KNOWLEDGE_TYPES,
} from "@/lib/ai-knowledge.functions";
import {
  listChatConversations, getConversation, rateMessage, deleteMessageFeedback, getBotStats,
} from "@/lib/ai-admin.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/assistant-ia")({
  component: AssistantIAPage,
  head: () => ({ meta: [{ title: "Assistant IA — Kadence" }] }),
});

type EntryType = "text" | "faq" | "link" | "file" | "table";
type Entry = {
  id: string; title: string; content: string; category: string;
  tags: string[]; priority: number; is_active: boolean;
  entry_type: EntryType; data: any;
  author_id: string | null; created_at: string; updated_at: string;
};

const ALL = "__all__";
const TYPE_ICONS: Record<EntryType, any> = {
  text: Type, faq: HelpCircle, link: Link2, file: FileUp, table: Table2,
};

function categoryLabel(v: string) { return KNOWLEDGE_CATEGORIES.find((c) => c.value === v)?.label ?? v; }
function typeLabel(v: EntryType) { return KNOWLEDGE_TYPES.find((t) => t.value === v)?.label ?? v; }

/* ============================================================ ROOT ============================================================ */

function AssistantIAPage() {
  const [tab, setTab] = useState<"knowledge" | "conversations" | "performance">("knowledge");

  return (
    <div className="p-4 md:p-6">
      <div className="mb-5 flex items-start gap-3">
        <div className="rounded-xl flex items-center justify-center shrink-0"
          style={{ width: 44, height: 44, backgroundColor: "var(--coral)" }}>
          <Bot size={22} color="var(--coral-text)" strokeWidth={1.8} />
        </div>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 500, marginBottom: 2 }}>Assistant IA</h1>
          <p style={{ fontSize: 13, color: "var(--muted-foreground)", maxWidth: 620 }}>
            Alimente, supervise et améliore le chatbot Kadence en continu.
          </p>
        </div>
      </div>

      <div className="flex gap-1 mb-5 border-b" style={{ borderColor: "var(--border)" }}>
        {[
          { k: "knowledge", l: "Bases de connaissances", icon: BookOpen },
          { k: "conversations", l: "Conversations", icon: MessageSquare },
          { k: "performance", l: "Performance", icon: BarChart3 },
        ].map((t) => {
          const active = tab === t.k;
          const Icon = t.icon;
          return (
            <button key={t.k} onClick={() => setTab(t.k as any)}
              className="px-3 py-2.5 inline-flex items-center gap-2"
              style={{
                fontSize: 13, fontWeight: 500,
                color: active ? "var(--foreground)" : "var(--muted-foreground)",
                borderBottom: active ? "2px solid var(--coral)" : "2px solid transparent",
                marginBottom: -1,
              }}>
              <Icon size={14} /> {t.l}
            </button>
          );
        })}
      </div>

      {tab === "knowledge" && <KnowledgeTab />}
      {tab === "conversations" && <ConversationsTab />}
      {tab === "performance" && <PerformanceTab />}
    </div>
  );
}

/* ============================================================ KNOWLEDGE ============================================================ */

function KnowledgeTab() {
  const list = useServerFn(listKnowledgeEntries);
  const upsert = useServerFn(upsertKnowledgeEntry);
  const toggle = useServerFn(toggleKnowledgeEntry);
  const del = useServerFn(deleteKnowledgeEntry);

  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>(ALL);
  const [typeFilter, setTypeFilter] = useState<EntryType | typeof ALL>(ALL);
  const [editing, setEditing] = useState<Partial<Entry> | null>(null);

  const load = async () => {
    setLoading(true);
    try { const r = await list(); setEntries(r.entries as Entry[]); }
    catch (e: any) { toast.error(e?.message || "Erreur"); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    return entries.filter((e) => {
      if (cat !== ALL && e.category !== cat) return false;
      if (typeFilter !== ALL && e.entry_type !== typeFilter) return false;
      if (!n) return true;
      return e.title.toLowerCase().includes(n)
        || e.content.toLowerCase().includes(n)
        || e.tags.some((t) => t.toLowerCase().includes(n));
    });
  }, [entries, q, cat, typeFilter]);

  const countsByType = useMemo(() => {
    const c: Record<string, number> = { text: 0, faq: 0, link: 0, file: 0, table: 0 };
    for (const e of entries) c[e.entry_type] = (c[e.entry_type] || 0) + 1;
    return c;
  }, [entries]);

  const handleSave = async (p: Partial<Entry>) => {
    try {
      await upsert({ data: {
        id: p.id, title: (p.title || "").trim(), content: (p.content || "").trim(),
        category: p.category || "general", tags: p.tags || [],
        priority: p.priority ?? 0, is_active: p.is_active ?? true,
        entry_type: (p.entry_type as EntryType) || "text", data: p.data || {},
      }});
      toast.success(p.id ? "Mise à jour" : "Ajouté");
      setEditing(null); await load();
    } catch (e: any) { toast.error(e?.message || "Échec"); }
  };

  const handleToggle = async (e: Entry) => {
    await toggle({ data: { id: e.id, is_active: !e.is_active } });
    setEntries((prev) => prev.map((x) => x.id === e.id ? { ...x, is_active: !x.is_active } : x));
  };
  const handleDelete = async (e: Entry) => {
    if (!confirm(`Supprimer "${e.title}" ?`)) return;
    await del({ data: { id: e.id } });
    setEntries((prev) => prev.filter((x) => x.id !== e.id));
    toast.success("Supprimé");
  };

  return (
    <div>
      {/* Type cards (like screenshot) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 mb-5">
        {KNOWLEDGE_TYPES.map((t) => {
          const Icon = TYPE_ICONS[t.value as EntryType];
          const active = typeFilter === t.value;
          return (
            <button key={t.value}
              onClick={() => setTypeFilter(typeFilter === t.value ? ALL : t.value as EntryType)}
              className="rounded-lg p-3 text-left transition"
              style={{
                backgroundColor: "#fff",
                border: active ? "1px solid var(--coral)" : "0.5px solid var(--border)",
              }}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="rounded-md flex items-center justify-center"
                  style={{ width: 28, height: 28, backgroundColor: active ? "var(--coral)" : "var(--muted)" }}>
                  <Icon size={14} color={active ? "var(--coral-text)" : "var(--foreground)"} />
                </div>
                <button onClick={(ev) => { ev.stopPropagation(); setEditing({ entry_type: t.value as EntryType, category: "general", tags: [], priority: 0, is_active: true, data: {} }); }}
                  className="rounded p-1" style={{ color: "var(--muted-foreground)" }}>
                  <Plus size={14} />
                </button>
              </div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{t.label}</div>
              <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                {countsByType[t.value] ?? 0} {countsByType[t.value] === 1 ? "entrée" : "entrées"}
              </div>
            </button>
          );
        })}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="flex items-center gap-2 px-3 rounded-md flex-1"
          style={{ border: "0.5px solid var(--border)", backgroundColor: "#fff" }}>
          <Search size={14} color="var(--muted-foreground)" />
          <input value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher…"
            className="flex-1 py-2 outline-none bg-transparent" style={{ fontSize: 13 }} />
          {q && <button onClick={() => setQ("")}><X size={14} color="var(--muted-foreground)" /></button>}
        </div>
        <div className="sm:w-64">
          <Select value={cat} onChange={setCat}
            options={[{ value: ALL, label: "Toutes catégories" }, ...KNOWLEDGE_CATEGORIES.map((c) => ({ value: c.value, label: c.label }))]} />
        </div>
        <button onClick={() => setEditing({ entry_type: "text", category: "general", tags: [], priority: 0, is_active: true, data: {} })}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-md"
          style={{ fontSize: 13, fontWeight: 500, backgroundColor: "var(--foreground)", color: "var(--coral)" }}>
          <Plus size={14} /> Nouvelle
        </button>
      </div>

      {loading ? (
        <Loading />
      ) : filtered.length === 0 ? (
        <Empty msg={typeFilter !== ALL || cat !== ALL || q ? "Rien ne correspond" : "Aucune entrée pour l'instant"} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {filtered.map((e) => (
            <EntryCard key={e.id} entry={e} onEdit={() => setEditing(e)}
              onToggle={() => handleToggle(e)} onDelete={() => handleDelete(e)} />
          ))}
        </div>
      )}

      {editing && (
        <EditSheet initial={editing} onClose={() => setEditing(null)} onSave={handleSave} />
      )}
    </div>
  );
}

function EntryCard({ entry, onEdit, onToggle, onDelete }:
  { entry: Entry; onEdit: () => void; onToggle: () => void; onDelete: () => void }) {
  const dim = !entry.is_active;
  const Icon = TYPE_ICONS[entry.entry_type] ?? Type;
  return (
    <div className="p-4 rounded-lg flex flex-col gap-2"
      style={{ backgroundColor: "#fff", border: "0.5px solid var(--border)", opacity: dim ? 0.55 : 1 }}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded"
              style={{ fontSize: 10, fontWeight: 500, backgroundColor: "var(--muted)", color: "var(--foreground)" }}>
              <Icon size={10} /> {typeLabel(entry.entry_type)}
            </span>
            <span style={{ fontSize: 10, color: "var(--muted-foreground)" }}>{categoryLabel(entry.category)}</span>
            {entry.priority > 0 && <span style={{ fontSize: 10, color: "var(--coral)" }}><Sparkles size={10} className="inline" /> {entry.priority}</span>}
            <span style={{ fontSize: 10, color: dim ? "var(--muted-foreground)" : "#2d8a5f" }} className="inline-flex items-center gap-1">
              {dim ? <Circle size={10} /> : <CheckCircle2 size={10} />}{dim ? "Off" : "Actif"}
            </span>
          </div>
          <h3 style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.3 }} className="truncate">{entry.title}</h3>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <IconBtn title={entry.is_active ? "Désactiver" : "Activer"} onClick={onToggle}><Power size={14} /></IconBtn>
          <IconBtn title="Modifier" onClick={onEdit}><Pencil size={14} /></IconBtn>
          <IconBtn title="Supprimer" onClick={onDelete}><Trash2 size={14} /></IconBtn>
        </div>
      </div>
      <p style={{ fontSize: 12, color: "var(--muted-foreground)", lineHeight: 1.5 }} className="line-clamp-3">{entry.content}</p>
      {entry.tags.length > 0 && (
        <div className="flex gap-1 flex-wrap">
          {entry.tags.map((t) => (
            <span key={t} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded"
              style={{ fontSize: 10, color: "var(--muted-foreground)", border: "0.5px solid var(--border)" }}>
              <Tag size={9} /> {t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function IconBtn({ children, onClick, title }: any) {
  return (
    <button onClick={onClick} title={title}
      className="rounded-md p-1.5 hover:bg-black/5" style={{ color: "var(--muted-foreground)" }}>
      {children}
    </button>
  );
}

/* ============================================================ EDIT SHEET ============================================================ */

function EditSheet({ initial, onClose, onSave }:
  { initial: Partial<Entry>; onClose: () => void; onSave: (e: Partial<Entry>) => Promise<void> }) {
  const [entryType, setEntryType] = useState<EntryType>((initial.entry_type as EntryType) || "text");
  const [title, setTitle] = useState(initial.title || "");
  const [content, setContent] = useState(initial.content || "");
  const [category, setCategory] = useState(initial.category || "general");
  
  const [priority, setPriority] = useState(initial.priority ?? 0);
  const [isActive, setIsActive] = useState(initial.is_active ?? true);
  const [saving, setSaving] = useState(false);

  // type-specific fields
  const [faqQ, setFaqQ] = useState(initial.data?.question || "");
  const [faqA, setFaqA] = useState(initial.data?.answer || "");
  const [linkUrl, setLinkUrl] = useState(initial.data?.url || "");
  const [linkDesc, setLinkDesc] = useState(initial.data?.description || "");
  const [filePath, setFilePath] = useState(initial.data?.file_path || "");
  const [fileName, setFileName] = useState(initial.data?.file_name || "");
  const [fileDesc, setFileDesc] = useState(initial.data?.description || "");
  const [uploading, setUploading] = useState(false);
  const [tableText, setTableText] = useState(initial.data?.raw || "");

  // Auto-compute content
  useEffect(() => {
    if (entryType === "faq") {
      setContent(`**Q :** ${faqQ}\n\n**R :** ${faqA}`);
      if (!title.trim() && faqQ) setTitle(faqQ.slice(0, 100));
    } else if (entryType === "link") {
      setContent([title ? title : "", linkUrl, linkDesc].filter(Boolean).join(" — "));
    } else if (entryType === "file") {
      setContent(`Fichier joint : ${fileName || "(aucun)"}${fileDesc ? `\n\n${fileDesc}` : ""}`);
      if (!title.trim() && fileName) setTitle(fileName);
    } else if (entryType === "table") {
      setContent(tableText);
    }
    // text mode: user types content directly
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryType, faqQ, faqA, linkUrl, linkDesc, fileName, fileDesc, tableText]);

  const onPickFile = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("ai-knowledge").upload(path, file, { upsert: false });
      if (error) throw error;
      setFilePath(path); setFileName(file.name);
      toast.success("Fichier importé");
    } catch (e: any) {
      toast.error(e?.message || "Upload échoué");
    } finally { setUploading(false); }
  };

  const submit = async () => {
    if (!title.trim()) { toast.error("Titre requis"); return; }
    if (!content.trim()) { toast.error("Contenu vide"); return; }
    setSaving(true);
    let data: any = {};
    if (entryType === "faq") data = { question: faqQ, answer: faqA };
    else if (entryType === "link") data = { url: linkUrl, description: linkDesc };
    else if (entryType === "file") data = { file_path: filePath, file_name: fileName, description: fileDesc };
    else if (entryType === "table") data = { raw: tableText };
    try {
      await onSave({
        id: initial.id, title, content, category,
        tags: [],
        priority, is_active: isActive, entry_type: entryType, data,
      });
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end" style={{ backgroundColor: "rgba(0,0,0,0.35)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="h-full overflow-y-auto"
        style={{ width: "100%", maxWidth: 680, backgroundColor: "#FAFAF8" }}>
        <div className="sticky top-0 z-10 px-5 py-4 flex items-center justify-between"
          style={{ backgroundColor: "#FAFAF8", borderBottom: "0.5px solid var(--border)" }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 500 }}>{initial.id ? "Modifier" : "Nouvelle connaissance"}</div>
            <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Sera utilisée par le chatbot</div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md"><X size={18} /></button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          {/* Type selector */}
          <div>
            <Label>Type</Label>
            <div className="grid grid-cols-5 gap-1.5">
              {KNOWLEDGE_TYPES.map((t) => {
                const Icon = TYPE_ICONS[t.value as EntryType];
                const active = entryType === t.value;
                return (
                  <button key={t.value} type="button" onClick={() => setEntryType(t.value as EntryType)}
                    className="flex flex-col items-center gap-1 py-2.5 rounded-md transition"
                    style={{
                      backgroundColor: active ? "var(--coral)" : "#fff",
                      color: active ? "var(--coral-text)" : "var(--foreground)",
                      border: active ? "none" : "0.5px solid var(--border)",
                    }}>
                    <Icon size={14} />
                    <span style={{ fontSize: 10, fontWeight: 500 }}>{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <Field label="Titre">
            <Input value={title} onChange={setTitle} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Catégorie">
              <Select value={category} onChange={setCategory}
                options={KNOWLEDGE_CATEGORIES.map((c) => ({ value: c.value, label: c.label }))} />
            </Field>
            <Field label="Priorité" hint="0–100, plus haut = plus important">
              <Input type="number" value={String(priority)} onChange={(v: string) => setPriority(parseInt(v || "0", 10))} />
            </Field>
          </div>

          {entryType === "text" && (
            <Field label="Contenu" hint="Markdown supporté">
              <Textarea value={content} onChange={setContent} rows={10} />
            </Field>
          )}

          {entryType === "faq" && (
            <>
              <Field label="Question"><Input value={faqQ} onChange={setFaqQ} /></Field>
              <Field label="Réponse"><Textarea value={faqA} onChange={setFaqA} rows={6} /></Field>
            </>
          )}

          {entryType === "link" && (
            <>
              <Field label="URL"><Input value={linkUrl} onChange={setLinkUrl} placeholder="https://…" /></Field>
              <Field label="Description (ce que contient le lien)">
                <Textarea value={linkDesc} onChange={setLinkDesc} rows={4} />
              </Field>
            </>
          )}

          {entryType === "file" && (
            <>
              <Field label="Fichier">
                <div className="flex items-center gap-2">
                  <label className="inline-flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer"
                    style={{ backgroundColor: "#fff", border: "0.5px solid var(--border)", fontSize: 13 }}>
                    {uploading ? <Loader2 size={14} className="animate-spin" /> : <FileUp size={14} />}
                    {fileName ? "Remplacer" : "Choisir un fichier"}
                    <input type="file" className="hidden"
                      onChange={(e) => e.target.files?.[0] && onPickFile(e.target.files[0])} />
                  </label>
                  {fileName && <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{fileName}</span>}
                </div>
              </Field>
              <Field label="Description / résumé du fichier" hint="Pour que le bot sache de quoi il s'agit">
                <Textarea value={fileDesc} onChange={setFileDesc} rows={5} />
              </Field>
            </>
          )}

          {entryType === "table" && (
            <Field label="Tableau (Markdown)" hint="Ex : | Col1 | Col2 |&#10;|---|---|&#10;| a | b |">
              <Textarea value={tableText} onChange={setTableText} rows={10} />
            </Field>
          )}


          <label className="inline-flex items-center gap-2" style={{ fontSize: 13 }}>
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            Actif (utilisé par le bot)
          </label>

          <div className="flex gap-2 pt-2">
            <button onClick={onClose} className="px-4 py-2 rounded-md"
              style={{ fontSize: 13, border: "0.5px solid var(--border)", backgroundColor: "#fff" }}>
              Annuler
            </button>
            <button onClick={submit} disabled={saving}
              className="flex-1 px-4 py-2 rounded-md disabled:opacity-50 inline-flex items-center justify-center gap-2"
              style={{ fontSize: 13, fontWeight: 500, backgroundColor: "var(--foreground)", color: "var(--coral)" }}>
              {saving && <Loader2 size={14} className="animate-spin" />}
              Enregistrer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================ CONVERSATIONS ============================================================ */

type Conv = {
  user_id: string; last_message: string; last_role: string; last_at: string; count: number;
  first_name: string | null; last_name: string | null; avatar_url: string | null;
  feedback: { up: number; down: number; correction: number };
};

function ConversationsTab() {
  const list = useServerFn(listChatConversations);
  const [convs, setConvs] = useState<Conv[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const load = async () => {
    setLoading(true);
    try { const r = await list(); setConvs(r.conversations as any); }
    catch (e: any) { toast.error(e?.message || "Erreur"); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  // Realtime: any new message → reload list
  useEffect(() => {
    const ch = supabase.channel("admin-ai-chat")
      .on("postgres_changes", { event: "*", schema: "public", table: "ai_chat_messages" }, () => { void load(); })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return convs;
    return convs.filter((c) => {
      const name = `${c.first_name ?? ""} ${c.last_name ?? ""}`.toLowerCase();
      return name.includes(n) || c.last_message.toLowerCase().includes(n);
    });
  }, [convs, q]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4" style={{ minHeight: 600 }}>
      <div className="rounded-lg overflow-hidden flex flex-col"
        style={{ backgroundColor: "#fff", border: "0.5px solid var(--border)", maxHeight: "75vh" }}>
        <div className="p-3 flex items-center gap-2" style={{ borderBottom: "0.5px solid var(--border)" }}>
          <Search size={14} color="var(--muted-foreground)" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher employé…"
            className="flex-1 outline-none bg-transparent" style={{ fontSize: 13 }} />
          <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{filtered.length}</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? <Loading /> : filtered.length === 0 ? (
            <div className="p-6 text-center" style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
              Aucune conversation
            </div>
          ) : filtered.map((c) => {
            const name = `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "Employé";
            const initials = (c.first_name?.[0] ?? "") + (c.last_name?.[0] ?? "");
            const active = selected === c.user_id;
            return (
              <button key={c.user_id} onClick={() => setSelected(c.user_id)}
                className="w-full text-left p-3 flex items-start gap-2.5 transition"
                style={{
                  backgroundColor: active ? "rgba(240,153,123,0.12)" : "transparent",
                  borderBottom: "0.5px solid var(--border)",
                  borderLeft: active ? "2px solid var(--coral)" : "2px solid transparent",
                }}>
                <div className="rounded-full flex items-center justify-center shrink-0"
                  style={{ width: 32, height: 32, backgroundColor: "var(--muted)", fontSize: 11, fontWeight: 500 }}>
                  {initials || <User size={14} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span style={{ fontSize: 13, fontWeight: 500 }} className="truncate">{name}</span>
                    <span style={{ fontSize: 10, color: "var(--muted-foreground)" }}>
                      {timeAgo(c.last_at)}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--muted-foreground)" }} className="truncate">
                    {c.last_role === "assistant" ? "🤖 " : ""}{c.last_message}
                  </div>
                  <div className="flex items-center gap-2 mt-1" style={{ fontSize: 10, color: "var(--muted-foreground)" }}>
                    <span>{c.count} msg</span>
                    {c.feedback.up > 0 && <span style={{ color: "#2d8a5f" }}>👍 {c.feedback.up}</span>}
                    {c.feedback.down > 0 && <span style={{ color: "#c44" }}>👎 {c.feedback.down}</span>}
                    {c.feedback.correction > 0 && <span style={{ color: "var(--coral)" }}>✏️ {c.feedback.correction}</span>}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-lg overflow-hidden"
        style={{ backgroundColor: "#fff", border: "0.5px solid var(--border)", maxHeight: "75vh" }}>
        {selected
          ? <ConversationDetail userId={selected} onSelectUser={() => setSelected(null)} />
          : <div className="h-full flex flex-col items-center justify-center p-8 text-center" style={{ minHeight: 400 }}>
              <MessageSquare size={32} color="var(--muted-foreground)" />
              <div style={{ fontSize: 14, fontWeight: 500, marginTop: 12 }}>Sélectionne une conversation</div>
              <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 4 }}>
                Pour visualiser les échanges et noter les réponses du bot.
              </div>
            </div>}
      </div>
    </div>
  );
}

type Msg = {
  id: string; role: "user" | "assistant"; content: string; created_at: string;
  feedback: null | { id: string; rating: "up" | "down" | "correction"; comment: string | null; corrected_answer: string | null };
};

function ConversationDetail({ userId, onSelectUser }: { userId: string; onSelectUser: () => void }) {
  const getConv = useServerFn(getConversation);
  const rate = useServerFn(rateMessage);
  const delFb = useServerFn(deleteMessageFeedback);

  const [profile, setProfile] = useState<any>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<{ msg: Msg; mode: "down" | "correction" } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await getConv({ data: { userId } });
      setProfile(r.profile); setMessages(r.messages as any);
    } catch (e: any) { toast.error(e?.message || "Erreur"); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [userId]);

  // Realtime: stream new messages
  useEffect(() => {
    const ch = supabase.channel(`admin-conv-${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "ai_chat_messages", filter: `user_id=eq.${userId}` },
        () => { void load(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "ai_message_feedback" },
        () => { void load(); })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
    // eslint-disable-next-line
  }, [userId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  const doRate = async (msg: Msg, rating: "up" | "down" | "correction", payload?: { comment?: string; corrected_answer?: string }) => {
    try {
      await rate({ data: { message_id: msg.id, rating, comment: payload?.comment, corrected_answer: payload?.corrected_answer } });
      toast.success(rating === "up" ? "Bot félicité 👍" : rating === "down" ? "Feedback enregistré" : "Rectification enregistrée, le bot va apprendre");
      void load();
    } catch (e: any) { toast.error(e?.message || "Erreur"); }
  };

  const removeFeedback = async (msg: Msg) => {
    await delFb({ data: { message_id: msg.id } });
    void load();
  };

  if (loading) return <Loading />;
  const name = `${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim() || "Employé";

  return (
    <div className="flex flex-col h-full" style={{ maxHeight: "75vh" }}>
      <div className="p-3 flex items-center justify-between" style={{ borderBottom: "0.5px solid var(--border)" }}>
        <div className="flex items-center gap-2.5">
          <button onClick={onSelectUser} className="lg:hidden p-1"><X size={14} /></button>
          <div className="rounded-full flex items-center justify-center"
            style={{ width: 32, height: 32, backgroundColor: "var(--muted)", fontSize: 11, fontWeight: 500 }}>
            {(profile?.first_name?.[0] ?? "") + (profile?.last_name?.[0] ?? "")}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500 }}>{name}</div>
            <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{messages.length} messages</div>
          </div>
        </div>
        <div className="inline-flex items-center gap-1" style={{ fontSize: 10, color: "var(--muted-foreground)" }}>
          <div className="rounded-full" style={{ width: 6, height: 6, backgroundColor: "#2d8a5f" }} />
          Temps réel
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 flex flex-col gap-3"
        style={{ backgroundColor: "#FAFAF8" }}>
        {messages.length === 0
          ? <div className="text-center" style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Aucun message</div>
          : messages.map((m) => (
            <MessageBubble key={m.id} msg={m}
              onRate={(r) => r === "up" ? doRate(m, "up") : setEditing({ msg: m, mode: r })}
              onClearFeedback={() => removeFeedback(m)} />
          ))}
      </div>

      {editing && (
        <FeedbackModal msg={editing.msg} mode={editing.mode}
          onClose={() => setEditing(null)}
          onSubmit={async (payload) => { await doRate(editing.msg, editing.mode, payload); setEditing(null); }} />
      )}
    </div>
  );
}

function MessageBubble({ msg, onRate, onClearFeedback }:
  { msg: Msg; onRate: (r: "up" | "down" | "correction") => void; onClearFeedback: () => void }) {
  const mine = msg.role === "user";
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"} gap-1.5 items-end`}>
      {!mine && (
        <div className="rounded-full flex items-center justify-center shrink-0"
          style={{ width: 22, height: 22, backgroundColor: "var(--coral)" }}>
          <Bot size={11} color="var(--coral-text)" />
        </div>
      )}
      <div style={{ maxWidth: "75%" }} className="flex flex-col gap-1">
        <div className="rounded-2xl px-3.5 py-2.5"
          style={{
            fontSize: 13, lineHeight: 1.45,
            backgroundColor: mine ? "var(--coral)" : "#fff",
            color: mine ? "var(--coral-text)" : "var(--foreground)",
            border: mine ? "none" : "0.5px solid var(--border)",
            whiteSpace: mine ? "pre-wrap" : "normal",
            wordBreak: "break-word",
          }}>
          {mine ? msg.content : (
            <div className="kadence-md">
              <ReactMarkdown components={{
                p: ({ children }) => <p style={{ margin: "0 0 6px" }}>{children}</p>,
                ul: ({ children }) => <ul style={{ margin: "4px 0 6px", paddingLeft: 18 }}>{children}</ul>,
                li: ({ children }) => <li style={{ margin: "2px 0" }}>{children}</li>,
                strong: ({ children }) => <strong style={{ fontWeight: 600 }}>{children}</strong>,
              }}>{msg.content}</ReactMarkdown>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 px-1" style={{ fontSize: 10, color: "var(--muted-foreground)" }}>
          <span>{new Date(msg.created_at).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
          {!mine && (
            <div className="inline-flex items-center gap-0.5 ml-1">
              <RateBtn active={msg.feedback?.rating === "up"} color="#2d8a5f"
                title="J'aime" onClick={() => msg.feedback?.rating === "up" ? onClearFeedback() : onRate("up")}>
                <ThumbsUp size={11} />
              </RateBtn>
              <RateBtn active={msg.feedback?.rating === "down"} color="#c44"
                title="Je n'aime pas" onClick={() => onRate("down")}>
                <ThumbsDown size={11} />
              </RateBtn>
              <RateBtn active={msg.feedback?.rating === "correction"} color="var(--coral)"
                title="Rectifier (apprendre au bot)" onClick={() => onRate("correction")}>
                <Wand2 size={11} />
              </RateBtn>
              {msg.feedback && (
                <span className="ml-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded"
                  style={{ fontSize: 9, backgroundColor: "var(--muted)" }}>
                  {msg.feedback.rating === "up" && "👍 noté"}
                  {msg.feedback.rating === "down" && "👎 noté"}
                  {msg.feedback.rating === "correction" && "✏️ rectifié"}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RateBtn({ children, active, color, onClick, title }: any) {
  return (
    <button onClick={onClick} title={title}
      className="rounded p-1 transition"
      style={{
        backgroundColor: active ? color : "transparent",
        color: active ? "#fff" : "var(--muted-foreground)",
      }}>
      {children}
    </button>
  );
}

function FeedbackModal({ msg, mode, onClose, onSubmit }:
  { msg: Msg; mode: "down" | "correction"; onClose: () => void;
    onSubmit: (p: { comment?: string; corrected_answer?: string }) => Promise<void> }) {
  // For "correction" mode we store the admin's style/tone remark in `corrected_answer`
  // (kept as the DB field for backward compat). For "down" mode it goes in `comment`.
  const initialRemark = msg.feedback?.corrected_answer || msg.feedback?.comment || "";
  const [remark, setRemark] = useState(initialRemark);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!remark.trim()) {
      toast.error(mode === "correction" ? "Écris une remarque pour le bot" : "Explique pourquoi");
      return;
    }
    setSaving(true);
    try {
      await onSubmit({
        comment: mode === "down" ? remark.trim() : undefined,
        corrected_answer: mode === "correction" ? remark.trim() : undefined,
      });
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.4)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="rounded-xl w-full"
        style={{ maxWidth: 600, backgroundColor: "#FAFAF8", border: "0.5px solid var(--border)" }}>
        <div className="px-5 py-4 flex items-start gap-3" style={{ borderBottom: "0.5px solid var(--border)" }}>
          <div className="rounded-full flex items-center justify-center shrink-0"
            style={{ width: 32, height: 32, backgroundColor: mode === "correction" ? "var(--coral)" : "#fde2e2" }}>
            {mode === "correction" ? <Wand2 size={15} color="var(--coral-text)" /> : <ThumbsDown size={15} color="#c44" />}
          </div>
          <div className="flex-1">
            <div style={{ fontSize: 15, fontWeight: 500 }}>
              {mode === "correction" ? "Rectifier cette réponse" : "Qu'est-ce qui ne va pas ?"}
            </div>
            <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
              {mode === "correction"
                ? "Indique au bot ce que tu n'as pas aimé dans le ton, le format ou le fond. Il s'en servira pour ajuster ses prochaines réponses."
                : "Ton feedback aidera le bot à éviter cette erreur."}
            </div>
          </div>
          <button onClick={onClose}><X size={16} color="var(--muted-foreground)" /></button>
        </div>

        <div className="p-5 flex flex-col gap-3">
          <div className="rounded-md p-3" style={{ backgroundColor: "#fff", border: "0.5px solid var(--border)", maxHeight: 280, overflowY: "auto" }}>
            <div style={{ fontSize: 10, color: "var(--muted-foreground)", marginBottom: 6, letterSpacing: 0.4 }}>RÉPONSE ACTUELLE DU BOT</div>
            <div className="kadence-md" style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--foreground)" }}>
              <ReactMarkdown
                components={{
                  p: ({ children }) => <p style={{ margin: "0 0 8px" }}>{children}</p>,
                  h1: ({ children }) => <h1 style={{ fontSize: 15, fontWeight: 600, margin: "8px 0 6px" }}>{children}</h1>,
                  h2: ({ children }) => <h2 style={{ fontSize: 14, fontWeight: 600, margin: "8px 0 4px" }}>{children}</h2>,
                  h3: ({ children }) => <h3 style={{ fontSize: 13, fontWeight: 600, margin: "6px 0 3px" }}>{children}</h3>,
                  ul: ({ children }) => <ul style={{ margin: "4px 0 8px", paddingLeft: 18 }}>{children}</ul>,
                  ol: ({ children }) => <ol style={{ margin: "4px 0 8px", paddingLeft: 18 }}>{children}</ol>,
                  li: ({ children }) => <li style={{ margin: "2px 0" }}>{children}</li>,
                  strong: ({ children }) => <strong style={{ fontWeight: 600 }}>{children}</strong>,
                  code: ({ children }) => <code style={{ backgroundColor: "rgba(0,0,0,0.05)", padding: "1px 4px", borderRadius: 4, fontSize: 11.5 }}>{children}</code>,
                  a: ({ href, children }) => <a href={href} target="_blank" rel="noreferrer" style={{ color: "var(--coral)", textDecoration: "underline" }}>{children}</a>,
                }}
              >
                {msg.content}
              </ReactMarkdown>
            </div>
          </div>

          <Field label={mode === "correction"
            ? "Ta remarque pour le bot (ton, style, format, ce qui t'a déplu…)"
            : "Pourquoi cette réponse n'est pas bonne"}>
            <Textarea value={remark} onChange={setRemark} rows={5}
              placeholder={mode === "correction"
                ? "Ex : utilise plus de titres en ## et des listes à puces, sois moins formel, évite les phrases trop longues, ne commence pas par 'Bien sûr !'…"
                : "Ex : ton trop sec, info incorrecte, hors sujet…"} />
          </Field>
          {mode === "correction" && (
            <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: -4 }}>
              Le bot va comparer ta remarque à sa réponse actuelle et ajuster son style sur les prochaines questions similaires.
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="px-4 py-2 rounded-md"
              style={{ fontSize: 13, backgroundColor: "#fff", border: "0.5px solid var(--border)" }}>
              Annuler
            </button>
            <button onClick={submit} disabled={saving}
              className="flex-1 px-4 py-2 rounded-md inline-flex items-center justify-center gap-2 disabled:opacity-50"
              style={{ fontSize: 13, fontWeight: 500, backgroundColor: "var(--foreground)", color: "var(--coral)" }}>
              {saving && <Loader2 size={14} className="animate-spin" />}
              {mode === "correction" ? "Apprendre au bot" : "Envoyer le feedback"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================ PERFORMANCE ============================================================ */

function PerformanceTab() {
  const stats = useServerFn(getBotStats);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try { setData(await stats()); }
      catch (e: any) { toast.error(e?.message || "Erreur"); }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading || !data) return <Loading />;
  const t = data.totals, f = data.feedback;
  const maxDay = Math.max(1, ...data.timeline.map((d: any) => d.total));

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Messages totaux" value={t.total_messages.toString()} sub="depuis le début" />
        <StatCard label="Réponses (30j)" value={t.assistant_messages_30d.toString()} sub={`pour ${t.unique_users} employés`} />
        <StatCard label="Satisfaction"
          value={f.satisfaction_pct == null ? "—" : `${f.satisfaction_pct}%`}
          sub={`${f.up} 👍 / ${f.down + f.correction} 👎`} />
        <StatCard label="Couverture notée" value={`${f.coverage_pct}%`} sub={`${f.rated} réponses notées`} />
      </div>

      {/* Timeline chart */}
      <div className="rounded-lg p-4" style={{ backgroundColor: "#fff", border: "0.5px solid var(--border)" }}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <div style={{ fontSize: 13, fontWeight: 500 }}>Activité — 30 derniers jours</div>
            <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Réponses du bot par jour, et notations</div>
          </div>
          <div className="flex items-center gap-3" style={{ fontSize: 10, color: "var(--muted-foreground)" }}>
            <Legend color="var(--coral)" label="Réponses" />
            <Legend color="#2d8a5f" label="👍" />
            <Legend color="#c44" label="👎" />
          </div>
        </div>
        <div className="flex items-end gap-1" style={{ height: 140 }}>
          {data.timeline.map((d: any) => {
            const h = (d.total / maxDay) * 120;
            return (
              <div key={d.date} className="flex-1 flex flex-col items-center gap-0.5" title={`${d.date} — ${d.total} réponses, 👍${d.up} 👎${d.down} ✏️${d.correction}`}>
                <div className="w-full rounded-t flex flex-col justify-end" style={{ height: 120 }}>
                  <div style={{ height: h || 2, backgroundColor: "var(--coral)", opacity: d.total ? 1 : 0.2, borderRadius: 2 }} />
                </div>
                <div style={{ fontSize: 8, color: "var(--muted-foreground)" }}>{d.date.slice(8, 10)}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Feedback breakdown */}
        <div className="rounded-lg p-4" style={{ backgroundColor: "#fff", border: "0.5px solid var(--border)" }}>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12 }}>Qualité des réponses</div>
          <div className="flex flex-col gap-2.5">
            <BreakdownRow label="J'aime" value={f.up} total={f.rated} color="#2d8a5f" icon={<ThumbsUp size={12} />} />
            <BreakdownRow label="Je n'aime pas" value={f.down} total={f.rated} color="#c44" icon={<ThumbsDown size={12} />} />
            <BreakdownRow label="Rectifications" value={f.correction} total={f.rated} color="var(--coral)" icon={<Wand2 size={12} />} />
          </div>
          {f.rated === 0 && (
            <div className="mt-3" style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
              Aucune notation pour l'instant. Va dans l'onglet Conversations pour commencer à noter les réponses du bot.
            </div>
          )}
        </div>

        {/* Knowledge composition */}
        <div className="rounded-lg p-4" style={{ backgroundColor: "#fff", border: "0.5px solid var(--border)" }}>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12 }}>
            Base de connaissance — {t.knowledge_active}/{t.knowledge_total} actives
          </div>
          <div className="flex flex-col gap-2">
            {KNOWLEDGE_TYPES.map((kt) => {
              const c = data.knowledge_by_type[kt.value] ?? 0;
              const Icon = TYPE_ICONS[kt.value as EntryType];
              return (
                <div key={kt.value} className="flex items-center justify-between" style={{ fontSize: 12 }}>
                  <span className="inline-flex items-center gap-2"><Icon size={12} color="var(--muted-foreground)" /> {kt.label}</span>
                  <span style={{ color: "var(--muted-foreground)" }}>{c}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: color, display: "inline-block" }} />
      {label}
    </span>
  );
}

function BreakdownRow({ label, value, total, color, icon }: any) {
  const pct = total === 0 ? 0 : Math.round((value / total) * 100);
  return (
    <div>
      <div className="flex items-center justify-between mb-1" style={{ fontSize: 12 }}>
        <span className="inline-flex items-center gap-1.5" style={{ color }}>{icon} {label}</span>
        <span style={{ color: "var(--muted-foreground)" }}>{value} · {pct}%</span>
      </div>
      <div className="rounded-full overflow-hidden" style={{ height: 6, backgroundColor: "var(--muted)" }}>
        <div style={{ width: `${pct}%`, height: "100%", backgroundColor: color, transition: "width 0.4s" }} />
      </div>
    </div>
  );
}

/* ============================================================ SHARED ============================================================ */

function StatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="p-4 rounded-lg" style={{ backgroundColor: "#fff", border: "0.5px solid var(--border)" }}>
      <div style={{ fontSize: 10, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 500, marginTop: 4 }}>{value}</div>
      <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 2 }}>{sub}</div>
    </div>
  );
}
function Empty({ msg }: { msg: string }) {
  return (
    <div className="rounded-lg p-10 text-center"
      style={{ backgroundColor: "#fff", border: "0.5px dashed var(--border)" }}>
      <BookOpen size={20} color="var(--muted-foreground)" className="mx-auto mb-2" />
      <div style={{ fontSize: 13, color: "var(--muted-foreground)" }}>{msg}</div>
    </div>
  );
}
function Loading() {
  return (
    <div className="flex items-center justify-center gap-2 py-10"
      style={{ color: "var(--muted-foreground)", fontSize: 13 }}>
      <Loader2 size={14} className="animate-spin" /> Chargement…
    </div>
  );
}
function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11, fontWeight: 500, color: "var(--foreground)", marginBottom: 6 }}>{children}</div>;
}
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
      {hint && <div style={{ fontSize: 10, color: "var(--muted-foreground)", marginTop: 4 }}>{hint}</div>}
    </div>
  );
}
function Input({ value, onChange, type = "text", placeholder }: any) {
  return (
    <input value={value} onChange={(e) => onChange(e.target.value)} type={type} placeholder={placeholder}
      className="w-full px-3 py-2 rounded-md outline-none"
      style={{ fontSize: 13, border: "0.5px solid var(--border)", backgroundColor: "#fff" }} />
  );
}
function Textarea({ value, onChange, rows, placeholder }: any) {
  return (
    <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows} placeholder={placeholder}
      className="w-full px-3 py-2 rounded-md outline-none resize-y"
      style={{ fontSize: 13, border: "0.5px solid var(--border)", backgroundColor: "#fff", lineHeight: 1.5 }} />
  );
}
function Select({ value, onChange, options, placeholder }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; placeholder?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);
  const current = options.find((o) => o.value === value);
  return (
    <div ref={ref} className="relative w-full">
      <button type="button" onClick={() => setOpen((v) => !v)}
        className="w-full inline-flex items-center justify-between gap-2 px-3 py-2 rounded-md outline-none transition"
        style={{
          fontSize: 13, lineHeight: 1.2,
          border: `0.5px solid ${open ? "var(--foreground)" : "var(--border)"}`,
          backgroundColor: "#fff", color: current ? "var(--foreground)" : "var(--muted-foreground)",
          textAlign: "left",
        }}>
        <span className="truncate">{current?.label ?? placeholder ?? "Choisir…"}</span>
        <ChevronDown size={14} color="var(--muted-foreground)"
          style={{ transition: "transform 0.15s ease", transform: open ? "rotate(180deg)" : "none", flexShrink: 0 }} />
      </button>
      {open && (
        <div className="absolute left-0 right-0 z-50 mt-1 rounded-md overflow-hidden"
          style={{
            backgroundColor: "#fff",
            border: "0.5px solid var(--border)",
            boxShadow: "0 8px 24px -8px rgba(0,0,0,0.12), 0 2px 6px -2px rgba(0,0,0,0.05)",
            maxHeight: 280, overflowY: "auto",
            animation: "kadence-dropdown-in 0.12s ease-out",
          }}>
          {options.map((o) => {
            const selected = o.value === value;
            return (
              <button key={o.value} type="button"
                onClick={() => { onChange(o.value); setOpen(false); }}
                className="w-full text-left px-3 py-2 inline-flex items-center justify-between gap-2 transition"
                style={{
                  fontSize: 13,
                  color: selected ? "var(--coral-text, var(--foreground))" : "var(--foreground)",
                  backgroundColor: selected ? "color-mix(in oklab, var(--coral) 18%, transparent)" : "transparent",
                  fontWeight: selected ? 500 : 400,
                }}
                onMouseEnter={(e) => { if (!selected) (e.currentTarget as HTMLButtonElement).style.backgroundColor = "rgba(0,0,0,0.035)"; }}
                onMouseLeave={(e) => { if (!selected) (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent"; }}>
                <span className="truncate">{o.label}</span>
                {selected && <CheckCircle2 size={13} color="var(--coral)" style={{ flexShrink: 0 }} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

if (typeof document !== "undefined" && !document.getElementById("kadence-dropdown-style")) {
  const s = document.createElement("style");
  s.id = "kadence-dropdown-style";
  s.textContent = `@keyframes kadence-dropdown-in { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }`;
  document.head.appendChild(s);
}
function timeAgo(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}j`;
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}
