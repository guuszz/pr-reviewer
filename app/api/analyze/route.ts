import { reviewHandlers } from "@/lib/review-service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const POST = reviewHandlers.json;
