import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { config, r2Ready } from "../lib/config.js";
import { HttpError } from "../lib/errors.js";
function client() {
  if (!r2Ready())
    throw new HttpError(
      503,
      "Add the R2 bucket credentials to enable receipt storage.",
    );
  return new S3Client({
    region: "auto",
    endpoint: config.R2_ENDPOINT,
    credentials: {
      accessKeyId: config.R2_ACCESS_KEY_ID!,
      secretAccessKey: config.R2_SECRET_ACCESS_KEY!,
    },
  });
}
export const storage = {
  async put(key: string, body: Uint8Array, mimeType: string) {
    await client().send(
      new PutObjectCommand({
        Bucket: config.R2_BUCKET,
        Key: key,
        Body: body,
        ContentType: mimeType,
      }),
    );
  },
  async get(key: string) {
    return client().send(
      new GetObjectCommand({ Bucket: config.R2_BUCKET, Key: key }),
    );
  },
  async remove(key: string) {
    await client().send(
      new DeleteObjectCommand({ Bucket: config.R2_BUCKET, Key: key }),
    );
  },
};
