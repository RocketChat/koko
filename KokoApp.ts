import { IConfigurationExtend, IConfigurationModify, IEnvironmentRead, IHttp, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { App } from '@rocket.chat/apps-engine/definition/App';
import { IMessage } from '@rocket.chat/apps-engine/definition/messages';
import { RocketChatAssociationModel, RocketChatAssociationRecord } from '@rocket.chat/apps-engine/definition/metadata';
import { RoomType } from '@rocket.chat/apps-engine/definition/rooms';
import { ISetting, SettingType } from '@rocket.chat/apps-engine/definition/settings';
import { IUser } from '@rocket.chat/apps-engine/definition/users';

import { KokoCommand } from './commands';
import { IPraiseStorage } from './storage/PraiseStorage';

export class KokoApp extends App {
    public kokoName: string = 'Koko';
    public kokoEmojiAvatar: string = ':gorilla:';
    public kokoRoomId: string;
    public botUser: IUser;

    public async checkPostMessageSent(message: IMessage): Promise<boolean> {
        console.log('checkPostMessageSent');
        // We'll ignore any message that is not a direct message between rocket.cat and user
        return true;
        // return message.room.type === RoomType.DIRECT_MESSAGE && message.room.id.indexOf('rocket.cat') !== -1;
    }

    public async onEnable(environmentRead: IEnvironmentRead, configModify: IConfigurationModify): Promise<boolean> {
        console.log('onEnable');
        this.kokoRoomId = await environmentRead.getSettings().getValueById('Room_Id');
        return true;
    }

    public async onSettingUpdated(setting: ISetting, configModify: IConfigurationModify, read: IRead, http: IHttp): Promise<void> {
        switch (setting.id) {
            case 'Room_Id':
                this.kokoRoomId = setting.value;
                break;
        }
    }

    public async executePostMessageSent(message: IMessage, read: IRead, http: IHttp, persistence: IPersistence): Promise<void> {
        console.log('executePostMessageSent');
        // this.botUser = await read.getUserReader().getByUsername('rocket.cat');
        // const msg = read.getNotifier().getMessageBuilder()
        //     .setText('No data')
        //     .setUsernameAlias(this.kokoName)
        //     .setEmojiAvatar(this.kokoEmojiAvatar)
        //     .setRoom(message.room)
        //     .setSender(this.botUser)
        //     .getMessage();
        // await read.getNotifier().notifyUser(message.sender, msg);
        // const assoc = new RocketChatAssociationRecord(RocketChatAssociationModel.USER, message.sender.id);
        // const waitdata = await read.getPersistenceReader().readByAssociation(assoc);
        // if (waitdata && waitdata.length > 0) {
        //     const data = waitdata[0] as IPraiseStorage;
        //     if (data.listen) {
        //         const msg = read.getNotifier().getMessageBuilder()
        //             .setText('Listening')
        //             .setUsernameAlias(this.kokoName)
        //             .setEmojiAvatar(this.kokoEmojiAvatar)
        //             .setRoom(message.room)
        //             .setSender(this.botUser)
        //             .getMessage();
        //         await read.getNotifier().notifyUser(message.sender, msg);
        //     } else {
        //         const msg = read.getNotifier().getMessageBuilder()
        //             .setText('Not Listening')
        //             .setUsernameAlias(this.kokoName)
        //             .setEmojiAvatar(this.kokoEmojiAvatar)
        //             .setRoom(message.room)
        //             .setSender(this.botUser)
        //             .getMessage();
        //         await read.getNotifier().notifyUser(message.sender, msg);
        //     }
        // } else {
        //     const msg = read.getNotifier().getMessageBuilder()
        //         .setText('No data')
        //         .setUsernameAlias(this.kokoName)
        //         .setEmojiAvatar(this.kokoEmojiAvatar)
        //         .setRoom(message.room)
        //         .setSender(this.botUser)
        //         .getMessage();
        //     await read.getNotifier().notifyUser(message.sender, msg);
        // }
    }

    protected async extendConfiguration(configuration: IConfigurationExtend): Promise<void> {
        console.log('extendConfiguration');
        await configuration.slashCommands.provideSlashCommand(new KokoCommand(this));
        await configuration.settings.provideSetting({
            id: 'Room_Id',
            type: SettingType.STRING,
            packageValue: '',
            required: true,
            public: false,
            i18nLabel: 'Koko_Room_Id',
            i18nDescription: 'Koko_Room_Id_Description',
        });
    }
}
