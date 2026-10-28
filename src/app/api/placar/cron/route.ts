// Fechamento automático da rodada, segunda entre 10h e 11h (vercel.json). Confere o CRON_SECRET.
import { cronGet } from "@/lib/placar/api-semana";

export const dynamic = "force-dynamic";

export const GET = cronGet;
