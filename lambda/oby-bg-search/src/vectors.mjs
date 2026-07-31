import { S3VectorsClient, QueryVectorsCommand } from "@aws-sdk/client-s3vectors";

const VECTOR_BUCKET_NAME = process.env.VECTOR_BUCKET_NAME;
const VECTOR_INDEX_NAME = process.env.VECTOR_INDEX_NAME;
const MAX_SEARCH_RESULTS = Number(process.env.MAX_SEARCH_RESULTS ?? 200);

const client = new S3VectorsClient({});

/**
 * Runs an approximate nearest neighbor search in the configured S3 Vectors
 * index and returns the matching vector keys (listing IDs), ordered by
 * distance. When categoryId is given, results are restricted to vectors
 * whose metadata.categoryId matches it.
 * @param {number[]} embedding
 * @param {{ categoryId?: number }} [options]
 * @returns {Promise<string[]>}
 */
export async function queryVectors(embedding, { categoryId } = {}) {
  const command = new QueryVectorsCommand({
    vectorBucketName: VECTOR_BUCKET_NAME,
    indexName: VECTOR_INDEX_NAME,
    queryVector: { float32: embedding },
    topK: MAX_SEARCH_RESULTS,
    ...(categoryId !== undefined && { filter: { categoryId } }),
  });

  const response = await client.send(command);
  return (response.vectors ?? []).map((vector) => vector.key);
}