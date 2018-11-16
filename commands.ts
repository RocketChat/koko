import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { MessageActionButtonsAlignment, MessageActionType } from '@rocket.chat/apps-engine/definition/messages';
import { RocketChatAssociationModel, RocketChatAssociationRecord } from '@rocket.chat/apps-engine/definition/metadata';
import { IRoom, RoomType } from '@rocket.chat/apps-engine/definition/rooms';
import { ISlashCommand, SlashCommandContext } from '@rocket.chat/apps-engine/definition/slashcommands';
import { IUser } from '@rocket.chat/apps-engine/definition/users';
import { KokoApp } from './KokoApp';

export class KokoCommand implements ISlashCommand {
    public command = 'koko';
    public i18nParamsExample = 'params_example';
    public i18nDescription = 'cmd_description';
    public providesPreview = false;

    constructor(private readonly app: KokoApp) { }

    public async executor(context: SlashCommandContext, read: IRead, modify: IModify, http: IHttp, persis: IPersistence): Promise<void> {
        this.app.botUser = await read.getUserReader().getByUsername('rocket.cat');
        const members = await this.getMembers(context, read, modify);

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
            const room = await this.getDirect(context, read, modify, member.username) as IRoom;
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
            persis.updateByAssociation(assoc, { listen: true }, true);
            try {
                await modify.getCreator().finish(builder);
            } catch (error) {
                builder.setText('An error occured while sending praise request to members');
                modify.getNotifier().notifyUser(context.getSender(), builder.getMessage());
            }
        });
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
    private async getDirect(context: SlashCommandContext, read: IRead, modify: IModify, username: string): Promise<IRoom | undefined> {
        const usernames = ['rocket.cat', username];
        let room;
        try {
            room = await read.getRoomReader().getDirectByUsernames(usernames);
        } catch (error) {
            await this.notifyError(context, modify, error);
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
    private async getMembers(context: SlashCommandContext, read: IRead, modify: IModify): Promise<Array<IUser>> {
        let members;
        try {
            members = await read.getRoomReader().getMembers(this.app.kokoRoomId);
        } catch (error) {
            await this.notifyError(context, modify, error);
        }
        return members;
    }

    /**
     * Notifies user who triggered the action of an error
     * @param context
     * @param modify
     * @param error the thrown error
     */
    private async notifyError(context: SlashCommandContext, modify: IModify, error: Error) {
        const builder = modify.getCreator().startMessage()
            .setUsernameAlias(this.app.kokoName)
            .setEmojiAvatar(this.app.kokoEmojiAvatar)
            .setText(`An error occured: ${error.message}`);

        modify.getNotifier().notifyUser(context.getSender(), builder.getMessage());
    }
}
