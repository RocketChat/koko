import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { IRoom } from '@rocket.chat/apps-engine/definition/rooms';
import { UIKitViewSubmitInteractionContext } from '@rocket.chat/apps-engine/definition/uikit';
import { IUser } from '@rocket.chat/apps-engine/definition/users';
import { RocketChatAssociationModel, RocketChatAssociationRecord } from '@rocket.chat/apps-engine/definition/metadata';

import { KokoApp } from '../KokoApp';
import { getDirect, getMembers, sendMessage } from '../lib/helpers';
import { questionSubmittedModal } from '../modals/QuestionAskModal';
import { createQuestionBlocks } from '../blocks/QuestionBlocks';
import { QuestionPayload } from '../types/AskQuestion';

export class KokoAskQuestion {
	constructor(private readonly app: KokoApp) {}

	public async submit({
		context,
		modify,
		read,
		persistence,
		http,
	}: {
		context: UIKitViewSubmitInteractionContext;
		modify: IModify;
		read: IRead;
		persistence: IPersistence;
		http: IHttp;
	}) {
		const data = context.getInteractionData();
		const { state } = data.view;

		if (!state) {
			return context.getInteractionResponder().viewErrorResponse({
				viewId: data.view.id,
				errors: {
					'question-input-block': 'Invalid state data. Please try again.',
				},
			});
		}

		const questionText: string = state['question-input-block']?.['question-input-action'];
		const collectionDate = state['question-date-block']?.['question-date-action'];

		if (!questionText?.trim()) {
			return context.getInteractionResponder().viewErrorResponse({
				viewId: data.view.id,
				errors: {
					'question-input-block': 'Please enter a question to ask',
				},
			});
		}

		try {
			// Persist the question
			const questionData: QuestionPayload = {
				text: questionText,
				collectionDate,
				askedBy: data.user.id,
				timestamp: new Date().toISOString(),
				msgIds: [],
				state: 'pending',
			};

			// send after a minute
			const sendTime = new Date().setSeconds(new Date().getSeconds() + 10);

			// Encode the question text to create a unique ID
			const questionId = Buffer.from(questionText?.trim(), 'utf-8').toString('base64');

			const questionAssocId = `question_${questionId}`;
			const assoc = new RocketChatAssociationRecord(RocketChatAssociationModel.MISC, questionAssocId);
			await persistence.updateByAssociation(assoc, questionData, true);

			// Schedule a one‑time job at the given date
			await modify.getScheduler().scheduleOnce({
				id: 'ask-question',
				when: new Date(sendTime),
				data: { questionAssocId },
			});

			// 3) Show confirmation
			const modal = questionSubmittedModal(this.app.getID(), questionText);
			return context.getInteractionResponder().updateModalViewResponse(modal);
		} catch (err) {
			this.app.getLogger().error(`Error scheduling question: ${err.message}`);
			return context.getInteractionResponder().viewErrorResponse({
				viewId: data.view.id,
				errors: {
					'question-input-block': 'An error occurred while scheduling your question. Please try again.',
				},
			});
		}
	}

	public async run(read: IRead, modify: IModify, persistence: IPersistence, questionAssocId: string) {
		if (!this.app.botUser) {
			return;
		}

		try {
			// Load the saved question
			const assoc = new RocketChatAssociationRecord(RocketChatAssociationModel.MISC, questionAssocId);
			const [saved] = (await read.getPersistenceReader().readByAssociation(assoc)) as QuestionPayload[];

			if (!saved) {
				throw new Error(`No question found for ${questionAssocId}`);
			}

			const { text: questionText, collectionDate } = saved;

			// Helper to format the deadline
			const formatDate = (dateString: string): string => {
				const date = new Date(dateString);
				return new Intl.DateTimeFormat('en-US', {
					weekday: 'short',
					month: 'short',
					day: 'numeric',
					year: 'numeric',
					hour: 'numeric',
					minute: 'numeric',
					timeZone: 'UTC',
					timeZoneName: 'short',
				}).format(date);
			};
			const formattedDate = formatDate(collectionDate);

			// Fetch members and send
			const members = await getMembers(this.app, read);
			const messageIds: string[] = [];
			const finisher = modify.getCreator();

			for (const member of members) {
				if (member.id === this.app.botUser.id) {
					continue;
				}
				const room = await getDirect(this.app, read, modify, member.username);
				if (!room) {
					continue;
				}

				// First, the highlighted question
				const highlightedText = `*${questionText.trim()}*`;
				const firstMsg = finisher
					.startMessage()
					.setSender(this.app.botUser)
					.setUsernameAlias(this.app.kokoName)
					.setEmojiAvatar(this.app.kokoEmojiAvatar)
					.setRoom(room)
					.setText(highlightedText);

				const msgId = await finisher.finish(firstMsg);
				messageIds.push(msgId);

				// Then, the deadline/top‐level info (in thread)
				const infoMsg = finisher
					.startMessage()
					.setSender(this.app.botUser)
					.setRoom(room)
					.setText(`*Deadline:* ${formattedDate}\nReply below in the thread to submit your answer`)
					.setThreadId(msgId);

				await finisher.finish(infoMsg);
			}

			// Persist the sent message IDs and mark “sent”
			saved.msgIds = messageIds;
			saved.state = 'sent';
			await persistence.updateByAssociation(assoc, saved, true);
		} catch (err) {
			this.app.getLogger().error(`Error in ask-question processor: ${err.message}`);
		}
	}

	/**
	 * Collects and processes responses for a question
	 */
	public async collectResponses(read: IRead, persistence: IPersistence, questionId: string) {
		try {
			const assocQuestion = new RocketChatAssociationRecord(
				RocketChatAssociationModel.MISC,
				`asked_question_${questionId}`,
			);

			const responses = await read.getPersistenceReader().readByAssociation(assocQuestion);
			return responses;
		} catch (error) {
			this.app.getLogger().error(`Error collecting responses: ${error.message}`);
			return null;
		}
	}
}
