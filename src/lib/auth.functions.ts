import { createServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";

export const getSession = createServerFn({ method: "GET" }).handler(async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
});
