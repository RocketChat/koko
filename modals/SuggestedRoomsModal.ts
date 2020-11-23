import { IModify, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import {
    TextObjectType,
} from '@rocket.chat/apps-engine/definition/uikit/blocks';
import { IUIKitModalViewParam } from '@rocket.chat/apps-engine/definition/uikit/UIKitInteractionResponder';

import { ISuggestedRoomsStorage } from '../storage/ISuggestedRoomStorage';

export async function suggestedRoomsModal({ suggestedRooms, modify }: {
    suggestedRooms: ISuggestedRoomsStorage,
    modify: IModify,
}): Promise<IUIKitModalViewParam> {
    const viewId = 'suggested-rooms';
    const block = modify.getCreator().getBlockBuilder();

    suggestedRooms.rooms.map(({ inviteLink, name }) => {
        block.addSectionBlock({
            text: {
                type: TextObjectType.MARKDOWN,
                text: `[${name}](${inviteLink})`,
            },
            // accessory: {
            //     type: BlockElementType.BUTTON,
            //     text: {
            //         type: TextObjectType.PLAINTEXT,
            //         text: 'Join',
            //     },
            //     actionId: 'joinRoom',
            // } as IButtonElement,
        });
    });

    return {
        id: viewId,
        title: {
            type: TextObjectType.PLAINTEXT,
            text: 'Suggested Rooms',
        },
        close: block.newButtonElement({
            text: {
                type: TextObjectType.PLAINTEXT,
                text: 'Dismiss',
            },
        }),
        blocks: block.getBlocks(),
    };
}
