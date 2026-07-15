import { 
  handleCors, 
  verifyUser, 
  formatError, 
  formatResponse, 
  checkRateLimit,
  getSecret
} from "../shared/index.ts";

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const userId = await verifyUser(req);
    checkRateLimit(userId);

    const elevenLabsApiKey = await getSecret('ELEVENLABS_API_KEY');
    const elevenLabsApiBaseUrl = await getSecret('ELEVENLABS_API_BASE_URL').catch(() => 'https://api.elevenlabs.io');

    console.log("Fetching voices list from ElevenLabs API...");
    const response = await fetch(`${elevenLabsApiBaseUrl}/v1/voices`, {
      method: "GET",
      headers: {
        "xi-api-key": elevenLabsApiKey
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ElevenLabs Get Voices API returned status ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    return formatResponse(result);
  } catch (err) {
    return formatError(err);
  }
});
