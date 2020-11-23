import { IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { SlashCommandContext } from '@rocket.chat/apps-engine/definition/slashcommands';
import { KokoApp } from '../KokoApp';

// tslint:disable-next-line:max-line-length
export async function proccessRemoveRoomsCommand(app: KokoApp, context: SlashCommandContext, read: IRead, modify: IModify): Promise<void> {
    
    app.kokoSuggestRooms.removeRoomPrompt({ triggerId: context.getTriggerId() as string }, context.getSender(), read, modify, context.getRoom());

}
