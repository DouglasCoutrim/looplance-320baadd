import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";

export const deleteFromR2 = async (key: string) => {
  const S3 = new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT_URL,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
    },
  });

  const command = new DeleteObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
  });

  return await S3.send(command);
};
