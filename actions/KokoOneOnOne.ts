import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { MessageActionButtonsAlignment, MessageActionType } from '@rocket.chat/apps-engine/definition/messages';
import { RocketChatAssociationModel, RocketChatAssociationRecord } from '@rocket.chat/apps-engine/definition/metadata';
import { IRoom } from '@rocket.chat/apps-engine/definition/rooms';
import { IUser } from '@rocket.chat/apps-engine/definition/users';
import { KokoApp } from '../KokoApp';
import { getDirect, getMembers, notifyUser, random, sendMessage } from '../lib/helpers';
import { IListenStorage } from '../storage/IListenStorage';
import { IStatsStorage } from '../storage/IStatsStorage';

export class KokoOneOnOne {
    private questions = [
        'What was the first job you ever had?',
        'What fun plans do you have for the weekend?',
        'What’s the most fun project you’ve ever worked on?',
        'How old were you when you had your first job?',
        'How long can you go without checking your phone?',
        'Have you ever really kept a New Year’s resolution?',
        'What would you do if you were home alone and the power went out?',
        'What shows are you into?',
        'What do you hope never changes?',
        'What would you rate 10 / 10?',
        'What skill would you like to master?',
        'What takes up too much of your time?',
        'What’s the farthest you’ve ever been from home?',
        'Where is the most interesting place you’ve been?',
        'What are you most likely to become famous for?',
        'How do you relax after a hard day of work?',
        'What pets did you have while you were growing up?',
        'What would be the most amazing adventure to go on?',
        'What would be your ideal way to spend the weekend?',
        'What one thing do you really want but can’t afford?',
        'What is the luckiest thing that has happened to you?',
        'What are some small things that make your day better?',
        'What’s the best thing that happened to you last week?',
        'What are you looking forward to in the coming months?',
        'What are you interested in that most people haven’t heard of?',
        'Why did you decide to do the work you are doing now?',
        'Where do you usually go when you have time off?',
        'What are you most looking forward to in the next 10 years?',
        'If you suddenly became a master at woodworking, what would you make?',
        'What could you give a 40-minute presentation on with absolutely no preparation?',
        'What amazing thing did you do that no one was around to see?',
        'What hobby would you get into if time and money weren’t an issue?',
        'When people come to you for help, what do they usually want help with?',
        'What would be your first question after waking up from being cryogenically frozen for 100 years?',
    ];

    constructor(private readonly app: KokoApp) { }

    /**
     * Sends a new one on one request to all members of selected room
     *
     * @param read
     * @param modify
     * @param http
     * @param persistence
     */
    public async run(read: IRead, modify: IModify, persistence: IPersistence) {
        // When running a new one-on-one request, clear pending one-on-one
        const oneOnOneAssociation = new RocketChatAssociationRecord(RocketChatAssociationModel.MISC, 'one-on-one');
        await persistence.removeByAssociation(oneOnOneAssociation);

        // Gets room members (removes rocket.cat and koko bot)
        const members = (await getMembers(this.app, read))
            .filter((member) => member.username !== 'rocket.cat' && member.username !== this.app.botUsername);

        // Sends a request to each member
        for (const member of members) {

            // Gets or creates a direct message room between botUser and member
            const room = await getDirect(this.app, read, modify, member.username) as IRoom;

            // Saves new association record for listening for one-on-one answer
            const assoc = new RocketChatAssociationRecord(RocketChatAssociationModel.USER, member.id);
            const listenStorage: IListenStorage = { listen: 'one-on-one' };
            persistence.updateByAssociation(assoc, listenStorage, true);

            const text = 'Are you available for a random one-on-one call?';
            const attachment = {
                actionButtonsAlignment: MessageActionButtonsAlignment.HORIZONTAL,
                actions: [
                    {
                        text: 'Yes',
                        type: MessageActionType.BUTTON,
                        msg_in_chat_window: true,
                        msg: '/koko one-on-one',
                    },
                    // {
                    //     text: 'No',
                    //     type: MessageActionType.BUTTON,
                    //     msg_in_chat_window: true,
                    //     msg: '/koko one-on-one cancel',
                    // },
                ],
            };

            await sendMessage(this.app, modify, room, text, [attachment]);
        }
    }

    /**
     * When listening to one-on-one, checks if user answered yes or no
     * If yes, checks if there's anyone waiting for a call and link them
     * If no one is waiting, put user on the waiting list
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
        if (data.listen === 'one-on-one') {
            // Removes listening status for user
            const association = new RocketChatAssociationRecord(RocketChatAssociationModel.USER, sender.id);
            persistence.removeByAssociation(association);

            if (text === 'Yes') {
                // Checks if user if first or last in the call
                const oneOnOneAssociation = new RocketChatAssociationRecord(RocketChatAssociationModel.MISC, 'one-on-one');
                const oneOnOneData = await read.getPersistenceReader().readByAssociation(oneOnOneAssociation);
                if (oneOnOneData && oneOnOneData.length > 0 && oneOnOneData[0]) {
                    const oneOnOne = oneOnOneData[0] as any;
                    const username = oneOnOne.username;
                    if (username !== sender.username) {
                        // Previous user found; Remove association to avoid possible race condition sooner
                        await persistence.removeByAssociation(oneOnOneAssociation);

                        // Sends a message to the connecting user
                        const url = `https://jitsi.rocket.chat/koko-${Math.random().toString(36).substring(2, 15)}`;
                        let message = `I found a match for you. Please click [here](${url}) to join your random one-on-one.`;
                        message += '\nIf you need help with some conversation starters, here is an idea:\n';
                        let question = this.questions[random(0, this.questions.length - 1)];
                        let msgWithQuestion = `${message}*${question}*`;
                        await sendMessage(this.app, modify, room, msgWithQuestion);

                        // Sends a message to the matching user (waiting user)
                        const matchRoom = await getDirect(this.app, read, modify, username) as IRoom;
                        question = this.questions[random(0, this.questions.length - 1)];
                        msgWithQuestion = `${message}*${question}*`;
                        await sendMessage(this.app, modify, matchRoom, msgWithQuestion);

                        const statsAssoc = new RocketChatAssociationRecord(RocketChatAssociationModel.MISC, 'one-on-one-stats');
                        const stats: IStatsStorage = { username1: username, username2: sender.username, dateTime: new Date() };
                        await persistence.createWithAssociation(stats, statsAssoc);
                    } else {
                        await sendMessage(this.app, modify, room, 'You are already on the list.');
                    }
                } else {
                    // No one was found waiting, so we wait
                    await persistence.updateByAssociation(oneOnOneAssociation, {
                        username: sender.username,
                    }, true);
                    const message = `I've put you on the random 1:1 waiting list. I'll let you know once someone accepts too.
                    If you'd like to cancel the request, please type \`/koko cancel\` or click the button below.`;
                    const attachment = {
                        actions: [
                            {
                                type: MessageActionType.BUTTON,
                                msg: `/koko cancel`,
                                msg_in_chat_window: true,
                                text: 'Cancel',
                            },
                        ],
                    };
                    await sendMessage(this.app, modify, room, message, [attachment]);
                }
            } else {
                // User didn't reply with Yes
                const message = `Maybe some other time.
                If you change your mind, just type \`/koko 1:1\` or click the button below and you'll be added to the 1:1 waiting list`;
                const attachment = {
                    actions: [
                        {
                            type: MessageActionType.BUTTON,
                            msg: `/koko 1:1`,
                            msg_in_chat_window: true,
                            text: 'I changed my mind',
                        },
                    ],
                };
                await sendMessage(this.app, modify, room, message, [attachment]);
            }
        }
    }

    /**
     * Sends past one-on-ones
     *
     * @param app
     * @param read
     * @param modify
     * @param sender
     * @param room
     */
    public async sendStats(app: KokoApp, read: IRead, modify: IModify, sender: IUser, room: IRoom) {
        const statsAssoc = new RocketChatAssociationRecord(RocketChatAssociationModel.MISC, 'one-on-one-stats');
        const statsData = await read.getPersistenceReader().readByAssociation(statsAssoc);
        if (statsData && statsData.length > 0) {
            let message = '';
            for (const key in statsData) {
                if (statsData.hasOwnProperty(key)) {
                    const stats = statsData[key] as IStatsStorage;
                    message += `${stats.username1} x ${stats.username2} at ${stats.dateTime.toUTCString()}\n`;
                }
            }
            notifyUser(app, modify, room, sender, message);
        }
    }
}
