import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });

    // Check placement test status (skip if already on /placement)
    if (location.pathname !== "/placement") {
      const { data: profile } = await supabase
        .from("profiles")
        .select("placement_done")
        .eq("user_id", data.user.id)
        .maybeSingle();
      if (profile && profile.placement_done === false) {
        throw redirect({ to: "/placement" });
      }
    }

    return { user: data.user };
  },
  component: () => <Outlet />,
});
