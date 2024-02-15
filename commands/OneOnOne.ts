import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { RocketChatAssociationModel, RocketChatAssociationRecord } from '@rocket.chat/apps-engine/definition/metadata';
import { IRoom } from '@rocket.chat/apps-engine/definition/rooms';
import { SlashCommandContext } from '@rocket.chat/apps-engine/definition/slashcommands';
import { KokoApp } from '../KokoApp';
import { getDirect } from '../lib/helpers';
import { IListenStorage } from '../storage/IListenStorage';

// tslint:disable-next-line:max-line-length
export async function processOneOnOneCommand(app: KokoApp, context: SlashCommandContext, read: IRead, modify: IModify, persistence: IPersistence, http: IHttp, params?: Array<string>): Promise<void> {
    const sender = context.getSender();
    if (params && params.length > 0 && params[0].trim()) {
        const subcommand = params.shift() as string | boolean;
        if (subcommand === 'stats') {
            return await app.kokoOneOnOne.sendStats(app, read, modify, sender, context.getRoom());
        }
    }

    const room = await getDirect(app, read, modify, sender.username) as IRoom;

    // Saves association record for listening for one-on-one answer
    const assoc = new RocketChatAssociationRecord(RocketChatAssociationModel.USER, sender.id);
    const listen: IListenStorage = { listen: 'one-on-one' };
    persistence.updateByAssociation(assoc, listen, true);

    // Puts user on the waiting list or matches with whoever is waiting
    await app.kokoOneOnOne.answer(read, modify, persistence, sender, room, listen, 'Yes', http);
}
