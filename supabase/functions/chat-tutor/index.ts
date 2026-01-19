
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper for multi-part form data body (needed for Whisper API if we were doing raw fetch, but we might just use JSON with base64)
// OpenAI Whisper API supports file uploads. We'll constructs a FormData object.

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { messages, audio_base64, target_lang, user_level } = await req.json();
    const apiKey = Deno.env.get("OPENAI_API_KEY");

    if (!apiKey) {
      throw new Error("Missing OpenAI API Key");
    }

    let userMessage = messages[messages.length - 1]?.content || "";
    let wasAudio = false;

    // 1. Transcribe Audio if present
    if (audio_base64) {
      wasAudio = true;
      try {
        // Create a Blob from the Base64 string
        const binaryString = atob(audio_base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const file = new Blob([bytes], { type: 'audio/m4a' }); // or audio/wav depending on recording

        const formData = new FormData();
        formData.append("file", file, "input.m4a");
        formData.append("model", "whisper-1");
        // Force language if known, or let it detect. Better to let it detect or hint.
        if (target_lang && target_lang !== 'auto') {
          formData.append("language", target_lang);
        }

        const transcriptRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
          },
          body: formData,
        });

        const transcriptData = await transcriptRes.json();
        if (transcriptData.error) {
          console.error("Whisper Error:", transcriptData.error);
          throw new Error(`Whisper Error: ${transcriptData.error.message}`);
        }

        userMessage = transcriptData.text;

        // Update the last message content with the transcribed text so the history is correct
        messages[messages.length - 1].content = userMessage;

      } catch (err) {
        console.error("Transcription failed", err);
        return new Response(JSON.stringify({ error: "Transcription failed: " + err.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    // 2. Chat Completion
    const systemPrompt = `
You are a friendly, encouraging language tutor helping a user learn ${target_lang || "a foreign language"}.
The user's level is roughly ${user_level || "intermediate"}.

Your Goal:
1. Respond naturally to the user's message in ${target_lang || "the target language"}. Keep it conversational and brief (1-3 sentences).
2. Check the user's last message for SIGNIFICANT grammar or vocabulary mistakes.
   - If the mistake is minor or the message is understandable, ignore it to keep flow, UNLESS it's a recurring error.
   - If you correct them, be gentle.

Output Format:
Return ONLY a valid JSON object with this structure:
{
  "reply": "Your conversational response here...",
  "correction": {
     "original": "The user's text part that was wrong",
     "corrected": "The corrected version",
     "explanation": "Brief explanation of why"
  } | null
}

If no correction is needed, set "correction" to null.
Do not include markdown blocks like \`\`\`json. Just the raw JSON string.
    `;

    const requestMessages = [
      { role: "system", content: systemPrompt },
      ...messages
    ];

    const chatRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini", // Fast and cheap
        messages: requestMessages,
        temperature: 0.7,
        response_format: { type: "json_object" }
      }),
    });

    const chatData = await chatRes.json();
    const content = chatData.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content from OpenAI");
    }

    const parsedContent = JSON.parse(content);

    // If it was audio, we send back the transcription + the reply + correction
    const responseData = {
      ...parsedContent,
      user_transcript: wasAudio ? userMessage : null
    };

    return new Response(JSON.stringify(responseData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
