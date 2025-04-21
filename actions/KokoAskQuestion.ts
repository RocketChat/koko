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

	/**
	 * Handles the submit action for the Ask Question modal
	 * Validates input and sends question to all members
	 */
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

		// Extract values from the correct state structure
		const questionText = state['question-input-block']?.['question-input-action'];
		const collectionDate = state['question-date-block']?.['question-date-action'];

		// Validate question
		if (!questionText?.trim()) {
			return context.getInteractionResponder().viewErrorResponse({
				viewId: data.view.id,
				errors: {
					'question-input-block': 'Please enter a question to ask',
				},
			});
		}

		try {
			// Get all members
			const members = await getMembers(this.app, read);
			if (!members || members.length === 0) {
				throw new Error('No members found to send the question to');
			}

			// Save question to persistence
			const questionData: QuestionPayload = {
				text: questionText,
				collectionDate,
				askedBy: data.user.id,
				timestamp: new Date().toISOString(),
				msgIds: [],
			};

			// maybe generate a unique hash for the question
			const questionId = Buffer.from(`${questionText}`, 'utf-8').toString('base64');

			const questionAssocId = `question_${questionId}`;
			const assocQuestion = new RocketChatAssociationRecord(RocketChatAssociationModel.MISC, questionAssocId);
			await persistence.updateByAssociation(assocQuestion, questionData, true);

			const messageIds: string[] = [];
			// Send question to each member
			for (const member of members) {
				if (member.id === this.app.botUser?.id) {
					continue;
				}

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

				const room = await getDirect(this.app, read, modify, member.username);
				if (room) {
					const formattedDate = formatDate(collectionDate);
					const highlightedText = `*${questionText}*`;

					// First message with the question
					const finisher = modify.getCreator();
					const msg = finisher
						.startMessage()
						.setSender(this.app.botUser)
						.setUsernameAlias(this.app.kokoName)
						.setEmojiAvatar(this.app.kokoEmojiAvatar)
						.setRoom(room)
						.setText(highlightedText);

					// Send the message
					const msgId = await finisher.finish(msg);

					messageIds.push(msgId);
					// Second message with formatted deadline info
					const infoMsg = finisher
						.startMessage()
						.setSender(this.app.botUser)
						.setRoom(room)
						.setText(`*Deadline:* ${formattedDate}\nReply in this thread to submit your answer`)
						.setThreadId(msgId);

					await finisher.finish(infoMsg);
				}
			}

			// Store the active question data
			questionData.msgIds = messageIds;

			await persistence.updateByAssociation(assocQuestion, questionData, true);

			// Show confirmation modal
			const modal = questionSubmittedModal(this.app.getID(), questionText);
			return context.getInteractionResponder().updateModalViewResponse(modal);
		} catch (error) {
			this.app.getLogger().error(`Error in ask question command: ${error.message}`);

			return context.getInteractionResponder().viewErrorResponse({
				viewId: data.view.id,
				errors: {
					'question-input-block': 'An error occurred while sending your question. Please try again.',
				},
			});
		}
	}

	/**
	 * Broadcasts a question to all members
	 */
	public async run(read: IRead, modify: IModify, persistence: IPersistence, question?: string) {
		if (!this.app.botUser || !this.app.kokoMembersRoom) {
			return;
		}

		try {
			const members = await getMembers(this.app, read);
			if (!members || members.length === 0) {
				throw new Error('No members found to send the question to');
			}

			const questionText = question || 'Default question text';

			// Send question to each member
			for (const member of members) {
				if (member.id === this.app.botUser.id) {
					continue;
				}

				const room = await getDirect(this.app, read, modify, member.username);
				if (room) {
					const blocks = createQuestionBlocks(modify, questionText);
					await sendMessage(this.app, modify, room, questionText, [], blocks);
				}
			}
		} catch (error) {
			this.app.getLogger().error(`Error in ask question run method: ${error.message}`);
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
