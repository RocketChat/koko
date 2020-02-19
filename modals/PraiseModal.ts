import { IModify, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import {
    BlockElementType,
    IMultiStaticSelectElement,
    TextObjectType,
} from '@rocket.chat/apps-engine/definition/uikit/blocks';
import { IUIKitModalViewParam } from '@rocket.chat/apps-engine/definition/uikit/UIKitInteractionResponder';

import { KokoApp } from '../KokoApp';
import { getMembers } from '../lib/helpers';

export async function praiseModal({ app, data, read, modify }: {
    app: KokoApp,
    data,
    read: IRead,
    modify: IModify,
}): Promise<IUIKitModalViewParam> {
    const viewId = 'praise';
    const block = modify.getCreator().getBlockBuilder();

    const members = await getMembers(app, read);

    // Build a list of usernames to add to message attachment
    const users = members
        .sort((a, b) => {
            return a.name.toUpperCase() < b.name.toUpperCase() ? -1 : 1;
        })
        .map((member) => {
            return {
                text: {
                    type: TextObjectType.PLAINTEXT,
                    text: member.username,
                },
                value: member.username,
            };
        });

    block.addInputBlock({
        blockId: 'praise',
        element: block.newMultiStaticElement({
            actionId: 'who',
            placeholder: {
                type: TextObjectType.PLAINTEXT,
                text: 'Select 1 or more users',
            },
            options: users,
        }),
        label: {
            type: TextObjectType.PLAINTEXT,
            text: 'Who would you like to praise?',
            emoji: true,
        },
    });
    block.addInputBlock({
        blockId: 'praise',
        element: block.newPlainTextInputElement({ actionId: 'why' }),
        label: {
            type: TextObjectType.PLAINTEXT,
            text: `@${data.user.username} says thanks for...`,
            emoji: true,
        },
    });

    return {
        id: viewId,
        title: {
            type: TextObjectType.PLAINTEXT,
            text: 'Praise time!',
        },
        submit: block.newButtonElement({
            text: {
                type: TextObjectType.PLAINTEXT,
                text: 'Praise',
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

export async function praiseRegisteredModal({ read, modify, data }: {
    read: IRead,
    modify: IModify,
    data,
}): Promise<IUIKitModalViewParam> {
    const viewId = 'praise';
    const block = modify.getCreator().getBlockBuilder();

    block.addSectionBlock({
        text: {
            type: TextObjectType.PLAINTEXT,
            text: 'Your praise has been registered.',
        },
    });

    return {
        id: viewId,
        title: {
            type: TextObjectType.PLAINTEXT,
            text: 'Thank you',
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
