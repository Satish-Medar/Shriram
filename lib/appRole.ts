import { supabase } from "@/lib/supabase";

export type AppRole = "owner" | "report2" | "agent" | "unassigned";

export const getCurrentAppRole = async (): Promise<AppRole> => {
  if (!supabase) return "unassigned";
  const { data, error } = await supabase.rpc("current_app_role");
  if (error) throw error;
  if (data === "owner" || data === "report2" || data === "agent") {
    return data;
  }
  return "unassigned";
};
