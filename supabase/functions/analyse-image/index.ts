import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.0";
import {
  checkRateLimit,
  formatError,
  formatResponse,
  generateMultimodalResult,
  handleCors,
  logUsageEvent,
  verifyUser,
  safeParseAIJson,
} from "../shared/index.ts";

const MEDIA_BUCKET = "media";
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

type AnalysisResult = {
  ocr_text?: string | null;
  detected_language?: string | null;
  translated_text?: string | null;
  classified_type?: string;
  key_entities?: string[];
  analysis?: string;
  food_info?: {
    name?: string;
    translated_name?: string;
    calories?: number | null;
    protein?: string | null;
    carbs?: string | null;
    fat?: string | null;
    allergens?: string[];
    confidence?: number | null;
  } | null;
  ocr_boxes?: Array<{
    text: string;
    translated: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
};

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const userId = await verifyUser(req);
    checkRateLimit(userId, 20, 60_000);

    if (!(req.headers.get("content-type") ?? "").includes("multipart/form-data")) {
      return formatError("Invalid Content-Type. Must be multipart/form-data");
    }

    const formData = await req.formData();
    const file = formData.get("file");
    const target = formData.get("target")?.toString().trim() || "en";
    const mode = formData.get("mode")?.toString().trim() || "ocr";
    const requestedSessionId = formData.get("session_id")?.toString().trim();

    if (!(file instanceof File)) return formatError("Missing parameter: 'file' is required");
    if (!file.type.startsWith("image/")) return formatError(`Unsupported image type: ${file.type}`);
    if (file.size === 0) return formatError("The selected image is empty");
    if (file.size > MAX_IMAGE_BYTES) return formatError("Image exceeds the 10MB limit");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    let sessionId = requestedSessionId || "";
    if (sessionId) {
      const { data: session } = await supabase
        .from("translation_sessions")
        .select("id,user_id")
        .eq("id", sessionId)
        .maybeSingle();
      if (!session || session.user_id !== userId) return formatError("Camera session was not found", 404);
    } else {
      const { data: session, error } = await supabase
        .from("translation_sessions")
        .insert({
          user_id: userId,
          session_type: "camera",
          source_language: "auto",
          target_language: target,
          title: `Camera ${mode} scan`,
          status: "completed",
          metadata: { mode, provider: "google", feature: "vision_translation" },
        })
        .select("id")
        .single();
      if (error || !session) throw new Error(`Failed to create camera session: ${error?.message}`);
      sessionId = session.id;
    }

    const extension = file.type.split("/")[1]?.replace("jpeg", "jpg") || "jpg";
    const imagePath = `camera_inputs/${userId}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from(MEDIA_BUCKET).upload(imagePath, file, {
      contentType: file.type,
      cacheControl: "3600",
      upsert: false,
    });
    if (uploadError) throw new Error(`Failed to save camera image: ${uploadError.message}`);

    const { data: mediaAsset, error: mediaError } = await supabase
      .from("media_assets")
      .insert({
        user_id: userId,
        session_id: sessionId,
        media_kind: "camera_input",
        bucket: MEDIA_BUCKET,
        path: imagePath,
        mime_type: file.type,
        size_bytes: file.size,
        retention_policy: "session",
      })
      .select("id")
      .single();
    if (mediaError) throw new Error(`Failed to save camera media record: ${mediaError.message}`);

    const systemInstruction = `You are a precise OCR, translation, menu, and food-image assistant. Return one valid JSON object only. Use these keys: ocr_text, detected_language, translated_text, classified_type, key_entities, analysis, food_info, ocr_boxes. Translate all visible text into the target language ${target}. For food_info use name, translated_name, calories, protein, carbs, fat, allergens, confidence; use null when the image is not food. For ocr_boxes, return at most 12 important text regions with x, y, width, height as integer coordinates from 0 to 1000. Never invent text or nutrition facts; use null and explain uncertainty when evidence is insufficient.`;
    const generated = await generateMultimodalResult(
      new Uint8Array(await file.arrayBuffer()),
      file.type,
      `Analyze this image in ${mode} mode and translate it to ${target}.`,
      systemInstruction,
      true,
    );

    const result = safeParseAIJson<AnalysisResult>(generated.text, {
      ocr_text: 'string',
      detected_language: 'string',
      translated_text: 'string',
      classified_type: 'string',
      key_entities: 'array',
      analysis: 'string',
      food_info: 'any',
      ocr_boxes: 'array',
    });

    if (!result.translated_text && !result.analysis) {
      result.translated_text = generated.text.trim();
      result.analysis = "The provider returned an unstructured result.";
    }

    const sourceText = String(result.ocr_text || result.food_info?.name || result.analysis || "Image analysis").trim();
    const translatedText = String(result.translated_text || result.food_info?.translated_name || result.analysis || "").trim();
    const { data: item, error: itemError } = await supabase
      .from("translation_items")
      .insert({
        session_id: sessionId,
        user_id: userId,
        speaker_id: "camera",
        sequence_number: 1,
        source_text: sourceText,
        translated_text: translatedText || null,
        detected_language: result.detected_language || "unknown",
        source_language: result.detected_language || "auto",
        target_language: target,
        alternatives: result.key_entities || [],
        context_notes: result.analysis || null,
      })
      .select("id")
      .single();
    if (itemError) throw new Error(`Failed to save camera translation: ${itemError.message}`);

    await supabase.from("translation_sessions").update({
      title: sourceText.slice(0, 80),
      source_language: result.detected_language || "auto",
      metadata: { 
        mode, 
        provider: "google", 
        model: generated.model, 
        classified_type: result.classified_type,
        food_info: result.food_info || null,
        ocr_boxes: result.ocr_boxes || []
      },
    }).eq("id", sessionId).eq("user_id", userId);

    await logUsageEvent(userId, "image_analysis", 1, "image", {
      session_id: sessionId,
      target_language: target,
      mode,
      model: generated.model,
    });

    const { data: signedImage } = await supabase.storage.from(MEDIA_BUCKET).createSignedUrl(imagePath, 86_400);
    return formatResponse({
      ...result,
      session_id: sessionId,
      translation_item_id: item?.id || null,
      image_url: signedImage?.signedUrl || null,
      media_asset_id: mediaAsset?.id || null,
      analysis_model: generated.model,
    });
  } catch (error) {
    return formatError(error);
  }
});
