import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listAnimalsTool from "./tools/list-animals";
import listPendingPayablesTool from "./tools/list-pending-payables";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "elitebov-mcp",
  title: "ELITEBOV",
  version: "0.1.0",
  instructions:
    "Ferramentas de leitura do ELITEBOV (gestão pecuária): consulte o rebanho e as contas a pagar da fazenda do usuário autenticado.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listAnimalsTool, listPendingPayablesTool],
});
