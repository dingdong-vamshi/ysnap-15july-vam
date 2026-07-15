import { 
  handleCors, 
  verifyUser, 
  formatError, 
  formatResponse, 
  checkRateLimit, 
  logUsageEvent,
  getSecret
} from "../shared/index.ts";

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const userId = await verifyUser(req);
    checkRateLimit(userId);

    const elevenLabsApiKey = await getSecret('ELEVENLABS_API_KEY');
    if (!elevenLabsApiKey) {
      return formatError("ELEVENLABS_API_KEY is not configured", 500);
    }

    const contentType = req.headers.get("content-type") ?? "";
    let fileBlob: Blob;
    let fileName = "audio.mp3";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file");
      if (!file || !(file instanceof File)) {
        return formatError("Missing parameter: 'file' field is required in form-data");
      }
      fileBlob = file;
      fileName = file.name || "audio.mp3";
    } else if (contentType.startsWith("audio/")) {
      // Raw binary upload
      const arrayBuffer = await req.arrayBuffer();
      fileBlob = new Blob([arrayBuffer], { type: contentType });
    } else {
      return formatError("Invalid Content-Type. Must be multipart/form-data or audio/*");
    }

    // Enforce MIME bounds and file size (20 MB limit)
    const MAX_SIZE = 20 * 1024 * 1024;
    if (fileBlob.size > MAX_SIZE) {
      return formatError(`File size exceeds limit of 20MB. Received size: ${(fileBlob.size / (1024 * 1024)).toFixed(2)}MB`);
    }

    const outboundFormData = new FormData();
    outboundFormData.append("file", fileBlob, fileName);
    outboundFormData.append("model_id", "scribe_v2");

    console.log(`Transcribing audio of size ${(fileBlob.size / 1024).toFixed(1)} KB...`);
    const response = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: {
        "xi-api-key": elevenLabsApiKey
      },
      body: outboundFormData
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ElevenLabs STT API returned status ${response.status}: ${errorText}`);
    }

    const result = await response.json();

    // Log usage event (quantity = file size in bytes)
    const transcribedText = result.text || "";
    await logUsageEvent(userId, 'transcription', fileBlob.size, 'bytes', {
      file_size: fileBlob.size,
      text_length: transcribedText.length
    });

    return formatResponse(result);
  } catch (err) {
    return formatError(err);
  }
});
