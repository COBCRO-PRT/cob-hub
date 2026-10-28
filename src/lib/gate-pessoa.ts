/**
 * Login individual do Placar e do financeiro.
 *
 * O placar mostra dono, meta e resultado de cada cliente, então não abre com a
 * senha do time: só com o login de uma das pessoas de HUB_USERS. O menu de
 * atalhos continua com a senha do time.
 *
 * HUB_USERS é um JSON com o hash de cada senha (PBKDF2), nunca a senha.
 * HUB_SESSION_SECRET assina o cookie. Sem qualquer uma das duas o placar fecha.
 * Para gerar ou trocar senhas: scripts/acessos-placar.mjs.
 */

/** Nome do cookie da sessão individual. */
export const USER_COOKIE_NAME = "cob_hub_pessoa";

/** 30 dias. Trocar a senha de alguém derruba a sessão dele antes disso. */
export const USER_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

/** "admin" é quem entra no financeiro. */
export type Role = "admin" | "time";

export interface HubUser {
  id: string;
  name: string;
  role: Role;
  /** `pbkdf2-sha256$<iterações>$<salt>$<hash>`, salt e hash em base64url. */
  hash: string;
}

export type Pessoa = Pick<HubUser, "id" | "name" | "role">;

const enc = new TextEncoder();

function toB64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(value: string): Uint8Array {
  const s = atob(value.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

function isUser(u: unknown): u is HubUser {
  if (!u || typeof u !== "object") return false;
  const r = u as Record<string, unknown>;
  return (
    typeof r.id === "string" &&
    /^[a-z0-9-]+$/.test(r.id) &&
    typeof r.name === "string" &&
    (r.role === "admin" || r.role === "time") &&
    typeof r.hash === "string" &&
    r.hash.startsWith("pbkdf2-sha256$")
  );
}

/** Lista de HUB_USERS. JSON quebrado vira lista vazia, e aí ninguém entra. */
export function hubUsers(): HubUser[] {
  const raw = process.env.HUB_USERS;
  if (!raw) return [];
  try {
    const list: unknown = JSON.parse(raw);
    return Array.isArray(list) ? list.filter(isUser) : [];
  } catch {
    return [];
  }
}

/** Login e cookie só funcionam com as duas variáveis configuradas. */
export function loginConfigured(): boolean {
  return hubUsers().length > 0 && Boolean(process.env.HUB_SESSION_SECRET);
}

/** Aceita "Ramon", "ramon" ou " RAMON ". */
function findUser(login: string): HubUser | undefined {
  const key = login.trim().toLowerCase();
  if (!key) return undefined;
  return hubUsers().find((u) => u.id === key || u.name.toLowerCase() === key);
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function pbkdf2(senha: string, salt: Uint8Array, iterations: number, bytes: number) {
  const key = await crypto.subtle.importKey("raw", enc.encode(senha), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations },
    key,
    bytes * 8,
  );
  return new Uint8Array(bits);
}

/** Hash usado quando o nome não existe, para a resposta demorar o mesmo tanto. */
const DUMMY = "pbkdf2-sha256$600000$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

/** Confere nome e senha. Devolve a pessoa ou null, sem dizer qual dos dois errou. */
export async function checkLogin(login: string, senha: string): Promise<Pessoa | null> {
  const user = findUser(login);
  const [, iter, salt, hash] = (user?.hash ?? DUMMY).split("$");
  const iterations = Number(iter);
  if (!Number.isInteger(iterations) || iterations < 100_000 || !salt || !hash) return null;

  const esperado = fromB64url(hash);
  const calculado = await pbkdf2(senha, fromB64url(salt), iterations, esperado.length);
  if (!user || !sameBytes(calculado, esperado)) return null;
  return { id: user.id, name: user.name, role: user.role };
}

async function hmacKey(secret: string, usage: KeyUsage) {
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [usage]);
}

/**
 * O que a assinatura cobre. Entra o fim do hash da senha: trocar a senha de
 * alguém (ou tirar a pessoa de HUB_USERS) invalida o cookie que ela já tem.
 */
const signedPart = (user: HubUser, exp: number) => `${user.id}.${exp}.${user.hash.slice(-16)}`;

/** Valor do cookie: `<id>.<expira em>.<assinatura>`. */
export async function createSession(pessoa: Pessoa): Promise<string | null> {
  const secret = process.env.HUB_SESSION_SECRET;
  const user = hubUsers().find((u) => u.id === pessoa.id);
  if (!secret || !user) return null;

  const exp = Math.floor(Date.now() / 1000) + USER_COOKIE_MAX_AGE;
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(secret, "sign"), enc.encode(signedPart(user, exp)));
  return `${user.id}.${exp}.${toB64url(new Uint8Array(sig))}`;
}

/** Lê o cookie. Assinatura errada, vencida ou de pessoa que saiu da lista dá null. */
export async function readSession(value: string | undefined): Promise<Pessoa | null> {
  const secret = process.env.HUB_SESSION_SECRET;
  if (!secret || !value) return null;

  const [id, expRaw, sig] = value.split(".");
  const exp = Number(expRaw);
  if (!id || !sig || !Number.isInteger(exp) || exp < Date.now() / 1000) return null;

  const user = hubUsers().find((u) => u.id === id);
  if (!user) return null;

  let assinatura: Uint8Array;
  try {
    assinatura = fromB64url(sig);
  } catch {
    return null;
  }
  const ok = await crypto.subtle.verify(
    "HMAC",
    await hmacKey(secret, "verify"),
    assinatura as BufferSource,
    enc.encode(signedPart(user, exp)),
  );
  return ok ? { id: user.id, name: user.name, role: user.role } : null;
}
