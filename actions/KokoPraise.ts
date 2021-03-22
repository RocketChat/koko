import { IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { RocketChatAssociationModel, RocketChatAssociationRecord } from '@rocket.chat/apps-engine/definition/metadata';
import { IRoom } from '@rocket.chat/apps-engine/definition/rooms';
import { UIKitViewSubmitInteractionContext } from '@rocket.chat/apps-engine/definition/uikit';
import { IUser } from '@rocket.chat/apps-engine/definition/users';
import { Buffer } from 'buffer';

import { createPraiseBlocks } from '../blocks/PraiseBlocks';
import { KokoApp } from '../KokoApp';
import { getDirect, getMembers, notifyUser, random, sendMessage } from '../lib/helpers';
import { praiseRegisteredModal } from '../modals/PraiseModal';
import { IKarmaStorage, IPraiserKarmaStorage } from '../storage/IKarmaStorage';

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
    public async run(read: IRead, modify: IModify, persistence: IPersistence, user?: IUser, praiseQuestion?: string, sendScoreBoard?: string) {

        // Gets room members (removes rocket.cat and koko bot)
        let members = await getMembers(this.app, read);

        if (members && this.app.botUser !== undefined && this.app.kokoMembersRoom !== undefined && this.app.kokoPostPraiseRoom !== undefined) {
              // Randomize praise request message
            const praiseQuestions = [
                'Hello :vulcan: would you like to praise someone today?',
                'I\'m sure someone did something good recently. How about saying thanks?',
                'How about giving praise to someone today?',
            ];
            const text = praiseQuestion ? praiseQuestion : praiseQuestions[random(0, praiseQuestions.length - 1)];

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

                // Creates praise blocks
                const blocks = createPraiseBlocks(modify, text);
                await sendMessage(this.app, modify, room, text, [], blocks);
            }

            if (sendScoreBoard === 'praisers') {
                await this.sendKarmaScoreboard({ read, modify, room: this.app.kokoPostPraiseRoom, praisees: false, praisers: true });
            } else if (sendScoreBoard === 'all') {
                await this.sendKarmaScoreboard({ read, modify, room: this.app.kokoPostPraiseRoom, praisees: true, praisers: true });
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
    public async sendKarmaScoreboard({ read, modify, room, user, praisers, praisees }: { read: IRead, modify: IModify, room: IRoom, user?: IUser, praisers?: boolean, praisees?: boolean }) {
        let output = '';

        if (praisers !== false) {
            const praiserKarmaAssoc = new RocketChatAssociationRecord(RocketChatAssociationModel.MISC, 'praiserKarma');
            const praiserKarmaData = await read.getPersistenceReader().readByAssociation(praiserKarmaAssoc);
            if (praiserKarmaData && praiserKarmaData.length > 0 && praiserKarmaData[0]) {
                const praiserKarma = praiserKarmaData[0] as IPraiserKarmaStorage;
                const praiserSortable = [] as any;
                for (const key in praiserKarma) {
                    if (praiserKarma.hasOwnProperty(key)) {
                        praiserSortable.push([key, praiserKarma[key]]);
                    }
                }
                praiserSortable.sort((a, b) => b[1] - a[1]);
                output += '*These are the people who sent the most praises (top 10)*:\n';
                const emojis = [':first_place: ', ':second_place: ', ':third_place: '];
                let countUsers = 0;
                let count = -1;
                let last;
                for (const key in praiserSortable) {
                    countUsers++;
                    if (countUsers > 10) {
                        break;
                    }
                    if (praiserSortable.hasOwnProperty(key)) {
                        if (last !== praiserSortable[key][1]) {
                            count++;
                        }
                        const username = Buffer.from(praiserSortable[key][0], 'base64').toString('utf8') as string;
                        output += `${emojis[count] ? emojis[count] : ':reminder_ribbon: '}${username}: ${praiserSortable[key][1]}\n`;
                        last = praiserSortable[key][1];
                    }
                }
            }
        }


        if (praisees !== false) {
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
                output += '\n*Here is the current Karma Scoreboard (top 10)*:\n';
                const emojis = [':first_place: ', ':second_place: ', ':third_place: '];
                let countUsers = 0;
                let count = -1;
                let last;
                for (const key in sortable) {
                    countUsers++;
                    if (countUsers > 10) {
                        break;
                    }
                    if (sortable.hasOwnProperty(key)) {
                        if (last !== sortable[key][1]) {
                            count++;
                        }
                        const username = Buffer.from(sortable[key][0], 'base64').toString('utf8') as string;
                        output += `${emojis[count] ? emojis[count] : ':reminder_ribbon: '}${username}: ${sortable[key][1]}\n`;
                        last = sortable[key][1];
                    }
                }
            }
        }

        if (output) {
            if (user) {
                await notifyUser(this.app, modify, room, user, output);
            } else {
                await sendMessage(this.app, modify, room, output);
            }
        }
    }

    /**
     * Checks if usernames have been selected and reason is given
     * Then sends a praise to the selected users
     */
    // tslint:disable-next-line:max-line-length
    public async submit({ context, modify, read, persistence }: { context: UIKitViewSubmitInteractionContext, modify: IModify, read: IRead, persistence: IPersistence }) {
        const data = context.getInteractionData();
        const { praise }: {
            praise: {
                who: Array<string>,
                why: string,
            },
        } = data.view.state as any;
        const errors = {} as any;
        if (praise === undefined || praise.who === undefined || praise.who.length === 0) {
            errors.who = 'Please select at least one user';
        }
        if (praise === undefined || praise.why === undefined || praise.why.length === 0) {
            errors.why = 'Please type a reason';
        }
        if (Object.keys(errors).length > 0) {
            return context.getInteractionResponder().viewErrorResponse({
                viewId: data.view.id,
                errors,
            });
        }
        await this.sendPraise(read, modify, persistence, data.user, praise.who, praise.why);
        const modal = await praiseRegisteredModal({ read, modify, data });
        return context.getInteractionResponder().updateModalViewResponse(modal);
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
     * Sends a praise message to kokoPostPraiseRoom
     *
     * @param username the username being praised
     * @param text the motive for praising
     * @param sender the user sending a praise
     * @param read IRead
     * @param modify IModify
     */
    private async sendPraise(read: IRead, modify: IModify, persistence: IPersistence, sender: IUser, usernames: Array<string>, text: string) {
        const karmaAssoc = new RocketChatAssociationRecord(RocketChatAssociationModel.MISC, 'karma');
        const karmaData = await read.getPersistenceReader().readByAssociation(karmaAssoc);
        let karma = karmaData && karmaData.length > 0 && karmaData[0] as IKarmaStorage;
        if (!karma) {
            karma = {};
        }

        for (let username of usernames) {
            // Adds 1 karma points to praised user
            username = Buffer.from(username).toString('base64') as string;
            if (karma[username]) {
                karma[username] += 1;
            } else {
                karma[username] = 1;
            }
        }
        await persistence.updateByAssociation(karmaAssoc, karma);

        const praiserKarmaAssoc = new RocketChatAssociationRecord(RocketChatAssociationModel.MISC, 'praiserKarma');
        const praiserKarmaData = await read.getPersistenceReader().readByAssociation(praiserKarmaAssoc);
        let praiserKarma = praiserKarmaData && praiserKarmaData.length > 0 && praiserKarmaData[0] as IPraiserKarmaStorage;
        if (!praiserKarma) {
            praiserKarma = {};
        }

        const senderUsername = Buffer.from(sender.username).toString('base64') as string;
        if (praiserKarma[senderUsername]) {
            praiserKarma[senderUsername] += 1;
        } else {
            praiserKarma[senderUsername] = 1;
        }
        await persistence.updateByAssociation(praiserKarmaAssoc, praiserKarma);

        let msg;
        let replaceUsernames;
        if (usernames.length === 1) {
            replaceUsernames = usernames[0];
        } else {
            const lastUsername = usernames.pop();
            replaceUsernames = usernames.join(', @') + ` and @${lastUsername}`;
        }

        const praiseMessages = [
            '@sender says thanks to @username for "{text}"',
            '@sender gives @username kudos for "{text}"',
            '@sender thinks @username did a good job on "{text}"',
        ];
        msg = praiseMessages[random(0, praiseMessages.length - 1)];
        msg = msg.replace('@sender', '@' + sender.username).replace('@username', '@' + replaceUsernames).replace('{text}', text);
        await sendMessage(this.app, modify, this.app.kokoPostPraiseRoom, msg);
    }
}
