// Source unique pour les types/utilitaires de rôles côté UI.
// Re-export depuis mock-data (qui contient déjà un Proxy dynamique branché
// sur la table business_roles). Ce fichier existe pour que les pages
// applicatives n'importent plus jamais directement "mock-data".

export { roleColors, getQuotaStatus } from "./mock-data";
export type { Role, ContractType, Studio } from "./mock-data";
