import { handleCors, formatError } from "../shared/index.ts";

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    return formatError("Gemini visual analysis is not configured yet.", 501);
  } catch (error: any) {
    return formatError(error.message, 500);
  }
});
