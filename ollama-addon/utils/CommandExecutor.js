import { follow, goto, stopGoals, center } from '../../../src/bot/utils/Movement.js';
import TeleportTask from '../../../src/bot/utils/TeleportTask.js';
import { Vec3 } from 'vec3';

/**
 * @param {Object} i        - Bot wrapper (i.bot = mineflayer, i.fly, i.followTarget)
 * @param {string} requesterUsername
 * @param {string} cmd
 * @param {string|null} arg
 * @param {Function} whisperFn
 */
export async function executeCommand(i, requesterUsername, cmd, arg, whisperFn) {
    try {
        switch (cmd) {

            case 'follow': {
                const targetName = arg || requesterUsername;
                const target = i.bot.players[targetName];
                if (!target) {
                    whisperFn(`Can't find player: ${targetName}`);
                    return;
                }
                // Fly-based follow — same as !follow fly in the bot
                i.fly = true;
                i.followTarget.target = target;
                break;
            }

            case 'stop':
            case 'stopfollow': {
                i.followTarget.target = undefined;
                stopGoals(i);
                break;
            }

            case 'goto': {
                if (!arg) { whisperFn('No coords given!'); return; }

                // Accept "x y z" or "x,y,z"
                const parts = arg.split(/[\s,]+/).map(Number);
                if (parts.length < 3 || parts.some(isNaN)) {
                    whisperFn(`Bad coords: ${arg}`);
                    return;
                }
                const [x, y, z] = parts;
                const goal = new Vec3(x, y, z);

                // Stop current movement first
                i.followTarget.target = undefined;
                stopGoals(i);

                // Fly-teleport to coords (TeleportTask supports up to ~200 blocks per call)
                i.fly = true;
                const task = new TeleportTask(i, true, true);
                const success = await task.fastTeleport(goal);
                if (!success) {
                    // Fallback: pathfinder walk (if too far or blocked)
                    goto(i, goal);
                }
                break;
            }

            case 'fly': {
                i.fly = !i.fly;
                whisperFn(`Fly: ${i.fly ? 'ON' : 'OFF'}`);
                break;
            }

            case 'attack': {
                if (!arg) { whisperFn('Who should I attack?'); return; }
                const target = i.bot.players[arg];
                if (!target?.entity) { whisperFn(`Can't find: ${arg}`); return; }
                i.bot.attack(target.entity);
                break;
            }

            case 'equip': {
                if (!arg) return;
                const item = i.bot.inventory.items().find(it =>
                    it.name.toLowerCase().includes(arg.toLowerCase())
                );
                if (!item) { whisperFn(`Item not found: ${arg}`); return; }
                await i.bot.equip(item, 'hand');
                break;
            }

            case 'drop': {
                if (!arg) return;
                const item = i.bot.inventory.items().find(it =>
                    it.name.toLowerCase().includes(arg.toLowerCase())
                );
                if (!item) { whisperFn(`Item not found: ${arg}`); return; }
                await i.bot.tossStack(item);
                break;
            }

            case 'center': {
                center(i);
                break;
            }

            default:
                i.logger.warn(`[OllamaAddon] Unknown AI command: ${cmd}`);
                break;
        }
    } catch (err) {
        i.logger.error(`[OllamaAddon] Command error (${cmd}): ${err.message}`);
    }
}
