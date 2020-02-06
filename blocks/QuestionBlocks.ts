import { IModify } from '@rocket.chat/apps-engine/definition/accessors';
import { BlockBuilder, BlockElementType, IButtonElement, TextObjectType } from '@rocket.chat/apps-engine/definition/uikit';

export function createQuestionBlocks(modify: IModify, question: string): BlockBuilder {
    const blocks = modify.getCreator().getBlockBuilder();
    blocks.addSectionBlock({
        text: {
            type: TextObjectType.PLAINTEXT,
            text: question,
        },
    });
    blocks.addActionsBlock({
        elements: [{
            type: BlockElementType.BUTTON,
            text: {
                type: TextObjectType.PLAINTEXT,
                text: 'Answer',
            },
            actionId: 'question',
        } as IButtonElement,
        ],
    });
    return blocks;
}
