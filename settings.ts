import {
    ISetting,
    SettingType,
} from '@rocket.chat/apps-engine/definition/settings';
export const settings: Array<ISetting> = [
    {
        id: 'Members_Room_Name',
        type: SettingType.STRING,
        packageValue: '',
        required: true,
        public: false,
        i18nLabel: 'Koko_Members_Room_Name',
        i18nDescription: 'Koko_Members_Room_Name_Description',
    },
    {
        id: 'Post_Praise_Room_Name',
        type: SettingType.STRING,
        packageValue: '',
        required: true,
        public: false,
        i18nLabel: 'Koko_Post_Praise_Room_Name',
        i18nDescription: 'Koko_Post_Praise_Room_Name_Description',
    },
    {
        id: 'Post_Answers_Room_Name',
        type: SettingType.STRING,
        packageValue: '',
        required: true,
        public: false,
        i18nLabel: 'Koko_Post_Answers_Room_Name',
        i18nDescription: 'Koko_Post_Answers_Room_Name_Description',
    },
    {
        id: 'Bot_Username',
        type: SettingType.STRING,
        packageValue: 'rocket.cat',
        required: true,
        public: false,
        i18nLabel: 'Koko_Bot_Username',
        i18nDescription: 'Koko_Bot_Username_Description',
    },
    {
        id: 'Use_OpenAI',
        type: SettingType.BOOLEAN,
        packageValue: false,
        required: true,
        public: false,
        i18nLabel: 'Koko_Use_OpenAI',
        i18nDescription: 'Koko_Use_OpenAI_Description',
    },
    {
        id: 'OpenAI_Token',
        type: SettingType.STRING,
        packageValue: '',
        required: true,
        public: false,
        i18nLabel: 'Koko_OpenAI_Token',
        i18nDescription: 'Koko_OpenAI_Token_Description',
    },
    {
        id: 'OpenAI_Model',
        type: SettingType.STRING,
        packageValue: 'gpt-3.5-turbo',
        required: true,
        public: false,
        i18nLabel: 'Koko_OpenAI_Model',
        i18nDescription: 'Koko_OpenAI_Model_Description',
    },
    {
        id: 'OpenAI_Question_Prompt',
        type: SettingType.STRING,
        packageValue: 'Send a random engaging question',
        required: true,
        public: false,
        i18nLabel: 'Koko_OpenAI_Question_Prompt',
        i18nDescription: 'Koko_OpenAI_Question_Prompt_Description',
    },
    {
        id: 'OpenAI_Question_AutoApprove',
        type: SettingType.BOOLEAN,
        packageValue: false,
        required: true,
        public: false,
        i18nLabel: 'Koko_OpenAI_Question_AutoApprove',
        i18nDescription: 'Koko_OpenAI_Question_AutoApprove_Description',
    },
];
