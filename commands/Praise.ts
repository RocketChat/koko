import { IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { SlashCommandContext } from '@rocket.chat/apps-engine/definition/slashcommands';
import { KokoApp } from '../KokoApp';

// tslint:disable-next-line:max-line-length
export async function processPraiseCommand(app: KokoApp, context: SlashCommandContext, read: IRead, modify: IModify, persistence: IPersistence, params?: Array<string>): Promise<void> {
    const sender = context.getSender();
    if (params && params.length > 0 && params[0].trim()) {
        const firstParam = params.shift() as string | boolean;

        // If first param is 'score', send scoreboard
        if (firstParam === 'score') {
            return await app.kokoPraise.sendKarmaScoreboard(read, modify, context.getRoom(), context.getSender());
        }
    }

    // If command had no params, start a new praise with user choice
    app.kokoPraise.run(read, modify, persistence, sender);
}
