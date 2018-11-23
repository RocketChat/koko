import { IUser } from '@rocket.chat/apps-engine/definition/users';

export class IMembersCache {
    public members: Array<IUser>;
    public expire: number;
}
