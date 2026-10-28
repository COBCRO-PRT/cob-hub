"use client";

import { useEffect } from "react";
import { RotateCcw } from "lucide-react";
import { Button, CONTAINER, Notice } from "@/components/ui";

/**
 * Erro da tela (§7): o que houve e uma saída. O Next 16 entrega `unstable_retry`
 * (relê o servidor) e ainda o `reset` antigo; usamos o primeiro quando existe.
 */
export default function Error({
  error,
  reset,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  unstable_retry?: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const retry = unstable_retry ?? reset;

  return (
    <div className="min-h-screen bg-bg">
      <div className={CONTAINER}>
        <Notice
          tone="bad"
          title="Não deu pra montar as notas do mês"
          action={
            <Button size="sm" icon={<RotateCcw aria-hidden strokeWidth={1.75} />} onClick={() => retry()}>
              Tentar de novo
            </Button>
          }
        >
          <p className="break-words">{error.message}</p>
          {error.digest && <p className="font-mono text-xs opacity-80">{error.digest}</p>}
        </Notice>
      </div>
    </div>
  );
}
