import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// OpenAI TTS voices - all support multiple languages
// alloy, echo, fable, onyx, nova, shimmer
const DEFAULT_VOICE = 'nova'; // Natural, warm female voice

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { text, language, voice } = await req.json();

        if (!text || typeof text !== 'string') {
            return new Response(
                JSON.stringify({ error: 'Missing or invalid "text" parameter' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const apiKey = Deno.env.get("OPENAI_API_KEY");
        if (!apiKey) {
            console.error('OPENAI_API_KEY not found in environment');
            return new Response(
                JSON.stringify({ error: 'OpenAI API key not configured' }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Use provided voice or default
        const selectedVoice = voice || DEFAULT_VOICE;
        console.log('TTS request - voice:', selectedVoice, 'text length:', text.length);

        // Call OpenAI TTS API
        const response = await fetch('https://api.openai.com/v1/audio/speech', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'tts-1', // Use tts-1 for speed, tts-1-hd for quality
                input: text,
                voice: selectedVoice,
                response_format: 'mp3',
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('OpenAI TTS API error:', response.status, errorText);
            return new Response(
                JSON.stringify({
                    error: `OpenAI TTS API error: ${response.status}`,
                    details: errorText
                }),
                { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Stream the audio response
        const audioBuffer = await response.arrayBuffer();
        console.log('TTS success - audio size:', audioBuffer.byteLength, 'bytes');

        return new Response(audioBuffer, {
            headers: {
                ...corsHeaders,
                'Content-Type': 'audio/mpeg',
                'Content-Length': audioBuffer.byteLength.toString(),
            },
        });

    } catch (err) {
        console.error('TTS Error:', err);
        return new Response(
            JSON.stringify({ error: err.message || 'Unknown error' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
