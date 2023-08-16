import type {
    IHttp,
    IHttpRequest,
    IHttpResponse,
} from '@rocket.chat/apps-engine/definition/accessors';
import type { KokoApp } from '../KokoApp';

export interface ITypedHttpResponse<T> extends IHttpResponse {
    data?: T;
}

export interface ITypedHttpRequest<T> extends IHttpRequest {
    data?: T;
}

export interface ITypedHttp<Request, Response> extends IHttp {
    post(
        url: string,
        options?: ITypedHttpRequest<Request>
    ): Promise<ITypedHttpResponse<Response>>;
}

export interface IOpenAICompletionResponse {
    choices: Array<{ message: { role: string; content: string } }>;
}

export type IOpenAICompletionRequest = {
    model: string;
    max_tokens: number;
    messages: Array<IOpenAICompletionResponse['choices'][0]['message']>;
};

export class OpenAI {
    private token: string;

    private model: string;

    private headers = {
        'Content-Type': 'application/json',
        Authorization: '',
    };

    private http!: ITypedHttp<
        IOpenAICompletionRequest,
        IOpenAICompletionResponse
    >;

    constructor(private readonly app: KokoApp) {
        this.http = this.app.getAccessors()?.http;
    }

    public refreshCofiguration({
        token,
        model,
    }: {
        token?: string;
        model?: string;
    }) {
        if (token) {
            this.token = token;
            this.headers.Authorization = `Bearer ${token}`;
        }
        if (model) this.model = model;
    }

    public async getCompletionsForPrompt(
        prompt: string
    ): Promise<ITypedHttpResponse<IOpenAICompletionResponse>> {
        const safePrompt = this.generateSafePromptForQuestionOutput(prompt);

        const body: IOpenAICompletionRequest = {
            model: this.model,
            max_tokens: 100,
            messages: [
                {
                    role: 'user',
                    content: safePrompt,
                },
            ],
        };

        this.app.getLogger().debug('OpenAI request body', body);

        const completionUrl = 'https://api.openai.com/v1/chat/completions';

        const response = await this.http.post(completionUrl, {
            headers: this.headers,
            data: body,
        });
        this.app.getLogger().debug('OpenAI response', response);

        return response;
    }

    // generates the safest possible prompt from the question passed (exclusing offensive topics for example)
    private generateSafePromptForQuestionOutput(question: string) {
        return (
            question +
            '\n' +
            'question must not include anything offensive' +
            '\n' +
            'answer format: <question>'
        );
    }
}
