// tslint:disable:variable-name
import { IUser } from '@rocket.chat/apps-engine/definition/users';

export class MembersCache {
    private _members: Array<IUser>;
    private _expire: number;
    private _expirationTime: number = 300000;

    constructor(members: Array<IUser>) {
        this._members = members;
        this._expire = Date.now() + this._expirationTime;
        return this;
    }

    public isValid(): boolean {
        return this._expire > Date.now();
    }

    get members(): Array<IUser> {
        return this._members;
    }
}
