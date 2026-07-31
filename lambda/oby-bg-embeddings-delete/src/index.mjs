import { deleteVector } from "./vectors.mjs";

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

/**
 * Lambda handler for the API Gateway proxy integration backing
 * DELETE /embeddings/{id}. Deletes the vector whose key matches the given
 * id from the S3 Vectors index. Deleting an id with no matching embedding
 * is not an error - the call still returns OK.
 */
export const handler = async (event) => {
  const id = event?.pathParameters?.id;

  if (!id || !id.trim()) {
    return jsonResponse(400, { message: 'Missing required path parameter "id"' });
  }

  try {
    await deleteVector(id.trim());
  } catch (error) {
    if (error?.name !== "NotFoundException") {
      console.error(`Failed to delete embedding ${id}:`, error);
      return jsonResponse(500, { message: "Internal server error" });
    }
  }

  return jsonResponse(200, { message: "OK" });
};