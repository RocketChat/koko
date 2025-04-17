import {
	IAppAccessors,
	IConfigurationExtend,
	IConfigurationModify,
	IEnvironmentRead,
	IHttp,
	ILogger,
	IModify,
	IPersistence,
	IRead,
} from '@rocket.chat/apps-engine/definition/accessors';
import { ApiSecurity, ApiVisibility } from '@rocket.chat/apps-engine/definition/api';
import { App } from '@rocket.chat/apps-engine/definition/App';
import { IAppInfo } from '@rocket.chat/apps-engine/definition/metadata';
import { IRoom } from '@rocket.chat/apps-engine/definition/rooms';
import { StartupType } from '@rocket.chat/apps-engine/definition/scheduler';
import { ISetting } from '@rocket.chat/apps-engine/definition/settings';
import {
	IUIKitInteractionHandler,
	UIKitBlockInteractionContext,
	UIKitViewSubmitInteractionContext,
} from '@rocket.chat/apps-engine/definition/uikit';
import { IUser } from '@rocket.chat/apps-engine/definition/users';

import { KokoOneOnOne } from './actions/KokoOneOnOne';
import { KokoPraise } from './actions/KokoPraise';
import { KokoQuestion } from './actions/KokoQuestion';
import { KokoValues } from './actions/KokoValues';
import { KokoWellness } from './actions/KokoWellness';
import { KokoCommand } from './commands/KokoCommand';
import { OneOnOneEndpoint } from './endpoints/OneOnOneEndpoint';
import { PraiseEndpoint } from './endpoints/PraiseEndpoint';
import { QuestionEndpoint } from './endpoints/QuestionEndpoint';
import { ValuesEndpoint } from './endpoints/ValuesEndpoint';
import { WellnessEndpoint } from './endpoints/WellnessEndpoint';
import { MembersCache } from './MembersCache';
import { learnMoreModal } from './modals/LearnMoreModal';
import { praiseModal } from './modals/PraiseModal';
import { questionModal } from './modals/QuestionModal';
import { valuesModal } from './modals/ValuesModal';
import { settings } from './settings';
import { KokoSend } from './actions/KokoSend';
import { KokoAskQuestion } from './actions/KokoAskQuestion';

export class KokoApp extends App implements IUIKitInteractionHandler {
	/**
	 * The bot username alias
	 */
	public kokoName: string = 'Koko';

	/**
	 * The bot avatar
	 */
	public kokoEmojiAvatar: string = ':gorilla:';

	/**
	 * The room name where to get members from
	 */
	public kokoMembersRoomName: string;

	/**
	 * The actual room object where to get members from
	 */
	public kokoMembersRoom: IRoom;

	/**
	 * The room name where to post thanks messages to
	 */
	public kokoPostPraiseRoomName: string;

	/**
	 * The actual room object where to post thanks messages to
	 */
	public kokoPostPraiseRoom: IRoom;

	/**
	 * The room name where to post answers to
	 */
	public kokoPostAnswersRoomName: string;

	/**
	 * The actual room object where to post answers to
	 */
	public kokoPostAnswersRoom: IRoom;

	/**
	 * The bot username who sends the messages
	 */
	public botUsername: string;

	/**
	 * The bot user sending messages
	 */
	public botUser: IUser;

	/**
	 * The praise mechanism
	 */
	public kokoPraise: KokoPraise;

	/**
	 * The question mechanism
	 */
	public kokoQuestion: KokoQuestion;

	/**
	 * The question ask mechanism
	 */
	public kokoQuestionAsk: KokoAskQuestion;

	/**
	 * The values mechanism
	 */
	public kokoValues: KokoValues;

	/**
	 * The random one on one mechanism
	 */
	public kokoOneOnOne: KokoOneOnOne;

	/**
	 * The wellness mechanism
	 */
	public kokoWellness: KokoWellness;

	/**
	 * The send message mechanism
	 */
	public kokoSend: KokoSend;

	/**
	 * Members cache
	 */
	// tslint:disable-next-line:variable-name
	private _membersCache: MembersCache;

	public managerRolesMap: Map<string, string> = new Map();

	constructor(info: IAppInfo, logger: ILogger, accessors: IAppAccessors) {
		super(info, logger, accessors);
	}

	/**
	 * Sends a praise or answers a question
	 */
	public async executeViewSubmitHandler(
		context: UIKitViewSubmitInteractionContext,
		read: IRead,
		http: IHttp,
		persistence: IPersistence,
		modify: IModify,
	) {
		const data = context.getInteractionData();
		switch (data.view.id) {
			case 'praise':
				return this.kokoPraise.submit({ context, modify, read, persistence, http });
			case 'question':
				return this.kokoQuestion.submit({ context, modify, read, persistence });
			case 'values':
				return this.kokoValues.submit({ context, modify, read, persistence, http });
			case 'send':
				return this.kokoSend.submit({ context, modify, read, persistence, http });
			case 'question-ask-modal':
				return this.kokoQuestionAsk.submit({
					context,
					modify,
					read,
					persistence,
					http,
				});
		}
		return {
			success: true,
		};
	}

	/**
	 * Implements the click of a button
	 */
	public async executeBlockActionHandler(
		context: UIKitBlockInteractionContext,
		read: IRead,
		http: IHttp,
		persistence: IPersistence,
		modify: IModify,
	) {
		const data = context.getInteractionData();
		switch (data.actionId) {
			case 'praise': {
				const modal = await praiseModal({ app: this, data, read, modify });
				return context.getInteractionResponder().openModalViewResponse(modal);
			}
			case 'question': {
				const modal = await questionModal({ read, modify, data });
				return context.getInteractionResponder().openModalViewResponse(modal);
			}
			case 'values': {
				const modal = await valuesModal({ app: this, read, modify });
				return context.getInteractionResponder().openModalViewResponse(modal);
			}
			case 'learnMore': {
				const modal = await learnMoreModal({ app: this, read, modify, data });
				return context.getInteractionResponder().openModalViewResponse(modal);
			}
		}
		return {
			success: true,
		};
	}

	public async initialize(
		configurationExtend: IConfigurationExtend,
		environmentRead: IEnvironmentRead,
	): Promise<void> {
		this.kokoPraise = new KokoPraise(this);
		this.kokoQuestion = new KokoQuestion(this);
		this.kokoOneOnOne = new KokoOneOnOne(this);
		this.kokoWellness = new KokoWellness(this);
		this.kokoValues = new KokoValues(this);
		this.kokoSend = new KokoSend(this);
		this.kokoQuestionAsk = new KokoAskQuestion(this);

		await this.extendConfiguration(configurationExtend);
	}

	/**
	 * Loads the room where to get members from
	 * Loads the room where to post messages to
	 * Loads the user who'll be posting messages as the botUser
	 *
	 * @param environmentRead
	 * @param configModify
	 */
	public async onEnable(environmentRead: IEnvironmentRead, configModify: IConfigurationModify): Promise<boolean> {
		this.kokoMembersRoomName = await environmentRead.getSettings().getValueById('Members_Room_Name');
		if (this.kokoMembersRoomName) {
			this.kokoMembersRoom = (await this.getAccessors()
				.reader.getRoomReader()
				.getByName(this.kokoMembersRoomName)) as IRoom;
		}
		this.kokoPostPraiseRoomName = await environmentRead.getSettings().getValueById('Post_Praise_Room_Name');
		if (this.kokoPostPraiseRoomName) {
			this.kokoPostPraiseRoom = (await this.getAccessors()
				.reader.getRoomReader()
				.getByName(this.kokoPostPraiseRoomName)) as IRoom;
		}
		this.kokoPostAnswersRoomName = await environmentRead.getSettings().getValueById('Post_Answers_Room_Name');
		if (this.kokoPostAnswersRoomName) {
			this.kokoPostAnswersRoom = (await this.getAccessors()
				.reader.getRoomReader()
				.getByName(this.kokoPostAnswersRoomName)) as IRoom;
		}
		this.botUsername = await environmentRead.getSettings().getValueById('Bot_Username');
		if (this.botUsername) {
			this.botUser = (await this.getAccessors().reader.getUserReader().getByUsername(this.botUsername)) as IUser;
		}

		// Reconfigure the managerRolesMap
		const accessRolesSetting = await environmentRead.getSettings().getValueById('Access_Roles');
		if (accessRolesSetting) {
			await this.updateRolesMap(accessRolesSetting, this.getAccessors().reader);
		}
		return true;
	}

	/**
	 * Updates room ids for members and messages when settings are updated
	 *
	 * @param setting
	 * @param configModify
	 * @param read
	 * @param http
	 */
	public async onSettingUpdated(
		setting: ISetting,
		configModify: IConfigurationModify,
		read: IRead,
		http: IHttp,
	): Promise<void> {
		switch (setting.id) {
			case 'Members_Room_Name':
				this.kokoMembersRoomName = setting.value;
				if (this.kokoMembersRoomName) {
					this.kokoMembersRoom = (await read.getRoomReader().getByName(this.kokoMembersRoomName)) as IRoom;
				}
				break;
			case 'Post_Praise_Room_Name':
				this.kokoPostPraiseRoomName = setting.value;
				if (this.kokoPostPraiseRoomName) {
					this.kokoPostPraiseRoom = (await read
						.getRoomReader()
						.getByName(this.kokoPostPraiseRoomName)) as IRoom;
				}
				break;
			case 'Post_Answers_Room_Name':
				this.kokoPostAnswersRoomName = setting.value;
				if (this.kokoPostAnswersRoomName) {
					this.kokoPostAnswersRoom = (await read
						.getRoomReader()
						.getByName(this.kokoPostAnswersRoomName)) as IRoom;
				}
				break;
			case 'Bot_User':
				this.botUsername = setting.value;
				if (this.botUsername) {
					this.botUser = (await read.getUserReader().getByUsername(this.botUsername)) as IUser;
				}
				break;
			case 'Access_Roles': {
				await this.updateRolesMap(setting.value, read);
				break;
			}
		}
	}

	/**
	 * Provides a setting for room id where to get members from
	 * Provides a setting for room id where to post messages to
	 * Provides an API for activating the praise mechanism
	 *
	 * @param configuration
	 */
	protected async extendConfiguration(configuration: IConfigurationExtend): Promise<void> {
		// Settings
		await Promise.all(settings.map((setting) => configuration.settings.provideSetting(setting)));

		// API endpoints
		await configuration.api.provideApi({
			visibility: ApiVisibility.PRIVATE,
			security: ApiSecurity.UNSECURE,
			endpoints: [
				new PraiseEndpoint(this),
				new QuestionEndpoint(this),
				new OneOnOneEndpoint(this),
				new WellnessEndpoint(this),
				new ValuesEndpoint(this),
			],
		});

		// Slash Commands
		await configuration.slashCommands.provideSlashCommand(new KokoCommand(this));

		// Scheduler
		configuration.scheduler.registerProcessors([
			{
				id: 'praise',
				startupSetting: {
					type: StartupType.RECURRING,
					interval: '15 14 * * 1',
					data: { appId: this.getID() },
				},
				processor: async (jobContext, read, modify, http, persistence) => {
					await this.kokoPraise.run(
						read,
						modify,
						persistence,
						undefined,
						undefined,
						this.kokoPraise.sendScore ? 'praisers' : undefined,
					);
					this.kokoPraise.sendScore = !this.kokoPraise.sendScore;
				},
			},
			{
				id: 'question',
				startupSetting: {
					type: StartupType.RECURRING,
					interval: '0 15 * * 1,4',
					data: { appId: this.getID() },
				},
				processor: async (jobContext, read, modify, http, persistence) => {
					await this.kokoQuestion.run(read, modify, persistence);
				},
			},
			{
				id: 'one-on-one',
				startupSetting: {
					type: StartupType.RECURRING,
					interval: '0 17 * * 4',
					data: { appId: this.getID() },
				},
				processor: async (jobContext, read, modify, http, persistence) => {
					await this.kokoOneOnOne.run(read, modify, persistence);
				},
			},
			{
				id: 'welness',
				startupSetting: {
					type: StartupType.RECURRING,
					interval: '0 13 * * 1,3,5',
					data: { appId: this.getID() },
				},
				processor: async (jobContext, read, modify, http, persistence) => {
					await this.kokoWellness.run(read, modify, persistence);
				},
			},
			{
				id: 'values',
				startupSetting: {
					type: StartupType.RECURRING,
					interval: '0 16 * * 5',
					data: { appId: this.getID() },
				},
				processor: async (jobContext, read, modify, http, persistence) => {
					await this.kokoValues.run(read, modify, persistence);
				},
			},
		]);
	}

	get membersCache(): MembersCache {
		return this._membersCache;
	}

	set membersCache(memberCache: MembersCache) {
		this._membersCache = memberCache;
	}

	/**
	 * Helper to update roles map based on a setting value
	 */
	private async updateRolesMap(rolesString: string, read: IRead): Promise<void> {
		const roles = rolesString.split(',').map((role) => role.trim());
		if (roles.length === 0) {
			this.getLogger().warn('No roles provided in the Access_Roles setting.');
			return;
		}

		// Clear the previous roles
		this.managerRolesMap.clear();
		this.getLogger().info('Cleared existing manager roles map.');

		// Populate the roles map
		for (const role of roles) {
			try {
				const roleDetails = await read.getRoleReader().getOneByIdOrName(role, this.getID());
				if (roleDetails) {
					this.managerRolesMap.set(roleDetails.id, roleDetails.name);
					this.getLogger().info(`Role added: ${roleDetails.name} (ID: ${roleDetails.id})`);
				} else {
					this.getLogger().warn(`Role not found: ${role}`);
				}
			} catch (error) {
				this.getLogger().error(`Error fetching role details for "${role}": ${error.message}`);
			}
		}

		this.getLogger().info(`Manager roles map updated with ${this.managerRolesMap.size} roles.`);
	}
}
