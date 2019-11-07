import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { ApiEndpoint, IApiEndpointInfo, IApiRequest, IApiResponse } from '@rocket.chat/apps-engine/definition/api';
import { KokoApp } from '../KokoApp';
import { random } from '../lib/helpers';

export class PraiseEndpoint extends ApiEndpoint {
    public path: string = 'praise';

    constructor(public app: KokoApp) {
        super(app);
    }

    // tslint:disable-next-line:max-line-length
    public async post(request: IApiRequest, endpoint: IApiEndpointInfo, read: IRead, modify: IModify, http: IHttp, persistence: IPersistence): Promise<IApiResponse> {
        // Randomly sends karma points
        if (random(0, 1) === 1) {
            await this.app.kokoPraise.sendKarmaScoreboard(read, modify, this.app.kokoPostPraiseRoom);
        }
        this.app.kokoPraise.run(read, modify, persistence);
        return this.success();
    }
}
