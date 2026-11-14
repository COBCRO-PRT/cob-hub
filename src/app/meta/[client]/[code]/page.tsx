import { Logo } from "@/components/Logo";
import { Surface } from "@/components/ui";
import { PedidoForm } from "@/components/placar/PedidoForm";
import { currentMonth, monthLabel, nextMonth, pedidoCode, pedidoOf, referenceFor, unitOf } from "@/lib/placar/pedido";
import { addWeeks, lastClosedWeek } from "@/lib/placar/score";
import { getStore } from "@/lib/placar/store";

export const metadata = {
  title: "Seu resultado do mês · Colombo Media",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

function Invalid() {
  return (
    <main className="relative flex min-h-[100dvh] items-center justify-center bg-bg px-4 py-8 sm:px-6">
      <Surface light className="relative w-full max-w-[440px] p-6 sm:p-8">
        <Logo className="h-5" />
        <h1 className="type-title mt-6 text-fg">Esse link não vale mais.</h1>
        <p className="type-body mt-2 text-mute">Fale com a Colombo Media e peça um link novo.</p>
      </Surface>
    </main>
  );
}

/** Página sem login: o código do link é a chave (docs/placar-pedido-cliente.md). */
export default async function MetaDoCliente({ params }: { params: Promise<{ client: string; code: string }> }) {
  const { client, code } = await params;
  const expected = await pedidoCode(client);
  if (!expected || expected !== code) return <Invalid />;

  const store = await getStore();
  const c = await store.getClient(client);
  if (!c || !c.active) return <Invalid />;

  const month = nextMonth();
  const [entries, pedidos] = await Promise.all([store.listEntries(addWeeks(lastClosedWeek(), -8)), store.listPedidos(currentMonth())]);
  const ref = referenceFor(c, entries);
  const unit = unitOf(c);
  const prev = pedidoOf(pedidos, c.id, month);

  return (
    <PedidoForm
      client={c.id}
      code={code}
      name={c.name}
      owner={c.owner}
      month={monthLabel(month)}
      unit={unit}
      reference={ref && ref.value > 0 ? { value: ref.value, weeks: ref.weeks } : null}
      previous={prev && prev.wanted_value !== null && prev.score !== null ? { wanted: prev.wanted_value, score: prev.score, note: prev.note } : null}
    />
  );
}
