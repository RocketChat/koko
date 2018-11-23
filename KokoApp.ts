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
import { OneOnOneEndpoint } from './endpoints/OneOnOneEndpoint';
import { PraiseEndpoint } from './endpoints/PraiseEndpoint';
import { IMembersCache } from './IMemberCache';
import { IPraiseStorage } from './storage/IPraiseStorage';

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
     * The room id where to get members from
     */
    public kokoMembersRoomId: string;

    /**
     * The room id where to post thanks messages to
     */
    public kokoPostRoomId: string;

    /**
     * The bot user sending messages
     */
    public botUser: IUser;

    /**
     * The praise mechanism
     */
    public readonly kokoPraise: KokoPraise;

    /**
     * The random one on one mechanism
     */
    public readonly kokoOneOnOne: KokoOneOnOne;

    /**
     * Members cache
     */
    private membersCache: IMembersCache;

    constructor(info: IAppInfo, logger: ILogger, accessors: IAppAccessors) {
        super(info, logger, accessors);
        this.kokoPraise = new KokoPraise(this);
        this.kokoOneOnOne = new KokoOneOnOne(this);
    }

    /**
     * Loads the room id where to get members from
     * Loads the room id where to post messages to
     * Loads the user who'll be posting messages as the botUser
     *
     * @param environmentRead
     * @param configModify
     */
    public async onEnable(environmentRead: IEnvironmentRead, configModify: IConfigurationModify): Promise<boolean> {
        this.kokoMembersRoomId = await environmentRead.getSettings().getValueById('Members_Room_Id');
        this.kokoPostRoomId = await environmentRead.getSettings().getValueById('Post_Room_Id');
        this.botUser = await this.getAccessors().reader.getUserReader().getByUsername('rocket.cat');
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
            case 'Members_Room_Id':
                this.kokoMembersRoomId = setting.value;
                break;
            case 'Post_Room_Id':
                this.kokoPostRoomId = setting.value;
                break;
        }
    }

    /**
     * We'll ignore any message that is not a direct message between rocket.cat and user
     *
     * @param message
     */
    public async checkPostMessageSent(message: IMessage): Promise<boolean> {
        return message.room.type === RoomType.DIRECT_MESSAGE && message.sender.id !== 'rocket.cat' && message.room.id.indexOf('rocket.cat') !== -1;
    }

    /**
     * Checks whether we are listening to username or praise
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
            const data = waitdata[0] as IPraiseStorage;
            switch (data.listen) {
                case 'username':
                case 'praise':
                    await this.kokoPraise.listen(data, message, read, persistence, modify);
                    break;
                case 'one-on-one':
                    await this.kokoOneOnOne.listen(data, message, read, persistence, modify);
                    break;
            }
        }
    }

    /**
     * Gets users of room defined by room id setting
     * Uses simple caching (30s) for avoiding repeated database queries
     *
     * @param context
     * @param read
     * @param modify
     * @param http
     * @param persis
     * @returns array of users
     */
    public async getMembers(read: IRead): Promise<Array<IUser>> {
        if (this.membersCache && this.membersCache.expire > Date.now()) {
            return this.membersCache.members;
        }
        let members;
        try {
            members = await read.getRoomReader().getMembers(this.kokoMembersRoomId);
        } catch (error) {
            console.log(error);
        }
        this.membersCache = { members, expire: Date.now() + 30000 };
        return members;
    }

    /**
     * Gets a direct message room between rocket.cat and another user, creating if it doesn't exist
     *
     * @param context
     * @param read
     * @param modify
     * @param username
     * @returns the room
     */
    public async getDirect(read: IRead, modify: IModify, username: string): Promise <IRoom | undefined > {
        const usernames = ['rocket.cat', username];
        let room;
        try {
            room = await read.getRoomReader().getDirectByUsernames(usernames);
        } catch (error) {
            console.log(error);
        }

        if (room) {
            return room;
        } else {
            let roomId;
            const newRoom = modify.getCreator().startRoom()
                .setType(RoomType.DIRECT_MESSAGE)
                .setCreator(this.botUser)
                .setUsernames(usernames);
            roomId = await modify.getCreator().finish(newRoom);
            return await read.getRoomReader().getById(roomId);
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
        await configuration.settings.provideSetting({
            id: 'Members_Room_Id',
            type: SettingType.STRING,
            packageValue: '',
            required: true,
            public: false,
            i18nLabel: 'Koko_Members_Room_Id',
            i18nDescription: 'Koko_Members_Room_Id_Description',
        });
        await configuration.settings.provideSetting({
            id: 'Post_Room_Id',
            type: SettingType.STRING,
            packageValue: '',
            required: true,
            public: false,
            i18nLabel: 'Koko_Post_Room_Id',
            i18nDescription: 'Koko_Post_Room_Id_Description',
        });
        await configuration.api.provideApi({
            visibility: ApiVisibility.PRIVATE,
            security: ApiSecurity.UNSECURE,
            endpoints: [
                new PraiseEndpoint(this),
                new OneOnOneEndpoint(this),
            ],
        });
    }
}
