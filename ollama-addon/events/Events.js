import { OLLAMA_CONFIG } from '../config.js';
import { askOllama, parseCommands } from '../utils/OllamaUtils.js';
import { executeCommand } from '../utils/CommandExecutor.js';

function splitMessage(text, maxLen = 200) {
    if (text.length <= maxLen) return [text];

    const chunks = [];
    const lines = text.split('\n').filter(l => l.trim().length > 0);

    for (const line of lines) {
        if (line.length <= maxLen) {
            chunks.push(line.trim());
        } else {
            for (let j = 0; j < line.length; j += maxLen) {
                chunks.push(line.slice(j, j + maxLen).trim());
            }
        }
    }

    return chunks.filter(c => c.length > 0);
}

/**
 * @param {Object} i - Bot wrapper
 *   i.bot        = mineflayer bot
 *   i.logger     = Logger
 *   i.fly        = fly toggle (boolean)
 *   i.followTarget.target = fly-follow target
 */
export default function initOllamaEvents(i) {
    const conversationHistory = [];

    const whisperBack = (message) => {
        const chunks = splitMessage(String(message));
        for (const chunk of chunks) {
            if (chunk.length > 0) {
                // ONLY /msg — never public chat
                i.bot.chat(`/msg ${OLLAMA_CONFIG.allowedUser} ${chunk}`);
            }
        }
    };

    i.bot.on('whisper', async (username, message) => {
        // Only allowed user
        if (username !== OLLAMA_CONFIG.allowedUser) return;

        // Skip empty
        if (!message || message.trim().length === 0) return;

        // Skip !commands — bot's own handler deals with those
        if (message.trim().startsWith('!')) return;

        i.logger.info(`[OllamaAddon] ${username}: ${message}`);

        try {
            const rawResponse = await askOllama(conversationHistory, message);
            const { cleanText, commands } = parseCommands(rawResponse);

            conversationHistory.push({ role: 'user', content: message });
            conversationHistory.push({ role: 'assistant', content: rawResponse });

            // Keep history within limit
            while (conversationHistory.length > OLLAMA_CONFIG.maxHistory * 2) {
                conversationHistory.splice(0, 2);
            }

            // Execute any bot commands the AI embedded
            for (const { cmd, arg } of commands) {
                i.logger.info(`[OllamaAddon] Executing: ${cmd}${arg ? ':' + arg : ''}`);
                await executeCommand(i, username, cmd, arg, whisperBack);
            }

            if (cleanText.length > 0) {
                whisperBack(cleanText);
            }

        } catch (err) {
            i.logger.error(`[OllamaAddon] Error: ${err.message}`);

            if (err.message.includes('ECONNREFUSED') || err.message.includes('fetch')) {
                whisperBack(`Ollama not responding — is it running at ${OLLAMA_CONFIG.host}?`);
            } else {
                whisperBack(`Error: ${err.message.slice(0, 100)}`);
            }
        }
    });

    i.logger.info(`[OllamaAddon] Ready! Only ${OLLAMA_CONFIG.allowedUser} can talk to me.`);
}
