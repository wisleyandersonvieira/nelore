import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "list_pending_payables",
  title: "Listar contas a pagar pendentes",
  description: "Retorna contas a pagar em aberto, opcionalmente filtradas por intervalo de vencimento.",
  inputSchema: {
    due_from: z.string().optional().describe("Data inicial (YYYY-MM-DD) de vencimento."),
    due_to: z.string().optional().describe("Data final (YYYY-MM-DD) de vencimento."),
    limit: z.number().int().positive().optional().describe("Máximo de registros (padrão 100)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ due_from, due_to, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    let q = sb
      .from("accounts_payable")
      .select("id, supplier_id, description, due_date, amount, status, document_number")
      .neq("status", "paid")
      .order("due_date", { ascending: true })
      .limit(limit ?? 100);
    if (due_from) q = q.gte("due_date", due_from);
    if (due_to) q = q.lte("due_date", due_to);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { payables: data ?? [] },
    };
  },
});
