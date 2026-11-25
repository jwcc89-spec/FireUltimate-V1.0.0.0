import { useState } from "react";
import { errorText } from "./maintenanceUtils";

export function useDialogSave() {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const run = async (work: () => Promise<void>, fallback: string) => {
    setSaving(true);
    setError("");
    try {
      await work();
      return true;
    } catch (saveError) {
      setError(errorText(saveError, fallback));
      return false;
    } finally {
      setSaving(false);
    }
  };
  return { saving, error, setError, run };
}
