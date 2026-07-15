import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.0";
import { 
  handleCors, 
  verifyUser, 
  formatError, 
  formatResponse, 
  checkRateLimit, 
  GEMINI_MODEL,
  logUsageEvent,
  getSecret
} from "../shared/index.ts";

async function generateMultimodal(
  imageBytes: Uint8Array,
  mimeType: string,
  prompt: string,
  systemInstruction?: string
): Promise<string> {
  const geminiApiKey = await getSecret('GEMINI_API_KEY').catch(() => '');
  const openRouterApiKey = Deno.env.get('OPENROUTER_API_KEY');

  const base64Data = btoa(
    new Uint8Array(imageBytes).reduce((data, byte) => data + String.fromCharCode(byte), "")
  );

  if (geminiApiKey) {
    try {
      console.log("Calling Gemini API Multimodal...");
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": geminiApiKey },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: mimeType,
                  data: base64Data
                }
              }
            ]
          }],
          systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API returned status ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) return text;
      throw new Error("Empty response from Gemini API");
    } catch (err) {
      console.error("Gemini Multimodal failed, trying OpenRouter fallback...", err);
    }
  }

  if (openRouterApiKey) {
    try {
      console.log("Calling OpenRouter API Multimodal...");
      const url = "https://openrouter.ai/api/v1/chat/completions";
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${openRouterApiKey}`,
          "HTTP-Referer": "https://ysnap.app",
          "X-Title": "YSnap App"
        },
        body: JSON.stringify({
          model: "google/gemini-3.5-flash",
          messages: [
            ...(systemInstruction ? [{ role: "system", content: systemInstruction }] : []),
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:${mimeType};base64,${base64Data}`
                  }
                }
              ]
            }
          ]
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenRouter API returned status ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      const text = data.choices?.[0]?.message?.content;
      if (text) return text;
      throw new Error("Empty response from OpenRouter API");
    } catch (err) {
      console.error("OpenRouter Multimodal failed:", err);
      throw new Error("Both Gemini and OpenRouter multimodal calls failed: " + err.message);
    }
  }

  throw new Error("Credentials missing: Neither GEMINI_API_KEY nor OPENROUTER_API_KEY is available");
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const userId = await verifyUser(req);
    checkRateLimit(userId);

    const contentType = req.headers.get("content-type") ?? "";
    let fileBlob: Blob;
    let visualQuery = "";
    let sessionId: string | null = null;

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file");
      visualQuery = formData.get("query")?.toString() || "";
      sessionId = formData.get("session_id")?.toString() || null;

      if (!file || !(file instanceof File)) {
        return formatError("Missing parameter: 'file' field is required in form-data");
      }
      fileBlob = file;
    } else {
      return formatError("Invalid Content-Type. Must be multipart/form-data");
    }

    if (!visualQuery.trim()) {
      return formatError("Missing parameter: 'query' text is required");
    }

    // Enforce file size check (10 MB limit)
    const MAX_SIZE = 10 * 1024 * 1024;
    if (fileBlob.size > MAX_SIZE) {
      return formatError(`Image file size exceeds limit of 10MB. Received size: ${(fileBlob.size / (1024 * 1024)).toFixed(2)}MB`);
    }

    if (!fileBlob.type.startsWith("image/")) {
      return formatError(`Invalid file format. Upload must be an image, got: ${fileBlob.type}`);
    }

    const imageBytes = new Uint8Array(await fileBlob.arrayBuffer());

    // 1. Save Image to Supabase Storage
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    });

    const fileUUID = crypto.randomUUID();
    const extension = fileBlob.type.split("/")[1] || "jpg";
    const filePath = `camera_inputs/${userId}/${fileUUID}.${extension}`;
    const bucketName = 'media';

    console.log(`Uploading camera image to storage bucket '${bucketName}' at path '${filePath}'...`);
    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(filePath, fileBlob, {
        contentType: fileBlob.type,
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      throw new Error(`Failed to upload image to storage: ${uploadError.message}`);
    }

    // Insert record in media_assets
    const { data: mediaAsset } = await supabase
      .from('media_assets')
      .insert({
        user_id: userId,
        session_id: sessionId,
        media_kind: 'camera_input',
        bucket: bucketName,
        path: filePath,
        mime_type: fileBlob.type,
        size_bytes: fileBlob.size,
        retention_policy: 'session'
      })
      .select()
      .single();

    // 2. Query Gemini/OpenRouter with Image and visual query
    const systemInstruction = `You are a real-time smart translation camera assistant. Analyze the image and respond directly to the user's question, keeping the answer accurate, helpful, and concise.`;

    console.log(`Querying Gemini with visual query: "${visualQuery}"...`);
    const answer = await generateMultimodal(
      imageBytes,
      fileBlob.type,
      visualQuery,
      systemInstruction
    );

    // Log Image Analysis Usage
    await logUsageEvent(userId, 'image_analysis', 1, 'image', {
      file_size: fileBlob.size,
      visual_query: visualQuery
    });

    // Create a signed URL for the image
    const { data: signedUrlData } = await supabase.storage
      .from(bucketName)
      .createSignedUrl(filePath, 86400); // 24 hours

    return formatResponse({
      answer,
      image_url: signedUrlData?.signedUrl || null,
      media_asset_id: mediaAsset?.id || null
    });
  } catch (err) {
    return formatError(err);
  }
});
