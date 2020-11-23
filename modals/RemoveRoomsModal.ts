import { IModify, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import {
    TextObjectType,
} from '@rocket.chat/apps-engine/definition/uikit/blocks';
import { IUIKitModalViewParam } from '@rocket.chat/apps-engine/definition/uikit/UIKitInteractionResponder';

import { ISuggestedRoomsStorage } from '../storage/ISuggestedRoomStorage';

export async function removeRoomsModal({ suggestedRooms, modify }: {
    suggestedRooms: ISuggestedRoomsStorage,
    modify: IModify,
}): Promise<IUIKitModalViewParam> {
    const viewId = 'remove-rooms';
    const block = modify.getCreator().getBlockBuilder();

    const rooms = suggestedRooms.rooms.map(({ name }) => ({
        text: {
            type: TextObjectType.PLAINTEXT,
            text: name,
        },
        value: name,
    }));

    block.addInputBlock({
        blockId: 'values',
        element: block.newMultiStaticElement({
            actionId: 'rooms',
            placeholder: {
                type: TextObjectType.PLAINTEXT,
                text: 'Select 1 or more rooms',
            },
            options: rooms,
        }),
        label: {
            type: TextObjectType.PLAINTEXT,
            text: 'What rooms would you like to remove?',
            emoji: true,
        },
    });

    return {
        id: viewId,
        title: {
            type: TextObjectType.PLAINTEXT,
            text: 'Remove Suggested Rooms',
        },
        submit: block.newButtonElement({
            text: {
                type: TextObjectType.PLAINTEXT,
                text: 'Remove',
            },
        }),
        close: block.newButtonElement({
            text: {
                type: TextObjectType.PLAINTEXT,
                text: 'Dismiss',
            },
        }),
        blocks: block.getBlocks(),
    };
}

export async function successRemovingRoomsModal(modify: IModify): Promise<IUIKitModalViewParam> {
    const viewId = 'remove-rooms';
    const block = modify.getCreator().getBlockBuilder();

    block.addSectionBlock({
        text: {
            type: TextObjectType.PLAINTEXT,
            text: 'Rooms removed!',
        }
    });

    return {
        id: viewId,
        title: {
            type: TextObjectType.PLAINTEXT,
            text: 'Success!',
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

export async function failedToRemoveRoomModal(read: IRead, modify: IModify): Promise<IUIKitModalViewParam> {
    const viewId = 'remove-rooms';
    const block = modify.getCreator().getBlockBuilder();

    block.addSectionBlock({
        text: {
            type: TextObjectType.MARKDOWN,
            text: 'Failed to remove rooms. Check if they still exist by running `/koko suggest-rooms`',
        }
    });

    return {
        id: viewId,
        title: {
            type: TextObjectType.PLAINTEXT,
            text: 'Error',
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
