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
			const sendTime = new Date().setSeconds(new Date().getSeconds() + 60);

			this.app
				.getLogger()
				.info(`Scheduling question "${questionText}" for ${sendTime}; current time is ${new Date()}`);

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
			this.app.getLogger().debug(`ask-question processor: ${questionAssocId}`);
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

			this.app.getLogger().debug(`ask-question processor: members ${members.length}`);
			const messageIds: string[] = [];
			const finisher = modify.getCreator();

			for (const member of members) {
				if (member.id === this.app.botUser.id) {
					continue;
				}
				const room = await getDirect(this.app, read, modify, member.username);
				if (!room) {
					this.app.getLogger().error(`ask-question processor: no room for ${member.username}`);
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

				try {
					const msgId = await finisher.finish(firstMsg);
					messageIds.push(msgId);

					this.app
						.getLogger()
						.debug(`ask-question processor: sent question to ${member.username} (${msgId})`);
					// Then, the deadline/top‐level info (in thread)
					const infoMsg = finisher
						.startMessage()
						.setSender(this.app.botUser)
						.setRoom(room)
						.setUsernameAlias(this.app.kokoName)
						.setEmojiAvatar(this.app.kokoEmojiAvatar)
						.setText(`*Deadline:* ${formattedDate}\nReply below in the thread to submit your answer`)
						.setThreadId(msgId);

					await finisher.finish(infoMsg);
				} catch (error) {
					this.app
						.getLogger()
						.error(`ask-question processor: error sending message to ${member.username}`, error);
					continue;
				}
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
			this.app.getLogger().error(`Error in ask-question processor`, err);
		}
	}

	/**
	 * Scheduler processor for "post-answers":
	 *  1) Load the QuestionPayload, including saved.msgIds[]
	 *  2) For each thread (msgId) fetch all replies
	 *  3) Build a per‑reply link: https://<server>/direct/<roomId>?msg=<msgId>
	 *  4) Post into your configured answers room: first the question, then all links in a thread
	 */
	public async postAnswers(
		read: IRead,
		modify: IModify,
		persistence: IPersistence,
		questionAssocId: string,
		roomName?: string,
	) {
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
			const answerRoomName =
				roomName ||
				((await read.getEnvironmentReader().getSettings().getValueById('Post_Answers_Room_Name')) as string);

			// remove trailing slash
			const trimmedServerUrl = serverUrl.replace(/\/$/, '');

			const answerRoom = await read.getRoomReader().getByName(answerRoomName);
			if (!answerRoom) {
				throw new Error(`postAnswers: could not find room "${answerRoomName}"`);
			}
			this.app.getLogger().debug(`postAnswers: posting to ${answerRoomName} (${answerRoom.id})`);

			const finisher = modify.getCreator();

			// Collect all responses concurrently
			const collected = await Promise.all(
				msgIds.map(async (threadId) => {
					try {
						const responseAssoc = new RocketChatAssociationRecord(
							RocketChatAssociationModel.MISC,
							`response_${threadId}`,
						);
						const [savedResp] = (await read
							.getPersistenceReader()
							.readByAssociation(responseAssoc)) as ResponsePayload[];
						if (!savedResp) {
							this.app.getLogger().debug(`postAnswers: no saved response for ${threadId}`);
							return null;
						}
						const { roomId: rid, msgId: mid, userId } = savedResp;
						const [replyUser, replyMsg] = await Promise.all([
							read.getUserReader().getById(userId),
							read.getMessageReader().getById(mid),
						]);
						if (!replyUser) {
							this.app.getLogger().debug(`postAnswers: no user for ${userId}`);
							return null;
						}
						const createdAt = replyMsg?.createdAt
							? new Date(replyMsg.createdAt).getTime()
							: Number.MAX_SAFE_INTEGER;
						return {
							username: replyUser.username || 'user',
							link: `${trimmedServerUrl}/direct/${rid}?msg=${mid}`,
							createdAt,
						};
					} catch (e) {
						this.app.getLogger().debug(`postAnswers: error collecting for ${threadId}: ${e.message}`);
						return null;
					}
				}),
			);

			// Single pass: build responses and compute earliest
			const responses: Array<{ username: string; link: string; createdAt: number }> = [];
			let earliest: { username: string; link: string; createdAt: number } | null = null;
			for (const entry of collected) {
				if (!entry) {
					continue;
				}
				responses.push(entry);
				if (!earliest || entry.createdAt < earliest.createdAt) {
					earliest = entry;
				}
			}

			const responseCount = responses.length;

			// Send question header as standalone message
			let questionHeader = `** ${questionText} **\n\n`;
			if (responseCount === 0) {
				questionHeader += `_No responses received._`;
			} else {
				const responseWord = responseCount === 1 ? 'response' : 'responses';
				const photosPhrase = responseCount === 1 ? 'the photo' : 'all the photos';
				questionHeader += `_${responseCount} ${responseWord} received… and you won’t believe what’s inside. Open the thread to see ${photosPhrase}! 👀_`;
			}

			const questionMsg = finisher
				.startMessage()
				.setRoom(answerRoom)
				.setText(questionHeader)
				.setUsernameAlias(this.app.kokoName)
				.setSender(this.app.botUser)
				.setEmojiAvatar(this.app.kokoEmojiAvatar);
			const questionMsgId = await finisher.finish(questionMsg);

			// Send first response in main room: earliest by createdAt
			if (responses.length > 0 && earliest) {
				const firstResponse = earliest;
				const firstResponseMsg = finisher
					.startMessage()
					.setRoom(answerRoom)
					.setText(`[**${firstResponse.username}**](${firstResponse.link})`)
					.setUsernameAlias(this.app.kokoName)
					.setSender(this.app.botUser)
					.setEmojiAvatar(this.app.kokoEmojiAvatar);
				await finisher.finish(firstResponseMsg);

				// Send ALL responses in thread under the question (including the first one)
				await Promise.all(
					responses.map((response) =>
						finisher.finish(
							finisher
								.startMessage()
								.setRoom(answerRoom)
								.setText(`[**${response.username}**](${response.link})`)
								.setUsernameAlias(this.app.kokoName)
								.setSender(this.app.botUser)
								.setEmojiAvatar(this.app.kokoEmojiAvatar)
								.setThreadId(questionMsgId),
						),
					),
				);
			}

			// Mark the question "closed" in persistence
			saved.state = 'closed';
			await persistence.updateByAssociation(assoc, saved, true);
		} catch (err) {
			this.app.getLogger().error(`postAnswers error: ${err.message}`);
		}
	}

	public async showQuestionInfoByText(
		read: IRead,
		modify: IModify,
		persistence: IPersistence,
		text: string,
		roomId: string,
	): Promise<void> {
		const questionId = Buffer.from(text, 'utf-8').toString('base64');
		const questionAssocId = `question_${questionId}`;
		const assoc = new RocketChatAssociationRecord(RocketChatAssociationModel.MISC, questionAssocId);
		const [saved] = (await read.getPersistenceReader().readByAssociation(assoc)) as QuestionPayload[];

		if (!saved) {
			throw new Error(`No question found for ${text}`);
		}

		const roomInfo = await read.getRoomReader().getById(roomId);
		if (!roomInfo) {
			this.app.getLogger().error(`No room found for ${roomId}`);
			return;
		}

		const finisher = modify.getCreator();
		const formattedData = JSON.stringify(saved, null, 2);

		const message = finisher
			.startMessage()
			.setSender(this.app.botUser)
			.setUsernameAlias(this.app.kokoName)
			.setEmojiAvatar(this.app.kokoEmojiAvatar)
			.setRoom(roomInfo)
			.setText(`*Question Data (\`${questionAssocId}\`):*\n\`\`\`\n${formattedData}\n\`\`\``);

		await finisher.finish(message);
	}
}
