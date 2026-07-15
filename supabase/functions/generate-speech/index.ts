import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.0";
import { 
  handleCors, 
  verifyUser, 
  parseJsonBody, 
  formatError, 
  formatResponse, 
  checkRateLimit, 
  logUsageEvent,
  corsHeaders,
  getSecret
} from "../shared/index.ts";

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const userId = await verifyUser(req);
    checkRateLimit(userId);

    const { text, voiceId, saveToStorage, sessionId } = await parseJsonBody<{
      text: string;
      voiceId?: string;
      saveToStorage?: boolean;
      sessionId?: string;
    }>(req);

    if (!text || !text.trim()) {
      return formatError("Missing parameter: text is required");
    }

    const elevenLabsApiKey = await getSecret('ELEVENLABS_API_KEY');
    const elevenLabsApiBaseUrl = await getSecret('ELEVENLABS_API_BASE_URL').catch(() => 'https://api.elevenlabs.io');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // Default to user's cloned voice if available and requested voice is default
    let targetVoiceId = voiceId || "21m00Tcm4TlvDq8ikWAM";
    if (targetVoiceId === "21m00Tcm4TlvDq8ikWAM") {
      const { data: customVoice } = await supabase
        .from("voice_profiles")
        .select("provider_voice_id")
        .eq("user_id", userId)
        .eq("status", "ready")
        .limit(1)
        .maybeSingle();
      if (customVoice?.provider_voice_id) {
        console.log(`Auto-defaulting to user's cloned voice: ${customVoice.provider_voice_id}`);
        targetVoiceId = customVoice.provider_voice_id;
      }
    }
    const url = `${elevenLabsApiBaseUrl}/v1/text-to-speech/${targetVoiceId}`;

    console.log(`Generating speech for text length ${text.length} using voice ${targetVoiceId}...`);
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": elevenLabsApiKey
      },
      body: JSON.stringify({
        text: text,
        model_id: "eleven_v3",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ElevenLabs TTS API returned status ${response.status}: ${errorText}`);
    }

    const audioBuffer = await response.arrayBuffer();
    const audioBlob = new Blob([audioBuffer], { type: "audio/mpeg" });

    // Log usage: quantity is character count
    await logUsageEvent(userId, 'tts', text.length, 'characters', {
      voice_id: targetVoiceId,
      model: 'eleven_v3',
      text_length: text.length,
      audio_size_bytes: audioBlob.size
    });

    if (saveToStorage) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
      const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
      const supabase = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false }
      });

      const fileUUID = crypto.randomUUID();
      const filePath = `voice_outputs/${userId}/${fileUUID}.mp3`;
      const bucketName = 'media'; // Private media assets bucket

      console.log(`Uploading voice output to storage bucket '${bucketName}' at path '${filePath}'...`);
      const { error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(filePath, audioBlob, {
          contentType: 'audio/mpeg',
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        throw new Error(`Failed to upload generated audio to storage: ${uploadError.message}`);
      }

      // Insert record into media_assets table
      const { data: mediaAsset, error: dbError } = await supabase
        .from('media_assets')
        .insert({
          user_id: userId,
          session_id: sessionId || null,
          media_kind: 'voice_output',
          bucket: bucketName,
          path: filePath,
          mime_type: 'audio/mpeg',
          size_bytes: audioBlob.size,
          retention_policy: 'session'
        })
        .select()
        .single();

      if (dbError) {
        console.error("Failed to insert media asset record:", dbError);
      }

      // Create a signed URL
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from(bucketName)
        .createSignedUrl(filePath, 86400); // 24 hours

      if (signedUrlError) {
        throw new Error(`Failed to create signed URL: ${signedUrlError.message}`);
      }

      return formatResponse({
        url: signedUrlData.signedUrl,
        filePath,
        mediaAssetId: mediaAsset?.id || null
      });
    }

    // Otherwise, return raw audio bytes
    return new Response(audioBuffer, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "audio/mpeg",
        "Content-Length": String(audioBuffer.byteLength)
      }
    });
  } catch (err) {
    return formatError(err);
  }
});
