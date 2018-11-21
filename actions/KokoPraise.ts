import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { IMessage, MessageActionButtonsAlignment, MessageActionType } from '@rocket.chat/apps-engine/definition/messages';
import { RocketChatAssociationModel, RocketChatAssociationRecord } from '@rocket.chat/apps-engine/definition/metadata';
import { IRoom, RoomType } from '@rocket.chat/apps-engine/definition/rooms';
import { SlashCommandContext } from '@rocket.chat/apps-engine/definition/slashcommands';
import { IUser } from '@rocket.chat/apps-engine/definition/users';

import { KokoApp } from '../KokoApp';
import { IPraiseStorage } from '../storage/PraiseStorage';

export class KokoPraise {
    constructor(private readonly app: KokoApp) { }

    public async run(read: IRead, modify: IModify, http: IHttp, persistence: IPersistence) {
        const members = await this.getMembers(read);

        // build a list of usernames to add to message attachment
        const users = members
            .sort((a, b) => {
                return a.name.toUpperCase() < b.name.toUpperCase() ? -1 : 1;
            })
            .map((member) => {
                return {
                    text: member.name,
                    type: MessageActionType.BUTTON,
                    msg_in_chat_window: true,
                    msg: `@${member.username}`,
                };
            });

        members.forEach(async (member) => {
            const room = await this.getDirect(read, modify, member.username) as IRoom;
            const builder = modify.getCreator().startMessage()
                .setSender(this.app.botUser)
                .setRoom(room)
                .setText('How about giving praise to someone today?')
                .setUsernameAlias(this.app.kokoName)
                .setEmojiAvatar(this.app.kokoEmojiAvatar)
                .addAttachment({
                    actionButtonsAlignment: MessageActionButtonsAlignment.HORIZONTAL,
                    actions: users,
                });

            const assoc = new RocketChatAssociationRecord(RocketChatAssociationModel.USER, member.id);
            persistence.updateByAssociation(assoc, { listen: 'username' }, true);
            try {
                await modify.getCreator().finish(builder);
            } catch (error) {
                console.log(error);
            }
        });
        return;
    }

    public async listen(data: IPraiseStorage, message: IMessage, read: IRead, persistence: IPersistence, modify: IModify) {
        const association = new RocketChatAssociationRecord(RocketChatAssociationModel.USER, message.sender.id);
        if (data.listen === 'username') {
            const username = await this.getUsernameFromMessage(message, read);
            if (username) {
                this.selectUsername(username, association, message, read, persistence);
            } else {
                const msg = read.getNotifier().getMessageBuilder()
                    .setText(`I haven't found the username: ${message.text}`)
                    .setUsernameAlias(this.app.kokoName)
                    .setEmojiAvatar(this.app.kokoEmojiAvatar)
                    .setRoom(message.room)
                    .setSender(this.app.botUser)
                    .getMessage();
                await read.getNotifier().notifyUser(message.sender, msg);
            }
        } else if (data.listen === 'praise') {
            const username = await this.getUsernameFromMessage(message, read);
            if (username) {
                this.selectUsername(username, association, message, read, persistence);
            } else {
                persistence.updateByAssociation(association, { username: data.username, praise: message.text }, true);
                const msg = read.getNotifier().getMessageBuilder()
                    .setText(`Your praise has been registered`)
                    .setUsernameAlias(this.app.kokoName)
                    .setEmojiAvatar(this.app.kokoEmojiAvatar)
                    .setRoom(message.room)
                    .setSender(this.app.botUser)
                    .getMessage();
                await read.getNotifier().notifyUser(message.sender, msg);
                await this.sendPraise(data.username as string, message.text as string, message.sender, read, modify);
            }
        }
    }

    private async selectUsername(username: string, association: RocketChatAssociationRecord, message: IMessage, read: IRead, persistence: IPersistence) {
        persistence.updateByAssociation(association, { listen: 'praise', username }, true);
        const msg = read.getNotifier().getMessageBuilder()
            .setText(`I'd like to praise ${username} for...`)
            .setUsernameAlias(this.app.kokoName)
            .setEmojiAvatar(this.app.kokoEmojiAvatar)
            .setRoom(message.room)
            .setSender(this.app.botUser)
            .getMessage();
        await read.getNotifier().notifyUser(message.sender, msg);
    }

    private async getUsernameFromMessage(message: IMessage, read: IRead) {
        const username = message.text ? message.text.replace(/^@/, '') : false;
        const members = await read.getRoomReader().getMembers(this.app.kokoMembersRoomId);
        if (username) {
            if (Array.from(members).some((member: IUser) => {
                return member.username === username;
            })) {
                return username;
            }
        }
        return false;
    }
    /**
     * Gets a direct message room between rocket.cat and another user, creating if it doesn't exist
     * @param context
     * @param read
     * @param modify
     * @param username
     * @returns the room
     */
    // tslint:disable-next-line:max-line-length
    private async getDirect(read: IRead, modify: IModify, username: string): Promise<IRoom | undefined> {
        const usernames = ['rocket.cat', username];
        let room;
        try {
            room = await read.getRoomReader().getDirectByUsernames(usernames);
        } catch (error) {
            console.log(error);
        }

        if (room) {
            return room;
        } else {
            let roomId;
            const newRoom = modify.getCreator().startRoom()
                .setType(RoomType.DIRECT_MESSAGE)
                .setCreator(this.app.botUser)
                .setUsernames(usernames);
            roomId = await modify.getCreator().finish(newRoom);
            return await read.getRoomReader().getById(roomId);
        }
    }

    /**
     * Gets users of room defined by room id setting
     * @param context
     * @param read
     * @param modify
     * @param http
     * @param persis
     * @returns array of users
     */
    private async getMembers(read: IRead): Promise<Array<IUser>> {
        let members;
        try {
            members = await read.getRoomReader().getMembers(this.app.kokoMembersRoomId);
        } catch (error) {
            console.log(error);
        }
        return members;
    }

    private async sendPraise(username: string, text: string, sender: IUser, read: IRead, modify: IModify) {
        const postRoom = await read.getRoomReader().getById(this.app.kokoPostRoomId) as IRoom;
        const message = modify.getCreator().startMessage()
            .setText(`@${sender.username} says thanks to @${username} for ${text}`)
            .setRoom(postRoom)
            .setSender(this.app.botUser)
            .setEmojiAvatar(this.app.kokoEmojiAvatar)
            .setUsernameAlias(this.app.kokoName);
        const msgId = await modify.getCreator().finish(message);
    }
}
