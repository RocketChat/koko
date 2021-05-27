import { IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { RocketChatAssociationModel, RocketChatAssociationRecord } from '@rocket.chat/apps-engine/definition/metadata';
import { IRoom } from '@rocket.chat/apps-engine/definition/rooms';
import { UIKitViewSubmitInteractionContext } from '@rocket.chat/apps-engine/definition/uikit';
import { IUser } from '@rocket.chat/apps-engine/definition/users';
import { Buffer } from 'buffer';

import { createQuestionBlocks } from '../blocks/QuestionBlocks';
import { KokoApp } from '../KokoApp';
import { getDirect, getMembers, notifyUser, random, sendMessage } from '../lib/helpers';
import { answerRegisteredModal } from '../modals/QuestionModal';
import { IAnswer, IAnswerStorage } from '../storage/IAnswerStorage';
import { IQuestionStorage } from '../storage/IQuestionStorage';

export class KokoQuestion {
    // List of questions based on https://conversationstartersworld.com and https://reddit.com/r/askreddit
    private questions = [
        'Among your friends or family, what are you famous for?',
        'An app mysteriously appears on your phone that does something amazing. What does it do?',
        'An epic feast is held in your honor, what\'s on the table?',
        'Are all individuals morally obligated to save another person\'s life if they are able? What if that person lives in another country?',
        'Are there any songs that always bring a tear to your eye?',
        'Are you a very organized person?',
        'Are you usually early or late?',
        'Are you very active of do you prefer to just relax in your free time?',
        'As a child, what did you think would be awesome about being an adult, but isn\'t as awesome as you thought it would be?',
        'As you get older, what are you becoming more and more afraid of?',
        'At what point is a technologically enhanced human not a human anymore?',
        'Can you think of any technology that has only made the world worse? How about a piece of technology that has only made the world better?',
        'Do you always have to have the latest phone?',
        'Do you care about fashion? What style of clothes do you usually wear?',
        'Do you eat food that\'s past its expiration date if it still smells and looks fine?',
        'Do you experience phantom vibration? (Feeling your phone vibrate even though it didn\'t.)',
        'Do you have any pets? What are their names?',
        'Do you like documentaries? Why / why not?',
        'Do you like going to concerts? Why or why not? What was the last concert you went to?',
        'Do you like horror movies? Why or why not?',
        'Do you like reality TV shows? Why or why not? If so, which ones?',
        'Do you like spicy food? Why or why not? What is the spiciest thing you have ever eaten?',
        'Do you like things to be carefully planned or do you prefer to just go with the flow?',
        'Do you play sports video games? Which ones? Is playing the video game or sport more fun? Why?',
        'Do you prefer fiction or nonfiction books?',
        'Do you prefer physical books or ebooks?',
        'Do you prefer summer or winter activities?',
        'Do you prefer to go off the beaten path when you travel?',
        'Do you prefer to watch movies in the theater or in the comfort of your own home?',
        'Do you prefer traveling alone or with a group?',
        'Do you text more or call more? Why?',
        'Do you think that aliens exist?',
        'Do you think that children born today will have better or worse lives than their parents?',
        'Do you think that humans will ever be able to live together in harmony?',
        'Do you usually achieve goals you set? Why or why not?',
        'Do you wish there were more or less holidays? Why?',
        'Does a person\'s name influence the person they become?',
        'Does anonymity encourage people to misbehave or does it reveal how people would choose to act all the time if they could?',
        'Does fate exist? If so, do we have free will?',
        'Does having a day off for a holiday increase or decrease productivity at work?',
        'Has anyone ever saved your life?',
        'Have you ever given to any charities?',
        'Have you ever saved an animal\'s life? How about a person\'s life?',
        'Have you ever spoke in front of a large group of people? How did it go?',
        'Have you traveled to any different countries? Which ones?',
        'Have your parents influenced what goals you have?',
        'How ambitious are you?',
        'How different was your life one year ago?',
        'How do you feel if you accidentally leave your phone at home?',
        'How do you make yourself sleep when you can\'t seem to get to sleep?',
        'How do you plan to make the world a better place?',
        'How do you relax after a hard day of work?',
        'How do you think traveling to a lot of different countries changes a person?',
        'How have your goals changed over your life?',
        'How much do you plan / prepare for the future?',
        'How much of your body would you cybernetically enhance if you could?',
        'How much privacy are you willing to sacrifice for safety?',
        'How much time do you spend on the internet? What do you usually do?',
        'How often do you check your phone?',
        'How often do you curse?',
        'How often do you help others? Who do you help? How do you help?',
        'How often do you play sports?',
        'How should success be measured? By that measurement, who is the most successful person you know?',
        'If all jobs had the same pay and hours, what job would you like to have?',
        'If magic was real, what spell would you try to learn first?',
        'If you could airdrop anything you want, worth two million dollars or less, anywhere you want, what would you airdrop and where would you airdrop it?',
        'If you could become immortal on the condition you would NEVER be able to die or kill yourself, would you choose immortality?',
        'If you could bring back one TV show that was cancelled, which one would you bring back?',
        'If you could call up anyone in the world and have a one hour conversation, who would you call?',
        'If you could convince everyone in the world to do one thing at one point in time, what would that thing be?',
        'If you could have a video of any one event in your life, what event would you choose?',
        'If you could have any animal as a pet, what animal would you choose?',
        'If you could learn the answer to one question about your future, what would the question be?',
        'If you could make a 20 second phone call to yourself at any point in your life present or future, when would you call and what would you say?',
        'If you could make one rule that everyone had to follow, what rule would you make?',
        'If you could press a button and receive a million dollars, but one stranger would die, would you press the button? And if so, how many times?',
        'If you didn\'t have to sleep, what would you do with the extra time?',
        'If you wanted to slowly drive a roommate insane using only notes, what kind of notes would you leave around the house?',
        'If you were moving to another country, but could only pack one carry-on sized bag, what would you pack?',
        'In what situation or place would you feel the most out of place in?',
        'In your group of friends, what role do you play?',
        'Is it better for a person to have a broad knowledge base or a deep knowledge base?',
        'Is it better to be a big fish in a small pond or a small fish in a big pond?',
        'Is teaching a skill that can be taught?',
        'Is there a meaning to life? If so, what is it?',
        'Time freezes for everyone but you for one day. What do you do?',
        'Was there ever an event in your life that defied explanation?',
        'What \'old person\' things do you do?',
        'What activities cause you to feel like you are living life to the fullest?',
        'What always cheers you up when you think about it?',
        'What amazing thing did you do that no one was around to see?',
        'What app can you not believe someone hasn\'t made yet?',
        'What apps have changed your life a lot?',
        'What are some goals you have already achieved? What are some goals you have failed to accomplish?',
        'What are some misconceptions about your hobby?',
        'What are some of the best vacations you\'ve had?',
        'What are some of the events in your life that made you who you are?',
        'What are some of your personal \'rules\' that you never break?',
        'What are some red flags to watch out for in daily life?',
        'What are some small things that make your day better?',
        'What are three interesting facts about you?',
        'What are you addicted to?',
        'What are you interested in that most people aren\'t?',
        'What are you most likely to become famous for?',
        'What are you most likely very wrong about?',
        'What are you most looking forward to in the next 10 years?',
        'What are you really good at, but kind of embarrassed that you are good at it?',
        'What benefit do you bring to the group when you hang out with friends?',
        'What book genres do you like to read?',
        'What book has had the biggest impact on your life?',
        'What brand are you most loyal to?',
        'What can you not get right, no matter how many times you try?',
        'What challenging thing are you working through these days?',
        'What company do you despise and why?',
        'What could you do with two million dollars to impact the most amount of people?',
        'What did you think you would grow out of but haven\'t?',
        'What do a lot of people have very strong opinions about, even though they know very little about it?',
        'What do a lot of people hope will happen but is just not going to happen?',
        'What do app makers do that really annoys you?',
        'What do you bring with you everywhere you go?',
        'What do you contribute back to society?',
        'What do you do to get rid of stress?',
        'What do you do to improve your mood when you are in a bad mood?',
        'What do you do to make the world a better place?',
        'What do you do when you hang out with your friends?',
        'What do you do when you hear something fall in the middle of the night while you are in bed?',
        'What do you hope never changes?',
        'What do you hope to achieve in your professional life?',
        'What do you like to do in spring?',
        'What do you need help with most often?',
        'What do you regret not doing or starting when you were younger?',
        'What do you think of online education?',
        'What do you think of tattoos? Do you have any?',
        'What do you think you do better than 90% of people?',
        'What do you wish you could tell yourself 10 years ago? What do you think you\'ll want to tell your current self 10 years from now?',
        'What flavor of ice cream do you wish existed?',
        'What habit do you have now that you wish you started much earlier?',
        'What has someone borrowed but never given back?',
        'What hobby would you get into if time and money weren\'t an issue?',
        'What horror story do you have from a job you\'ve had?',
        'What is something that is popular now that annoys you?',
        'What is something that really annoys you but doesn\'t bother most people?',
        'What is something that your friends would consider \'so you\'?',
        'What is something you are certain you\'ll never experience?',
        'What is the luckiest thing that has happened to you?',
        'What is the strangest thing you have come across?',
        'What is the worst hotel you have stayed at? How about the best hotel?',
        'What is your favorite food?',
        'What job doesn\'t exist now but will exist in the future?',
        'What job would you be terrible at?',
        'What languages do you wish you could speak?',
        'What life skills are rarely taught but extremely useful?',
        'What makes you roll your eyes every time you hear it?',
        'What problems will technology solve in the next 5 years? What problems will it create?',
        'What product do you wish a company would make a \'smart\' version of?',
        'What product or service is way more expensive than it needs to be?',
        'What question can you ask to find out the most about a person?',
        'What question would you most like to know the answer to?',
        'What questions would you like to ask a time traveler from 200 years in the future?',
        'What really needs to be modernized?',
        'What risks are worth taking?',
        'What smell brings back great memories?',
        'What takes up too much of your time?',
        'What three words best describe you?',
        'What values are most important to you?',
        'What was ruined because it became popular?',
        'What was the best birthday wish or gift you\'ve ever received?',
        'What was the last book you read?',
        'What was the last funny video you saw?',
        'What was the last time you worked incredibly hard?',
        'What was the most memorable gift you\'ve received?',
        'What was the worst shopping experience you\'ve ever had?',
        'What was your first smartphone? How did you feel when you got it?',
        'What was your most recent lie?',
        'What website do you visit most often?',
        'What weird food combinations do you really enjoy?',
        'What would be your ideal way to spend the weekend?',
        'What would you rate 10 / 10?',
        'What\'s incredibly cheap and you would pay way more for?',
        'What\'s something that happened or something that someone said that changed how you view the world?',
        'What\'s the best thing that happened to you last week?',
        'What\'s the cutest thing you can imagine? Something so cute it\'s almost painful.',
        'What\'s the farthest you\'ve ever been from home?',
        'What\'s the hardest lesson you\'ve learned?',
        'What\'s the weirdest text or email you\'ve gotten?',
        'What\'s your favorite season? Why?',
        'When did something start out badly for you but in the end, it was great?',
        'When people come to you for help, what do they usually want help with?',
        'When was the last time you climbed a tree?',
        'When was the last time you stayed up through the entire night?',
        'When was the most inappropriate time you busted out in laughter?',
        'Where did you go last weekend? What did you do?',
        'Where do you get your news?',
        // tslint:disable-next-line:max-line-length
        'Where do you think is the most worthwhile place to find meaning in life? Work, family, hobby, religion, philosophy, helping others, all the small miracles, or something else entirely?',
        'Where do you usually go when you when you have time off?',
        'Who had the biggest impact on the person you have become? If your parents, who else besides them?',
        'Why did you decide to do the work you are doing now?',
        'Would you rather always be 10 minutes late or always be 20 minutes early?',
        'Would you rather be able to teleport anywhere or be able to read minds?',
        'Would you rather be completely invisible for one day or be able to fly for one day?',
        'Would you rather be famous when you are alive and forgotten when you die or unknown when you are alive but famous after you die?',
        'Would you rather be feared by all or loved by all?',
        'Would you rather be locked in a room that is constantly dark for a week or a room that is constantly bright for a week?',
        'Would you rather find your true love or a suitcase with five million dollars inside?',
        'Would you rather get 5 dollars for every song you sang in public or 50 dollars for every stranger you kiss?',
        'Would you rather have a completely automated home or a self-driving car?',
        'Would you rather live on the beach or in a cabin in the woods?',
        'Would you rather not be able to open any closed doors (locked or unlocked) or not be able to close any open doors?',
        'Would you rather travel the world for a year on a shoe string budget or stay in only one country for a year but live in luxury?',
        'Would you want the ability to hear the thoughts of people near you if you couldn\'t turn the ability off?',
        'You are sent back to the day the titanic set sail with nothing but a 3rd class ticket (and food water ect) your task is to stop the titanic from sinking, how do you do this?',
        'What was your "How didn\'t they notice?" moment?',
        'What phrases are you really sick of hearing?',
        'You go on a first date with someone, what habit or characteristic is a deal breaker?',
        'What are great questions to ask your interviewer at the end of a job interview?',
        'You have one hour to eat 5,000 calories, what food do you choose?',
        'If you could make one thing illegal, what would it be?',
        'What is something you fear at night?',
        'What\'s that dumb thing you did years ago that you can\'t stop thinking about?',
        'What stereotype about your country is actually pretty accurate?',
        'What turns you into a little kid?',
        'What is generally more dangerous than people think?',
        'What is a waste of money to you?',
        'Which TV series eventually won you over, after refusing to give it a shot?',
        'You are now a YouTuber with over 5 Million subscribers. What content are you posting?',
        'What is your daily moment of peace?',
        'What\'s a thing many people do but is actually pretty disrespectful ?',
        'What feels like some money laundering scheme in the area where you live but can\'t prove it?',
        'What silly thing did you worry about when you were a kid?',
        'What is your favorite quote?',
        'You can choose to live in any movie. Which one do you choose and why?',
        'What is the worst thing humanity has created?',
        'What song is stuck in your head?',
        'Where is the best place to be during a zombie apocalypse?',
        'What 1% are you a part of?',
        'You are starting a revolution, why?',
        'How was your day, yesterday?',
        'What is the first thing you notice about a person?',
        'If you could only take 3 things with you onto an abandoned island what would you take?',
        'What is something someone told you that you\'ll never forget?',
        'What is the weirdest dream you\'ve ever had?',
        'In what ways would the world be different if religion never existed?',
        'What\'s the best thing to say to the cops after you killed someone?',
        'What\'s your nickname and why?',
        'What do you want on your tombstone?',
        'What is the worst thing you could whisper when hugging someone?',
        'How to make time go by really fast?',
        'What’s the most uncomfortable question you can ask someone?',
        'What free things online should everyone take advantage of?',
        'What is an adult problem you were not prepared for?',
        'What is the dumbest idea you have ever had that actually worked?',
        'What do people learn too late?',
        'You have just been cheated out of $1000 for a stupid brick. How do you take revenge?',
        'What was the biggest bullet you dodged?',
        'What is something that has aged well?',
        'What movie will you always recommend to people?',
        'What was a huge trend that everyone forgot about?',
        'What\'s the craziest butterfly effect that happened to you because of a small decision you made?',
        'How is your day going?',
        'What’s the most overpriced thing you’ve seen?',
        'What is something about yourself that sounds totally made up but is 100% real?',
        'What life changing item can you buy for less than $100?',
        'What invention is so good that it actually can’t be improved upon?',
        'Have you ever laughed so hysterically at something so simple you were starting to get worried that you were losing your sanity? What was it?',
        'What song/movie/tv show is 10/10, yet hardly anyone has heard of it?',
        'What\'s the weirdest compliment you\'ve ever been given?',
        'What small thing makes you automatically distrust someone?',
        'You\'re being interrogated and so far you\'ve held strong. What song do they play on repeat that breaks you?',
        'If you could telepathically say something that all 7.8 Billion people on earth could hear at once what would it be?',
        'If you had enough money to build your dream house, what\'s a strange room/feature you\'d include?',
        'What advice would you give to someone 10 years younger than you?',
        'If you could singlehandedly choose anyone (alive, dead, or fictional character) to be the next president of your country, who would you choose and why?',
        'If Covid never happened, what would\'ve you done in 2020?',
        'What food do you swear people only pretend to like?',
        'In what movie did you like the bad guy more than the good guy?',
        'What\'s your favorite short joke?',
        'You\'re tired from the human race, so you decide to help an advanced alien civilization destroy the Earth, what tips would you give them?',
        'What is the greatest comeback to a insult you’ve ever heard?',
        'What\'s the dumbest way you\'ve gotten a scar?',
        'Steve Irwin has you pinned down in a headlock, what cool facts does he tell the audience about you and your habitat?',
        'What movie could have been over in 10 minutes if the main character wasn\'t such a fool?',
        'What makes you optimistic about the future?',
        'Which album do you think has no bad songs on it, and can be listened all the way through?',
        'What will never be the same again once the pandemic is over?',
        'What’s a small act of kindness you were once shown, that you’ll never forget?',
        'You have died and find that instead of going to heaven, you\'ve only leveled up to Earth 2.0. What are some things that make Earth 2.0 better but not quite heaven?',
        'If cats had pockets what would you find in your cats pockets?',
        'What happened in the past week that made you happy?',
        'Without saying what the category is, what are your top five?',
        'You can fully communicate with your pet for 24 straight hours. How do you spend this time?',
        'If someone borrowed your body for a week, what quirks would you tell them about so they are prepared?',
        'What is your "I was into X before it was cool" thing?',
        'What\'s a really cheap item you can buy that can make you look incredibly rich?',
        'What is normal in your country but seems weird to the rest of the world?',
        'What’s a very common thing that you just can\'t relate to?',
        'Which fictional character\'s death have you not gotten over?',
        'What is one of the dumbest things you\'ve done when your brain was on "auto-pilot"?',
    ];

    constructor(private readonly app: KokoApp) {}

    public async run(read: IRead, modify: IModify, persistence: IPersistence) {
        if (this.app.botUser !== undefined && this.app.kokoMembersRoom !== undefined && this.app.kokoPostAnswersRoom !== undefined) {

            // Gets room members (removes rocket.cat and koko bot)
            const members = await getMembers(this.app, read);

            if (members) {
                // Posts previous answers as soon as new questions are being sent
                await this.postAnswers(read, modify, persistence);

                // Saves a random question in storage
                let answers = {};
                const question = this.questions[random(0, this.questions.length - 1)];
                const encodedQuestion = Buffer.from(question).toString('base64') as string;

                const assocQuestions = new RocketChatAssociationRecord(RocketChatAssociationModel.MISC, 'questions');
                const awaitData = await read.getPersistenceReader().readByAssociation(assocQuestions);
                if (awaitData && awaitData[0]) {
                    const questionData = awaitData[0] as IQuestionStorage;
                    answers = questionData.answers || {};
                    if (questionData.answers && !questionData.answers[encodedQuestion]) {
                        answers[encodedQuestion] = [];
                    }
                }

                const questionStorage: IQuestionStorage = { question, answers };
                await persistence.updateByAssociation(assocQuestions, questionStorage, true);

                // Sends message to each member
                for (const member of members) {
                    if (member.id === this.app.botUser.id) {
                        continue;
                    }

                    // Gets or creates a direct message room between botUser and member
                    const room = await getDirect(this.app, read, modify, member.username) as IRoom;

                    // Creates praise blocks
                    const blocks = createQuestionBlocks(modify, question);
                    await sendMessage(this.app, modify, room, question, [], blocks);
                }
            }
        }
    }

    /**
     * Checks if usernames have been selected and reason is given
     * Then sends a praise to the selected users
     */
    // tslint:disable-next-line:max-line-length
    public async submit({ context, modify, read, persistence }: { context: UIKitViewSubmitInteractionContext, modify: IModify, read: IRead, persistence: IPersistence }) {
        const data = context.getInteractionData();
        const { question }: {
            question: {
                answer: string,
                anonymous: string,
            },
        } = data.view.state as any;
        const errors = {} as any;
        if (question === undefined || question.answer === undefined || question.answer.length === 0) {
            errors.answer = 'Please type your answer';
        }
        if (Object.keys(errors).length > 0) {
            return context.getInteractionResponder().viewErrorResponse({
                viewId: data.view.id,
                errors,
            });
        }

        const assocQuestions = new RocketChatAssociationRecord(RocketChatAssociationModel.MISC, 'questions');
        const awaitData = await read.getPersistenceReader().readByAssociation(assocQuestions);
        if (awaitData && awaitData[0]) {
            const questionData = awaitData[0] as IQuestionStorage;
            const lastQuestion = questionData.question;
            const encodedQuestion = Buffer.from(lastQuestion).toString('base64') as string;

            if (questionData.answers[encodedQuestion] === undefined) {
                questionData.answers[encodedQuestion] = [];
            }

            let update = false;
            if (question && question.anonymous !== 'yes') {
                for (const index in questionData.answers[encodedQuestion]) {
                    if (questionData.answers[encodedQuestion].hasOwnProperty(index)) {
                        const answer = questionData.answers[encodedQuestion][index];
                        if (answer.username === data.user.username) {
                            update = true;
                            questionData.answers[encodedQuestion][index].answer = question.answer;
                        }
                    }
                }
            }
            if (!update) {
                questionData.answers[encodedQuestion].push({
                    username: question && question.anonymous !== 'yes' ? data.user.username : 'Anonymous',
                    answer: question.answer,
                });
            }

            const questionStorage: IQuestionStorage = { question: lastQuestion, answers: questionData.answers };
            await persistence.updateByAssociation(assocQuestions, questionStorage, true);

            // // Notifies user that his answer is saved
            // const room = await getDirect(this.app, read, modify, data.user.username) as IRoom;
            // const msg = `Your answer has been registered.`;
            // await notifyUser(this.app, modify, room, data.user, msg);

            const modal = await answerRegisteredModal({ read, modify, data });
            return context.getInteractionResponder().updateModalViewResponse(modal);
        }

        return {
            success: true,
        };
    }

    /**
     * Grabs the answer and saves it for posting
     *
     * @param modify
     * @param persistence
     * @param sender the user from direct room
     * @param room the direct room
     * @param text the message to get username or praise from
     */
    // tslint:disable-next-line:max-line-length
    public async answer(read: IRead, modify: IModify, persistence: IPersistence, sender: IUser, room: IRoom, text: string) {
        // Removes listening record from persistence storage
        const association = new RocketChatAssociationRecord(RocketChatAssociationModel.USER, sender.id);
        await persistence.removeByAssociation(association);

        // Saves the answer
        const answer: IAnswer = { username: sender.username, answer: text };
        let answerStorage: IAnswerStorage;
        const assocAnswer = new RocketChatAssociationRecord(RocketChatAssociationModel.MISC, 'answer');
        const awaitData = await read.getPersistenceReader().readByAssociation(assocAnswer);
        const data = awaitData && awaitData.length > 0 && awaitData[0] as IAnswerStorage;
        if (!data) {
            answerStorage = [answer];
        } else {
            let indexFound = false;
            for (const index in data) {
                if (data.hasOwnProperty(index)) {
                    const dataAnswer = data[index] as IAnswer;
                    if (dataAnswer.username === sender.username) {
                        data[index] = answer;
                        indexFound = true;
                        break;
                    }
                }
            }
            if (!indexFound) {
                data.push(answer);
            }
            answerStorage = data;
        }
        persistence.updateByAssociation(assocAnswer, answerStorage, true);

        // Notifies user that his answer is saved
        const msg = `Your answer has been registered. If you want to change your answer, type \`/koko question\`.`;
        await sendMessage(this.app, modify, room, msg);
    }

    /**
     * Posts all answer for the previous question
     *
     * @param read
     * @param modify
     * @param persistence
     */
    public async postAnswers(read: IRead, modify: IModify, persistence: IPersistence) {
        if (this.app.kokoPostAnswersRoom) {
            const assocQuestion = new RocketChatAssociationRecord(RocketChatAssociationModel.MISC, 'questions');
            const awaitData = await read.getPersistenceReader().readByAssociation(assocQuestion);
            if (awaitData && awaitData[0]) {
                const question = awaitData[0] as IQuestionStorage;
                const encodedQuestion = Buffer.from(question.question).toString('base64') as string;

                // Start building the message that will be sent to answers channel
                let text = `*${question.question}*\n\n`;
                const answers = question.answers[encodedQuestion] || [];
                answers.forEach((answer: IAnswer) => {
                    text += `*${answer.username}*: ${answer.answer}\n`;
                });

                    // Message is built, send
                await sendMessage(this.app, modify, this.app.kokoPostAnswersRoom, text);
            }
        }
    }
}
