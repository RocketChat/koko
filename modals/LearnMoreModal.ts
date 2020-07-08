import { IModify, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { TextObjectType } from '@rocket.chat/apps-engine/definition/uikit/blocks';
import { IUIKitModalViewParam } from '@rocket.chat/apps-engine/definition/uikit/UIKitInteractionResponder';

import { KokoApp } from '../KokoApp';

export async function learnMoreModal({ app, data, read, modify }: {
    app: KokoApp,
    data,
    read: IRead,
    modify: IModify,
}): Promise<IUIKitModalViewParam> {
    const viewId = 'learnMore';
    const block = modify.getCreator().getBlockBuilder();
    let text;
    switch (data.value) {
        case 'dream':
            text = 'We get out of our comfort zone and take risks because we *dream*. Our dreams take us to high goals and the fear of failure doesn\'t stop us from trying because we have the passion to go beyond the status quo.';
            break;
        case 'own':
            text = 'We hope to find those better ways because of our ownership, because we *own*. We own the problems that appear and feel empowered to take initiative to solve them, testing and adapting. We own our responsibilities, and if we say it we do it, constantly trying to go the extra mile to exceed expectations. We wear this ownership everyday, represented by the t-shirts we so proudly wear in every possible color.';
            break;
        case 'trust':
            text = 'We are so proud of what we do, we wear it, and talk about it because we *trust*. We trust what we\'re creating, we trust the purpose of what we do, and we trust each other. That is what gives us the freedom to innovate, to create our own schedules, to have the remote work as part of who we are as Rocket.Chat. The flexibility and balance we achieve by trusting is what makes our environment one of enjoyment, is what makes us feel pleasure in doing what we do.';
            break;
        case 'share':
            text = 'We trust, believe and enjoy what we do because we *share*. We share the good and the bad because we\'re united by a common belief. We team up to solve problems, meet clients, create solutions, celebrate birthdays or our yearly Summit. Most importantly, we share because that is the essence of who we are. We\'re open, and built by our community, so more than just sharing, it is about empowering and loving the community and who\'s beside us, making this all happen.';
            break;
    }
    block.addSectionBlock({
        text: block.newMarkdownTextObject(text),
    });
    return {
        id: viewId,
        title: {
            type: TextObjectType.PLAINTEXT,
            text: 'Learn more',
        },
        close: block.newButtonElement({
            text: {
                type: TextObjectType.PLAINTEXT,
                text: 'Dismiss',
            },
        }),
        blocks: block.getBlocks(),
    };
}
