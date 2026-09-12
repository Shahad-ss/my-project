export type CustomFetchOptions = RequestInit & {
  responseType?: "json" | "text" | "blob" | "auto";
};

export type ErrorType<T = unknown> = ApiError<T>;

export type BodyType<T> = T;

export type AuthTokenGetter = () => Promise<string | null> | string | null;

const NO_BODY_STATUS = new Set([204, 205, 304]);
const DEFAULT_JSON_ACCEPT = "application/json, application/problem+json";

// ---------------------------------------------------------------------------
// Module-level configuration
// ---------------------------------------------------------------------------

let _baseUrl: string | null = null;
let _authTokenGetter: AuthTokenGetter | null = null;

/**
 * Set a base URL that is prepended to every relative request URL
 * (i.e. paths that start with `/`).
 *
 * Useful for Expo bundles that need to call a remote API server.
 * Pass `null` to clear the base URL.
 */
export function setBaseUrl(url: string | null): void {
  _baseUrl = url ? url.replace(/\/+$/, "") : null;
}

/**
 * Register a getter that supplies a bearer auth token.  Before every fetch
 * the getter is invoked; when it returns a non-null string, an
 * `Authorization: Bearer <token>` header is attached to the request.
 *
 * Useful for Expo bundles making token-gated API calls.
 * Pass `null` to clear the getter.
 *
 * NOTE: This function should never be used in web applications where session
 * token cookies are automatically associated with API calls by the browser.
 */
export function setAuthTokenGetter(getter: AuthTokenGetter | null): void {
  _authTokenGetter = getter;
}

function isRequest(input: RequestInfo | URL): input is Request {
  return typeof Request !== "undefined" && input instanceof Request;
}

function resolveMethod(input: RequestInfo | URL, explicitMethod?: string): string {
  if (explicitMethod) return explicitMethod.toUpperCase();
  if (isRequest(input)) return input.method.toUpperCase();
  return "GET";
}

// Use loose check for URL — some runtimes (e.g. React Native) polyfill URL
// differently, so `instanceof URL` can fail.
function isUrl(input: RequestInfo | URL): input is URL {
  return typeof URL !== "undefined" && input instanceof URL;
}

function applyBaseUrl(input: RequestInfo | URL): RequestInfo | URL {
  if (!_baseUrl) return input;
  const url = resolveUrl(input);
  // Only prepend to relative paths (starting with /)
  if (!url.startsWith("/")) return input;

  const absolute = `${_baseUrl}${url}`;
  if (typeof input === "string") return absolute;
  if (isUrl(input)) return new URL(absolute);
  return new Request(absolute, input as Request);
}

function resolveUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (isUrl(input)) return input.toString();
  return input.url;
}

function mergeHeaders(...sources: Array<HeadersInit | undefined>): Headers {
  const headers = new Headers();

  for (const source of sources) {
    if (!source) continue;
    new Headers(source).forEach((value, key) => {
      headers.set(key, value);
    });
  }

  return headers;
}

function getMediaType(headers: Headers): string | null {
  const value = headers.get("content-type");
  return value ? value.split(";", 1)[0].trim().toLowerCase() : null;
}

function isJsonMediaType(mediaType: string | null): boolean {
  return mediaType === "application/json" || Boolean(mediaType?.endsWith("+json"));
}

function isTextMediaType(mediaType: string | null): boolean {
  return Boolean(
    mediaType &&
      (mediaType.startsWith("text/") ||
        mediaType === "application/xml" ||
        mediaType === "text/xml" ||
        mediaType.endsWith("+xml") ||
        mediaType === "application/x-www-form-urlencoded"),
  );
}

// Use strict equality: in browsers, `response.body` is `null` when the
// response genuinely has no content.  In React Native, `response.body` is
// always `undefined` because the ReadableStream API is not implemented —
// even when the response carries a full payload readable via `.text()` or
// `.json()`.  Loose equality (`== null`) matches both `null` and `undefined`,
// which causes every React Native response to be treated as empty.
function hasNoBody(response: Response, method: string): boolean {
  if (method === "HEAD") return true;
  if (NO_BODY_STATUS.has(response.status)) return true;
  if (response.headers.get("content-length") === "0") return true;
  if (response.body === null) return true;
  return false;
}

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function looksLikeJson(text: string): boolean {
  const trimmed = text.trimStart();
  return trimmed.startsWith("{") || trimmed.startsWith("[");
}

function getStringField(value: unknown, key: string): string | undefined {
  if (!value || typeof value !== "object") return undefined;

  const candidate = (value as Record<string, unknown>)[key];
  if (typeof candidate !== "string") return undefined;

  const trimmed = candidate.trim();
  return trimmed === "" ? undefined : trimmed;
}

function truncate(text: string, maxLength = 300): string {
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function buildErrorMessage(response: Response, data: unknown): string {
  const prefix = `HTTP ${response.status} ${response.statusText}`;

  if (typeof data === "string") {
    const text = data.trim();
    return text ? `${prefix}: ${truncate(text)}` : prefix;
  }

  const title = getStringField(data, "title");
  const detail = getStringField(data, "detail");
  const message =
    getStringField(data, "message") ??
    getStringField(data, "error_description") ??
    getStringField(data, "error");

  if (title && detail) return `${prefix}: ${title} — ${detail}`;
  if (detail) return `${prefix}: ${detail}`;
  if (message) return `${prefix}: ${message}`;
  if (title) return `${prefix}: ${title}`;

  return prefix;
}

export class ApiError<T = unknown> extends Error {
  readonly name = "ApiError";
  readonly status: number;
  readonly statusText: string;
  readonly data: T | null;
  readonly headers: Headers;
  readonly response: Response;
  readonly method: string;
  readonly url: string;

  constructor(
    response: Response,
    data: T | null,
    requestInfo: { method: string; url: string },
  ) {
    super(buildErrorMessage(response, data));
    Object.setPrototypeOf(this, new.target.prototype);

    this.status = response.status;
    this.statusText = response.statusText;
    this.data = data;
    this.headers = response.headers;
    this.response = response;
    this.method = requestInfo.method;
    this.url = response.url || requestInfo.url;
  }
}

export class ResponseParseError extends Error {
  readonly name = "ResponseParseError";
  readonly status: number;
  readonly statusText: string;
  readonly headers: Headers;
  readonly response: Response;
  readonly method: string;
  readonly url: string;
  readonly rawBody: string;
  readonly cause: unknown;

  constructor(
    response: Response,
    rawBody: string,
    cause: unknown,
    requestInfo: { method: string; url: string },
  ) {
    super(
      `Failed to parse response from ${requestInfo.method} ${response.url || requestInfo.url} ` +
        `(${response.status} ${response.statusText}) as JSON`,
    );
    Object.setPrototypeOf(this, new.target.prototype);

    this.status = response.status;
    this.statusText = response.statusText;
    this.headers = response.headers;
    this.response = response;
    this.method = requestInfo.method;
    this.url = response.url || requestInfo.url;
    this.rawBody = rawBody;
    this.cause = cause;
  }
}

async function parseJsonBody(
  response: Response,
  requestInfo: { method: string; url: string },
): Promise<unknown> {
  const raw = await response.text();
  const normalized = stripBom(raw);

  if (normalized.trim() === "") {
    return null;
  }

  try {
    return JSON.parse(normalized);
  } catch (cause) {
    throw new ResponseParseError(response, raw, cause, requestInfo);
  }
}

async function parseErrorBody(response: Response, method: string): Promise<unknown> {
  if (hasNoBody(response, method)) {
    return null;
  }

  const mediaType = getMediaType(response.headers);

  // Fall back to text when blob() is unavailable (e.g. some React Native builds).
  if (mediaType && !isJsonMediaType(mediaType) && !isTextMediaType(mediaType)) {
    return typeof response.blob === "function" ? response.blob() : response.text();
  }

  const raw = await response.text();
  const normalized = stripBom(raw);
  const trimmed = normalized.trim();

  if (trimmed === "") {
    return null;
  }

  if (isJsonMediaType(mediaType) || looksLikeJson(normalized)) {
    try {
      return JSON.parse(normalized);
    } catch {
      return raw;
    }
  }

  return raw;
}

function inferResponseType(response: Response): "json" | "text" | "blob" {
  const mediaType = getMediaType(response.headers);

  if (isJsonMediaType(mediaType)) return "json";
  if (isTextMediaType(mediaType) || mediaType == null) return "text";
  return "blob";
}

async function parseSuccessBody(
  response: Response,
  responseType: "json" | "text" | "blob" | "auto",
  requestInfo: { method: string; url: string },
): Promise<unknown> {
  if (hasNoBody(response, requestInfo.method)) {
    return null;
  }

  const effectiveType =
    responseType === "auto" ? inferResponseType(response) : responseType;

  switch (effectiveType) {
    case "json":
      return parseJsonBody(response, requestInfo);

    case "text": {
      const text = await response.text();
      return text === "" ? null : text;
    }

    case "blob":
      if (typeof response.blob !== "function") {
        throw new TypeError(
          "Blob responses are not supported in this runtime. " +
            "Use responseType \"json\" or \"text\" instead.",
        );
      }
      return response.blob();
  }
}

function getStored<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch {
    return defaultValue;
  }
}

function setStored<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function getCurrentUserKey(): string {
  try {
    const item = localStorage.getItem("mizan_user");
    if (!item) return "default";
    const parsed = JSON.parse(item);
    return (parsed?.email || parsed?.id || "default").toLowerCase().replace(/[^a-z0-9]/g, "_");
  } catch {
    return "default";
  }
}

function handleMockStorage(url: string, method: string, bodyData: any): any {
  const cleanUrl = url.split("?")[0];
  const userKey = getCurrentUserKey();
  const profileKey = `mizan_${userKey}_profile`;
  const billsKey = `mizan_${userKey}_bills`;
  const debtsKey = `mizan_${userKey}_debts`;
  const savingsKey = `mizan_${userKey}_savings`;

  if (cleanUrl.includes("/api/user/profile")) {
    const profile = getStored(profileKey, { displayName: userKey !== "default" ? userKey.split("_")[0] : "User", preferredCurrency: "USD" });
    if (method === "PUT" || method === "POST") {
      const updated = { ...profile, ...bodyData };
      setStored(profileKey, updated);
      return updated;
    }
    return profile;
  }

  if (cleanUrl.includes("/api/bills")) {
    let bills = getStored<any[]>(billsKey, []);
    const match = cleanUrl.match(/\/api\/bills\/(\d+)/);
    const id = match ? Number(match[1]) : null;

    if (method === "GET") return bills;
    if (method === "POST") {
      const newBill = {
        id: Date.now(),
        name: bodyData?.name || "New Bill",
        amount: Number(bodyData?.amount || 0),
        dueDate: bodyData?.dueDate || new Date().toISOString().split("T")[0],
        nextPaymentDate: bodyData?.dueDate || new Date().toISOString().split("T")[0],
        frequency: bodyData?.frequency || "monthly",
        endDate: bodyData?.endDate || null,
        paid: false,
        status: "pending",
        daysRemaining: 7,
      };
      bills.push(newBill);
      setStored(billsKey, bills);
      return newBill;
    }
    if (method === "PATCH" || method === "PUT") {
      if (id) {
        bills = bills.map((b) => (b.id === id ? { ...b, ...bodyData } : b));
        setStored(billsKey, bills);
        return bills.find((b) => b.id === id) || {};
      }
    }
    if (method === "DELETE" && id) {
      bills = bills.filter((b) => b.id !== id);
      setStored(billsKey, bills);
      return { success: true };
    }
    return bills;
  }

  if (cleanUrl.includes("/api/debts")) {
    let debts = getStored<any[]>(debtsKey, []);
    const match = cleanUrl.match(/\/api\/debts\/(\d+)/);
    const id = match ? Number(match[1]) : null;

    if (cleanUrl.includes("/payments") && method === "POST") {
      const payMatch = cleanUrl.match(/\/api\/debts\/(\d+)\/payments/);
      const payId = payMatch ? Number(payMatch[1]) : null;
      if (payId) {
        debts = debts.map((d) => {
          if (d.id === payId) {
            const paid = Number(bodyData?.amount || 0);
            const remaining = Math.max(0, d.remainingAmount - paid);
            const progress = Math.min(100, Math.round(((d.totalAmount - remaining) / d.totalAmount) * 100));
            return { ...d, remainingAmount: remaining, progress };
          }
          return d;
        });
        setStored(debtsKey, debts);
        return debts.find((d) => d.id === payId) || {};
      }
    }

    if (method === "GET") return debts;
    if (method === "POST") {
      const totalAmount = Number(bodyData?.totalAmount || 0);
      const newDebt = {
        id: Date.now(),
        name: bodyData?.name || "New Debt",
        totalAmount,
        remainingAmount: totalAmount,
        monthlyPayment: Number(bodyData?.monthlyPayment || 0),
        dueDate: bodyData?.dueDate || new Date().toISOString().split("T")[0],
        progress: 0,
        estimatedMonthsRemaining: Math.ceil(totalAmount / (bodyData?.monthlyPayment || 1)),
        estimatedPayoffDate: new Date().toISOString(),
      };
      debts.push(newDebt);
      setStored(debtsKey, debts);
      return newDebt;
    }
    if (method === "DELETE" && id) {
      debts = debts.filter((d) => d.id !== id);
      setStored(debtsKey, debts);
      return { success: true };
    }
    return debts;
  }

  if (cleanUrl.includes("/api/savings-goals")) {
    let goals = getStored<any[]>(savingsKey, []);
    const match = cleanUrl.match(/\/api\/savings-goals\/(\d+)/);
    const id = match ? Number(match[1]) : null;

    if (cleanUrl.includes("/contributions") && method === "POST") {
      const contribMatch = cleanUrl.match(/\/api\/savings-goals\/(\d+)\/contributions/);
      const contribId = contribMatch ? Number(contribMatch[1]) : null;
      if (contribId) {
        goals = goals.map((g) => {
          if (g.id === contribId) {
            const added = Number(bodyData?.amount || 0);
            const current = g.currentAmount + added;
            const remaining = Math.max(0, g.targetAmount - current);
            const progress = g.targetAmount > 0 ? Math.min(100, Math.round((current / g.targetAmount) * 100)) : 0;
            return { ...g, currentAmount: current, remainingAmount: remaining, progress };
          }
          return g;
        });
        setStored(savingsKey, goals);
        return goals.find((g) => g.id === contribId) || {};
      }
    }

    if (method === "GET") return goals;
    if (method === "POST") {
      const targetAmount = Number(bodyData?.targetAmount || 0);
      const currentAmount = Number(bodyData?.currentAmount || 0);
      const remainingAmount = Math.max(0, targetAmount - currentAmount);
      const progress = targetAmount > 0 ? Math.min(100, Math.round((currentAmount / targetAmount) * 100)) : 0;
      const newGoal = {
        id: Date.now(),
        name: bodyData?.name || "New Savings Goal",
        targetAmount,
        currentAmount,
        remainingAmount,
        monthlyContribution: Number(bodyData?.monthlyContribution || 0),
        progress,
        estimatedMonthsRemaining: Math.ceil(remainingAmount / (bodyData?.monthlyContribution || 1)),
        estimatedCompletionDate: new Date().toISOString(),
      };
      goals.push(newGoal);
      setStored(savingsKey, goals);
      return newGoal;
    }
    if (method === "DELETE" && id) {
      goals = goals.filter((g) => g.id !== id);
      setStored(savingsKey, goals);
      return { success: true };
    }
    return goals;
  }

  if (cleanUrl.includes("/api/dashboard")) {
    const bills = getStored<any[]>(billsKey, []);
    const debts = getStored<any[]>(debtsKey, []);
    const goals = getStored<any[]>(savingsKey, []);

    const upcomingBills = bills.filter((b) => !b.paid).length;
    const totalRemainingDebt = debts.reduce((sum, d) => sum + Number(d.remainingAmount || 0), 0);
    const currentSavings = goals.reduce((sum, g) => sum + Number(g.currentAmount || 0), 0);
    const targetSavings = goals.reduce((sum, g) => sum + Number(g.targetAmount || 0), 0);
    const savingsProgress = targetSavings > 0 ? Math.min(100, Math.round((currentSavings / targetSavings) * 100)) : 0;

    return {
      monthlyIncome: 5000,
      upcomingBills,
      nextBill: bills.find((b) => !b.paid)?.name || null,
      totalRemainingDebt,
      currentSavings,
      savingsProgress,
      recentActivity: [
        ...bills.slice(-2).map((b) => ({ id: "b_" + b.id, title: `Bill: ${b.name}`, detail: `$${b.amount}`, occurredAt: new Date().toISOString() })),
        ...debts.slice(-2).map((d) => ({ id: "d_" + d.id, title: `Debt: ${d.name}`, detail: `$${d.remainingAmount} remaining`, occurredAt: new Date().toISOString() })),
      ],
    };
  }

  return [];
}

export async function customFetch<T = unknown>(
  input: RequestInfo | URL,
  options: CustomFetchOptions = {},
): Promise<T> {
  input = applyBaseUrl(input);
  const { responseType = "auto", headers: headersInit, ...init } = options;

  const method = resolveMethod(input, init.method);

  if (init.body != null && (method === "GET" || method === "HEAD")) {
    throw new TypeError(`customFetch: ${method} requests cannot have a body.`);
  }

  const headers = mergeHeaders(isRequest(input) ? input.headers : undefined, headersInit);

  if (
    typeof init.body === "string" &&
    !headers.has("content-type") &&
    looksLikeJson(init.body)
  ) {
    headers.set("content-type", "application/json");
  }

  if (responseType === "json" && !headers.has("accept")) {
    headers.set("accept", DEFAULT_JSON_ACCEPT);
  }

  if (_authTokenGetter && !headers.has("authorization")) {
    const token = await _authTokenGetter();
    if (token) {
      headers.set("authorization", `Bearer ${token}`);
    }
  }

  const requestInfo = { method, url: resolveUrl(input) };

  try {
    const response = await fetch(input, { ...init, method, headers });
    const contentType = response.headers.get("content-type") || "";

    if (response.ok && !contentType.includes("text/html")) {
      return (await parseSuccessBody(response, responseType, requestInfo)) as T;
    }

    if (!response.ok && contentType.includes("application/json")) {
      const errorData = await parseErrorBody(response, method);
      throw new ApiError(response, errorData, requestInfo);
    }
  } catch (err: any) {
    if (err instanceof ApiError && err.status < 400) {
      throw err;
    }
  }

  let bodyData: any = null;
  if (typeof init.body === "string") {
    try { bodyData = JSON.parse(init.body); } catch {}
  }
  return handleMockStorage(requestInfo.url, method, bodyData) as T;
}
