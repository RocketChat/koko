import { IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { SlashCommandContext } from '@rocket.chat/apps-engine/definition/slashcommands';
import { KokoApp } from '../KokoApp';
import { questionModal } from '../modals/QuestionModal';
import { hasValidRole, notifyUser } from '../lib/helpers';
import { getQuestionAskModal } from '../modals/QuestionAskModal';
import { IUser } from '@rocket.chat/apps-engine/definition/users';

// tslint:disable-next-line:max-line-length
enum QuestionSubcommand {
	REPOST = 'repost',
	INFO = 'info',
}

export async function processQuestionCommand(
	app: KokoApp,
	context: SlashCommandContext,
	read: IRead,
	modify: IModify,
	persistence: IPersistence,
): Promise<void> {
	const args = context.getArguments();
	const triggerId = context.getTriggerId();
	const sender = context.getSender();
	const room = context.getRoom();

	// Show question modal if no arguments provided
	if (args.length === 1 && triggerId) {
		return handleQuestionModal(app, context, read, modify, sender, triggerId);
	}

	const [_command, subcommand, ...params] = args;

	try {
		switch (subcommand?.toLowerCase()) {
			case QuestionSubcommand.REPOST:
				await handleRepost(app, read, modify, persistence, room, sender, params);
				break;

			case QuestionSubcommand.INFO:
				await handleInfo(app, read, modify, persistence, room, sender, params);
				break;

			default:
				await showHelp(app, modify, room, sender);
		}
	} catch (error) {
		app.getLogger().error('Error processing question command:', error);
		await notifyUser(app, modify, room, sender, `Error: ${error.message}`);
	}
}

async function handleRepost(
	app: KokoApp,
	read: IRead,
	modify: IModify,
	persistence: IPersistence,
	room: any,
	sender: IUser,
	params: string[],
): Promise<void> {
	const [questionId, roomName] = params;
	if (!questionId) {
		throw new Error('Please provide a question ID to repost');
	}

	const roomNameWithoutHash = roomName?.startsWith('#') ? roomName.substring(1) : roomName;
	const postRoomName = roomNameWithoutHash || room.slugifiedName;
	await app.kokoQuestionAsk.postAnswers(read, modify, persistence, questionId, postRoomName);
}

async function handleInfo(
	app: KokoApp,
	read: IRead,
	modify: IModify,
	persistence: IPersistence,
	room: any,
	sender: IUser,
	params: string[],
): Promise<void> {
	const questionText = params.join(' ');
	if (!questionText) {
		throw new Error('Please provide a question text to show its details');
	}

	await app.kokoQuestionAsk.showQuestionInfoByText(read, modify, persistence, questionText, room.id);
}

async function showHelp(app: KokoApp, modify: IModify, room: any, sender: IUser): Promise<void> {
	await notifyUser(
		app,
		modify,
		room,
		sender,
		'Available subcommands:\n' +
			'`/koko question` - Create a new question\n' +
			'`/koko question info <questionText>` - Show question details\n' +
			'`/koko question repost <questionId> [roomName]` - Repost question answers',
	);
}

async function handleQuestionModal(
	app: KokoApp,
	context: SlashCommandContext,
	read: IRead,
	modify: IModify,
	sender: IUser,
	triggerId: string,
): Promise<void> {
	try {
		if (await hasValidRole(read, sender.roles, app.managerRolesMap)) {
			const questionAskModal = getQuestionAskModal(app.getID());
			await modify.getUiController().openSurfaceView(questionAskModal, { triggerId }, sender);
			return;
		}
		const modal = await questionModal({ read, modify, data: { user: sender } });
		await modify.getUiController().openModalView(modal, { triggerId }, sender);
	} catch (error) {
		app.getLogger().error('Error opening question modal:', error);
		await notifyUser(app, modify, context.getRoom(), sender, 'Error opening question modal: ' + error.message);
	}
}
