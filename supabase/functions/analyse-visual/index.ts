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

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const userId = await verifyUser(req);
    checkRateLimit(userId, 30, 60_000);

    if (!(req.headers.get("content-type") ?? "").includes("multipart/form-data")) {
      return formatError("Invalid Content-Type. Must be multipart/form-data");
    }

    const formData = await req.formData();
    const file = formData.get("file");
    const target = formData.get("target")?.toString().trim() || "en";
    const mode = formData.get("mode")?.toString().trim() || "ocr";

    if (!(file instanceof File)) return formatError("Missing parameter: 'file' is required");
    if (!file.type.startsWith("image/")) return formatError(`Unsupported image type: ${file.type}`);
    if (file.size === 0) return formatError("The selected image is empty");
    if (file.size > MAX_IMAGE_BYTES) return formatError("Image exceeds the 10MB limit");

    const systemInstruction = `You are a precise multimodal image-analysis assistant. Analyze the image and return a single valid JSON object matching the following structure exactly. Do not wrap it in markdown code blocks or add any trailing text. 

JSON Schema:
{
  "category": "text" | "document" | "menu" | "product" | "food" | "drink" | "landmark" | "monument" | "plant" | "animal" | "object" | "scene" | "person_present" | "unknown",
  "title": string,
  "summary": string,
  "confidence": number,
  "detectedLanguage": {
    "code": string,
    "name": string,
    "confidence": number
  },
  "detectedText": [
    {
      "text": string,
      "languageCode": string,
      "languageName": string,
      "translatedText": string,
      "boundingBox": { "x": number, "y": number, "width": number, "height": number }
    }
  ],
  "entities": [
    {
      "name": string,
      "category": string,
      "description": string,
      "confidence": number,
      "visibleText": string,
      "boundingBox": { "x": number, "y": number, "width": number, "height": number }
    }
  ],
  "product": {
    "name": string,
    "brand": string,
    "visibleClaims": string[],
    "packageText": string[]
  },
  "food": {
    "name": string,
    "visibleIngredients": string[],
    "packageClaims": string[],
    "visibleNutritionText": string[]
  },
  "landmark": {
    "name": string,
    "city": string,
    "country": string,
    "briefHistory": string,
    "confidence": number
  },
  "defaultTranslation": {
    "sourceLanguage": string,
    "targetLanguage": string,
    "sourceText": string,
    "translatedText": string
  },
  "suggestedActions": string[],
  "sources": [
    {
      "title": string,
      "url": string
    }
  ],
  "spokenSummary": string
}

Instructions:
1. "category": Pick the primary category of the image. If a person is present in the photo, set category to "person_present" and describe only visible non-sensitive scene details; do not identify real people or guess personal traits.
2. "defaultTranslation": Translate all visible text to English by default (or the target language "${target}").
3. Bounding boxes: Use integer coordinates from 0 to 1000. Only include boundingBox if you are confident and have exact coordinates. Do not invent coordinates.
4. "spokenSummary": A concise (1-3 sentences) natural-sounding explanation of the image analysis results, suitable for speech synthesis. Do not read raw JSON structure. Mention detected text, detected language, and English translation if relevant.
5. If a category is not present in the image (e.g. not food, not landmark), omit or leave its specific object field null. Do not fabricate or invent details.`;

    const generated = await generateMultimodalResult(
      new Uint8Array(await file.arrayBuffer()),
      file.type,
      `Analyze this image in ${mode} mode and translate it to ${target}.`,
      systemInstruction,
      true,
    );

    let parsed: any;
    try {
      const cleanText = generated.text.replace(/```json/g, "").replace(/```/g, "").trim();
      parsed = JSON.parse(cleanText);
    } catch {
      parsed = safeParseAIJson(generated.text, {
        category: "string",
        title: "string",
        summary: "string",
        spokenSummary: "string",
        suggestedActions: "array",
      });
    }

    await logUsageEvent(userId, "image_analysis", 1, "image", {
      target_language: target,
      mode,
      model: generated.model,
    });

    return formatResponse(parsed);
  } catch (error: any) {
    return formatError(error);
  }
});
