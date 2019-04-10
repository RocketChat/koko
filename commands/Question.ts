import { IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { SlashCommandContext } from '@rocket.chat/apps-engine/definition/slashcommands';
import { KokoApp } from '../KokoApp';

// tslint:disable-next-line:max-line-length
export async function processQuestionCommand(app: KokoApp, context: SlashCommandContext, read: IRead, modify: IModify, persistence: IPersistence): Promise<void> {
    const sender = context.getSender();

    // Repeats last question for the user
    await app.kokoQuestion.repeatQuestion(read, modify, persistence, sender);
}
