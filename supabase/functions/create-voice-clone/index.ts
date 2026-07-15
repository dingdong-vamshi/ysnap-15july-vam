import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.0";
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

    const contentType = req.headers.get("content-type") ?? "";
    if (!contentType.includes("multipart/form-data")) {
      return formatError("Invalid Content-Type. Must be multipart/form-data");
    }

    const formData = await req.formData();
    const file = formData.get("file");
    const name = formData.get("name")?.toString();
    const description = formData.get("description")?.toString() || "Instant voice clone created via API";
    const accentInfo = formData.get("accent_info")?.toString() || "";
    const sampleDurationSeconds = Number(formData.get("sample_duration_seconds")?.toString() || "0");
    
    // Consent verification parameters
    const ownershipConfirmedStr = formData.get("ownership_confirmed")?.toString();
    const privacyAcknowledgedStr = formData.get("privacy_acknowledged")?.toString();
    const ownershipConfirmed = ownershipConfirmedStr === "true";
    const privacyAcknowledged = privacyAcknowledgedStr === "true";

    if (!file || !(file instanceof File)) {
      return formatError("Missing parameter: 'file' (audio sample) is required");
    }
    if (!name || !name.trim()) {
      return formatError("Missing parameter: 'name' is required");
    }
    if (!ownershipConfirmed || !privacyAcknowledged) {
      return formatError("Consent required: You must confirm ownership and acknowledge privacy to clone a voice.");
    }
    if (sampleDurationSeconds && (sampleDurationSeconds < 10 || sampleDurationSeconds > 180)) {
      return formatError("Voice samples must be between 10 seconds and 3 minutes.");
    }

    // Enforce audio sample size limits (15 MB limit)
    const MAX_SIZE = 15 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return formatError(`Sample audio file size exceeds limit of 15MB. Received size: ${(file.size / (1024 * 1024)).toFixed(2)}MB`);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    });

    // 1. Create a voice profile record in 'pending' status
    const { data: voiceProfile, error: profileError } = await supabase
      .from('voice_profiles')
      .insert({
        user_id: userId,
        provider: 'elevenlabs',
        display_name: name,
        accent_info: accentInfo || null,
        is_cloned: true,
        status: 'pending'
      })
      .select()
      .single();

    if (profileError || !voiceProfile) {
      throw new Error(`Failed to initialize voice profile in database: ${profileError?.message}`);
    }

    // 2. Insert consent record
    const { error: consentError } = await supabase
      .from('voice_consents')
      .insert({
        user_id: userId,
        voice_profile_id: voiceProfile.id,
        consent_version: '1.0',
        ownership_confirmed: ownershipConfirmed,
        privacy_acknowledged: privacyAcknowledged
      });

    if (consentError) {
      // Cleanup the profile if consent fails
      await supabase.from('voice_profiles').delete().eq('id', voiceProfile.id);
      throw new Error(`Failed to insert voice consent: ${consentError.message}`);
    }

    // 3. Forward sample file to ElevenLabs API to create clone
    const outboundFormData = new FormData();
    outboundFormData.append("name", name);
    outboundFormData.append("description", description);
    outboundFormData.append("files", file, file.name || "sample.mp3");
    outboundFormData.append("remove_background_noise", "false");
    if (accentInfo) {
      outboundFormData.append("labels", JSON.stringify({ accent: accentInfo }));
    }

    console.log(`Cloning voice "${name}" with ElevenLabs...`);
    const elevenLabsResponse = await fetch("https://api.elevenlabs.io/v1/voices/add", {
      method: "POST",
      headers: {
        "xi-api-key": elevenLabsApiKey
      },
      body: outboundFormData
    });

    if (!elevenLabsResponse.ok) {
      const errorText = await elevenLabsResponse.text();
      // Update DB to failed status
      await supabase
        .from('voice_profiles')
        .update({ status: 'failed' })
        .eq('id', voiceProfile.id);
      
      throw new Error(`ElevenLabs Voice Add failed with status ${elevenLabsResponse.status}: ${errorText}`);
    }

    const elevenLabsResult = await elevenLabsResponse.json();
    const providerVoiceId = elevenLabsResult.voice_id;
    console.log(`Successfully cloned voice. Provider Voice ID: ${providerVoiceId}`);

    // 4. Save sample file to Supabase Storage
    const sampleUUID = crypto.randomUUID();
    const extension = file.type.includes('webm')
      ? 'webm'
      : file.type.includes('wav')
      ? 'wav'
      : file.type.includes('mp4') || file.type.includes('m4a')
      ? 'm4a'
      : 'mp3';
    const samplePath = `voice_samples/${userId}/${sampleUUID}.${extension}`;
    const bucketName = 'media';

    console.log(`Saving voice sample to storage bucket '${bucketName}' at path '${samplePath}'...`);
    const { error: storageError } = await supabase.storage
      .from(bucketName)
      .upload(samplePath, file, {
        contentType: file.type || 'audio/mpeg',
        cacheControl: '3600',
        upsert: false
      });

    if (storageError) {
      console.error("Failed to upload voice sample file to storage:", storageError);
    } else {
      // Insert media asset for sample file
      await supabase.from('media_assets').insert({
        user_id: userId,
        media_kind: 'voice_sample',
        bucket: bucketName,
        path: samplePath,
        mime_type: file.type || 'audio/mpeg',
        size_bytes: file.size,
        retention_policy: 'permanent'
      });
    }

    // 5. Update voice profile status to 'ready' and save provider ID
    const { data: updatedProfile, error: updateError } = await supabase
      .from('voice_profiles')
      .update({
        provider_voice_id: providerVoiceId,
        status: 'ready'
      })
      .eq('id', voiceProfile.id)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Failed to update voice profile to ready status: ${updateError.message}`);
    }

    // Log Usage Event
    await logUsageEvent(userId, 'voice_clone', 1, 'clone', {
      voice_profile_id: voiceProfile.id,
      provider_voice_id: providerVoiceId,
      sample_duration_seconds: sampleDurationSeconds || null
    });

    return formatResponse({
      message: "Voice cloned successfully",
      voice_profile: updatedProfile
    });
  } catch (err) {
    return formatError(err);
  }
});
