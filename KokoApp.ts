import { IAppAccessors, IConfigurationExtend, IConfigurationModify, IEnvironmentRead, IHttp, ILogger, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { ApiSecurity, ApiVisibility } from '@rocket.chat/apps-engine/definition/api';
import { App } from '@rocket.chat/apps-engine/definition/App';
import { IMessage, IPostMessageSent } from '@rocket.chat/apps-engine/definition/messages';
import { IAppInfo, RocketChatAssociationModel, RocketChatAssociationRecord } from '@rocket.chat/apps-engine/definition/metadata';
import { IRoom, RoomType } from '@rocket.chat/apps-engine/definition/rooms';
import { ISetting, SettingType } from '@rocket.chat/apps-engine/definition/settings';
import { IUser } from '@rocket.chat/apps-engine/definition/users';
import { KokoOneOnOne } from './actions/KokoOneOnOne';
import { KokoPraise } from './actions/KokoPraise';
import { KokoQuestion } from './actions/KokoQuestion';
import { KokoCommand } from './commands/KokoCommand';
import { OneOnOneEndpoint } from './endpoints/OneOnOneEndpoint';
import { PraiseEndpoint } from './endpoints/PraiseEndpoint';
import { QuestionEndpoint } from './endpoints/QuestionEndpoint';
import { IMembersCache } from './IMemberCache';
import { IListenStorage } from './storage/IListenStorage';

export class KokoApp extends App implements IPostMessageSent {
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
    public readonly kokoPraise: KokoPraise;

    /**
     * The question mechanism
     */
    public readonly kokoQuestion: KokoQuestion;

    /**
     * The random one on one mechanism
     */
    public readonly kokoOneOnOne: KokoOneOnOne;

    /**
     * Members cache
     */
    private membersCache: IMembersCache;

    /**
     * Members cache expire time
     * 300s
     */
    private MEMBERS_CACHE_EXPIRE: number = 300000;

    constructor(info: IAppInfo, logger: ILogger, accessors: IAppAccessors) {
        super(info, logger, accessors);
        this.kokoPraise = new KokoPraise(this);
        this.kokoQuestion = new KokoQuestion(this);
        this.kokoOneOnOne = new KokoOneOnOne(this);
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
            this.kokoMembersRoom = await this.getAccessors().reader.getRoomReader().getByName(this.kokoMembersRoomName) as IRoom;
        } else {
            return false;
        }
        this.kokoPostPraiseRoomName = await environmentRead.getSettings().getValueById('Post_Praise_Room_Name');
        if (this.kokoPostPraiseRoomName) {
            this.kokoPostPraiseRoom = await this.getAccessors().reader.getRoomReader().getByName(this.kokoPostPraiseRoomName) as IRoom;
        } else {
            return false;
        }
        this.kokoPostAnswersRoomName = await environmentRead.getSettings().getValueById('Post_Answers_Room_Name');
        if (this.kokoPostAnswersRoomName) {
            this.kokoPostAnswersRoom = await this.getAccessors().reader.getRoomReader().getByName(this.kokoPostAnswersRoomName) as IRoom;
        } else {
            return false;
        }
        this.botUsername = await environmentRead.getSettings().getValueById('Bot_Username');
        if (this.botUsername) {
            this.botUser = await this.getAccessors().reader.getUserReader().getByUsername(this.botUsername) as IUser;
        } else {
            return false;
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
    public async onSettingUpdated(setting: ISetting, configModify: IConfigurationModify, read: IRead, http: IHttp): Promise<void> {
        switch (setting.id) {
            case 'Members_Room_Name':
                this.kokoMembersRoomName = setting.value;
                if (this.kokoMembersRoomName) {
                    this.kokoMembersRoom = await this.getAccessors().reader.getRoomReader().getByName(this.kokoMembersRoomName) as IRoom;
                }
                break;
            case 'Post_Praise_Room_Name':
                this.kokoPostPraiseRoomName = setting.value;
                if (this.kokoPostPraiseRoomName) {
                    this.kokoPostPraiseRoom = await this.getAccessors().reader.getRoomReader().getByName(this.kokoPostPraiseRoomName) as IRoom;
                }
                break;
            case 'Post_Answers_Room_Name':
                this.kokoPostAnswersRoomName = setting.value;
                if (this.kokoPostAnswersRoomName) {
                    this.kokoPostAnswersRoom = await this.getAccessors().reader.getRoomReader().getByName(this.kokoPostAnswersRoomName) as IRoom;
                }
                break;
            case 'Bot_User':
                this.botUsername = setting.value;
                if (this.botUsername) {
                    this.botUser = await this.getAccessors().reader.getUserReader().getByUsername(this.botUsername) as IUser;
                }
                break;
        }
    }

    /**
     * We'll ignore any message that is not a direct message between bot and user
     *
     * @param message
     */
    public async checkPostMessageSent(message: IMessage): Promise<boolean> {
        // tslint:disable-next-line:max-line-length
        return this.botUser !== undefined && this.kokoPostPraiseRoom !== undefined && this.kokoPostAnswersRoom !== undefined && this.kokoMembersRoom !== undefined && message.room.type === RoomType.DIRECT_MESSAGE && message.sender.id !== this.botUser.id && message.room.id.indexOf(this.botUser.id) !== -1;
    }

    /**
     * Checks whether we are listening to username, praise or answer
     *
     * @param message
     * @param read
     * @param http
     * @param persistence
     * @param modify
     */
    public async executePostMessageSent(message: IMessage, read: IRead, http: IHttp, persistence: IPersistence, modify: IModify): Promise<void> {
        const association = new RocketChatAssociationRecord(RocketChatAssociationModel.USER, message.sender.id);
        const waitdata = await read.getPersistenceReader().readByAssociation(association);
        if (waitdata && waitdata.length > 0 && waitdata[0]) {
            const data = waitdata[0] as IListenStorage;
            const text = message.text as string;
            const room = message.room;
            const sender = message.sender;
            switch (data.listen) {
                case 'username':
                case 'praise':
                    await this.kokoPraise.answer({ data, text, room, sender, read, persistence, modify });
                    break;
                case 'answer':
                    await this.kokoQuestion.answer({ text, room, sender, persistence, modify });
                    break;
                case 'one-on-one':
                    await this.kokoOneOnOne.answer({ data, text, room, sender, read, persistence, modify });
                    break;
            }
        }
    }

    /**
     * Gets users of room defined by room id setting
     * Uses simple caching for avoiding repeated database queries
     *
     * @param context
     * @param read
     * @param modify
     * @param http
     * @param persis
     * @returns array of users
     */
    public async getMembers({ read }: { read: IRead }): Promise<Array<IUser>> {
        if (this.membersCache && this.membersCache.expire > Date.now()) {
            return this.membersCache.members;
        }
        let members;
        if (this.kokoMembersRoom) {
            try {
                members = await read.getRoomReader().getMembers(this.kokoMembersRoom.id);
            } catch (error) {
                console.log(error);
            }
            this.membersCache = { members, expire: Date.now() + this.MEMBERS_CACHE_EXPIRE };
        }
        return members || [];
    }

    /**
     * Gets a direct message room between bot and another user, creating if it doesn't exist
     *
     * @param context
     * @param read
     * @param modify
     * @param username
     * @returns the room
     */
    public async getDirect({ read, modify, username }: { read: IRead, modify: IModify, username: string }): Promise <IRoom | undefined > {
        const usernames = [this.botUsername, username];
        let room;
        try {
            room = await read.getRoomReader().getDirectByUsernames(usernames);
        } catch (error) {
            console.log(error);
        }

        if (room) {
            return room;
        } else if (this.botUser) {
            let roomId;
            const newRoom = modify.getCreator().startRoom()
                .setType(RoomType.DIRECT_MESSAGE)
                .setCreator(this.botUser)
                .setUsernames(usernames);
            roomId = await modify.getCreator().finish(newRoom);
            return await read.getRoomReader().getById(roomId);
        } else {
            return;
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
        await configuration.settings.provideSetting({
            id: 'Members_Room_Name',
            type: SettingType.STRING,
            packageValue: '',
            required: true,
            public: false,
            i18nLabel: 'Koko_Members_Room_Name',
            i18nDescription: 'Koko_Members_Room_Name_Description',
        });
        await configuration.settings.provideSetting({
            id: 'Post_Praise_Room_Name',
            type: SettingType.STRING,
            packageValue: '',
            required: true,
            public: false,
            i18nLabel: 'Koko_Post_Praise_Room_Name',
            i18nDescription: 'Koko_Post_Praise_Room_Name_Description',
        });
        await configuration.settings.provideSetting({
            id: 'Post_Answers_Room_Name',
            type: SettingType.STRING,
            packageValue: '',
            required: true,
            public: false,
            i18nLabel: 'Koko_Post_Answers_Room_Name',
            i18nDescription: 'Koko_Post_Answers_Room_Name_Description',
        });
        await configuration.settings.provideSetting({
            id: 'Bot_Username',
            type: SettingType.STRING,
            packageValue: 'rocket.cat',
            required: true,
            public: false,
            i18nLabel: 'Koko_Bot_Username',
            i18nDescription: 'Koko_Bot_Username_Description',
        });

        // API endpoints
        await configuration.api.provideApi({
            visibility: ApiVisibility.PRIVATE,
            security: ApiSecurity.UNSECURE,
            endpoints: [
                new PraiseEndpoint(this),
                new QuestionEndpoint(this),
                new OneOnOneEndpoint(this),
            ],
        });

        // Slash Commands
        await configuration.slashCommands.provideSlashCommand(new KokoCommand(this));
    }
}
