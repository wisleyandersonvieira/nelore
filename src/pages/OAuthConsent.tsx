import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import elitebovLogo from "@/assets/elitebov-logo.png";

// Typed shim for the beta supabase.auth.oauth namespace
type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<{ data: any; error: any }>;
  approveAuthorization: (id: string) => Promise<{ data: any; error: any }>;
  denyAuthorization: (id: string) => Promise<{ data: any; error: any }>;
};
const oauth = (supabase.auth as unknown as { oauth: OAuthApi }).oauth;

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) return setError("authorization_id ausente");
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        window.location.href = "/auth?next=" + encodeURIComponent(next);
        return;
      }
      const { data, error } = await oauth.getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (error) return setError(error.message);
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data);
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    const { data, error } = approve
      ? await oauth.approveAuthorization(authorizationId)
      : await oauth.denyAuthorization(authorizationId);
    if (error) {
      setBusy(false);
      return setError(error.message);
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      return setError("Servidor não retornou URL de redirecionamento.");
    }
    window.location.href = target;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 via-emerald-50 to-green-100 p-4">
      <Card className="w-full max-w-md border-green-200">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <img src={elitebovLogo} alt="ELITEBOV" className="h-16" />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && <p className="text-sm text-destructive">{error}</p>}
          {!error && !details && <p className="text-sm text-muted-foreground">Carregando…</p>}
          {details && (
            <>
              <div>
                <h1 className="text-xl font-bold text-green-800">
                  Conectar {details.client?.name ?? "aplicativo"} à sua conta
                </h1>
                <p className="text-sm text-muted-foreground mt-2">
                  Isto permitirá que {details.client?.name ?? "este aplicativo"} acesse os dados
                  do ELITEBOV em seu nome.
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  className="flex-1 bg-green-700 hover:bg-green-800"
                  disabled={busy}
                  onClick={() => decide(true)}
                >
                  Aprovar
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  disabled={busy}
                  onClick={() => decide(false)}
                >
                  Recusar
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
