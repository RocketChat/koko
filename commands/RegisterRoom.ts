import { IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { SlashCommandContext } from '@rocket.chat/apps-engine/definition/slashcommands';
import { KokoApp } from '../KokoApp';
import { notifyUser } from '../lib/helpers';
import { ISuggestedRoomsStorage, SuggestedRoomsAssociationID,  } from '../storage/ISuggestedRoomStorage';

// tslint:disable-next-line:max-line-length
export async function proccessRegisterSuggestedRoomCommand(app: KokoApp, context: SlashCommandContext, read: IRead, modify: IModify, persistence: IPersistence, params?: Array<string>): Promise<void> {
    const [name, inviteLink] = params as string[];

    if (!name || !inviteLink) {
        const message = 'Params `name` and `inviteLink` are required. Type `/koko help` for a command list.'
        return notifyUser(app, modify, context.getRoom(), context.getSender(), message);
    }

    const currentRoomsPersistence = await app.kokoSuggestRooms.getRooms(read);

    const suggestedRoom = { name, inviteLink };

    let suggested: ISuggestedRoomsStorage;
    if (!!currentRoomsPersistence[0]) {
        const currentSuggestedRooms = currentRoomsPersistence[0] as ISuggestedRoomsStorage;

        // Check if room already exists
        if (currentSuggestedRooms.rooms.some(({ name: roomName }) => roomName.toLocaleLowerCase() === name.toLocaleLowerCase())) {
            const message = 'A room with that name is already registered.';
            return notifyUser(app, modify, context.getRoom(), context.getSender(), message);
        }

        suggested = { rooms: [...currentSuggestedRooms.rooms, suggestedRoom] };
    } else {
        suggested = { rooms: [suggestedRoom] };
    }

    const result = await app.kokoSuggestRooms.setRooms(persistence, suggested);
    if (result) {
        return notifyUser(app, modify, context.getRoom(), context.getSender(), `Room \`${name}\` with invite link \`${inviteLink}\` registered!`);
    }
    return notifyUser(app, modify, context.getRoom(), context.getSender(), 'An error happened while registering the room.');
}
