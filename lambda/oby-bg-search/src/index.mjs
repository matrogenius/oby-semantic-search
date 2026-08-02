import { embedText } from "./embeddings.mjs";
import { queryVectors } from "./vectors.mjs";

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

function parseRequestBody(event) {
  if (!event?.body) return {};
  const raw = event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf-8") : event.body;
  return JSON.parse(raw);
}

/**
 * Lambda handler for the API Gateway proxy integration backing
 * POST /search with body { searchString: string, categoryId?: number }.
 * Embeds the search string with Bedrock Titan Text Embeddings V2 and
 * returns the closest listings found in the S3 Vectors index, each with its
 * ID and its distance to the query (lower = closer match), optionally
 * restricted to a single categoryId.
 */
export const handler = async (event) => {
  let requestBody;
  try {
    requestBody = parseRequestBody(event);
  } catch {
    return jsonResponse(400, { message: "Request body must be valid JSON" });
  }

  const { searchString, categoryId } = requestBody;

  if (typeof searchString !== "string" || !searchString.trim()) {
    return jsonResponse(400, { message: 'Missing required field "searchString"' });
  }

  let categoryFilter;
  if (categoryId !== undefined && categoryId !== null) {
    if (typeof categoryId !== "number" || !Number.isFinite(categoryId) || categoryId < 0) {
      return jsonResponse(400, { message: '"categoryId" must be a non-negative number' });
    }
    categoryFilter = categoryId;
  }

  try {
    const embedding = await embedText(searchString.trim());
    const results = await queryVectors(embedding, { categoryId: categoryFilter });
    return jsonResponse(200, { results });
  } catch (error) {
    console.error("Search failed:", error);
    return jsonResponse(500, { message: "Internal server error" });
  }
};