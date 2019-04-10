import { IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { RocketChatAssociationModel, RocketChatAssociationRecord } from '@rocket.chat/apps-engine/definition/metadata';
import { IRoom } from '@rocket.chat/apps-engine/definition/rooms';
import { SlashCommandContext } from '@rocket.chat/apps-engine/definition/slashcommands';
import { KokoApp } from '../KokoApp';
import { getDirect, sendMessage } from '../lib/helpers';

// tslint:disable-next-line:max-line-length
export async function processCancelCommand(app: KokoApp, context: SlashCommandContext, read: IRead, modify: IModify, persistence: IPersistence): Promise<void> {
    const sender = context.getSender();
    const room = await getDirect(app, read, modify, sender.username) as IRoom;

    // Remove listening status for the user who sent cancel command
    const association = new RocketChatAssociationRecord(RocketChatAssociationModel.USER, sender.id);
    await persistence.removeByAssociation(association);

    // Sends message informing user his operations are cancelled
    await sendMessage(app, modify, room, 'You\'ve cancelled the last operation.');
}
