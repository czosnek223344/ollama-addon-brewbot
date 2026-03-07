import { OLLAMA_CONFIG } from '../config.js';

/**
 * Send a message to Ollama and get a response
 * @param {Array} history - [{role, content}]
 * @param {string} userMessage
 * @returns {Promise<string>}
 */
export async function askOllama(history, userMessage) {
    const messages = [
        { role: 'system', content: OLLAMA_CONFIG.systemPrompt },
        ...history,
        { role: 'user', content: userMessage }
    ];

    const response = await fetch(`${OLLAMA_CONFIG.host}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: OLLAMA_CONFIG.model,
            messages,
            stream: false,
            options: { temperature: 0.7 }
        })
    });

    if (!response.ok) {
        throw new Error(`Ollama error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    let text = data.message?.content || 'No response';

    // Strip <think>...</think> blocks — qwen3 outputs these before every reply
    text = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

    return text;
}

/**
 * Parse [CMD:name] or [CMD:name:arg] tags from AI response
 * Returns { cleanText, commands: [{cmd, arg}] }
 */
export function parseCommands(text) {
    const commands = [];
    const regex = /\[CMD:([a-zA-Z]+)(?::([^\]]*))?\]/g;
    let match;

    while ((match = regex.exec(text)) !== null) {
        commands.push({
            cmd: match[1].toLowerCase(),
            arg: match[2] ? match[2].trim() : null
        });
    }

    const cleanText = text.replace(/\[CMD:[^\]]*\]/g, '').trim();
    return { cleanText, commands };
}
