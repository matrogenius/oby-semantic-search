import { embedText } from "./embeddings.mjs";
import { putVector, deleteVector } from "./vectors.mjs";

/**
 * Parses and validates the SQS message contract:
 * { "operation": "create", "listingId": "<id>", "content": "...", "categoryId": <number> }
 * or { "operation": "delete", "listingId": "<id>" }.
 * Throws if the body isn't valid JSON, doesn't match this shape, or is
 * missing "listingId" - callers must not fall back to treating the body as
 * plain text. Returns null when "operation" isn't "create" or "delete",
 * signalling that the message must be ignored.
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

  const { operation, listingId } = parsed;

  if (operation !== "create" && operation !== "delete") {
    return null;
  }

  if (typeof listingId !== "string" || !listingId.trim()) {
    throw new Error('Message body must contain a non-empty string "listingId"');
  }

  if (operation === "delete") {
    return { operation, listingId: listingId.trim() };
  }

  const { content, categoryId } = parsed;

  if (typeof content !== "string" || !content.trim()) {
    throw new Error('Message body must contain a non-empty string "content"');
  }
  if (typeof categoryId !== "number" || !Number.isFinite(categoryId)) {
    throw new Error('Message body must contain a numeric "categoryId"');
  }

  return { operation, listingId: listingId.trim(), content: content.trim(), categoryId };
}

/**
 * Lambda handler for the SQS event source. Uses partial batch response
 * (ReportBatchItemFailures) so only failed messages are retried/redriven.
 */
export const handler = async (event) => {
  const batchItemFailures = [];

  for (const record of event.Records ?? []) {
    try {
      const message = parseMessage(record.body ?? "");

      if (!message) {
        console.warn(`Ignoring message ${record.messageId}: unrecognized "operation"`);
        continue;
      }

      if (message.operation === "delete") {
        await deleteVector(message.listingId);
        continue;
      }

      const embedding = await embedText(message.content);

      await putVector({
        key: message.listingId,
        embedding,
        metadata: {
          listingId: message.listingId,
          categoryId: message.categoryId,
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