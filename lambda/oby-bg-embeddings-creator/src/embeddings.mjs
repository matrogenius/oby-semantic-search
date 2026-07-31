import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";

const MODEL_ID = process.env.BEDROCK_MODEL_ID ?? "amazon.titan-embed-text-v2:0";
const DIMENSIONS = Number(process.env.EMBEDDING_DIMENSIONS ?? 1024);

const client = new BedrockRuntimeClient({});

/**
 * Calls Titan Text Embeddings V2 and returns a float32 embedding vector.
 * @param {string} text
 * @returns {Promise<number[]>}
 */
export async function embedText(text) {
  const command = new InvokeModelCommand({
    modelId: MODEL_ID,
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify({
      inputText: text,
      dimensions: DIMENSIONS,
      normalize: true,
    }),
  });

  const response = await client.send(command);
  const payload = JSON.parse(Buffer.from(response.body).toString("utf-8"));
  return payload.embedding;
}