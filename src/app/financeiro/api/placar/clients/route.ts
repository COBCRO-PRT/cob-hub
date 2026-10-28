// Clientes do placar. Financeiro: inclui a mensalidade. Fica sob /financeiro para herdar a segunda senha do proxy.
import { placarHandlers } from "@/lib/placar/api";

export const dynamic = "force-dynamic";

const handlers = placarHandlers("finance");
export const POST = handlers.createClient;
export const PATCH = handlers.updateClient;
