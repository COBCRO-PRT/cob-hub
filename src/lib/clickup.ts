/**
 * O pouco de ClickUp que o placar usa: criar a tarefa do cliente vermelho, ler
 * o status da lista e escalar. Só roda no servidor; o token nunca vai para o
 * navegador.
 *
 * O token é o pessoal do Matheus, o mesmo dos outros sistemas da casa.
 * Regenerar no ClickUp derruba todos de uma vez (ver docs/placar-semana.md).
 */
const API = "https://api.clickup.com/api/v2";

/** Usuário de cada dono no ClickUp. Dono fora daqui (ou sem dono) vai para o Matheus. */
export const CLICKUP_USERS: Record<string, number> = {
  Matheus: 44275261,
  Sayuri: 111972369,
  Ramon: 111928135,
  Israel: 248594873,
};

export const clickupUserFor = (owner: string) => CLICKUP_USERS[owner.trim()] ?? CLICKUP_USERS.Matheus;

export function clickupConfig(): { token: string; listId: string } | null {
  const token = process.env.CLICKUP_TOKEN?.trim();
  const listId = process.env.CLICKUP_RED_LIST_ID?.trim();
  return token && listId ? { token, listId } : null;
}

async function cu<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: token, "Content-Type": "application/json" },
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`ClickUp respondeu ${res.status}: ${text.slice(0, 200)}`);
  return (text ? JSON.parse(text) : null) as T;
}

interface RawTask {
  id: string;
  url: string;
  status?: { status?: string; type?: string };
  date_closed?: string | null;
  date_done?: string | null;
}

export interface TaskState {
  id: string;
  url: string;
  status: string;
  closed: boolean;
  /** Quando fechou, em ISO. O ClickUp manda milissegundos em texto. */
  closedAt: string | null;
}

function stateOf(t: RawTask): TaskState {
  const closed = t.status?.type === "closed" || t.status?.type === "done" || Boolean(t.date_closed || t.date_done);
  const ms = Number(t.date_done || t.date_closed);
  return {
    id: t.id,
    url: t.url,
    status: t.status?.status ?? "",
    closed,
    closedAt: closed && ms > 0 ? new Date(ms).toISOString() : null,
  };
}

export async function createTask(input: {
  name: string;
  markdown: string;
  assignee: number;
  dueInHours: number;
}): Promise<TaskState> {
  const cfg = clickupConfig();
  if (!cfg) throw new Error("ClickUp não configurado (CLICKUP_TOKEN e CLICKUP_RED_LIST_ID).");
  const t = await cu<RawTask>(cfg.token, `/list/${cfg.listId}/task`, {
    method: "POST",
    body: JSON.stringify({
      name: input.name,
      markdown_content: input.markdown,
      assignees: [input.assignee],
      priority: 2,
      due_date: Date.now() + input.dueInHours * 3600_000,
      due_date_time: true,
    }),
  });
  return stateOf(t);
}

/** Status de todas as tarefas da lista, abertas e fechadas, numa chamada por página de 100. */
export async function listTaskStates(): Promise<Map<string, TaskState>> {
  const cfg = clickupConfig();
  const out = new Map<string, TaskState>();
  if (!cfg) return out;
  for (let page = 0; page < 20; page++) {
    const r = await cu<{ tasks: RawTask[]; last_page?: boolean }>(
      cfg.token,
      `/list/${cfg.listId}/task?include_closed=true&subtasks=false&archived=false&page=${page}`,
    );
    for (const t of r.tasks ?? []) out.set(t.id, stateOf(t));
    if (r.last_page !== false || (r.tasks ?? []).length < 100) break;
  }
  return out;
}

/** Quarta rodada seguida no vermelho: comentário, prioridade urgente e o Matheus como responsável. */
export async function escalateTask(taskId: string, comment: string): Promise<void> {
  const cfg = clickupConfig();
  if (!cfg) throw new Error("ClickUp não configurado.");
  await cu(cfg.token, `/task/${taskId}`, {
    method: "PUT",
    body: JSON.stringify({ priority: 1, assignees: { add: [CLICKUP_USERS.Matheus], rem: [] } }),
  });
  await cu(cfg.token, `/task/${taskId}/comment`, {
    method: "POST",
    body: JSON.stringify({ comment_text: comment, notify_all: true }),
  });
}
