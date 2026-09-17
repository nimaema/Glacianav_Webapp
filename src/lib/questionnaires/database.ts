import "server-only";
import postgres from "postgres";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { questionnaireJson } from "./json";

export type QDatabase = {
  query<T = Record<string, unknown>>(
    text: string,
    params?: unknown[],
  ): Promise<T[]>;
  transaction<T>(fn: (tx: QDatabase) => Promise<T>): Promise<T>;
};
export function localMode() {
  return (
    process.env.NODE_ENV === "development" &&
    process.env.QUESTIONNAIRE_LOCAL_PREVIEW === "true" &&
    !process.env.DATABASE_URL
  );
}
const globalDb = globalThis as typeof globalThis & {
  questionnaireDatabase?: Promise<QDatabase>;
};
async function connect(): Promise<QDatabase> {
  if (localMode()) {
    const { PGlite } = await import("@electric-sql/pglite");
    await mkdir(path.join(process.cwd(), ".questionnaire-preview"), {
      recursive: true,
    });
    const pg = new PGlite(
      path.join(process.cwd(), ".questionnaire-preview", "database"),
    );
    await pg.exec(
      await readFile(
        path.join(process.cwd(), "src/db/migrations/0003_questionnaires.sql"),
        "utf8",
      ),
    );
    await pg.exec(await readFile(path.join(process.cwd(), "src/db/migrations/0004_questionnaire_content.sql"), "utf8"));
    const adapt = (p: Pick<typeof pg, "query">): QDatabase => ({
      query: async <T>(s: string, v: unknown[] = []) =>
        (await p.query<T>(s, v)).rows,
      transaction: (fn) =>
        p === pg ? pg.transaction((t) => fn(adapt(t))) : fn(adapt(p)),
    });
    return adapt(pg);
  }
  if (!process.env.DATABASE_URL)
    throw new Error(
      "Connect the workspace database to use questionnaires, or run npm run dev:questionnaires for an isolated local preview.",
    );
  const pg = postgres(process.env.DATABASE_URL, {
    types: { questionnaireJson },
    prepare: false,
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
  });
  const adapt = (p: typeof pg): QDatabase => ({
    query: async <T>(s: string, v: unknown[] = []) =>
      Array.from(await p.unsafe(s, v as never[])) as T[],
    transaction: async (fn) =>
      (await p.begin((tx) => fn(adapt(tx as unknown as typeof pg)))) as Awaited<
        ReturnType<typeof fn>
      >,
  });
  return adapt(pg);
}
export async function qdb() {
  globalDb.questionnaireDatabase ??= connect().catch((e) => {
    globalDb.questionnaireDatabase = undefined;
    throw e;
  });
  return globalDb.questionnaireDatabase;
}
