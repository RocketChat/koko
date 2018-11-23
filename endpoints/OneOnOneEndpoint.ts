import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { ApiEndpoint, IApiEndpointInfo, IApiRequest, IApiResponse } from '@rocket.chat/apps-engine/definition/api';
import { KokoApp } from '../KokoApp';

export class OneOnOneEndpoint extends ApiEndpoint {
    public path: string = 'one-on-one';

    constructor(public app: KokoApp) {
        super(app);
    }

    // tslint:disable-next-line:max-line-length
    public async get(request: IApiRequest, endpoint: IApiEndpointInfo, read: IRead, modify: IModify, http: IHttp, persistence: IPersistence): Promise<IApiResponse> {
        await this.app.kokoOneOnOne.run(read, modify, http, persistence);
        return this.success();
    }
}
