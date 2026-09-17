import "server-only";
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { createConnection } from "node:net";
import { localMode } from "./database";
import { QuestionnaireError } from "./access";
export async function saveAsset(key: string, bytes: Buffer, mime: string) {
  if (localMode()) {
    const folder = path.join(process.cwd(), ".questionnaire-preview", "assets");
    await mkdir(folder, { recursive: true });
    await writeFile(path.join(folder, key), bytes, { flag: "wx", mode: 0o600 });
  } else {
    const { putObject } = await import("@/lib/storage");
    await putObject(`questionnaires/${key}`, bytes, mime);
  }
}
export async function readAsset(key: string) {
  if (!/^[0-9a-f-]{36}$/.test(key))
    throw new QuestionnaireError("File not found.", 404);
  if (localMode())
    return readFile(
      path.join(process.cwd(), ".questionnaire-preview", "assets", key),
    );
  const { getObjectBuffer } = await import("@/lib/storage");
  return getObjectBuffer(`questionnaires/${key}`);
}
export async function deleteAsset(key: string) {
  if (!/^[0-9a-f-]{36}$/.test(key)) return;
  if (localMode())
    await unlink(
      path.join(process.cwd(), ".questionnaire-preview", "assets", key),
    ).catch(() => {});
  else {
    const { removeObject } = await import("@/lib/storage");
    await removeObject(`questionnaires/${key}`);
  }
}
export async function scanAsset(bytes: Buffer) {
  if (localMode()) return;
  if (!process.env.QUESTIONNAIRE_CLAMAV_HOST)
    throw new QuestionnaireError(
      "File uploads need the workspace file scanner. Please contact the questionnaire team.",
      503,
    );
  await new Promise<void>((resolve, reject) => {
    const socket = createConnection({
      host: process.env.QUESTIONNAIRE_CLAMAV_HOST,
      port: Number(process.env.QUESTIONNAIRE_CLAMAV_PORT ?? 3310),
    });
    let result = "";
    socket.setTimeout(30000, () =>
      socket.destroy(new Error("File scanner timed out.")),
    );
    socket.on("error", () =>
      reject(
        new QuestionnaireError(
          "The file scanner is unavailable. Please try again later.",
          503,
        ),
      ),
    );
    socket.on("data", (chunk) => {
      result += chunk.toString();
      if (result.includes("\0")) {
        socket.end();
        /^stream: OK\0$/.test(result)
          ? resolve()
          : reject(
              new QuestionnaireError(
                "This file did not pass the security scan.",
              ),
            );
      }
    });
    socket.on("end", () => {
      if (!/^stream: OK\0$/.test(result))
        reject(
          new QuestionnaireError(
            "The file scanner could not verify this file.",
            503,
          ),
        );
    });
    socket.on("connect", () => {
      socket.write("zINSTREAM\0");
      for (let offset = 0; offset < bytes.length; offset += 65536) {
        const chunk = bytes.subarray(offset, offset + 65536);
        const size = Buffer.alloc(4);
        size.writeUInt32BE(chunk.length);
        socket.write(size);
        socket.write(chunk);
      }
      socket.write(Buffer.alloc(4));
    });
  });
}
export async function boundedBytes(req: Request, max: number) {
  if (Number(req.headers.get("content-length") ?? 0) > max)
    throw new QuestionnaireError("The upload is too large.", 413);
  const reader = req.body?.getReader();
  if (!reader) throw new QuestionnaireError("Missing upload.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > max) {
      await reader.cancel();
      throw new QuestionnaireError("The upload is too large.", 413);
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}
