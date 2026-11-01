"use client";

import { useFormStatus } from "react-dom";
import { Logo } from "@/components/Logo";
import { Button, Field, Notice, Surface } from "@/components/ui";

type LoginField = "name" | "password";

export type LoginCardProps = {
  title: string;
  text: string;
  fields: LoginField[];
  /** Server Function que recebe o FormData (`nome`, `senha`, `next`). */
  action: (formData: FormData) => void | Promise<void>;
  /** Destino depois de entrar; vai no campo escondido `next`. */
  next?: string;
  /** Mensagem de erro do login; liga `aria-invalid` e `aria-describedby` no campo de senha. */
  error?: string;
  /** Aviso de configuração do servidor (senha ausente etc.). */
  notice?: string;
  passwordLabel?: string;
  submitLabel?: string;
};

const ERROR_ID = "login-erro";

/** Precisa ser filho do `<form>` para o `useFormStatus` enxergar o envio. */
function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" size="lg" pending={pending} className="w-full">
      {children}
    </Button>
  );
}

/**
 * Um cartão de login para os três acessos (D2.5): sem casca, `Surface light` de 400px centrada,
 * um único halo de acento bem fraco no topo da tela.
 */
export function LoginCard({
  title,
  text,
  fields,
  action,
  next,
  error,
  notice,
  passwordLabel = "Senha",
  submitLabel = "Entrar",
}: LoginCardProps) {
  return (
    <main className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-bg px-4 py-8 sm:px-6">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-glow-accent opacity-60" />
      <Surface light className="relative w-full max-w-[400px] p-6 sm:p-8">
        <Logo className="h-5" />

        <h1 className="type-title mt-6 text-fg">{title}</h1>
        <p className="type-body mt-2 text-mute">{text}</p>

        <form action={action} className="mt-6 flex flex-col gap-4">
          {next !== undefined && <input type="hidden" name="next" value={next} />}

          {fields.includes("name") && (
            <Field
              id="nome"
              name="nome"
              label="Nome"
              type="text"
              required
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
            />
          )}

          {fields.includes("password") && (
            <Field
              id="senha"
              name="senha"
              label={passwordLabel}
              type="password"
              required
              autoComplete="current-password"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? ERROR_ID : undefined}
            />
          )}

          {error && (
            <div id={ERROR_ID}>
              <Notice tone="bad">{error}</Notice>
            </div>
          )}

          <SubmitButton>{submitLabel}</SubmitButton>
        </form>

        {notice && (
          <Notice tone="warn" className="mt-4">
            {notice}
          </Notice>
        )}
      </Surface>
    </main>
  );
}
