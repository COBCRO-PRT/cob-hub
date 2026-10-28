// Placar de Clientes. Financeiro: inclui a mensalidade. Fica sob /financeiro para herdar a segunda senha do proxy.
import { placarHandlers } from "@/lib/placar/api";

export const dynamic = "force-dynamic";

export const GET = placarHandlers("finance").snapshot;
