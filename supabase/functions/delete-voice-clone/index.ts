import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.0";
import { 
  handleCors, 
  verifyUser, 
  parseJsonBody, 
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

    const { voiceProfileId } = await parseJsonBody<{
      voiceProfileId: string;
    }>(req);

    if (!voiceProfileId) {
      return formatError("Missing parameter: voiceProfileId is required");
    }

    const elevenLabsApiKey = await getSecret('ELEVENLABS_API_KEY');
    const elevenLabsApiBaseUrl = await getSecret('ELEVENLABS_API_BASE_URL').catch(() => 'https://api.elevenlabs.io');

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    });

    // 1. Get the voice profile from the database
    const { data: voiceProfile, error: getError } = await supabase
      .from('voice_profiles')
      .select('*')
      .eq('id', voiceProfileId)
      .eq('user_id', userId)
      .single();

    if (getError || !voiceProfile) {
      return formatError("Voice profile not found or access denied.");
    }

    const providerVoiceId = voiceProfile.provider_voice_id;
    if (providerVoiceId) {
      console.log(`Deleting voice from ElevenLabs with provider ID: ${providerVoiceId}...`);
      const elevenLabsResponse = await fetch(`${elevenLabsApiBaseUrl}/v1/voices/${providerVoiceId}`, {
        method: "DELETE",
        headers: {
          "xi-api-key": elevenLabsApiKey
        }
      });

      if (!elevenLabsResponse.ok) {
        const errorText = await elevenLabsResponse.text();
        // If ElevenLabs says voice not found (e.g. 404), we should still proceed with DB deletion to avoid orphan DB records.
        if (elevenLabsResponse.status !== 404) {
          throw new Error(`ElevenLabs voice deletion failed: ${errorText}`);
        }
        console.warn(`ElevenLabs voice not found (404), continuing database cleanup.`);
      } else {
        console.log(`Voice successfully deleted from ElevenLabs.`);
      }
    } else {
      console.warn("Voice profile has no provider_voice_id. Skipping ElevenLabs deletion.");
    }

    // 2. Perform soft-delete in database
    const { error: updateError } = await supabase
      .from('voice_profiles')
      .update({
        status: 'deleted',
        deleted_at: new Date().toISOString()
      })
      .eq('id', voiceProfileId);

    if (updateError) {
      throw new Error(`Failed to update voice profile record: ${updateError.message}`);
    }

    return formatResponse({
      message: "Voice profile successfully deleted"
    });
  } catch (err) {
    return formatError(err);
  }
});
