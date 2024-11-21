import dotenv from 'dotenv';
import { iamRepository } from './utils/index.js';
import { getTextCompletion } from './utils/yandex.js';
import { Telegraf } from 'telegraf';
import { getReplyId, cleanSpecialSymbols} from './utils/telegram.js';

dotenv.config({});

/**
 * @type{Record<number, { isWaitingFor?: 'role'; role: string; messages: Array<{ role: 'user' | 'assistant'; text: string; }> }>}
 */
const contextStore = {};

const DEFAULT_USER_STATE = {
    isWaitingFor: null,
    role: null,
    messages: [],
}

const commonTextCompletionProps = {
    folderId: process.env.FOLDER_ID,
    model: 'yandexgpt/latest',
}


async function main() {
    await iamRepository.init(process.env.YA_OAUTH_TOKEN);
    const bot = new Telegraf(process.env.BOT_TOKEN);

    await bot.telegram.setMyCommands([
        {
            command: '/start',
            description: 'Сброс контекста',
        },
        {
            command: '/reset',
            description: 'Сброс контекста',
        },
    ]);
    


    bot.on('message', async (ctx) => {
        const replyId = getReplyId(ctx);
        contextStore[replyId] = contextStore[replyId] || DEFAULT_USER_STATE;
        

        switch(ctx.text) {
            case '/role':
                contextStore[replyId].isWaitingFor = 'role';
                return ctx.reply('Напишите роль')
            default: 
            const isWaitingFor = contextStore[replyId]?.isWaitingFor === 'role';
            if ( isWaitingFor) {
                contextStore[replyId].isWaitingFor = null;
                contextStore[replyId].role = ctx.text;
                return ctx.reply(`Создана роль: ${ctx.text}`);
            } 

           if (!contextStore[replyId]) {
            return ctx.reply('Нет контекста для пользователя с ID: ' + replyId);
           }

           const { result: {alternatives}} = await getTextCompletion({
            iamToken: iamRepository.value,
            folderId: process.env.FOLDER_ID,
            model: 'yandexgpt/latest',
            role: contextStore[replyId].role,
            messages: [
                ...contextStore[replyId].messages,
                {
                    role: 'user',
                    text: ctx.text
                }
            ]
        });
            contextStore[replyId].messages.push({
                role: 'user',
                text: ctx.text
            })

            contextStore[replyId].messages.push({
                role: 'assistant',
                text: alternatives[0].message.text
            })
            ctx.reply(cleanSpecialSymbols(alternatives[0].message.text), { parse_mode: 'MarkdownV2'});

        }
       
    });
    await bot.launch();

    console.log('>>', compl.result.alternatives[0].message.text);
    } 

main();

// Enable graceful stop
process.once('SIGINT', () => {
    iamRepository.destroy();
    bot.stop('SIGINT');
})
process.once('SIGTERM', () =>  {
    iamRepository.destroy();
    bot.stop('SIGTERM');
})

