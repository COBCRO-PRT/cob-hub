"use client";

import { useState } from "react";
import { Button, Modal } from "@/components/ui";
import { cancelarLinha } from "./acoes";
import { SubmitButton } from "./SubmitButton";

/**
 * Cancelar nota é ação fiscal sem volta (§7): abre `Modal sm` com o número e o
 * valor, e só o confirmar chama a Server Action. O link "Cancelar" na linha
 * nunca cancela sozinho.
 */
export function CancelarNota({
  notaId,
  numero,
  valor,
  cliente,
}: {
  notaId: string;
  numero: string | null;
  /** Já formatado em R$, porque o pai (tela de servidor) é quem sabe o valor da nota. */
  valor: string;
  cliente: string;
}) {
  const [open, setOpen] = useState(false);
  const titulo = numero ? `Cancelar a nota ${numero} de ${valor}?` : `Cancelar a nota agendada de ${valor}?`;

  return (
    <>
      <Button variant="link" size="sm" className="text-mute hover:text-bad" onClick={() => setOpen(true)}>
        Cancelar
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        size="sm"
        title={titulo}
        description={`${cliente}. Em agendamento, some do Asaas; já emitida, vira pedido de cancelamento à prefeitura. Não dá pra desfazer.`}
        footer={
          <>
            <Button onClick={() => setOpen(false)}>Manter a nota</Button>
            <form action={cancelarLinha}>
              <input type="hidden" name="notaId" value={notaId} />
              <SubmitButton variant="danger">Cancelar nota</SubmitButton>
            </form>
          </>
        }
      />
    </>
  );
}
