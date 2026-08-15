interface CloudflareEnv {
  DB: D1Database;
  PRODUCT_IMAGES: R2Bucket;
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
}
