import { createReviewHandlers } from "./review-handlers";
import { fetchPrData } from "./github";
import { analyzePr, analyzePrStream, MODEL_NAME, SYSTEM_PROMPT } from "./gemini";
import { isRedisConfigured, saveSharedReview } from "./redis";

export const reviewHandlers = createReviewHandlers({
  fetchPr: fetchPrData,
  analyze: analyzePr,
  stream: analyzePrStream,
  // Bump this rule version when deterministic rules or input formatting change.
  engineVersion: `snapshot-v1:spr-v1:${MODEL_NAME}:${SYSTEM_PROMPT}`,
  share: async (id, review) => isRedisConfigured() ? saveSharedReview(id, review) : null,
});
