import { IModify } from '@rocket.chat/apps-engine/definition/accessors';
import { BlockBuilder, BlockElementType, IButtonElement, TextObjectType } from '@rocket.chat/apps-engine/definition/uikit';

export function createValuesBlocks(modify: IModify): BlockBuilder {
    const blocks = modify.getCreator().getBlockBuilder();
    blocks.addSectionBlock({
        text: blocks.newMarkdownTextObject('Rocket.Chat values are easily remembered by looking at our logo. Do you know what the DOTS mean?')
    });
    blocks.addSectionBlock({
        text: blocks.newMarkdownTextObject('We *D*ream'),
        accessory: {
            type: BlockElementType.BUTTON,
            actionId: 'learnMore',
            text: blocks.newPlainTextObject('Learn more'),
            value: 'dream',
        },
    });
    blocks.addSectionBlock({
        text: blocks.newMarkdownTextObject('We *O*wn'),
        accessory: {
            type: BlockElementType.BUTTON,
            actionId: 'learnMore',
            text: blocks.newPlainTextObject('Learn more'),
            value: 'own',
        },
    });
    blocks.addSectionBlock({
        text: blocks.newMarkdownTextObject('We *T*rust'),
        accessory: {
            type: BlockElementType.BUTTON,
            actionId: 'learnMore',
            text: blocks.newPlainTextObject('Learn more'),
            value: 'trust',
        },
    });
    blocks.addSectionBlock({
        text: blocks.newMarkdownTextObject('We *S*hare'),
        accessory: {
            type: BlockElementType.BUTTON,
            actionId: 'learnMore',
            text: blocks.newPlainTextObject('Learn more'),
            value: 'share',
        },
    });
    blocks.addSectionBlock({
        text: blocks.newMarkdownTextObject('What is something that happened, or someone who did something, that represent our values?'),
    });
    blocks.addActionsBlock({
        elements: [{
            type: BlockElementType.BUTTON,
            text: {
                type: TextObjectType.PLAINTEXT,
                text: 'Answer',
            },
            actionId: 'values',
        } as IButtonElement,
        ],
    });
    return blocks;
}
