import { Bot, InlineKeyboard } from "grammy";
import * as dotenv from "dotenv";
import logger from "./utils/logger";
import Together from "together-ai";

dotenv.config();

const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN as string);
const together = new Together({
	apiKey: process.env.TOGETHER_AI_API_KEY as string,
	maxRetries: 2,
});

// Menu
const models = {
	"Meta Llama 3.3 70B Instruct Turbo Free": "meta-llama/Llama-3.3-70B-Instruct-Turbo-Free",
	"Meta Llama Vision Free": "meta-llama/Llama-Vision-Free",
	"DeepSeek R1 Distill Llama 70B Free": "deepseek-ai/DeepSeek-R1-Distill-Llama-70B-free"
};

const userModelMap = new Map<number, string>(); // Store user-selected models


const OLLAMA_API_URL = 'http://localhost:11434/api/generate';

// ollama serve
async function getAIResponse(prompt: string, model: string): Promise<string> {
	return new Promise<string>(async (resolve) => {
		const response = await together.chat.completions.create({
			messages: [{ "role": "user", "content": `${prompt}` }],
			model: model,
			stream: false,
			temperature: 0.9,
			max_tokens: 150,
		});

		if (response.choices && response.choices[0] && response.choices[0].message && response.choices[0].message.content) {
			logger.info(`⚡Together AI response:`);
			resolve(response.choices[0].message.content);
		} else {
			logger.error('⚡Together AI response is undefined or invalid');
			resolve('✨Something Went Wrong! Please try again later.');
		}
	});
}


function getModelMenu() {
	const keyboard = new InlineKeyboard();
	Object.keys(models).forEach((key) => {
		keyboard.text(key, key).row();
	});
	return keyboard;
}


export const run = () => {
	bot.command("start", (ctx) => {
		ctx.reply(`Hello ${ctx.from?.first_name}! Select an AI model:`, {
			reply_markup: getModelMenu(),
		});
	});

	bot.command("set", (ctx) => {
		ctx.reply("Choose your AI model:", {
			reply_markup: getModelMenu(),
		});
	});

	bot.command('clear', async (ctx) => {
		let res = await ctx.reply('clearing...');

		for (let i = res.message_id; i >= 0; i--) {
			console.log(`chat_id: ${ctx.chat.id}, message_id: ${i}`);
			try {
				await ctx.api.deleteMessage(ctx.chat.id, i);
			} catch (e) {
				console.error(e);
			}
		}
	});

	bot.command("shutdown", (ctx) => {
		ctx.reply("Shutting down the bot...").then(() => {
			bot.stop();
			process.exit(0);
		});
	});

	bot.command("start", (ctx) => { bot.start(); });


	bot.on("callback_query:data", async (ctx) => {
		const modelKey = ctx.callbackQuery.data as keyof typeof models;
		if (models[modelKey]) {
			userModelMap.set(ctx.from.id, models[modelKey]);
			await Promise.all([ctx.answerCallbackQuery(`Model set to ${modelKey}!`), ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } }), ctx.reply(`✅ You selected **${modelKey}**. Now send a message!`)]);
		}
	});


	bot.on("message", async (ctx) => {
		const userMessage = ctx.message.text || "";
		const model = userModelMap.get(ctx.from.id) || models["DeepSeek R1 Distill Llama 70B Free"];

		const thinkingMessage = await ctx.reply("Thinking... 🤖");

		const aiResponse = await getAIResponse(userMessage, model);

		await ctx.api.deleteMessage(ctx.chat.id, thinkingMessage.message_id);

		await ctx.reply(aiResponse);
	});


	bot.start();
	logger.info("🤖 Bot is running...");

};