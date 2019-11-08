import { IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { MessageActionButtonsAlignment, MessageActionType } from '@rocket.chat/apps-engine/definition/messages';
import { RocketChatAssociationModel, RocketChatAssociationRecord } from '@rocket.chat/apps-engine/definition/metadata';
import { IRoom } from '@rocket.chat/apps-engine/definition/rooms';
import { IUser } from '@rocket.chat/apps-engine/definition/users';
import { Buffer } from 'buffer';
import { KokoApp } from '../KokoApp';
import { getDirect, getMembers, notifyUser, random, sendMessage } from '../lib/helpers';
import { IKarmaStorage } from '../storage/IKarmaStorage';
import { IListenStorage } from '../storage/IListenStorage';

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
    public async run(read: IRead, modify: IModify, persistence: IPersistence, user?: IUser) {

        // Gets room members (removes rocket.cat and koko bot)
        let members = (await getMembers(this.app, read))
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
                        msg: `/koko praise @${member.username}`,
                    };
                });

            // Randomize praise request message
            const praiseQuestions = [
                'Hello :vulcan: would you like to praise someone today?',
                'I\'m sure someone did something good recently. Who deserves your thanks?',
                ':rc: praise time :tada: Who deserves your :clapping: this week?',
                'How about giving praise to someone today?',
            ];
            const text = praiseQuestions[random(0, praiseQuestions.length - 1)];

            // If slashcommand was used, overrides members with the sender
            // This way only this user will receive the praise request
            if (user !== undefined) {
                members = [user];
            }

            // Sends message to each member
            for (const member of members) {
                if (member.id === this.app.botUser.id) {
                    continue;
                }

                // Gets or creates a direct message room between botUser and member
                const room = await getDirect(this.app, read, modify, member.username) as IRoom;

                // Saves new association record for listening for the username
                const assoc = new RocketChatAssociationRecord(RocketChatAssociationModel.USER, member.id);
                const listenStorage: IListenStorage = { listen: 'username' };
                await persistence.updateByAssociation(assoc, listenStorage, true);

                const attachment = {
                    actionButtonsAlignment: MessageActionButtonsAlignment.HORIZONTAL,
                    actions: users,
                };

                await sendMessage(this.app, modify, room, text, [attachment]);
            }
        }
        return;
    }

    /**
     * Sends current scoreboard to the Koko Praise room
     *
     * @param read
     * @param modify
     */
    public async sendKarmaScoreboard(read: IRead, modify: IModify, room: IRoom, user?: IUser) {
        const karmaAssoc = new RocketChatAssociationRecord(RocketChatAssociationModel.MISC, 'karma');
        const karmaData = await read.getPersistenceReader().readByAssociation(karmaAssoc);
        if (karmaData && karmaData.length > 0 && karmaData[0]) {
            const karma = karmaData[0] as IKarmaStorage;
            const sortable = [] as any;
            for (const key in karma) {
                if (karma.hasOwnProperty(key)) {
                    sortable.push([key, karma[key]]);
                }
            }
            sortable.sort((a, b) => b[1] - a[1]);
            let output = '*Here is the current Karma Scoreboard*:\n';
            const emojis = [':first_place: ', ':second_place: ', ':third_place: '];
            let count = -1;
            let last;
            for (const key in sortable) {
                if (sortable.hasOwnProperty(key)) {
                    if (last !== sortable[key][1]) {
                        count++;
                    }
                    const username = Buffer.from(sortable[key][0], 'base64').toString('utf8') as string;
                    output += `${emojis[count] ? emojis[count] : ':reminder_ribbon: '}@${username}: ${sortable[key][1]}\n`;
                    last = sortable[key][1];
                }
            }
            if (user) {
                await notifyUser(this.app, modify, room, user, output);
            } else {
                await sendMessage(this.app, modify, room, output);
            }
        }
    }

    /**
     * When listening for username, checks if message is a username belonging to members list
     * When listening for praise, checks if message is a username and if not, saves the praise
     * If message is a username, re-selects based on new username
     *
     * @param read
     * @param modify
     * @param persistence
     * @param sender the user from direct room
     * @param room the direct room
     * @param data the persistence data, indicating what we're listening to
     * @param text the message to get username or praise from
     */
    // tslint:disable-next-line:max-line-length
    public async answer(read: IRead, modify: IModify, persistence: IPersistence, sender: IUser, room: IRoom, data: IListenStorage, text: string) {
        // Where to save new data
        const association = new RocketChatAssociationRecord(RocketChatAssociationModel.USER, sender.id);

        /**
         * When listening to username, checks if message is a username belonging to the members list
         * If not, sends a message to the user saying we didn't find a username by that message
         */
        if (data.listen === 'username') {
            const username = await this.getUsernameFromText(read, text);
            if (username) {
                this.selectUsername(modify, persistence, sender, room, association, username);
            } else {
                await sendMessage(this.app, modify, room, `I haven't found the username: *${text}*`);
            }
        } else if (data.listen === 'praise') {
            /**
             * When listening to praise, first check if message is a username belonging to members list
             * If it is, select new username
             */
            let username = await this.getUsernameFromText(read, text);
            if (username) {
                this.selectUsername(modify, persistence, sender, room, association, username);
            } else {
                username = data.username as string;

                // Removes listening record from persistence storage
                await persistence.removeByAssociation(association);

                const karmaAssoc = new RocketChatAssociationRecord(RocketChatAssociationModel.MISC, 'karma');
                const karmaData = await read.getPersistenceReader().readByAssociation(karmaAssoc);
                let karma = karmaData && karmaData.length > 0 && karmaData[0] as IKarmaStorage;
                if (!karma) {
                    karma = {};
                }

                // Only increases karma points if it's not a self-praise
                if (username !== sender.username) {
                    // Adds 1 karma points to praised user
                    username = Buffer.from(username).toString('base64') as string;
                    if (karma[username]) {
                        karma[username] += 1;
                    } else {
                        karma[username] = 1;
                    }

                    // Adds 1 karma points to user giving praise
                    const senderUsername = Buffer.from(sender.username).toString('base64') as string;
                    if (karma[senderUsername]) {
                        karma[senderUsername] += 1;
                    } else {
                        karma[senderUsername] = 1;
                    }

                    username = Buffer.from(username, 'base64').toString('utf8') as string;
                }

                await persistence.updateByAssociation(karmaAssoc, karma);

                // Sends the praise
                await this.sendPraise(modify, sender, username, text);

                // Notifies user that a praise has been sent
                await sendMessage(this.app, modify, room, `Your praise has been registered`);
            }
        }
    }

    /**
     * Checks if the text is a username contained on the room members
     *
     * @param message The text being analyzed
     * @param read IRead
     */
    public async getUsernameFromText(read: IRead, text?: string): Promise<string | false> {
        // strips the @ from the text to check against room members usernames
        const username = text ? text.replace(/^@/, '').trim() : false;
        if (username) {
            // Loads members for checking
            const members = await getMembers(this.app, read);

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
    private async selectUsername(modify: IModify, persistence: IPersistence, sender: IUser, room: IRoom, association: RocketChatAssociationRecord, username: string) {
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
        await sendMessage(this.app, modify, room, txt);
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
    private async sendPraise(modify: IModify, sender: IUser, username: string, text: string) {
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
        await sendMessage(this.app, modify, this.app.kokoPostPraiseRoom, msg);
    }
}
