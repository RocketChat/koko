import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { IMessage, MessageActionButtonsAlignment, MessageActionType } from '@rocket.chat/apps-engine/definition/messages';
import { RocketChatAssociationModel, RocketChatAssociationRecord } from '@rocket.chat/apps-engine/definition/metadata';
import { IRoom, RoomType } from '@rocket.chat/apps-engine/definition/rooms';
import { IUser } from '@rocket.chat/apps-engine/definition/users';
import { KokoApp } from '../KokoApp';
import { IPraiseStorage } from '../storage/IPraiseStorage';
import { IScoreStorage } from '../storage/IScoreStorage';
import { random } from '../utils';

export class KokoPraise {
    private membersCache;

    constructor(private readonly app: KokoApp) { }

    /**
     * Sends a new praise request to all members of selected room
     *
     * @param read
     * @param modify
     * @param http
     * @param persistence
     */
    public async run(read: IRead, modify: IModify, http: IHttp, persistence: IPersistence) {
        // Gets room members
        const members = await this.getMembers(read);

        // Build a list of usernames to add to message attachment
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

        // Randomize praise request message
        const praiseQuestions = [
            'Hello :vulcan: would you like to praise someone today?',
            'I\'m sure someone did something good recently. Who deserves your thanks?',
            ':rc: praise time :tada: Who deserves your :clapping: this week?',
            'How about giving praise to someone today?',
        ];

        // Sends a random message to each member
        members.forEach(async (member) => {
            // Gets or creates a direct message room between botUser and member
            const room = await this.getDirect(read, modify, member.username) as IRoom;

            // Saves new association record for listening for the username
            const assoc = new RocketChatAssociationRecord(RocketChatAssociationModel.USER, member.id);
            persistence.updateByAssociation(assoc, { listen: 'username' }, true);

            const builder = modify.getCreator().startMessage()
                .setSender(this.app.botUser)
                .setRoom(room)
                .setText(praiseQuestions[random(0, praiseQuestions.length - 1)])
                .setUsernameAlias(this.app.kokoName)
                .setEmojiAvatar(this.app.kokoEmojiAvatar)
                .addAttachment({
                    actionButtonsAlignment: MessageActionButtonsAlignment.HORIZONTAL,
                    actions: users,
                });
            try {
                await modify.getCreator().finish(builder);
            } catch (error) {
                console.log(error);
            }
        });
        return;
    }

    /**
     * When listening for username, checks if message is a username belonging to members list
     * When listening for praise, checks if message is a username and if not, saves the praise
     * If message is a username, re-selects based on new username
     *
     * @param data the persistence data, indicating what we're listening to
     * @param message the message to get username or praise from
     * @param read
     * @param persistence
     * @param modify
     */
    public async listen(data: IPraiseStorage, message: IMessage, read: IRead, persistence: IPersistence, modify: IModify) {
        // Where to save new data
        const association = new RocketChatAssociationRecord(RocketChatAssociationModel.USER, message.sender.id);

        /**
         * When listening to username, checks if message is a username belonging to the members list
         * If not, sends a message to the user saying we didn't find a username by that message
         */
        if (data.listen === 'username') {
            const username = await this.getUsernameFromMessage(message, read);
            if (username) {
                this.selectUsername(username, association, message, read, persistence);
            } else {
                const msg = read.getNotifier().getMessageBuilder()
                    .setText(`I haven't found the username: *${message.text}*`)
                    .setUsernameAlias(this.app.kokoName)
                    .setEmojiAvatar(this.app.kokoEmojiAvatar)
                    .setRoom(message.room)
                    .setSender(this.app.botUser)
                    .getMessage();
                await read.getNotifier().notifyUser(message.sender, msg);
            }
        } else if (data.listen === 'praise') {
            /**
             * When listening to praise, first check if message is a username belonging to members list
             * If it is, select new username
             */
            const username = await this.getUsernameFromMessage(message, read);
            if (username) {
                this.selectUsername(username, association, message, read, persistence);
            } else {
                /**
                 * If praising one-self, no score is added
                 * If praising someone else, this person gets 1 score point
                 */
                if (data.username !== message.sender.username) {
                    const scoreAssociation = new RocketChatAssociationRecord(RocketChatAssociationModel.MISC, `score:${data.username}`);
                    let scoreStorage: IScoreStorage;
                    const scoreWait = await read.getPersistenceReader().readByAssociation(scoreAssociation);
                    if (scoreWait && scoreWait.length > 0 && scoreWait[0]) {
                        scoreStorage = scoreWait[0] as IScoreStorage;
                        const score = scoreStorage.score || 0;
                        scoreStorage = { score: score + 1 };
                    } else {
                        scoreStorage = { score: 1 } as IScoreStorage;
                    }
                    persistence.updateByAssociation(scoreAssociation, scoreStorage, true);
                }

                // Removes listening record from persistence storage
                persistence.removeByAssociation(association);

                // Sends the praise
                await this.sendPraise(data.username as string, message.text as string, message.sender, read, modify);

                // Notifies user that a praise has been sent
                const msg = read.getNotifier().getMessageBuilder()
                    .setText(`Your praise has been registered`)
                    .setUsernameAlias(this.app.kokoName)
                    .setEmojiAvatar(this.app.kokoEmojiAvatar)
                    .setRoom(message.room)
                    .setSender(this.app.botUser)
                    .getMessage();
                await read.getNotifier().notifyUser(message.sender, msg);
            }
        }
    }

    /**
     * Saves the selected username in persistence storage and asks for a praise reason
     * @param username selected username
     * @param association where to save the username
     * @param message original message to get sender from
     * @param read IRead
     * @param persistence IPersistence
     */
    private async selectUsername(username: string, association: RocketChatAssociationRecord, message: IMessage, read: IRead, persistence: IPersistence) {
        // Updates persistence storage with listening for a praise and selected username
        persistence.updateByAssociation(association, { listen: 'praise', username }, true);

        // Checks if it's a self praise
        let txt;
        if (message.sender && message.sender.username === username) {
            txt = 'What did you do so well that deserves your own thanks?';
        } else {
            txt = `What would you like to praise @${username} for?`;
        }

        // Asks for a praise reason
        const msg = read.getNotifier().getMessageBuilder()
            .setText(txt)
            .setUsernameAlias(this.app.kokoName)
            .setEmojiAvatar(this.app.kokoEmojiAvatar)
            .setRoom(message.room)
            .setSender(this.app.botUser)
            .getMessage();
        await read.getNotifier().notifyUser(message.sender, msg);
    }

    /**
     * Checks if the message is a username contained on the room members
     *
     * @param message The message being analyzed
     * @param read IRead
     */
    private async getUsernameFromMessage(message: IMessage, read: IRead) {
        // strips the @ from the message to check against room members usernames
        const username = message.text ? message.text.replace(/^@/, '') : false;

        if (username) {
            // Loads members for checking
            const members = await this.getMembers(read);
            // Returns as soon as one is found
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
     *
     * @param context
     * @param read
     * @param modify
     * @param username
     * @returns the room
     */
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
     * Uses simple caching (30s) for avoiding repeated database queries
     *
     * @param context
     * @param read
     * @param modify
     * @param http
     * @param persis
     * @returns array of users
     */
    private async getMembers(read: IRead): Promise<Array<IUser>> {
        if (this.membersCache && this.membersCache.expire > new Date()) {
            return this.membersCache.members;
        }
        let members;
        try {
            members = await read.getRoomReader().getMembers(this.app.kokoMembersRoomId);
        } catch (error) {
            console.log(error);
        }
        this.membersCache = { members, expire: Date.now() + 30000};
        return members;
    }

    /**
     * Sends a praise message to the room specified by kokoPostRoomId
     *
     * @param username the username being praised
     * @param text the motive for praising
     * @param sender the user sending a praise
     * @param read IRead
     * @param modify IModify
     */
    private async sendPraise(username: string, text: string, sender: IUser, read: IRead, modify: IModify) {
        let msg;
        if (sender.username === username) {
            msg = `@${sender.username} praises him- or herself for "${text}"`;
        } else {
            const praiseMessages = [
                '@sender says thanks to @username for "{text}"',
                '@sender gives @username kudos for "{text}"',
                '@sender thinks @username did a good job on "{text}"',
            ];
            msg = praiseMessages[random(0, praiseMessages.length - 1)];
            msg = msg.replace('@sender', '@' + sender.username).replace('@username', '@' + username).replace('{text}', text);
        }
        const postRoom = await read.getRoomReader().getById(this.app.kokoPostRoomId) as IRoom;
        const message = modify.getCreator().startMessage()
            .setText(msg)
            .setRoom(postRoom)
            .setSender(this.app.botUser)
            .setEmojiAvatar(this.app.kokoEmojiAvatar)
            .setUsernameAlias(this.app.kokoName);
        const msgId = await modify.getCreator().finish(message);
    }
}
