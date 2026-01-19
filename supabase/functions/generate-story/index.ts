import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const languageMap: { [key: string]: string } = {
    'en': 'English',
    'es': 'Spanish',
    'fr': 'French',
    'de': 'German',
    'it': 'Italian',
    'pt': 'Portuguese',
    'ru': 'Russian',
    'ja': 'Japanese',
    'ko': 'Korean',
    'zh': 'Chinese'
};

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { target_lang, cefr_level, topic } = await req.json();
        const apiKey = Deno.env.get("OPENAI_API_KEY");

        if (!apiKey) {
            throw new Error("Missing OpenAI API Key");
        }

        if (!target_lang || !cefr_level) {
            throw new Error("Missing required parameters: target_lang, cefr_level");
        }

        const targetLanguage = languageMap[target_lang] || target_lang;

        // Handle AI-picked topic
        const isAiPick = topic === '__AI_PICK__' || !topic;
        const topicInstruction = isAiPick
            ? 'Choose your own creative and interesting topic for the story. Be creative and varied - don\'t repeat common themes.'
            : `about: "${topic}"`;

        const systemPrompt = `You are a language learning content creator. Your task is to write engaging short stories for language learners at specific CEFR levels.

IMPORTANT:
- Write naturally and engagingly, like a real story.
- Match vocabulary and grammar complexity to the specified CEFR level.
- CEFR A1-A2: Simple sentences, basic vocabulary, present tense mostly.
- CEFR B1-B2: Compound sentences, varied vocabulary, multiple tenses.
- CEFR C1-C2: Complex structures, idiomatic expressions, nuanced vocabulary.

Always respond with ONLY a valid JSON object. No markdown, no code blocks.`;

        const userPrompt = `Write a short story in ${targetLanguage} at CEFR ${cefr_level} level ${topicInstruction}

Requirements:
- Story length: 3-5 paragraphs (appropriate for the level)
- Include a clear beginning, middle, and end
- Create 4 multiple choice comprehension questions about the story IN ${targetLanguage}
- Each question should have exactly 4 options with one correct answer
- Questions should test understanding, not just word matching

Return this exact JSON structure:
{
  "title": "Story title in ${targetLanguage}",
  "story": "The complete story text with proper paragraph breaks...",
  "questions": [
    {
      "question": "Comprehension question in ${targetLanguage}?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": "The correct option text exactly as it appears in options"
    }
  ]
}`;

        const chatRes = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt }
                ],
                temperature: 0.8,
                response_format: { type: "json_object" }
            }),
        });

        const chatData = await chatRes.json();

        if (chatData.error) {
            console.error("OpenAI Error:", chatData.error);
            throw new Error(`OpenAI Error: ${chatData.error.message}`);
        }

        const content = chatData.choices?.[0]?.message?.content;

        if (!content) {
            throw new Error("No content returned from OpenAI");
        }

        // Parse and validate the response
        const storyData = JSON.parse(content);

        if (!storyData.title || !storyData.story || !storyData.questions) {
            throw new Error("Invalid response structure from AI");
        }

        return new Response(JSON.stringify(storyData), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (err) {
        console.error("Generate Story Error:", err);
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
