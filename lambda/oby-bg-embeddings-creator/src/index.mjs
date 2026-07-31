import { embedText } from "./embeddings.mjs";
import { putVector } from "./vectors.mjs";

const MAX_METADATA_TEXT_LENGTH = 2000;

/**
 * Parses and validates the SQS message contract:
 * { "listingId": "<id>", "content": "...", "categoryId": <number> }.
 * Throws if the body isn't valid JSON or doesn't match this shape - callers
 * must not fall back to treating the body as plain text.
 */
function parseMessage(body) {
  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch {
    throw new Error("Message body is not valid JSON");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Message body must be a JSON object");
  }

  const { listingId, content, categoryId } = parsed;

  if (typeof listingId !== "string" || !listingId.trim()) {
    throw new Error('Message body must contain a non-empty string "listingId"');
  }
  if (typeof content !== "string" || !content.trim()) {
    throw new Error('Message body must contain a non-empty string "content"');
  }
  if (typeof categoryId !== "number" || !Number.isFinite(categoryId)) {
    throw new Error('Message body must contain a numeric "categoryId"');
  }

  return { listingId, content: content.trim(), categoryId };
}

/**
 * Lambda handler for the SQS event source. Uses partial batch response
 * (ReportBatchItemFailures) so only failed messages are retried/redriven.
 */
export const handler = async (event) => {
  const batchItemFailures = [];

  for (const record of event.Records ?? []) {
    try {
      const { listingId, content, categoryId } = parseMessage(record.body ?? "");

      const embedding = await embedText(content);

      await putVector({
        key: listingId,
        embedding,
        metadata: {
          listingId,
          categoryId,
          text: content.slice(0, MAX_METADATA_TEXT_LENGTH),
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