import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  component: IndexPage,
});

function IndexPage() {
  const navigate = useNavigate();
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (cancelled) return;
      navigate({ to: data.user ? "/inicio" : "/auth" });
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="size-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
