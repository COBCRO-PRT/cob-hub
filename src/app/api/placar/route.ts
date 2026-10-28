// Placar de Clientes. Time: nunca devolve nem grava a mensalidade (fee).
import { placarHandlers } from "@/lib/placar/api";

export const dynamic = "force-dynamic";

export const GET = placarHandlers("team").snapshot;
