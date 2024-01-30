import { Bot, Keyboard, Context, session, SessionFlavor } from "grammy";
import {
  type Conversation,
  type ConversationFlavor,
  conversations,
  createConversation,
} from "@grammyjs/conversations";
import * as dotenv from 'dotenv'
import { Bitrix } from '@2bad/bitrix'
import { freeStorage } from "@grammyjs/storage-free";
import { SessionData } from "./types.js";
import path from 'path';
import {fileURLToPath} from 'url';
import http from 'http'

const server = http.createServer((req, res) => {
  console.log(req.statusCode)
  res.end('Hello!')
});
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({
  "path": __dirname + '/.env'
})

const bitrix = Bitrix(process.env.WEBHOOK_BITRIX)

type MyContext = Context & SessionFlavor<SessionData> & ConversationFlavor;
type MyConversation = Conversation<MyContext>;

const bot = new Bot<MyContext>(process.env.BOT_TOKEN)

bot.use(session({
  "storage": freeStorage<SessionData>(bot.token),
  initial: () => ({  }),
}));


async function leadProcess(conversation: MyConversation, ctx: MyContext): Promise<void> {
  await ctx.reply('Какой документ вам необходимо оформить?', {
    "reply_markup": { remove_keyboard: true },
  })
  do {
    ctx = await conversation.waitFor("message:text");
  } while (!ctx.message.text)
  ctx.session.text = ctx.message.text
  do {
    const contactBtn = new Keyboard().requestContact('Поделиться контактом').resized()
    await ctx.reply(`Поделитесь вашим контактом, чтобы я мог с вами связаться и предложить лучшую цену на рынке!`, {
      "reply_markup": contactBtn
    })
    ctx = await conversation.waitFor("message:contact")
  } while (!ctx.message.contact)
  ctx.session.phoneNumber = ctx.message.contact.phone_number
  conversation.log(ctx.session)
  const resultQuery = await conversation.external(async () => await sendDataBitrix(ctx.session))
  if (resultQuery) {
    const keyboard = new Keyboard().text('Оформить сертификат').resized().persistent();
    await ctx.reply(`Спасибо, что оставили ваш контакт. Уже бегу за телефоном, чтобы вам позвонить!`, {
      "reply_markup": keyboard
  }) 
  } else {
    await ctx.reply(`Произошла ошибка! Попробуйте ещё раз!`)
  }

}


const sendDataBitrix = async ({ name, phoneNumber, text, code }: SessionData): Promise<boolean> => {
  try {
    const bitrixResult = await bitrix.leads.create({
      "NAME": name,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      "PHONE": [ { "VALUE": phoneNumber, "VALUE_TYPE": "MOBILE" } ] as any,
      "COMMENTS": text,
      "TITLE": code,
      "SOURCE_ID": "чат-бот"
    })
    console.log(bitrixResult)
    return true
  } catch (error) {
    console.log("Произошла ошибка!")
    console.log(error)
    return false
  } 
}


bot.use(conversations());
bot.use(createConversation(leadProcess));


bot.command('start', async (ctx) => {
  const codeLink = ctx.match;
  ctx.session.code = codeLink
  ctx.session.telegramId = ctx.from.id.toString()
  ctx.session.name = ctx.from.last_name? ctx.from.first_name +'' + ctx.from.last_name : ctx.from.first_name
  const greetText = `Здравствуйте, ${ctx.session.name}! \nМеня зовут Владимир Филатов, готов оформить для вас любой сертификат от аккредитованной лаборатории. `
  await ctx.reply(greetText)
  await ctx.conversation.enter("leadProcess")
})


bot.hears('Оформить сертификат', async (ctx) => {
  await ctx.conversation.enter("leadProcess")
})


bot.start()

server.listen(process.env.PORT)

