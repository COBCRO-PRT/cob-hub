// Lançamentos do placar. Time: nunca devolve nem grava a mensalidade (fee).
import { placarHandlers } from "@/lib/placar/api";

export const dynamic = "force-dynamic";

const handlers = placarHandlers("team");
export const PUT = handlers.putEntry;
export const DELETE = handlers.deleteEntry;
