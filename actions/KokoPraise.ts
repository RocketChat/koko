import { IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { MessageActionButtonsAlignment, MessageActionType } from '@rocket.chat/apps-engine/definition/messages';
import { RocketChatAssociationModel, RocketChatAssociationRecord } from '@rocket.chat/apps-engine/definition/metadata';
import { IRoom } from '@rocket.chat/apps-engine/definition/rooms';
import { IUser } from '@rocket.chat/apps-engine/definition/users';
import { KokoApp } from '../KokoApp';
import { IListenStorage } from '../storage/IListenStorage';
import { random } from '../utils';

export class KokoPraise {
    constructor(private readonly app: KokoApp) { }

    /**
     * Sends a new praise request to all members of selected room
     *
     * @param read
     * @param modify
     * @param persistence
     * @param user (optional) sends praise request to single user
     */
    // tslint:disable-next-line:max-line-length
    public async run({ read, modify, persistence, user }: { read: IRead, modify: IModify, persistence: IPersistence, user?: IUser }) {
        // Gets room members
        let members = (await this.app.getMembers({ read }))
            .filter((member) => member.username !== 'rocket.cat' && member.username !== this.app.botUsername);

        if (members && this.app.botUser !== undefined && this.app.kokoMembersRoom !== undefined && this.app.kokoPostPraiseRoom !== undefined) {
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

            // Overrides members with a single user (slashcommand)
            if (user !== undefined) {
                members = [user];
            }

            // Sends a random message to each member
            for (const member of members) {
                // Gets or creates a direct message room between botUser and member
                const room = await this.app.getDirect({ read, modify, username: member.username }) as IRoom;

                // Saves new association record for listening for the username
                const assoc = new RocketChatAssociationRecord(RocketChatAssociationModel.USER, member.id);
                const listenStorage: IListenStorage = { listen: 'username' };
                await persistence.updateByAssociation(assoc, listenStorage, true);

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
            }
        }
        return;
    }

    /**
     * When listening for username, checks if message is a username belonging to members list
     * When listening for praise, checks if message is a username and if not, saves the praise
     * If message is a username, re-selects based on new username
     *
     * @param data the persistence data, indicating what we're listening to
     * @param text the message to get username or praise from
     * @param room the direct room
     * @param sender the user from direct room
     * @param read
     * @param persistence
     * @param modify
     */
    // tslint:disable-next-line:max-line-length
    public async answer({ data, text, room, sender, read, persistence, modify }: { data: IListenStorage, text: string, room: IRoom, sender: IUser, read: IRead, persistence: IPersistence, modify: IModify }) {
        // Where to save new data
        const association = new RocketChatAssociationRecord(RocketChatAssociationModel.USER, sender.id);

        /**
         * When listening to username, checks if message is a username belonging to the members list
         * If not, sends a message to the user saying we didn't find a username by that message
         */
        if (data.listen === 'username') {
            const username = await this.getUsernameFromText({ text, read });
            if (username) {
                this.selectUsername({ username, association, room, sender, modify, persistence });
            } else {
                const message = modify.getCreator().startMessage()
                    .setText(`I haven't found the username: *${text}*`)
                    .setRoom(room)
                    .setSender(this.app.botUser)
                    .setEmojiAvatar(this.app.kokoEmojiAvatar)
                    .setUsernameAlias(this.app.kokoName);
                await modify.getCreator().finish(message);
            }
        } else if (data.listen === 'praise') {
            /**
             * When listening to praise, first check if message is a username belonging to members list
             * If it is, select new username
             */
            const username = await this.getUsernameFromText({ text, read });
            if (username) {
                this.selectUsername({ username, association, room, sender, modify, persistence });
            } else {
                // Removes listening record from persistence storage
                await persistence.removeByAssociation(association);

                // Sends the praise
                await this.sendPraise({ username: data.username as string, text, sender, read, modify });

                // Notifies user that a praise has been sent
                const message = modify.getCreator().startMessage()
                    .setText(`Your praise has been registered`)
                    .setRoom(room)
                    .setSender(this.app.botUser)
                    .setEmojiAvatar(this.app.kokoEmojiAvatar)
                    .setUsernameAlias(this.app.kokoName);
                await modify.getCreator().finish(message);
            }
        }
    }

    /**
     * Checks if the text is a username contained on the room members
     *
     * @param message The text being analyzed
     * @param read IRead
     */
    public async getUsernameFromText({ text, read }: { text?: string, read: IRead }): Promise<string | false> {
        // strips the @ from the text to check against room members usernames
        const username = text ? text.replace(/^@/, '') : false;
        if (username) {
            // Loads members for checking
            const members = await this.app.getMembers({ read });

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
     * Saves the selected username in persistence storage and asks for a praise reason
     * @param username selected username
     * @param association where to save the username
     * @param message original message to get sender from
     * @param read IRead
     * @param persistence IPersistence
     */
    // tslint:disable-next-line:max-line-length
    private async selectUsername({ username, association, room, sender, modify, persistence }: { username: string, association: RocketChatAssociationRecord, room: IRoom, sender: IUser, modify: IModify, persistence: IPersistence }) {
        // Updates persistence storage with listening for a praise and selected username
        const listenStorage: IListenStorage = { listen: 'praise', username };
        await persistence.updateByAssociation(association, listenStorage, true);

        // Checks if it's a self praise
        let txt;
        if (sender && sender.username === username) {
            txt = 'What did you do so well that deserves your own thanks?';
        } else {
            txt = `What would you like to praise @${username} for?`;
        }

        // Asks for a praise reason
        const message = modify.getCreator().startMessage()
            .setText(txt)
            .setRoom(room)
            .setSender(this.app.botUser)
            .setEmojiAvatar(this.app.kokoEmojiAvatar)
            .setUsernameAlias(this.app.kokoName);
        await modify.getCreator().finish(message);
    }

    /**
     * Sends a praise message to kokoPostPraiseRoom
     *
     * @param username the username being praised
     * @param text the motive for praising
     * @param sender the user sending a praise
     * @param read IRead
     * @param modify IModify
     */
    private async sendPraise({ username, text, sender, read, modify }: { username: string, text: string, sender: IUser, read: IRead, modify: IModify }) {
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
        const message = modify.getCreator().startMessage()
            .setText(msg)
            .setRoom(this.app.kokoPostPraiseRoom)
            .setSender(this.app.botUser)
            .setEmojiAvatar(this.app.kokoEmojiAvatar)
            .setUsernameAlias(this.app.kokoName);
        const msgId = await modify.getCreator().finish(message);
    }
}
