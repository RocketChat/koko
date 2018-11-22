import { IAppAccessors, IConfigurationExtend, IConfigurationModify, IEnvironmentRead, IHttp, ILogger, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { ApiSecurity, ApiVisibility } from '@rocket.chat/apps-engine/definition/api';
import { App } from '@rocket.chat/apps-engine/definition/App';
import { IMessage, IPostMessageSent } from '@rocket.chat/apps-engine/definition/messages';
import { IAppInfo, RocketChatAssociationModel, RocketChatAssociationRecord } from '@rocket.chat/apps-engine/definition/metadata';
import { RoomType } from '@rocket.chat/apps-engine/definition/rooms';
import { ISetting, SettingType } from '@rocket.chat/apps-engine/definition/settings';
import { IUser } from '@rocket.chat/apps-engine/definition/users';
import { KokoPraise } from './actions/KokoPraise';
import { PraiseEndpoint } from './endpoints/PraiseEndpoint';
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

    constructor(info: IAppInfo, logger: ILogger, accessors: IAppAccessors) {
        super(info, logger, accessors);
        this.kokoPraise = new KokoPraise(this);
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
            if (data.listen === 'username' || data.listen === 'praise') {
                await this.kokoPraise.listen(data, message, read, persistence, modify);
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
            ],
        });
    }
}
