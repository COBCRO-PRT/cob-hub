"use client";

import { useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "@/components/ui";

/**
 * Botão de envio que lê o estado do `<form>` em volta (§7): enquanto a Server
 * Action roda, o rótulo vira spinner e a largura fica. Precisa ser filho do
 * form (ou apontar pra ele via `form=`), que é de onde o `useFormStatus` lê.
 */
export function SubmitButton({ pending, ...props }: Omit<ButtonProps, "type">) {
  const status = useFormStatus();
  return <Button type="submit" pending={pending || status.pending} {...props} />;
}
