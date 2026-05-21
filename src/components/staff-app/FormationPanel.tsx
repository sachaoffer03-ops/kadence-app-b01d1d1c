import { FormationHub } from "./formation/FormationHub";

export function FormationPanel({ userId }: { userId: string }) {
  return <FormationHub userId={userId} />;
}
