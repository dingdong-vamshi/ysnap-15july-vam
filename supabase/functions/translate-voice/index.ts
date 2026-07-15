import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.0";
import {
  checkRateLimit,
  formatError,
  formatResponse,
  GEMINI_MODEL,
  generateTextResult,
  handleCors,
  logUsageEvent,
  verifyUser,
  getSecret,
  safeParseAIJson,
} from "../shared/index.ts";

const MAX_AUDIO_BYTES = 20 * 1024 * 1024;
const MEDIA_BUCKET = "media";

function audioExtension(file: File): string {
  if (file.type.includes("webm")) return "webm";
  if (file.type.includes("wav")) return "wav";
  if (file.type.includes("mp4") || file.type.includes("m4a")) return "m4a";
  if (file.type.includes("ogg")) return "ogg";
  return "mp3";
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const userId = await verifyUser(req);
    checkRateLimit(userId, 20, 60_000);

    const elevenLabsApiKey = await getSecret("ELEVENLABS_API_KEY");
    const elevenLabsApiBaseUrl = await getSecret("ELEVENLABS_API_BASE_URL").catch(() => "https://api.elevenlabs.io");

    if (!(req.headers.get("content-type") ?? "").includes("multipart/form-data")) {
      return formatError("Invalid Content-Type. Must be multipart/form-data");
    }

    const formData = await req.formData();
    const file = formData.get("file");
    const target = formData.get("target")?.toString().trim();
    const source = formData.get("source")?.toString().trim() || "auto";
    let voiceId = formData.get("voice_id")?.toString().trim() ||
      "21m00Tcm4TlvDq8ikWAM";
    const requestedSessionId = formData.get("session_id")?.toString().trim();
    const requestedSessionType = formData.get("session_type")?.toString();
    const sessionType = requestedSessionType === "conversation" ? "conversation" : "voice";
    const speakerId = formData.get("speaker_id")?.toString().trim() || "user";
    const requestedSequence = Number(formData.get("sequence_number")?.toString() || "0");

    if (!(file instanceof File)) return formatError("Missing parameter: 'file' is required");
    if (!target) return formatError("Missing parameter: 'target' language is required");
    if (file.size === 0) return formatError("The recorded audio file is empty");
    if (file.size > MAX_AUDIO_BYTES) {
      return formatError(`Audio file exceeds the ${MAX_AUDIO_BYTES / 1024 / 1024}MB limit`);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    // Default to the user's custom cloned voice if they have one and the request uses the default voice
    if (voiceId === "21m00Tcm4TlvDq8ikWAM") {
      const { data: customVoice } = await supabase
        .from("voice_profiles")
        .select("provider_voice_id")
        .eq("user_id", userId)
        .eq("status", "ready")
        .limit(1)
        .maybeSingle();
      if (customVoice?.provider_voice_id) {
        console.log(`Auto-defaulting to user's cloned voice: ${customVoice.provider_voice_id}`);
        voiceId = customVoice.provider_voice_id;
      } else {
        console.log("No cloned voice found. Dynamically cloning user's voice on-the-fly using input audio...");
        try {
          if (file.size > 50 * 1024) {
            const outboundFormData = new FormData();
            outboundFormData.append("name", `Auto Clone (${userId.slice(0, 5)})`);
            outboundFormData.append("description", "Dynamically cloned during voice translation");
            outboundFormData.append("files", file, "sample.mp3");
            outboundFormData.append("remove_background_noise", "true");

            const elevenLabsResponse = await fetch("https://api.elevenlabs.io/v1/voices/add", {
              method: "POST",
              headers: {
                "xi-api-key": apiKey
              },
              body: outboundFormData
            });

            if (elevenLabsResponse.ok) {
              const resData = await elevenLabsResponse.json();
              const providerVoiceId = resData.voice_id;
              console.log(`Successfully created dynamic voice clone: ${providerVoiceId}`);

              // Save in voice_profiles
              const { data: vp, error: vpError } = await supabase
                .from("voice_profiles")
                .insert({
                  user_id: userId,
                  provider: 'elevenlabs',
                  display_name: 'Dynamic Auto-Clone',
                  provider_voice_id: providerVoiceId,
                  status: 'ready',
                  is_cloned: true
                })
                .select()
                .single();

              if (!vpError && vp) {
                voiceId = providerVoiceId;
                // Update user preferences to default to this new voice ID
                await supabase
                  .from("user_preferences")
                  .update({ selected_voice_id: providerVoiceId })
                  .eq("user_id", userId);
              }
            } else {
              console.warn(`ElevenLabs dynamic voice cloning returned status ${elevenLabsResponse.status}: ${await elevenLabsResponse.text()}`);
            }
          }
        } catch (cloneErr) {
          console.error("Failed to dynamically clone voice on the fly:", cloneErr);
        }
      }
    }

    let sessionId = requestedSessionId || "";
    let createdSession = false;

    if (sessionId) {
      const { data: session, error } = await supabase
        .from("translation_sessions")
        .select("id,user_id")
        .eq("id", sessionId)
        .maybeSingle();
      if (error || !session || session.user_id !== userId) {
        return formatError("Translation session was not found for this user", 404);
      }
    } else {
      const { data: session, error } = await supabase
        .from("translation_sessions")
        .insert({
          user_id: userId,
          session_type: sessionType,
          source_language: source,
          target_language: target,
          title: sessionType === "conversation" ? "Voice conversation" : `Voice translation to ${target}`,
          status: sessionType === "conversation" ? "active" : "completed",
          metadata: {
            speech_provider: "elevenlabs",
            stt_model: "scribe_v2",
            tts_model: "eleven_v3",
            translation_provider: "google",
            translation_model: GEMINI_MODEL,
            voice_id: voiceId,
          },
        })
        .select("id")
        .single();
      if (error || !session) throw new Error(`Failed to create translation session: ${error?.message}`);
      sessionId = session.id;
      createdSession = true;
    }

    let sequenceNumber = Number.isFinite(requestedSequence) && requestedSequence > 0
      ? Math.floor(requestedSequence)
      : 0;
    if (!sequenceNumber) {
      const { data: lastItem } = await supabase
        .from("translation_items")
        .select("sequence_number")
        .eq("session_id", sessionId)
        .order("sequence_number", { ascending: false })
        .limit(1)
        .maybeSingle();
      sequenceNumber = (lastItem?.sequence_number || 0) + 1;
    }

    const extension = audioExtension(file);
    const inputAudioPath = `voice_inputs/${userId}/${crypto.randomUUID()}.${extension}`;
    const { error: inputUploadError } = await supabase.storage
      .from(MEDIA_BUCKET)
      .upload(inputAudioPath, file, {
        contentType: file.type || "audio/mpeg",
        cacheControl: "3600",
        upsert: false,
      });
    if (inputUploadError) throw new Error(`Failed to save source audio: ${inputUploadError.message}`);

    const sttFormData = new FormData();
    sttFormData.append("file", file, file.name || `input.${extension}`);
    sttFormData.append("model_id", "scribe_v2");
    sttFormData.append("tag_audio_events", "false");
    if (source !== "auto") sttFormData.append("language_code", source);

    const sttResponse = await fetch(`${elevenLabsApiBaseUrl}/v1/speech-to-text`, {
      method: "POST",
      headers: { "xi-api-key": elevenLabsApiKey },
      body: sttFormData,
    });
    if (!sttResponse.ok) {
      throw new Error(`ElevenLabs transcription failed (${sttResponse.status}): ${await sttResponse.text()}`);
    }

    const sttResult = await sttResponse.json();
    const sourceText = String(sttResult.text || "").trim();
    if (!sourceText) throw new Error("No speech was detected in the recording");
    const detectedLanguage = String(sttResult.language_code || source || "unknown");

    await logUsageEvent(userId, "transcription", file.size, "bytes", {
      session_id: sessionId,
      language_code: detectedLanguage,
      text_length: sourceText.length,
    });

    const systemInstruction = `You are a precise conversational translator. Return one valid JSON object with these keys: translated_text (string), detected_language (ISO language code), transliteration (string or null), alternatives (array of up to 3 strings), and context_notes (short string or null). Translate naturally into ${target}. Do not add markdown.`;
    const generatedTranslation = await generateTextResult(
      `Translate from ${source === "auto" ? detectedLanguage : source} to ${target}:\n\n${sourceText}`,
      systemInstruction,
      true,
    );
    const translatedRaw = generatedTranslation.text;

    const translation = safeParseAIJson<{
      translated_text: string;
      detected_language?: string;
      transliteration?: string | null;
      alternatives?: string[];
      context_notes?: string | null;
    }>(translatedRaw, {
      translated_text: 'string',
      detected_language: 'string',
      transliteration: 'string',
      alternatives: 'array',
      context_notes: 'string'
    });

    if (!translation.translated_text) {
      translation.translated_text = translatedRaw.trim();
    }
    const translatedText = String(translation.translated_text || "").trim();
    if (!translatedText) throw new Error("The translation provider returned an empty translation");

    await logUsageEvent(userId, "translation", sourceText.length, "characters", {
      session_id: sessionId,
      source_language: source,
      target_language: target,
      provider: "google",
      model: generatedTranslation.model,
    });

    const ttsResponse = await fetch(
      `${elevenLabsApiBaseUrl}/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "xi-api-key": elevenLabsApiKey },
        body: JSON.stringify({
          text: translatedText,
          model_id: "eleven_v3",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.8,
            use_speaker_boost: true,
          },
        }),
      },
    );
    if (!ttsResponse.ok) {
      throw new Error(`ElevenLabs speech generation failed (${ttsResponse.status}): ${await ttsResponse.text()}`);
    }

    const outputBuffer = await ttsResponse.arrayBuffer();
    const outputBlob = new Blob([outputBuffer], { type: "audio/mpeg" });
    const outputAudioPath = `voice_outputs/${userId}/${crypto.randomUUID()}.mp3`;
    const { error: outputUploadError } = await supabase.storage
      .from(MEDIA_BUCKET)
      .upload(outputAudioPath, outputBlob, {
        contentType: "audio/mpeg",
        cacheControl: "3600",
        upsert: false,
      });
    if (outputUploadError) throw new Error(`Failed to save translated audio: ${outputUploadError.message}`);

    const { error: mediaError } = await supabase.from("media_assets").insert([
      {
        user_id: userId,
        session_id: sessionId,
        media_kind: "voice_input",
        bucket: MEDIA_BUCKET,
        path: inputAudioPath,
        mime_type: file.type || "audio/mpeg",
        size_bytes: file.size,
        retention_policy: "session",
      },
      {
        user_id: userId,
        session_id: sessionId,
        media_kind: "voice_output",
        bucket: MEDIA_BUCKET,
        path: outputAudioPath,
        mime_type: "audio/mpeg",
        size_bytes: outputBlob.size,
        retention_policy: "session",
      },
    ]);
    if (mediaError) throw new Error(`Failed to save media records: ${mediaError.message}`);

    const { data: translationItem, error: itemError } = await supabase
      .from("translation_items")
      .insert({
        session_id: sessionId,
        user_id: userId,
        speaker_id: speakerId,
        sequence_number: sequenceNumber,
        source_text: sourceText,
        translated_text: translatedText,
        transliteration: translation.transliteration || null,
        detected_language: translation.detected_language || detectedLanguage,
        source_language: source === "auto" ? detectedLanguage : source,
        target_language: target,
        alternatives: translation.alternatives || [],
        context_notes: translation.context_notes || null,
        source_audio_path: inputAudioPath,
        generated_audio_path: outputAudioPath,
      })
      .select("id")
      .single();
    if (itemError || !translationItem) {
      throw new Error(`Failed to save the translated turn: ${itemError?.message}`);
    }

    if (createdSession) {
      await supabase.from("translation_sessions").update({
        title: sourceText.slice(0, 80),
        source_language: source === "auto" ? detectedLanguage : source,
      }).eq("id", sessionId).eq("user_id", userId);
    }

    await logUsageEvent(userId, "tts", translatedText.length, "characters", {
      session_id: sessionId,
      voice_id: voiceId,
      provider: "elevenlabs",
      model: "eleven_v3",
      output_size_bytes: outputBlob.size,
    });

    const [{ data: sourceUrl }, { data: outputUrl }] = await Promise.all([
      supabase.storage.from(MEDIA_BUCKET).createSignedUrl(inputAudioPath, 86_400),
      supabase.storage.from(MEDIA_BUCKET).createSignedUrl(outputAudioPath, 86_400),
    ]);

    return formatResponse({
      session_id: sessionId,
      translation_item_id: translationItem.id,
      source_text: sourceText,
      translated_text: translatedText,
      transliteration: translation.transliteration || null,
      detected_language: translation.detected_language || detectedLanguage,
      alternatives: translation.alternatives || [],
      context_notes: translation.context_notes || null,
      translation_model: generatedTranslation.model,
      source_audio_url: sourceUrl?.signedUrl || null,
      generated_audio_url: outputUrl?.signedUrl || null,
    });
  } catch (error) {
    return formatError(error);
  }
});
