import { IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { RocketChatAssociationModel, RocketChatAssociationRecord } from '@rocket.chat/apps-engine/definition/metadata';

import { KokoApp } from '../KokoApp';
import { sendMessage } from '../lib/helpers';

export class KokoWellness {
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
        if (this.app.kokoPostAnswersRoom !== undefined) {
            let text;
            const wellnessAssociation = new RocketChatAssociationRecord(RocketChatAssociationModel.MISC, 'wellness');
            const [record] = await read.getPersistenceReader().readByAssociation(wellnessAssociation);
            if (!record) {
                await persistence.updateByAssociation(wellnessAssociation, { first: true });
                text = `To make us feel a little closer together we're creating a daily point of contact around here to start our days! A simple check-in everyday to know how everyone is feeling, so let's begin?\n\nPlease react to this message with an emoji that represents how you are feeling today!`;
            } else {
                text = `*Check-in* - Please react to this message with an emoji that represents how you are feeling today!`;
            }
            await sendMessage(this.app, modify, this.app.kokoPostAnswersRoom, text);
        }
    }
}
