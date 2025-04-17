import { IUIKitSurfaceViewParam } from '@rocket.chat/apps-engine/definition/accessors';
import { UIKitSurfaceType } from '@rocket.chat/apps-engine/definition/uikit';
import { BlockElementType, ButtonElement, LayoutBlock } from '@rocket.chat/ui-kit';

const ASK_Q_MODAL_IDS = {
	QUESTION_ASK: 'question-ask-modal',
} as const;

const ASK_Q_ACTION_IDS = {
	QUESTION_INPUT: 'question-input-action',
	QUESTION_DATE: 'question-date-action',
	SUBMIT_QUESTION: 'submit-question',
	CLOSE_MODAL: 'close-modal',
} as const;

const ASK_Q_BLOCK_IDS = {
	QUESTION_INPUT: 'question-input-block',
	QUESTION_DATE: 'question-date-block',
} as const;

const ASK_Q_TEXT = {
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
	},
} as const;

function getQuestionAskModal(appId: string): IUIKitSurfaceViewParam {
	const blocks: LayoutBlock[] = [
		{
			type: 'input',
			element: {
				appId,
				type: 'plain_text_input',
				blockId: ASK_Q_BLOCK_IDS.QUESTION_INPUT,
				actionId: ASK_Q_ACTION_IDS.QUESTION_INPUT,
				placeholder: {
					type: 'plain_text',
					text: ASK_Q_TEXT.placeholders.QUESTION_INPUT,
					emoji: true,
				},
				initialValue: '',
				multiline: true,
			},
			label: {
				type: 'plain_text',
				text: ASK_Q_TEXT.labels.QUESTION_INPUT,
				emoji: true,
			},
		},
		{
			type: 'actions',
			elements: [
				{
					type: 'datepicker',
					appId,
					initialDate: new Date().toISOString().slice(0, 10),
					blockId: ASK_Q_BLOCK_IDS.QUESTION_DATE,
					actionId: ASK_Q_ACTION_IDS.QUESTION_DATE,
					placeholder: {
						type: 'plain_text',
						text: ASK_Q_TEXT.placeholders.QUESTION_DATE,
					},
				},
			],
		},
	];

	const questionAskModal: IUIKitSurfaceViewParam = {
		id: ASK_Q_MODAL_IDS.QUESTION_ASK,
		title: {
			type: 'plain_text',
			text: ASK_Q_TEXT.titles.QUESTION_ASK,
			emoji: true,
		},
		type: UIKitSurfaceType.MODAL,
		blocks,
		submit: {
			type: BlockElementType.BUTTON,
			text: {
				type: 'plain_text',
				text: ASK_Q_TEXT.titles.SUBMIT_BUTTON,
				emoji: true,
			},
			actionId: ASK_Q_ACTION_IDS.SUBMIT_QUESTION,
		} as ButtonElement,
		close: {
			type: BlockElementType.BUTTON,
			text: {
				type: 'plain_text',
				text: ASK_Q_TEXT.titles.CANCEL_BUTTON,
				emoji: true,
			},
			actionId: ASK_Q_ACTION_IDS.CLOSE_MODAL,
		} as ButtonElement,
		clearOnClose: true,
		notifyOnClose: true,
		state: {},
	};

	return questionAskModal;
}

export { getQuestionAskModal, ASK_Q_MODAL_IDS, ASK_Q_ACTION_IDS, ASK_Q_BLOCK_IDS, ASK_Q_TEXT };
