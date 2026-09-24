import { CreateBucketCommand, HeadBucketCommand, S3Client } from "@aws-sdk/client-s3";

const endpoint = process.env.PERISCAN_EVIDENCE_S3_ENDPOINT;
const bucket = process.env.PERISCAN_EVIDENCE_S3_BUCKET;
const accessKeyId = process.env.PERISCAN_EVIDENCE_S3_ACCESS_KEY_ID;
const secretAccessKey = process.env.PERISCAN_EVIDENCE_S3_SECRET_ACCESS_KEY;

if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
  throw new Error("Local evidence S3 endpoint, bucket, and credentials are required.");
}

const url = new URL(endpoint);
if (
  url.protocol !== "http:" ||
  !["127.0.0.1", "localhost", "minio"].includes(url.hostname) ||
  process.env.PERISCAN_DEPLOYMENT_ENVIRONMENT === "production"
) {
  throw new Error("Bucket bootstrap is restricted to local Community storage.");
}

const client = new S3Client({
  endpoint,
  region: process.env.PERISCAN_EVIDENCE_S3_REGION ?? "us-east-1",
  forcePathStyle: true,
  credentials: { accessKeyId, secretAccessKey }
});

try {
  await client.send(new HeadBucketCommand({ Bucket: bucket }));
  console.log(`Local evidence bucket ready: ${bucket}`);
} catch (error) {
  const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
  if (status !== 404) throw error;
  await client.send(new CreateBucketCommand({ Bucket: bucket }));
  await client.send(new HeadBucketCommand({ Bucket: bucket }));
  console.log(`Local evidence bucket created: ${bucket}`);
} finally {
  client.destroy();
}
