"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button, Label } from "@/components/ui";

export type WeekNav = {
  label: string;
  hint: string;
  onPrev: () => void;
  onNext: () => void;
  prevDisabled?: boolean;
  nextDisabled?: boolean;
  ariaLabel: string;
};

/** Cabeçalho de tela (§6): rótulo, título, navegação de semana e ações. Um só para Placar, Rodada e Notas. */
export function PageHeader({ eyebrow, title, week, actions }: { eyebrow: string; title: string; week?: WeekNav; actions?: React.ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div className="flex min-w-0 flex-col gap-2">
        <Label className="inline-flex items-center gap-2">
          <i aria-hidden className="inline-block size-2 rounded-[2px] bg-accent" />
          {eyebrow}
        </Label>
        <h1 className="type-display text-fg">{title}</h1>
      </div>
      {(week || actions) && (
        <div className="flex flex-wrap items-center gap-2" aria-label={week?.ariaLabel}>
          {week && (
            <>
              <Button size="sm" icon={<ChevronLeft aria-hidden strokeWidth={1.75} />} aria-label="Anterior" disabled={week.prevDisabled} onClick={week.onPrev} />
              <div className="flex min-w-[148px] flex-col items-center px-1">
                <b className="type-subtitle tabular-nums text-fg">{week.label}</b>
                <span className="type-caption text-dim">{week.hint}</span>
              </div>
              <Button size="sm" icon={<ChevronRight aria-hidden strokeWidth={1.75} />} aria-label="Próxima" disabled={week.nextDisabled} onClick={week.onNext} />
            </>
          )}
          {actions}
        </div>
      )}
    </header>
  );
}
