import { IModify } from '@rocket.chat/apps-engine/definition/accessors';
import { BlockBuilder, BlockElementType, IButtonElement, TextObjectType } from '@rocket.chat/apps-engine/definition/uikit';

export function createPraiseBlocks(modify: IModify, text: string): BlockBuilder {
    const blocks = modify.getCreator().getBlockBuilder();
    blocks.addSectionBlock({
        text: {
            type: TextObjectType.PLAINTEXT,
            text,
        },
    });
    blocks.addActionsBlock({
        elements: [{
            type: BlockElementType.BUTTON,
            text: {
                type: TextObjectType.PLAINTEXT,
                text: 'Praise',
            },
            actionId: 'praise',
        } as IButtonElement,
        ],
    });
    return blocks;
}
