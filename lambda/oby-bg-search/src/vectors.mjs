import { S3VectorsClient, QueryVectorsCommand } from "@aws-sdk/client-s3vectors";

const VECTOR_BUCKET_NAME = process.env.VECTOR_BUCKET_NAME;
const VECTOR_INDEX_NAME = process.env.VECTOR_INDEX_NAME;
const MAX_SEARCH_RESULTS = Number(process.env.MAX_SEARCH_RESULTS ?? 200);

const client = new S3VectorsClient({});

/**
 * Runs an approximate nearest neighbor search in the configured S3 Vectors
 * index and returns the matching listings, ordered by distance, together
 * with their computed distance to the query vector (lower = closer match).
 * When categoryId is given, results are restricted to vectors whose
 * metadata.categoryId matches it.
 * @param {number[]} embedding
 * @param {{ categoryId?: number }} [options]
 * @returns {Promise<{ id: string, distance: number }[]>}
 */
export async function queryVectors(embedding, { categoryId } = {}) {
  const command = new QueryVectorsCommand({
    vectorBucketName: VECTOR_BUCKET_NAME,
    indexName: VECTOR_INDEX_NAME,
    queryVector: { float32: embedding },
    topK: MAX_SEARCH_RESULTS,
    returnDistance: true,
    ...(categoryId !== undefined && { filter: { categoryId } }),
  });

  const response = await client.send(command);
  return (response.vectors ?? []).map((vector) => ({
    id: vector.key,
    distance: vector.distance,
  }));
}