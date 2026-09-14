import { createFileRoute, redirect } from "@tanstack/react-router";
import { Check, Loader2, ShieldCheck, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Autorizar integração | Inimigos do Fim" },
      { name: "description", content: "Autorize um agente a acessar a Agenda Cultural Inimigos do Fim." },
      { property: "og:title", content: "Autorizar integração | Inimigos do Fim" },
      { property: "og:description", content: "Autorize um agente a acessar a Agenda Cultural Inimigos do Fim." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    authorization_id: typeof search.authorization_id === "string" ? search.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Solicitação de autorização ausente.");
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      const next = `${location.pathname}${location.searchStr}`;
      throw redirect({ to: "/auth", search: { next } });
    }
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id") ?? "";
    const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId);
    if (error) throw error;
    if (data && "redirect_url" in data) throw redirect({ href: data.redirect_url });
    return data;
  },
  component: ConsentPage,
  errorComponent: ({ error }) => (
    <main className="grid min-h-screen place-items-center bg-background p-6 text-foreground">
      <section className="w-full max-w-lg rounded-lg border bg-card p-8 shadow-lg">
        <h1 className="text-2xl font-bold">Não foi possível abrir esta autorização</h1>
        <p className="mt-3 text-muted-foreground">{error instanceof Error ? error.message : String(error)}</p>
      </section>
    </main>
  ),
});

function ConsentPage() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clientName = details?.client.name ?? "um agente";

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const response = approve
      ? await supabase.auth.oauth.approveAuthorization(authorization_id, { skipBrowserRedirect: true })
      : await supabase.auth.oauth.denyAuthorization(authorization_id, { skipBrowserRedirect: true });
    if (response.error) {
      setBusy(false);
      setError(response.error.message);
      return;
    }
    if (!response.data?.redirect_url) {
      setBusy(false);
      setError("O serviço de autorização não informou o destino de retorno.");
      return;
    }
    window.location.assign(response.data.redirect_url);
  }

  return (
    <main className="grid min-h-screen place-items-center bg-background p-6 text-foreground">
      <section className="w-full max-w-lg rounded-lg border bg-card p-8 shadow-lg">
        <span className="grid size-12 place-items-center rounded-full bg-primary text-primary-foreground">
          <ShieldCheck className="size-6" aria-hidden="true" />
        </span>
        <p className="mt-6 text-sm font-semibold text-primary">Agenda Cultural - Inimigos do Fim</p>
        <h1 className="mt-2 text-3xl font-bold">Conectar {clientName} à sua conta?</h1>
        <p className="mt-4 leading-relaxed text-muted-foreground">
          Esta conexão poderá consultar, pesquisar e atualizar eventos conforme as permissões da sua conta.
        </p>
        {error ? <p role="alert" className="mt-4 text-sm text-destructive">{error}</p> : null}
        <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="outline" disabled={busy} onClick={() => decide(false)}>
            <X className="size-4" /> Negar
          </Button>
          <Button disabled={busy} onClick={() => decide(true)}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            Autorizar
          </Button>
        </div>
      </section>
    </main>
  );
}