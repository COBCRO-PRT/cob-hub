import type { Metadata } from "next";
import { ArrowUpRight, Play, Plus, Search } from "lucide-react";
import { Button, CONTAINER, Field, Kbd, Label, Pill, SectionTitle, Surface } from "@/components/ui";
import { Demo } from "./Demo";

export const metadata: Metadata = { title: "Design system · COB Hub" };

/** Styleguide vivo: todos os primitivos em todas as variantes. Só para quem constrói. */
export default function DsPage() {
  return (
    <main className={`${CONTAINER} flex flex-col gap-10`}>
      <div className="flex flex-col gap-2">
        <Label tone="accent">Design system · Arena</Label>
        <h1 className="type-display text-fg">Primitivos do hub</h1>
        <p className="type-body text-mute">Cada peça aqui é a única versão dela. Tela não inventa botão, campo nem rótulo.</p>
      </div>

      <section className="flex flex-col gap-4">
        <SectionTitle title="Tipo" hint="Seis papéis de texto e três de métrica. Nada fora da escala." />
        <Surface className="flex flex-col gap-3 p-5">
          <p className="type-display text-fg">Display 32 · Placar de Clientes</p>
          <p className="type-title text-fg">Title 20 · Missões da semana</p>
          <p className="type-subtitle text-fg">Subtitle 16 · Green Paradise</p>
          <p className="type-body text-mute">Body 14 · Lançar 170 contatos na semana para sair do vermelho.</p>
          <p className="type-caption text-dim">Caption 12 · Sayuri · FABU</p>
          <Label>Label 11 · temporada 1 · rodada 1 de 12</Label>
          <div className="flex flex-wrap items-end gap-6">
            <span className="type-metric-lg text-fg">6,8</span>
            <span className="type-metric text-good">24</span>
            <span className="type-metric-sm text-bad">2,1</span>
            <span className="type-metric text-fg font-mono">0123</span>
            <span className="type-caption text-dim">(o último é mono, só para comparar: número nunca é mono)</span>
          </div>
        </Surface>
      </section>

      <section className="flex flex-col gap-4">
        <SectionTitle title="Botão" hint="Cinco variantes, três tamanhos, pendente e ícone final em círculo no primary." right={<Button size="sm">slot direito</Button>} />
        <Surface className="flex flex-col gap-5 p-5">
          {(["sm", "md", "lg"] as const).map((size) => (
            <div key={size} className="flex flex-wrap items-center gap-3">
              <Label className="w-8">{size}</Label>
              <Button variant="primary" size={size}>Lançar</Button>
              <Button variant="primary" size={size} iconEnd={<Play aria-hidden strokeWidth={1.75} />}>Continuar a rodada</Button>
              <Button variant="primary" size={size} icon={<Plus aria-hidden strokeWidth={1.75} />}>Novo cliente</Button>
              <Button variant="ghost" size={size}>Editar</Button>
              <Button variant="soft" size={size} icon={<Search aria-hidden strokeWidth={1.75} />}>Ir para…</Button>
              <Button variant="danger" size={size}>Apagar</Button>
              <Button variant="link" size={size} iconEnd={<ArrowUpRight aria-hidden strokeWidth={1.75} />}>abrir no ClickUp</Button>
              <Button variant="primary" size={size} pending>Salvando</Button>
              <Button variant="ghost" size={size} icon={<Search aria-hidden strokeWidth={1.75} />} aria-label="Buscar" />
              <Button variant="ghost" size={size} disabled>Fechado</Button>
            </div>
          ))}
        </Surface>
      </section>

      <section className="flex flex-col gap-4">
        <SectionTitle title="Campo" hint="Rótulo, dica e erro ligados por aria-describedby." />
        <Surface className="grid gap-4 p-5 sm:grid-cols-3">
          <Field id="ds-nome" label="Resultado na semana" hint="Número inteiro ou com vírgula." placeholder="Ex.: 182" inputMode="decimal" />
          <Field id="ds-sel" label="Dono" as="select" defaultValue="sayuri">
            <option value="sayuri">Sayuri</option>
            <option value="ramon">Ramon</option>
          </Field>
          <Field id="ds-txt" label="O que aconteceu" as="textarea" placeholder="Ex.: 2 matrículas, campanha nova subiu na quarta" />
          <Field id="ds-erro" label="Nota que o cliente deu" error="Entre 0 e 10, com até uma casa." defaultValue="12" />
        </Surface>
      </section>

      <section className="flex flex-col gap-4">
        <SectionTitle title="Superfície" hint="Nível 1 e 2, interativa, e a com brilho (só o gesto-herói da tela)." />
        <div className="grid gap-3 sm:grid-cols-4">
          <Surface className="p-4"><p className="type-subtitle text-fg">Nível 1</p><p className="type-body text-mute">card em repouso</p></Surface>
          <Surface level={2} className="p-4"><p className="type-subtitle text-fg">Nível 2</p><p className="type-body text-mute">card dentro de card</p></Surface>
          <Surface interactive tabIndex={0} className="p-4"><p className="type-subtitle text-fg">Interativa</p><p className="type-body text-mute">hover, foco e afunda</p></Surface>
          <Surface glow className="p-4"><p className="type-subtitle text-fg">Com brilho</p><p className="type-body text-mute">um por tela</p></Surface>
        </div>
      </section>

      <Demo />

      <section className="flex flex-col gap-4">
        <SectionTitle title="Pílula e tecla" />
        <Surface className="flex flex-wrap items-center gap-3 p-5">
          <Pill tone="good">Verde</Pill>
          <Pill tone="warn">Amarelo</Pill>
          <Pill tone="bad">Vermelho</Pill>
          <Pill tone="none">Cinza</Pill>
          <Pill tone="accent" icon={<Play aria-hidden strokeWidth={2} />}>Rodada ao vivo</Pill>
          <Pill>Neutro</Pill>
          <Kbd>⌘K</Kbd>
          <Kbd>/</Kbd>
          <Kbd>esc</Kbd>
        </Surface>
      </section>
    </main>
  );
}
