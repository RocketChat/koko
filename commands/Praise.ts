import { IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { RocketChatAssociationModel, RocketChatAssociationRecord } from '@rocket.chat/apps-engine/definition/metadata';
import { IRoom } from '@rocket.chat/apps-engine/definition/rooms';
import { SlashCommandContext } from '@rocket.chat/apps-engine/definition/slashcommands';
import { KokoApp } from '../KokoApp';
import { getDirect } from '../lib/helpers';
import { IListenStorage } from '../storage/IListenStorage';

// tslint:disable-next-line:max-line-length
export async function processPraiseCommand(app: KokoApp, context: SlashCommandContext, read: IRead, modify: IModify, persistence: IPersistence, params?: Array<string>): Promise<void> {
    const sender = context.getSender();
    const room = await getDirect(this.app, read, modify, sender.username) as IRoom;
    if (params && params.length > 0 && params[0].trim()) {
        // first param is username
        const username = params.shift() as string;
        // all other params compose the message
        let text = params.join(' ');

        const association = new RocketChatAssociationRecord(RocketChatAssociationModel.USER, sender.id);
        if (await app.kokoPraise.getUsernameFromText(read, username)) {
            // if given username is valid, add username to listening status and wait for text
            const data: IListenStorage = { listen: 'praise', username };
            await persistence.updateByAssociation(association, data, true);
            text = text.trim() ? text : username;
            await app.kokoPraise.answer(read, modify, persistence, sender, room, data, text);
        } else {
            // if username isn't valid, listen for valid username
            const data: IListenStorage = { listen: 'username' };
            await persistence.updateByAssociation(association, data, true);
            text = username;
            await app.kokoPraise.answer(read, modify, persistence, sender, room, data, text);
        }
    } else {
        // If command had no params, start a new praise with user choice
        app.kokoPraise.run(read, modify, persistence, sender);
    }
}
