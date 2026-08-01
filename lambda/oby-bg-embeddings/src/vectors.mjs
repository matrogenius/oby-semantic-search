import { S3VectorsClient, PutVectorsCommand, DeleteVectorsCommand } from "@aws-sdk/client-s3vectors";

const VECTOR_BUCKET_NAME = process.env.VECTOR_BUCKET_NAME;
const VECTOR_INDEX_NAME = process.env.VECTOR_INDEX_NAME;

const client = new S3VectorsClient({});

/**
 * Writes a single vector, with metadata, into the configured S3 Vectors index.
 * @param {{ key: string, embedding: number[], metadata: Record<string, unknown> }} params
 */
export async function putVector({ key, embedding, metadata }) {
  const command = new PutVectorsCommand({
    vectorBucketName: VECTOR_BUCKET_NAME,
    indexName: VECTOR_INDEX_NAME,
    vectors: [
      {
        key,
        data: { float32: embedding },
        metadata,
      },
    ],
  });

  await client.send(command);
}

/**
 * Deletes the vector with the given key from the configured S3 Vectors
 * index. Deleting a key that has no matching vector is not an error - S3
 * Vectors treats it as a no-op.
 * @param {string} key
 */
export async function deleteVector(key) {
  const command = new DeleteVectorsCommand({
    vectorBucketName: VECTOR_BUCKET_NAME,
    indexName: VECTOR_INDEX_NAME,
    keys: [key],
  });

  await client.send(command);
}