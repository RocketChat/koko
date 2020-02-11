import { IModify, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { RocketChatAssociationModel, RocketChatAssociationRecord } from '@rocket.chat/apps-engine/definition/metadata';
import { TextObjectType } from '@rocket.chat/apps-engine/definition/uikit/blocks';
import { IUIKitModalViewParam } from '@rocket.chat/apps-engine/definition/uikit/UIKitInteractionResponder';
import { Buffer } from 'buffer';

import { IQuestionStorage } from '../storage/IQuestionStorage';

export async function questionModal({ read, modify, data }: {
    read: IRead,
    modify: IModify,
    data,
}): Promise<IUIKitModalViewParam> {
    const viewId = 'question';
    const block = modify.getCreator().getBlockBuilder();

    const assocQuestions = new RocketChatAssociationRecord(RocketChatAssociationModel.MISC, 'questions');
    const awaitData = await read.getPersistenceReader().readByAssociation(assocQuestions);
    if (awaitData && awaitData[0]) {
        const questionData = awaitData[0] as IQuestionStorage;
        const question = questionData.question;
        const encodedQuestion = Buffer.from(question).toString('base64') as string;
        let previousAnswer = '';
        const answers = questionData.answers[encodedQuestion];
        if (answers !== undefined && answers.length > 0) {
            for (const answer of answers) {
                if (answer.username === data.user.username) {
                    previousAnswer = answer.answer;
                    break;
                }
            }
        }
        block.addSectionBlock({
            text: {
                type: TextObjectType.PLAINTEXT,
                text: question,
            },
        });
        block.addInputBlock({
            blockId: 'question',
            element: block.newPlainTextInputElement({
                actionId: 'answer',
                initialValue: previousAnswer,
            }),
            label: {
                type: TextObjectType.PLAINTEXT,
                text: 'Your answer',
                emoji: true,
            },
        });
        block.addInputBlock({
            blockId: 'question',
            element: block.newStaticSelectElement({
                actionId: 'anonymous',
                initialValue: 'no',
                placeholder: {
                    type: TextObjectType.PLAINTEXT,
                    text: 'Yes/No',
                },
                options: [
                    {
                        text: {
                            type: TextObjectType.PLAINTEXT,
                            text: 'Yes',
                        },
                        value: 'yes',
                    },
                    {
                        text: {
                            type: TextObjectType.PLAINTEXT,
                            text: 'No',
                        },
                        value: 'no',
                    },
                ],
            }),
            label: {
                type: TextObjectType.PLAINTEXT,
                text: 'Anonymous?',
                emoji: true,
            },
        });
    }

    return {
        id: viewId,
        title: {
            type: TextObjectType.PLAINTEXT,
            text: 'Question',
        },
        submit: block.newButtonElement({
            text: {
                type: TextObjectType.PLAINTEXT,
                text: 'Answer',
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

export async function answerRegisteredModal({ read, modify, data }: {
    read: IRead,
    modify: IModify,
    data,
}): Promise<IUIKitModalViewParam> {
    const viewId = 'answerRegistered';
    const block = modify.getCreator().getBlockBuilder();

    block.addSectionBlock({
        text: {
            type: TextObjectType.PLAINTEXT,
            text: 'Your answer has been registered.',
        },
    });

    return {
        id: viewId,
        title: {
            type: TextObjectType.PLAINTEXT,
            text: 'Thank you',
        },
        close: block.newButtonElement({
            actionId: 'dismissAnswerRegistered',
            text: {
                type: TextObjectType.PLAINTEXT,
                text: 'Dismiss',
            },
        }),
        blocks: block.getBlocks(),
    };
}
