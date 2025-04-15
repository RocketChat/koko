import { IModify, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { IMessageAttachment } from '@rocket.chat/apps-engine/definition/messages';
import { IRoom, RoomType } from '@rocket.chat/apps-engine/definition/rooms';
import { BlockBuilder } from '@rocket.chat/apps-engine/definition/uikit';
import { IUser } from '@rocket.chat/apps-engine/definition/users';

import { KokoApp } from '../KokoApp';
import { MembersCache } from '../MembersCache';

/**
 * Copied from underscore
 *
 * @param min
 * @param max
 */
export function random(min: number, max: number): number {
	if (max == null) {
		max = min;
		min = 0;
	}
	return min + Math.floor(Math.random() * (max - min + 1));
}

/**
 * Gets a direct message room between bot and another user, creating if it doesn't exist
 *
 * @param app KokoApp
 * @param read
 * @param modify
 * @param username the username to create a direct with bot
 * @returns the room or undefined if botUser or botUsername is not set
 */
export async function getDirect(
	app: KokoApp,
	read: IRead,
	modify: IModify,
	username: string,
): Promise<IRoom | undefined> {
	if (app.botUsername) {
		const usernames = [app.botUsername, username];
		let room;
		try {
			room = await read.getRoomReader().getDirectByUsernames(usernames);
		} catch (error) {
			app.getLogger().log(error);
			return;
		}

		if (room) {
			return room;
		} else if (app.botUser) {
			let roomId;

			// Create direct room between botUser and username
			const newRoom = modify
				.getCreator()
				.startRoom()
				.setType(RoomType.DIRECT_MESSAGE)
				.setCreator(app.botUser)
				.setUsernames(usernames);
			roomId = await modify.getCreator().finish(newRoom);
			return await read.getRoomReader().getById(roomId);
		}
	}
	return;
}

/**
 * Gets users of room defined by room id setting
 * Uses simple caching for avoiding repeated database queries
 *
 * @param app
 * @param read
 * @returns array of users
 */
export async function getMembers(app: KokoApp, read: IRead): Promise<Array<IUser>> {
	// Gets cached members if expire date is still valid
	if (app.membersCache && app.membersCache.isValid()) {
		return app.membersCache.members;
	}
	let members;
	if (app.kokoMembersRoom) {
		try {
			members = await read.getRoomReader().getMembers(app.kokoMembersRoom.id);
		} catch (error) {
			app.getLogger().log(error);
		}
		app.membersCache = new MembersCache(members);
	}
	return members.filter((member) => member.username !== 'rocket.cat' && member.username !== app.botUsername) || [];
}

/**
 * Sends a message using bot
 *
 * @param app
 * @param modify
 * @param room Where to send message to
 * @param message What to send
 * @param attachments (optional) Message attachments (such as action buttons)
 */
export async function sendMessage(
	app: KokoApp,
	modify: IModify,
	room: IRoom,
	message?: string,
	attachments?: Array<IMessageAttachment>,
	blocks?: BlockBuilder,
): Promise<void> {
	const msg = modify
		.getCreator()
		.startMessage()
		.setGroupable(false)
		.setSender(app.botUser)
		.setUsernameAlias(app.kokoName)
		.setEmojiAvatar(app.kokoEmojiAvatar)
		.setRoom(room);
	if (message && message.length > 0) {
		msg.setText(message);
	}
	if (attachments && attachments.length > 0) {
		msg.setAttachments(attachments);
	}
	if (blocks !== undefined) {
		msg.setBlocks(blocks);
	}
	try {
		await modify.getCreator().finish(msg);
	} catch (error) {
		app.getLogger().log(error);
	}
}

/**
 * Notifies user using bot
 *
 * @param app
 * @param modify
 * @param user Who to notify
 * @param message What to send
 * @param attachments (optional) Message attachments (such as action buttons)
 */
export async function notifyUser(
	app: KokoApp,
	modify: IModify,
	room: IRoom,
	user: IUser,
	message: string,
	attachments?: Array<IMessageAttachment>,
): Promise<void> {
	const msg = modify
		.getCreator()
		.startMessage()
		.setSender(app.botUser)
		.setUsernameAlias(app.kokoName)
		.setEmojiAvatar(app.kokoEmojiAvatar)
		.setText(message)
		.setRoom(room)
		.getMessage();
	try {
		await modify.getNotifier().notifyUser(user, msg);
	} catch (error) {
		app.getLogger().log(error);
	}
}

/**
 * Checks if a user has at least one of the required roles.
 * @param read - The IRead instance to access the environment settings.
 * @param roles - The roles to check against the allowed roles.
 * @returns {boolean} - True if the user has one of the allowed roles, otherwise false.
 */
export const hasValidRole = async (
	read: IRead,
	roles: string[],
	allowedRoles: Map<string, string>,
): Promise<boolean> => {
	// Check if the user has at least one of the allowed roles
	for (const role of roles) {
		if (allowedRoles.has(role)) {
			return true;
		}
	}

	// If no allowed roles are found, return false
	return false;
};
