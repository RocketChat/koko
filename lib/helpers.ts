import { IModify, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { IRoom, RoomType } from '@rocket.chat/apps-engine/definition/rooms';
import { IUser } from '@rocket.chat/apps-engine/definition/users';
import { KokoApp } from '../KokoApp';
import { MembersCache } from '../MembersCache';

/**
 * Gets a direct message room between bot and another user, creating if it doesn't exist
 *
 * @param app KokoApp
 * @param read
 * @param modify
 * @param username the username to create a direct with bot
 * @returns the room or undefined if botUser or botUsername is not set
 */
export async function getDirect({ app, read, modify, username }: { app: KokoApp, read: IRead, modify: IModify, username: string }): Promise <IRoom | undefined > {
    if (app.botUsername) {
        const usernames = [app.botUsername, username];
        let room;
        try {
            room = await read.getRoomReader().getDirectByUsernames(usernames);
        } catch (error) {
            app.getLogger().log(error);
            return;
        }

        if (room) {
            return room;
        } else if (app.botUser) {
            let roomId;

            // Create direct room between botUser and username
            const newRoom = modify.getCreator().startRoom()
                .setType(RoomType.DIRECT_MESSAGE)
                .setCreator(app.botUser)
                .setUsernames(usernames);
            roomId = await modify.getCreator().finish(newRoom);
            return await read.getRoomReader().getById(roomId);
        }
    }
    return;
}

/**
 * Gets users of room defined by room id setting
 * Uses simple caching for avoiding repeated database queries
 *
 * @param app
 * @param read
 * @returns array of users
 */
export async function getMembers({ app, read }: { app: KokoApp, read: IRead }): Promise<Array<IUser>> {
    // Gets cached members if expire date is still valid
    if (app.membersCache && app.membersCache.isValid()) {
        return app.membersCache.members;
    }
    let members;
    if (app.kokoMembersRoom) {
        try {
            members = await read.getRoomReader().getMembers(app.kokoMembersRoom.id);
        } catch (error) {
            console.log(error);
        }
        app.membersCache = new MembersCache(members);
    }
    return members || [];
}
