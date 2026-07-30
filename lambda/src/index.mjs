import { embedText } from "./embeddings.mjs";
import { putVector } from "./vectors.mjs";

const MAX_METADATA_TEXT_LENGTH = 2000;

/**
 * Pulls the plain-text content out of an SQS message body. Accepts either a
 * raw text body, or a JSON body with a "text" / "content" string field.
 */
function extractText(record) {
  const body = record.body ?? "";
  try {
    const parsed = JSON.parse(body);
    if (typeof parsed === "string") return parsed;
    if (parsed && typeof parsed === "object") {
      const candidate = parsed.text ?? parsed.content ?? parsed.message;
      if (typeof candidate === "string") return candidate;
    }
  } catch {
    // Not JSON - treat the whole body as plain text.
  }
  return body;
}

/**
 * Lambda handler for the SQS event source. Uses partial batch response
 * (ReportBatchItemFailures) so only failed messages are retried/redriven.
 */
export const handler = async (event) => {
  const batchItemFailures = [];

  for (const record of event.Records ?? []) {
    try {
      const text = extractText(record).trim();
      if (!text) {
        throw new Error("Message body did not contain any text content");
      }

      const embedding = await embedText(text);

      await putVector({
        key: record.messageId,
        embedding,
        metadata: {
          text: text.slice(0, MAX_METADATA_TEXT_LENGTH),
          messageId: record.messageId,
          sourceQueueArn: record.eventSourceARN,
          ingestedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error(`Failed to process message ${record.messageId}:`, error);
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }

  return { batchItemFailures };
};