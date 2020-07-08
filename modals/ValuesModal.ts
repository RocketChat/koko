import { IModify, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { TextObjectType } from '@rocket.chat/apps-engine/definition/uikit/blocks';
import { IUIKitModalViewParam } from '@rocket.chat/apps-engine/definition/uikit/UIKitInteractionResponder';

import { KokoApp } from '../KokoApp';
import { getMembers } from '../lib/helpers';

export async function valuesModal({ app, read, modify }: {
    app: KokoApp,
    read: IRead,
    modify: IModify,
}): Promise<IUIKitModalViewParam> {
    const viewId = 'values';
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
        blockId: 'values',
        element: block.newMultiStaticElement({
            actionId: 'dots',
            placeholder: {
                type: TextObjectType.PLAINTEXT,
                text: 'Select 1 or more values',
            },
            options: [
                {
                    text: {
                        type: TextObjectType.PLAINTEXT,
                        text: 'Dream',
                    },
                    value: 'Dream',
                },
                {
                    text: {
                        type: TextObjectType.PLAINTEXT,
                        text: 'Own',
                    },
                    value: 'Own',
                },
                {
                    text: {
                        type: TextObjectType.PLAINTEXT,
                        text: 'Trust',
                    },
                    value: 'Trust',
                },
                {
                    text: {
                        type: TextObjectType.PLAINTEXT,
                        text: 'Share',
                    },
                    value: 'Share',
                },
            ],
        }),
        label: {
            type: TextObjectType.PLAINTEXT,
            text: 'Values',
            emoji: true,
        },
    });

    block.addInputBlock({
        blockId: 'values',
        element: block.newMultiStaticElement({
            actionId: 'who',
            placeholder: {
                type: TextObjectType.PLAINTEXT,
                text: 'Who did it?',
            },
            options: users,
        }),
        label: {
            type: TextObjectType.PLAINTEXT,
            text: 'Who did something amazing (optional)?',
            emoji: true,
        },
    });
    block.addInputBlock({
        blockId: 'values',
        element: block.newPlainTextInputElement({ actionId: 'reason' }),
        label: {
            type: TextObjectType.PLAINTEXT,
            text: `What was it?`,
            emoji: true,
        },
    });

    return {
        id: viewId,
        title: {
            type: TextObjectType.PLAINTEXT,
            text: 'DOTS',
        },
        submit: block.newButtonElement({
            text: {
                type: TextObjectType.PLAINTEXT,
                text: 'Submit',
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

export async function valuesRegisteredModal({ read, modify, data }: {
    read: IRead,
    modify: IModify,
    data,
}): Promise<IUIKitModalViewParam> {
    const viewId = 'values';
    const block = modify.getCreator().getBlockBuilder();

    block.addSectionBlock({
        text: {
            type: TextObjectType.PLAINTEXT,
            text: 'Your answer has been recorded.',
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
