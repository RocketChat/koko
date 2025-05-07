import { IMessage } from '@rocket.chat/apps-engine/definition/messages';
import { IUser } from '@rocket.chat/apps-engine/definition/users';
import { RocketChatAssociationModel, RocketChatAssociationRecord } from '@rocket.chat/apps-engine/definition/metadata';
import { IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { QuestionPayload } from '../types/AskQuestion';

export class AskQuestionHelper {
	/**
	 * Checks if the message is intended for the bot and eligible for processing.
	 *
	 * @param message - The message to check.
	 * @param appUser - The bot user associated with the app.
	 * @returns True if the message is eligible, false otherwise.
	 */
	public static isMessageIntendedForBot(message: IMessage, appUser: IUser | undefined): boolean {
		return !!(
			message.threadId && // Ensure the message is part of a thread
			appUser && // Ensure the app user is defined
			message.sender.id !== appUser.id && // Exclude messages sent by the bot itself
			message.room.userIds?.includes(appUser.id) && // Ensure the bot is part of the room
			!message.sender.roles?.includes('bot') && // Exclude messages sent by other bots
			!message.sender.roles?.includes('app') // Exclude messages sent by other apps
		);
	}

	/**
	 * Validates the parent message.
	 *
	 * @param parentMessage - The parent message to validate.
	 * @param botUserId - The bot user's ID.
	 * @returns True if the parent message is valid, false otherwise.
	 */
	public static isParentMessageValid(parentMessage: IMessage | undefined, botUserId: string): boolean {
		return !!(parentMessage && parentMessage.text && parentMessage.sender.id === botUserId);
	}

	/**
	 * Parses the message text to remove bold formatting.
	 *
	 * @param text - The text to parse.
	 * @returns The parsed text.
	 */
	public static parseMessageText(text: string): string {
		return text.replace(/^\*+|\*+$/g, '').trim();
	}

	/**
	 * Generates a question ID based on the parsed text.
	 *
	 * @param parsedText - The parsed text of the question.
	 * @returns The generated question ID.
	 */
	public static generateQuestionId(parsedText: string): string {
		const questionEncoded = Buffer.from(parsedText, 'utf-8').toString('base64');
		return `question_${questionEncoded}`;
	}

	/**
	 * Fetches question associations from persistence.
	 *
	 * @param read - The IRead accessor.
	 * @param questionId - The question ID to fetch associations for.
	 * @returns A promise resolving to an array of QuestionPayload.
	 */
	public static async getQuestionAssociations(read: IRead, questionId: string): Promise<QuestionPayload[]> {
		return (await read
			.getPersistenceReader()
			.readByAssociation(
				new RocketChatAssociationRecord(RocketChatAssociationModel.MISC, questionId),
			)) as QuestionPayload[];
	}

	/**
	 * Checks if the question date has expired.
	 *
	 * @param questionDate - The date of the question.
	 * @returns True if the question date has expired, false otherwise.
	 */
	public static isQuestionExpired(questionDate: Date): boolean {
		return new Date() > questionDate;
	}
}
