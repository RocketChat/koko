import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { UIKitViewSubmitInteractionContext } from '@rocket.chat/apps-engine/definition/uikit';
import { RocketChatAssociationModel, RocketChatAssociationRecord } from '@rocket.chat/apps-engine/definition/metadata';

import { KokoApp } from '../KokoApp';
import { getDirect, getMembers, sendMessage } from '../lib/helpers';
import { questionSubmittedModal } from '../modals/QuestionAskModal';
import { createQuestionBlocks } from '../blocks/QuestionBlocks';
import { QuestionPayload, ResponsePayload } from '../types/AskQuestion';

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
					'question-input-action': 'Please enter a question to ask',
				},
			});
		}

		// Check if the date is valid and in the future
		const today = new Date();

		if (!collectionDate || new Date(collectionDate) < today) {
			return context.getInteractionResponder().viewErrorResponse({
				viewId: data.view.id,
				errors: {
					'question-input-action': 'Please select a valid date in the future',
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

			const postCollectionDate = new Date(collectionDate);

			await modify.getScheduler().scheduleOnce({
				id: 'post-answers',
				when: postCollectionDate,
				data: { questionAssocId },
			});
		} catch (err) {
			this.app.getLogger().error(`Error in ask-question processor: ${err.message}`);
		}
	}

	/**
	 * Scheduler processor for "post-answers":
	 *  1) Load the QuestionPayload, including saved.msgIds[]
	 *  2) For each thread (msgId) fetch all replies
	 *  3) Build a per‑reply link: https://<server>/direct/<roomId>?msg=<msgId>
	 *  4) Post into your configured answers room: first the question, then all links in a thread
	 */
	public async postAnswers(read: IRead, modify: IModify, persistence: IPersistence, questionAssocId: string) {
		try {
			// Load question record
			const assoc = new RocketChatAssociationRecord(RocketChatAssociationModel.MISC, questionAssocId);
			const [saved] = (await read.getPersistenceReader().readByAssociation(assoc)) as QuestionPayload[];
			if (!saved) {
				throw new Error(`postAnswers: no question for ${questionAssocId}`);
			}

			const { text: questionText, msgIds } = saved;
			if (!msgIds || msgIds.length === 0) {
				throw new Error(`postAnswers: no msgIds to collect from`);
			}

			// Grab server URL and the answer room name from settings
			const serverUrl = (await read
				.getEnvironmentReader()
				.getServerSettings()
				.getValueById('Site_Url')) as string;
			const answerRoomName = (await read
				.getEnvironmentReader()
				.getSettings()
				.getValueById('Post_Answers_Room_Name')) as string;

			// remove trailing slash
			const trimmedServerUrl = serverUrl.replace(/\/$/, '');

			const answerRoom = await read.getRoomReader().getByName(answerRoomName);
			if (!answerRoom) {
				throw new Error(`postAnswers: could not find room "${answerRoomName}"`);
			}

			const finisher = modify.getCreator();

			// Post the question as a new message in the answers room
			const first = finisher
				.startMessage()
				.setRoom(answerRoom)
				.setText(`*Question:* ${questionText}`)
				.setUsernameAlias(this.app.kokoName)
				.setEmojiAvatar(this.app.kokoEmojiAvatar);
			const firstId = await finisher.finish(first);

			// For each original question‐msgId, fetch its recorded replies
			const linkLines: string[] = [];
			for (const threadId of msgIds) {
				// read from the persistence
				const assoc = new RocketChatAssociationRecord(RocketChatAssociationModel.MISC, `response_${threadId}`);
				const [saved] = (await read.getPersistenceReader().readByAssociation(assoc)) as ResponsePayload[];
				if (!saved) {
					this.app.getLogger().error(`postAnswers: no response for ${threadId}`);
					continue;
				}
				const { roomId: rid, msgId: mid, userId } = saved;
				const reply = await read.getUserReader().getById(userId);
				if (!reply) {
					this.app.getLogger().error(`postAnswers: no user for ${userId}`);
					continue;
				}

				// Build the link to the reply
				linkLines.push(`• [${reply.username || 'user'}](${trimmedServerUrl}/direct/${rid}?msg=${mid})`);
			}

			if (linkLines.length === 0) {
				linkLines.push('_No answers submitted._');
			}

			// Post all of the links as a threaded reply under `firstId`
			const threadMsg = finisher
				.startMessage()
				.setRoom(answerRoom)
				.setThreadId(firstId)
				.setText(linkLines.join('\n'));
			await finisher.finish(threadMsg);

			//  Optionally mark the question "closed" in persistence
			saved.state = 'closed';
			await persistence.updateByAssociation(assoc, saved, true);
		} catch (err) {
			this.app.getLogger().error(`postAnswers error: ${err.message}`);
		}
	}
}
