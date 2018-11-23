import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { IMessage, MessageActionButtonsAlignment, MessageActionType } from '@rocket.chat/apps-engine/definition/messages';
import { RocketChatAssociationModel, RocketChatAssociationRecord } from '@rocket.chat/apps-engine/definition/metadata';
import { IRoom } from '@rocket.chat/apps-engine/definition/rooms';
import { KokoApp } from '../KokoApp';
import { IPraiseStorage } from '../storage/IPraiseStorage';

export class KokoOneOnOne {
    constructor(private readonly app: KokoApp) { }

    /**
     * Sends a new one on one request to all members of selected room
     *
     * @param read
     * @param modify
     * @param http
     * @param persistence
     */
    public async run(read: IRead, modify: IModify, http: IHttp, persistence: IPersistence) {
        // When running a new one-on-one request, clear pending one-on-one
        const oneOnOneAssociation = new RocketChatAssociationRecord(RocketChatAssociationModel.MISC, 'one-on-one');
        await persistence.updateByAssociation(oneOnOneAssociation, { count: 0 }, true);

        const members = await this.app.getMembers(read);

        // Sends a request to each member
        members.forEach(async (member) => {
            // Gets or creates a direct message room between botUser and member
            const room = await this.app.getDirect(read, modify, member.username) as IRoom;

            // Saves new association record for listening for one-on-one answer
            const assoc = new RocketChatAssociationRecord(RocketChatAssociationModel.USER, member.id);
            persistence.updateByAssociation(assoc, { listen: 'one-on-one' }, true);

            const builder = modify.getCreator().startMessage()
                .setSender(this.app.botUser)
                .setRoom(room)
                .setText('Are you available for a random one-on-one call?')
                .setUsernameAlias(this.app.kokoName)
                .setEmojiAvatar(this.app.kokoEmojiAvatar)
                .addAttachment({
                    actionButtonsAlignment: MessageActionButtonsAlignment.HORIZONTAL,
                    actions: [
                        {
                            text: 'Yes',
                            type: MessageActionType.BUTTON,
                            msg_in_chat_window: true,
                            msg: 'Yes',
                        },
                        {
                            text: 'No',
                            type: MessageActionType.BUTTON,
                            msg_in_chat_window: true,
                            msg: 'No',
                        },
                    ],
                });
            try {
                await modify.getCreator().finish(builder);
            } catch (error) {
                console.log(error);
            }
        });
    }

    public async listen(data: IPraiseStorage, message: IMessage, read: IRead, persistence: IPersistence, modify: IModify) {

        /**
         * When listening to one-on-one, checks if user answered yes or no
         * If yes, checks if there's anyone waiting for a call and link them
         * If no one is waiting, put user on the waiting list
         */
        if (data.listen === 'one-on-one') {
            // Removes listening status for user
            const association = new RocketChatAssociationRecord(RocketChatAssociationModel.USER, message.sender.id);
            persistence.removeByAssociation(association);

            if (message.text === 'Yes') {
                const oneOnOneAssociation = new RocketChatAssociationRecord(RocketChatAssociationModel.MISC, 'one-on-one');

                // Atomic update association to indicate last user that answered yes and in what position
                const oneOnOne = await persistence.findAndUpdateByAssociation(oneOnOneAssociation, {
                    $set: { 'data.username': message.sender.username },
                    $inc: { 'data.count': 1 },
                }, false, true);

                // The atomic update above returns the record before being updated, so the logic is as below:
                // Odd positions are the matching users
                // Even positions are the first caller, waiting for someone
                const oddOrEven = (oneOnOne && oneOnOne.value && oneOnOne.value.data.count) || 0;
                if (oddOrEven % 2 === 0) {
                    const msg = read.getNotifier().getMessageBuilder()
                        .setText(`Yay! I've put you on the waiting list. I'll let you know once someone accepts too.`)
                        .setUsernameAlias(this.app.kokoName)
                        .setEmojiAvatar(this.app.kokoEmojiAvatar)
                        .setRoom(message.room)
                        .setSender(this.app.botUser)
                        .getMessage();
                    await read.getNotifier().notifyUser(message.sender, msg);
                } else {
                    // tslint:disable-next-line:max-line-length
                    const url = `https://jitsi.rocket.chat/koko-${Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)}`;
                    const msg = read.getNotifier().getMessageBuilder()
                        .setText(`I found a match for you. Please click [here](${url}) to join your random one-on-one.`)
                        .setUsernameAlias(this.app.kokoName)
                        .setEmojiAvatar(this.app.kokoEmojiAvatar)
                        .setRoom(message.room)
                        .setSender(this.app.botUser)
                        .getMessage();
                    await read.getNotifier().notifyUser(message.sender, msg);

                    const user = await read.getUserReader().getByUsername(oneOnOne.value.data.username);
                    const room = await this.app.getDirect(read, modify, oneOnOne.value.data.username) as IRoom;
                    const msg2 = read.getNotifier().getMessageBuilder()
                        .setText(`I found a match for you. Please click [here](${url}) to join your random one-on-one.`)
                        .setUsernameAlias(this.app.kokoName)
                        .setEmojiAvatar(this.app.kokoEmojiAvatar)
                        .setRoom(room)
                        .setSender(this.app.botUser)
                        .getMessage();
                    await read.getNotifier().notifyUser(user, msg2);
                }
            } else {
                const msg = read.getNotifier().getMessageBuilder()
                    .setText('Ok :( maybe some other time...')
                    .setUsernameAlias(this.app.kokoName)
                    .setEmojiAvatar(this.app.kokoEmojiAvatar)
                    .setRoom(message.room)
                    .setSender(this.app.botUser)
                    .getMessage();
                await read.getNotifier().notifyUser(message.sender, msg);
            }
        }
    }
}
