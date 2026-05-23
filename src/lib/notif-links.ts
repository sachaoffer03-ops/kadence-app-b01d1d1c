// Centralized notification deep-link builders.
// Every notification MUST have a non-null link pointing to the related resource.

type EmployeeKind =
  | { kind: "shift"; shiftId: string; tab?: "planning" | "accueil" | "pointage" }
  | { kind: "proposal"; proposalId: string }
  | { kind: "request"; requestId: string }
  | { kind: "thread"; threadId: string }
  | { kind: "course"; courseId: string }
  | { kind: "doc"; docId?: string }
  | { kind: "profil" }
  | { kind: "tab"; tab: "accueil" | "planning" | "pointage" | "formation" | "chat" | "profil" };

export function employeeLink(input: EmployeeKind): string {
  switch (input.kind) {
    case "shift": {
      const tab = input.tab ?? "planning";
      return `/staff-app?tab=${tab}&shift=${input.shiftId}`;
    }
    case "proposal":
      return `/staff-app/propositions`;
    case "request":
      return `/staff-app?tab=planning&request=${input.requestId}`;
    case "thread":
      return `/staff-app?tab=chat&thread=${input.threadId}`;
    case "course":
      return `/staff-app?tab=formation&course=${input.courseId}`;
    case "doc":
      return `/staff-app?tab=profil&openDocs=1${input.docId ? `&doc=${input.docId}` : ""}`;
    case "profil":
      return `/staff-app?tab=profil`;
    case "tab":
      return `/staff-app?tab=${input.tab}`;
  }
}

type AdminKind =
  | { kind: "submission"; submissionId: string }
  | { kind: "request"; requestId: string }
  | { kind: "proposal"; proposalId: string }
  | { kind: "shiftPointage"; shiftId: string }
  | { kind: "staffFormation"; userId: string }
  | { kind: "staffDocuments"; userId: string }
  | { kind: "staff"; userId: string }
  | { kind: "feedback"; id: string };

export function adminLink(input: AdminKind): string {
  switch (input.kind) {
    case "submission":
      return `/cloture?submission=${input.submissionId}`;
    case "request":
      return `/demandes?request=${input.requestId}`;
    case "proposal":
      return `/trous?proposal=${input.proposalId}`;
    case "shiftPointage":
      return `/pointage?shift=${input.shiftId}`;
    case "staffFormation":
      return `/staff/${input.userId}?tab=formation`;
    case "staffDocuments":
      return `/staff/${input.userId}?tab=documents`;
    case "staff":
      return `/staff/${input.userId}`;
    case "feedback":
      return `/feedbacks?id=${input.id}`;
  }
}

// Fallback by category for legacy notifs that arrive without a link.
export function fallbackLinkByCategory(category: string | null | undefined, isEmployee: boolean): string {
  if (isEmployee) {
    switch (category) {
      case "planning":
      case "shift": return "/staff-app?tab=planning";
      case "training": return "/staff-app?tab=formation";
      case "document": return "/staff-app?tab=profil&openDocs=1";
      case "pointage": return "/staff-app?tab=pointage";
      case "request": return "/staff-app?tab=planning";
      default: return "/staff-app?tab=accueil";
    }
  }
  switch (category) {
    case "planning": return "/planning";
    case "shift":
    case "pointage": return "/pointage";
    case "request": return "/demandes";
    case "training": return "/formation";
    case "document": return "/staff";
    default: return "/dashboard";
  }
}
