import { IUIKitSurfaceViewParam } from '@rocket.chat/apps-engine/definition/accessors';
import { UIKitSurfaceType } from '@rocket.chat/apps-engine/definition/uikit';
import { BlockElementType, ButtonElement, LayoutBlock } from '@rocket.chat/ui-kit';

const QUESTION_CONSTANTS = {
	MODAL_IDS: {
		QUESTION_ASK: 'question-ask-modal',
	},
	ACTION_IDS: {
		QUESTION_INPUT: 'question-input-action',
		QUESTION_DATE: 'question-date-action',
		SUBMIT_QUESTION: 'submit-question',
		CLOSE_MODAL: 'close-modal',
	},
	BLOCK_IDS: {
		QUESTION_INPUT: 'question-input-block',
		QUESTION_DATE: 'question-date-block',
	},
	TEXT: {
		labels: {
			QUESTION_INPUT: 'Question to ask',
			QUESTION_DATE: 'Collection date',
		},
		placeholders: {
			QUESTION_INPUT: 'Type your question here...',
			QUESTION_DATE: 'Select collection date',
		},
		titles: {
			QUESTION_ASK: 'Send Question to Members',
			CANCEL_BUTTON: 'Cancel',
			SUBMIT_BUTTON: 'Send',
			DISMISSED_BUTTON: 'Dismiss',
			QUESTION_SENT: 'Question Sent',
		},
	},
} as const;

const getQuestionAskModal = (appId: string): IUIKitSurfaceViewParam => ({
	id: QUESTION_CONSTANTS.MODAL_IDS.QUESTION_ASK,
	title: {
		type: 'plain_text',
		text: QUESTION_CONSTANTS.TEXT.titles.QUESTION_ASK,
		emoji: true,
	},
	type: UIKitSurfaceType.MODAL,
	blocks: [
		{
			type: 'input',
			element: {
				appId,
				type: 'plain_text_input',
				blockId: QUESTION_CONSTANTS.BLOCK_IDS.QUESTION_INPUT,
				actionId: QUESTION_CONSTANTS.ACTION_IDS.QUESTION_INPUT,
				placeholder: {
					type: 'plain_text',
					text: QUESTION_CONSTANTS.TEXT.placeholders.QUESTION_INPUT,
					emoji: true,
				},
				initialValue: '',
				multiline: true,
			},
			label: {
				type: 'plain_text',
				text: QUESTION_CONSTANTS.TEXT.labels.QUESTION_INPUT,
				emoji: true,
			},
		},
		{
			type: 'actions',
			blockId: QUESTION_CONSTANTS.BLOCK_IDS.QUESTION_DATE,
			elements: [
				{
					type: 'datepicker',
					appId,
					initialDate: new Date().toISOString().slice(0, 10),
					blockId: QUESTION_CONSTANTS.BLOCK_IDS.QUESTION_DATE,
					actionId: QUESTION_CONSTANTS.ACTION_IDS.QUESTION_DATE,
					placeholder: {
						type: 'plain_text',
						text: QUESTION_CONSTANTS.TEXT.placeholders.QUESTION_DATE,
					},
				},
			],
		},
	],
	submit: {
		type: BlockElementType.BUTTON,
		text: {
			type: 'plain_text',
			text: QUESTION_CONSTANTS.TEXT.titles.SUBMIT_BUTTON,
			emoji: true,
		},
		actionId: QUESTION_CONSTANTS.ACTION_IDS.SUBMIT_QUESTION,
	} as ButtonElement,
	close: {
		type: BlockElementType.BUTTON,
		text: {
			type: 'plain_text',
			text: QUESTION_CONSTANTS.TEXT.titles.CANCEL_BUTTON,
			emoji: true,
		},
		actionId: QUESTION_CONSTANTS.ACTION_IDS.CLOSE_MODAL,
	} as ButtonElement,
	clearOnClose: true,
	notifyOnClose: true,
	state: {},
});

const questionSubmittedModal = (appId: string, question: string): IUIKitSurfaceViewParam => ({
	id: QUESTION_CONSTANTS.MODAL_IDS.QUESTION_ASK,
	title: {
		type: 'plain_text',
		text: QUESTION_CONSTANTS.TEXT.titles.QUESTION_SENT,
		emoji: true,
	},
	type: UIKitSurfaceType.MODAL,
	blocks: [
		{
			type: 'section',
			text: {
				type: 'plain_text',
				text: question,
				emoji: true,
			},
		},
	],
	submit: undefined,
	close: {
		type: BlockElementType.BUTTON,
		text: {
			type: 'plain_text',
			text: QUESTION_CONSTANTS.TEXT.titles.DISMISSED_BUTTON,
			emoji: true,
		},
		actionId: QUESTION_CONSTANTS.ACTION_IDS.CLOSE_MODAL,
	} as ButtonElement,
	clearOnClose: true,
	state: {},
});

export { getQuestionAskModal, questionSubmittedModal, QUESTION_CONSTANTS };
