import { z } from "zod";

const BASE_URL = "https://api.openai.com/v1";

const embeddingsSchema = z.object({
  data: z.array(z.object({ index: z.number(), embedding: z.array(z.number()) })),
});

const chatSchema = z.object({
  choices: z
    .array(
      z.object({
        finish_reason: z.string().nullish(),
        message: z.object({ content: z.string().nullable(), refusal: z.string().nullish() }),
      }),
    )
    .min(1),
});

export type StructuredRequest<T extends z.ZodType> = {
  model: string;
  system: string;
  user: string;
  responseFormat: { type: "json_schema"; json_schema: { name: string; strict: boolean; schema: object } };
  schema: T;
};

export class OpenAIError extends Error {
  constructor(
    readonly status: number,
    readonly path: string,
    detail: string,
  ) {
    super(`OpenAI ${status} for ${path}: ${detail}`);
  }
}

export type OpenAIClientOptions = {
  apiKey: string;
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  maxRetries?: number;
};

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function createOpenAIClient({
  apiKey,
  fetch: fetchFn = fetch,
  sleep = defaultSleep,
  maxRetries = 5,
}: OpenAIClientOptions) {
  async function post<T extends z.ZodType>(path: string, body: unknown, schema: T) {
    for (let attempt = 0; ; attempt++) {
      let res: Response | undefined;
      try {
        res = await fetchFn(BASE_URL + path, {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } catch (err) {
        if (attempt >= maxRetries) throw err;
      }

      if (res?.ok) return schema.parse(await res.json()) as z.infer<T>;
      if (res && (attempt >= maxRetries || (res.status !== 429 && res.status < 500))) {
        throw new OpenAIError(res.status, path, await res.text());
      }
      // OpenAI also answers 429 when the account is out of credit; waiting won't fix that.
      if (res?.status === 429) {
        const detail = await res.text();
        if (detail.includes("insufficient_quota")) throw new OpenAIError(429, path, detail);
      }

      const retryAfter = Number(res?.headers.get("retry-after"));
      await sleep(retryAfter > 0 ? retryAfter * 1000 : 1000 * 2 ** attempt);
    }
  }

  return {
    // Returns one vector per input, in input order.
    async embed(model: string, inputs: string[]): Promise<number[][]> {
      const { data } = await post("/embeddings", { model, input: inputs }, embeddingsSchema);
      if (data.length !== inputs.length) {
        throw new Error(`OpenAI returned ${data.length} embeddings for ${inputs.length} inputs`);
      }
      return data.toSorted((a, b) => a.index - b.index).map((d) => d.embedding);
    },

    // One chat completion constrained to a JSON schema, parsed and validated with `schema`.
    async structured<T extends z.ZodType>({
      model,
      system,
      user,
      responseFormat,
      schema,
    }: StructuredRequest<T>): Promise<z.infer<T>> {
      const body = {
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: responseFormat,
      };
      const [choice] = (await post("/chat/completions", body, chatSchema)).choices;
      if (choice.message.refusal) throw new Error(`${model} refused: ${choice.message.refusal}`);
      if (choice.finish_reason !== "stop" || !choice.message.content) {
        throw new Error(`${model} stopped early (finish_reason ${choice.finish_reason})`);
      }
      return schema.parse(JSON.parse(choice.message.content)) as z.infer<T>;
    },
  };
}

export type OpenAIClient = ReturnType<typeof createOpenAIClient>;
