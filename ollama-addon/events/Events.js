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

export default function initOllamaEvents(i) {
    // Per-user conversation history — each allowed user gets their own context
    const histories = new Map();

    // Support both single string (legacy) and array
    const allowedUsers = Array.isArray(OLLAMA_CONFIG.allowedUsers)
        ? OLLAMA_CONFIG.allowedUsers
        : [OLLAMA_CONFIG.allowedUsers];

    const whisperBack = (username, message) => {
        const chunks = splitMessage(String(message));
        for (const chunk of chunks) {
            if (chunk.length > 0) {
                i.bot.chat(`/msg ${username} ${chunk}`);
            }
        }
    };

    i.bot.on('whisper', async (username, message) => {
        if (!allowedUsers.includes(username)) return;
        if (!message || message.trim().length === 0) return;
        if (message.trim().startsWith('!')) return;

        i.logger.info(`[OllamaAddon] ${username}: ${message}`);

        // Get or create this user's personal history
        if (!histories.has(username)) {
            histories.set(username, []);
        }
        const history = histories.get(username);

        try {
            const rawResponse = await askOllama(history, message);
            const { cleanText, commands } = parseCommands(rawResponse);

            history.push({ role: 'user', content: message });
            history.push({ role: 'assistant', content: cleanText || rawResponse });

            // Trim history to limit
            while (history.length > OLLAMA_CONFIG.maxHistory * 2) {
                history.splice(0, 2);
            }

            for (const { cmd, arg } of commands) {
                i.logger.info(`[OllamaAddon] Executing: ${cmd}${arg ? ':' + arg : ''}`);
                await executeCommand(i, username, cmd, arg, (msg) => whisperBack(username, msg));
            }

            if (cleanText.length > 0) {
                whisperBack(username, cleanText);
            }

        } catch (err) {
            i.logger.error(`[OllamaAddon] Error: ${err.message}`);

            if (err.message.includes('ECONNREFUSED') || err.message.includes('fetch')) {
                whisperBack(username, `Ollama not responding — is it running at ${OLLAMA_CONFIG.host}?`);
            } else {
                whisperBack(username, `Error: ${err.message.slice(0, 100)}`);
            }
        }
    });

    i.logger.info(`[OllamaAddon] Ready! Allowed users: ${allowedUsers.join(', ')}`);
}
