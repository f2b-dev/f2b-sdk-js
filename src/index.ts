import {
  ErrorCode,
  F2bError,
  type CommandResult,
  type CreateSandboxInput,
  type FileEntry,
  type SandboxRecord,
  type TemplateRef,
  type UsageSummary,
} from "@f2b/spec";

export type F2bClientOptions = {
  /**
   * 沙箱 API 根 URL。
   * - 直连 f2b-sandbox：http://127.0.0.1:13287
   * - 经 f2b-web BFF：http://127.0.0.1:13200（路径仍为 /v1，见 pathPrefix）
   */
  baseUrl: string;
  /**
   * API 路径前缀。
   * - 默认 `/v1`（f2b-sandbox 产品 API）
   * - 若只代理了 `/api/sandboxes` 的旧 BFF，可设为 `/api`
   */
  pathPrefix?: string;
  /** 用户 API Key（鉴权就绪后使用）；开发期可省略 */
  apiKey?: string;
  fetchImpl?: typeof fetch;
};

/** @deprecated 使用 F2bClientOptions；保留灵境云品牌别名 */
export type LingjingClientOptions = F2bClientOptions;

type ApiError = { code?: string; message?: string; details?: unknown };

async function parseJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

/**
 * 灵境云 HTTP 客户端。默认对接 f2b-sandbox `/v1/sandboxes`。
 */
export class F2bClient {
  private readonly baseUrl: string;
  private readonly pathPrefix: string;
  private readonly apiKey?: string;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: F2bClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/$/, "");
    const prefix = opts.pathPrefix ?? "/v1";
    this.pathPrefix = prefix.startsWith("/") ? prefix.replace(/\/$/, "") : `/${prefix}`;
    this.apiKey = opts.apiKey;
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  private headers(json = true): Record<string, string> {
    const h: Record<string, string> = {};
    if (json) h["Content-Type"] = "application/json";
    if (this.apiKey) h.Authorization = `Bearer ${this.apiKey}`;
    return h;
  }

  private sandboxesPath(sub = ""): string {
    const base = `${this.pathPrefix}/sandboxes`;
    return sub ? `${base}${sub.startsWith("/") ? sub : `/${sub}`}` : base;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        headers: this.headers(body !== undefined),
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (err) {
      throw new F2bError(
        ErrorCode.BACKEND_UNAVAILABLE,
        err instanceof Error ? err.message : "request failed",
        { cause: err },
      );
    }
    const data = await parseJson<{ error?: ApiError } & T>(res);
    if (!res.ok) {
      const err = data?.error;
      throw new F2bError(
        (err?.code as (typeof ErrorCode)[keyof typeof ErrorCode]) ||
          ErrorCode.INTERNAL,
        err?.message || `HTTP ${res.status}`,
        { status: res.status, details: err?.details },
      );
    }
    return data as T;
  }

  async listSandboxes(projectId?: string): Promise<SandboxRecord[]> {
    const q = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
    const data = await this.request<{ sandboxes: SandboxRecord[] }>(
      "GET",
      `${this.sandboxesPath()}${q}`,
    );
    return data.sandboxes;
  }

  async createSandbox(
    input: Partial<CreateSandboxInput> = {},
  ): Promise<Sandbox> {
    const data = await this.request<{ sandbox: SandboxRecord }>(
      "POST",
      this.sandboxesPath(),
      input,
    );
    return new Sandbox(this, data.sandbox);
  }

  async getSandbox(id: string): Promise<Sandbox> {
    const data = await this.request<{ sandbox: SandboxRecord }>(
      "GET",
      this.sandboxesPath(`/${encodeURIComponent(id)}`),
    );
    return new Sandbox(this, data.sandbox);
  }

  /** 近 N 日用量聚合（UTC 日桶），默认 7 天 */
  async getUsage(days = 7): Promise<UsageSummary> {
    const n = Math.min(90, Math.max(1, Math.floor(days)));
    const data = await this.request<{ usage: UsageSummary }>(
      "GET",
      `${this.pathPrefix}/usage?days=${n}`,
    );
    return data.usage;
  }

  /** 预置模板目录（id 即创建时的 template） */
  async listTemplates(): Promise<TemplateRef[]> {
    const data = await this.request<{ templates: TemplateRef[] }>(
      "GET",
      `${this.pathPrefix}/templates`,
    );
    return data.templates ?? [];
  }

  /** @internal */
  _request<T>(method: string, path: string, body?: unknown) {
    return this.request<T>(method, path, body);
  }

  /** @internal */
  _sandboxesPath(sub = "") {
    return this.sandboxesPath(sub);
  }
}

/** 灵境云品牌别名 */
export class LingjingClient extends F2bClient {}

export class Sandbox {
  constructor(
    private readonly client: F2bClient,
    private record: SandboxRecord,
  ) {}

  get id() {
    return this.record.id;
  }

  get data(): SandboxRecord {
    return this.record;
  }

  async refresh(): Promise<SandboxRecord> {
    const data = await this.client._request<{ sandbox: SandboxRecord }>(
      "GET",
      this.client._sandboxesPath(`/${encodeURIComponent(this.id)}`),
    );
    this.record = data.sandbox;
    return this.record;
  }

  async run(
    cmd: string,
    opts?: { cwd?: string; timeoutMs?: number; env?: Record<string, string> },
  ): Promise<CommandResult> {
    const data = await this.client._request<{ result: CommandResult }>(
      "POST",
      this.client._sandboxesPath(`/${encodeURIComponent(this.id)}/commands`),
      { cmd, ...opts },
    );
    return data.result;
  }

  async write(path: string, content: string): Promise<void> {
    await this.client._request(
      "POST",
      this.client._sandboxesPath(`/${encodeURIComponent(this.id)}/files`),
      { path, content, encoding: "utf8" },
    );
  }

  async read(path: string): Promise<string> {
    const data = await this.client._request<{
      file: { content: string; encoding: string };
    }>(
      "GET",
      `${this.client._sandboxesPath(`/${encodeURIComponent(this.id)}/files`)}?path=${encodeURIComponent(path)}&encoding=utf8`,
    );
    return data.file.content;
  }

  async listFiles(path = "/home/user"): Promise<FileEntry[]> {
    const data = await this.client._request<{ entries: FileEntry[] }>(
      "GET",
      `${this.client._sandboxesPath(`/${encodeURIComponent(this.id)}/files`)}?list=1&path=${encodeURIComponent(path)}`,
    );
    return data.entries;
  }

  async kill(): Promise<SandboxRecord> {
    const data = await this.client._request<{ sandbox: SandboxRecord }>(
      "DELETE",
      this.client._sandboxesPath(`/${encodeURIComponent(this.id)}`),
    );
    this.record = data.sandbox;
    return this.record;
  }

  async pause(): Promise<SandboxRecord> {
    const data = await this.client._request<{ sandbox: SandboxRecord }>(
      "POST",
      this.client._sandboxesPath(`/${encodeURIComponent(this.id)}/pause`),
    );
    this.record = data.sandbox;
    return this.record;
  }

  async resume(): Promise<SandboxRecord> {
    const data = await this.client._request<{ sandbox: SandboxRecord }>(
      "POST",
      this.client._sandboxesPath(`/${encodeURIComponent(this.id)}/resume`),
    );
    this.record = data.sandbox;
    return this.record;
  }

  /** 便捷：创建沙箱 */
  static async create(
    client: F2bClient,
    input?: Partial<CreateSandboxInput>,
  ) {
    return client.createSandbox(input);
  }
}

export { F2bError, ErrorCode } from "@f2b/spec";
export type {
  CommandResult,
  CreateSandboxInput,
  FileEntry,
  SandboxRecord,
  UsageDayBucket,
  UsageSummary,
} from "@f2b/spec";
