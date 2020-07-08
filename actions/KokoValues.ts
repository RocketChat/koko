import { IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { RocketChatAssociationModel, RocketChatAssociationRecord } from '@rocket.chat/apps-engine/definition/metadata';
import { IRoom } from '@rocket.chat/apps-engine/definition/rooms';
import { UIKitViewSubmitInteractionContext } from '@rocket.chat/apps-engine/definition/uikit';
import { IUser } from '@rocket.chat/apps-engine/definition/users';
import { Buffer } from 'buffer';

import { createValuesBlocks } from '../blocks/ValuesBlocks';
import { KokoApp } from '../KokoApp';
import { getDirect, getMembers, sendMessage } from '../lib/helpers';
import { valuesRegisteredModal } from '../modals/ValuesModal';
import { IValuesPointStorage, IValueAnswerStorage, IValueAnswer } from '../storage/IValuesStorage';
// import { IKarmaStorage, IPraiserKarmaStorage } from '../storage/IKarmaStorage';



export class KokoValues {
    constructor(private readonly app: KokoApp) { }

    /**
     * Sends a new one on one request to all members of selected room
     *
     * @param read
     * @param modify
     * @param persistence
     */
    public async run(read: IRead, modify: IModify, persistence: IPersistence) {
        if (this.app.botUser !== undefined && this.app.kokoMembersRoom !== undefined) {
            // Gets room members (removes rocket.cat and koko bot)
            const members = await getMembers(this.app, read);

            // const text = 'Rocket.Chat values are easily remembered by looking at our logo. Do you know what the DOTS mean?\n\nWe *D*ream: We get out of our comfort zone and take risks. Our *dreams* take us to high goals and the fear of failure doesn’t stop us from trying because we have the passion to go beyond the status quo.\nWe *O*wn: We hope to find those better ways because of our ownership. We *own* the problems that appear and feel empowered to take initiative to solve them, testing and adapting. We *own* our responsibilities, and if we say it we do it, constantly trying to go the extra mile to exceed expectations. We wear this ownership everyday, represented by the t - shirts we so proudly wear in every possible color.\nWe *T*rust: We are so proud of what we do, we wear it, and talk about it. We *trust* what we’re creating, we *trust* the purpose of what we do, and we *trust* each other. That is what gives us the freedom to innovate, to create our own schedules, to have the remote work as part of who we are as Rocket.Chat. The flexibility and balance we achieve by trusting is what makes our environment one of enjoyment, is what makes us feel pleasure in doing what we do.\nWe *S*hare: We trust, believe and enjoy what we do. We *share* the good and the bad because we’re united by a common belief. We team up to solve problems, meet clients, create solutions, celebrate birthdays or our yearly Summit. Most importantly, we *share* because that is the essence of who we are. We’re open, and built by our community, so more than just sharing, it is about empowering and loving the community and who’s beside us, making this all happen.\n\nWhat is something that happened, or someone who did something, that represent our values?';
            // const text = 'Rocket.Chat values are easily remembered by looking at our logo. Do you know what the DOTS mean?\n\nWe *D*ream\nWe *O*wn\nWe *T*rust\nWe *S*hare\n\nWhat is something that happened, or someone who did something, that represent our values?';

            // Sends message to each member
            for (const member of members) {
                if (member.id === this.app.botUser.id) {
                    continue;
                }

                // Gets or creates a direct message room between botUser and member
                const room = await getDirect(this.app, read, modify, member.username) as IRoom;

                // Creates praise blocks
                const blocks = createValuesBlocks(modify);
                await sendMessage(this.app, modify, room, 'Rocket.Chat values are easily remembered by looking at our logo. Do you know what the DOTS mean?', [], blocks);
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
        const { values }: {
            values: {
                dots: Array<string>,
                who?: Array<string>,
                reason: string,
            },
        } = data.view.state as any;
        const errors = {} as any;
        if (values === undefined || values.dots === undefined || values.dots.length === 0) {
            errors.who = 'Please select at least one value';
        }
        if (values === undefined || values.reason === undefined || values.reason.length === 0) {
            errors.reason = 'Please type a reason';
        }
        if (Object.keys(errors).length > 0) {
            return context.getInteractionResponder().viewErrorResponse({
                viewId: data.view.id,
                errors,
            });
        }
        await this.sendValuesAnswer(read, modify, persistence, data.user, values.dots, values.reason, values.who);
        const modal = await valuesRegisteredModal({ read, modify, data });
        return context.getInteractionResponder().updateModalViewResponse(modal);
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
    private async sendValuesAnswer(read: IRead, modify: IModify, persistence: IPersistence, sender: IUser, dots: Array<string>, text: string, usernames?: Array<string>) {
        console.log(sender, dots, text);
        const valuePointsAssoc = new RocketChatAssociationRecord(RocketChatAssociationModel.MISC, 'valuePoints');
        const valuePointsData = await read.getPersistenceReader().readByAssociation(valuePointsAssoc);
        let valuePoints = valuePointsData && valuePointsData.length > 0 && valuePointsData[0] as IValuesPointStorage;
        if (!valuePoints) {
            valuePoints = {};
        }

        if (usernames !== undefined && usernames.length > 0) {
            for (let username of usernames) {
                // Adds 1 karma points to praised user
                username = Buffer.from(username).toString('base64') as string;
                if (valuePoints[username]) {
                    valuePoints[username] += 1;
                } else {
                    valuePoints[username] = 1;
                }
            }
        }
        const senderUsername = Buffer.from(sender.username).toString('base64') as string;
        if (valuePoints[senderUsername]) {
            valuePoints[senderUsername] += 1;
        } else {
            valuePoints[senderUsername] = 1;
        }
        await persistence.updateByAssociation(valuePointsAssoc, valuePoints);

        const valuesAssoc = new RocketChatAssociationRecord(RocketChatAssociationModel.MISC, 'values');
        const valuesData = await read.getPersistenceReader().readByAssociation(valuesAssoc);
        let values = valuesData && valuesData.length > 0 && valuesData[0] as IValueAnswerStorage;
        if (!values) {
            values = [];
        }
        const valueAnswer: IValueAnswer = { username: sender.username, answer: text };
        if (usernames !== undefined) {
            valueAnswer.selectedUsers = usernames;
        }
        values.push(valueAnswer);
        await persistence.updateByAssociation(valuesAssoc, values);

        let msg;
        let replaceUsernames;
        if (usernames === undefined || usernames.length === 0) {
            msg = 'Here is something @sender thinks is connected to our value(s) of *{values}*:\n{text}';
        } else if (usernames.length === 1) {
            replaceUsernames = usernames[0];
            msg = 'Here is something @sender thinks @username did, that is connected to our value(s) of *{values}*:\n{text}';
        } else {
            msg = 'Here is something @sender thinks @username did, that is connected to our value(s) of *{values}*:\n{text}';
            const lastUsername = usernames.pop();
            replaceUsernames = usernames.join(', @') + ` and @${lastUsername}`;
        }

        msg = msg.replace('@sender', '@' + sender.username).replace('@username', '@' + replaceUsernames).replace('{values}', dots.join(', ')).replace('{text}', text);
        await sendMessage(this.app, modify, this.app.kokoPostPraiseRoom, msg);
    }
}
