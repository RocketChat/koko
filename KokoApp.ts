import { IAppAccessors, IConfigurationExtend, IConfigurationModify, IEnvironmentRead, IHttp, ILogger, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { App } from '@rocket.chat/apps-engine/definition/App';
import { IMessage, IPostMessageSent } from '@rocket.chat/apps-engine/definition/messages';
import { IAppInfo, RocketChatAssociationModel, RocketChatAssociationRecord } from '@rocket.chat/apps-engine/definition/metadata';
import { RoomType } from '@rocket.chat/apps-engine/definition/rooms';
import { ISetting, SettingType } from '@rocket.chat/apps-engine/definition/settings';
import { IUser } from '@rocket.chat/apps-engine/definition/users';

import { KokoHelp } from './actions/KokoHelp';
import { KokoPraise } from './actions/KokoPraise';
import { KokoCommand } from './commands/KokoCommand';
import { IPraiseStorage } from './storage/PraiseStorage';

export class KokoApp extends App implements IPostMessageSent {
    public kokoName: string = 'Koko';
    public kokoEmojiAvatar: string = ':gorilla:';
    public kokoMembersRoomId: string;
    public kokoPostRoomId: string;
    public botUser: IUser;
    public readonly kokoHelp: KokoHelp;
    public readonly kokoPraise: KokoPraise;

    constructor(info: IAppInfo, logger: ILogger, accessors: IAppAccessors) {
        super(info, logger, accessors);
        this.kokoHelp = new KokoHelp(this);
        this.kokoPraise = new KokoPraise(this);
    }

    public async initialize(configurationExtend: IConfigurationExtend, environmentRead: IEnvironmentRead) {
        super.initialize(configurationExtend, environmentRead);
        this.botUser = await this.getAccessors().reader.getUserReader().getByUsername('rocket.cat');
    }

    public async onEnable(environmentRead: IEnvironmentRead, configModify: IConfigurationModify): Promise<boolean> {
        this.kokoMembersRoomId = await environmentRead.getSettings().getValueById('Members_Room_Id');
        this.kokoPostRoomId = await environmentRead.getSettings().getValueById('Post_Room_Id');
        return true;
    }

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

    public async checkPostMessageSent(message: IMessage): Promise<boolean> {
        // We'll ignore any message that is not a direct message between rocket.cat and user
        return message.room.type === RoomType.DIRECT_MESSAGE && message.sender.id !== 'rocket.cat' && message.room.id.indexOf('rocket.cat') !== -1;
    }

    public async executePostMessageSent(message: IMessage, read: IRead, http: IHttp, persistence: IPersistence): Promise<void> {
        const association = new RocketChatAssociationRecord(RocketChatAssociationModel.USER, message.sender.id);
        const waitdata = await read.getPersistenceReader().readByAssociation(association);
        console.log(waitdata);
        if (waitdata && waitdata.length > 0 && waitdata[0]) {
            const data = waitdata[0] as IPraiseStorage;
            if (data.listen === 'username' || data.listen === 'praise') {
                await this.kokoPraise.listen(data, message, read, persistence);
            }
        }
    }

    protected async extendConfiguration(configuration: IConfigurationExtend): Promise<void> {
        await configuration.slashCommands.provideSlashCommand(new KokoCommand(this));
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
    }
}
