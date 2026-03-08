import BrewBotAddon from '../../src/addon/BrewBotAddon.js';
import initOllamaEvents from './events/Events.js';

export default class OllamaAddon extends BrewBotAddon {
    constructor() {
        super();
        this.name = 'OllamaAddon';
    }

    // Called first by autoRegisterAddons with bot=null,
    // then registerAllEvents sets this.bot and calls registerEvents()
    initialize(logger, bot = null) {
        super.initialize(logger, bot);
    }

    registerEvents() {
        // this.bot = Bot wrapper (set by registerAllEvents)
        // inside Events.js: i = Bot wrapper, i.bot = mineflayer bot
        initOllamaEvents(this.bot);
    }
}
