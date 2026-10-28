// Clientes do placar. Time: nunca devolve nem grava a mensalidade (fee).
import { placarHandlers } from "@/lib/placar/api";

export const dynamic = "force-dynamic";

const handlers = placarHandlers("team");
export const POST = handlers.createClient;
export const PATCH = handlers.updateClient;
