import { Bot, InlineKeyboard } from "grammy";
import * as dotenv from "dotenv";
import logger from "./utils/logger";
import Together from "together-ai";
import { init } from "./utils/sentry";

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
	"DeepSeek R1 Distill Llama 70B Free": "deepseek-ai/DeepSeek-R1-Distill-Llama-70B-free",
	"Generate Image": 'black-forest-labs/FLUX.1-schnell-Free'
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

/**
 * @function generateImages
 * @access private
 * @author dextel2
 * @event prompt
 * @todo -- revisit the function to generate images after togerther AI fix the issue
 * @since 2022-02-22
 * @copyright The Unlicense
 * @license The Unlicense
 * @version v0.0.1-beta
 * @description -- Generate images using together AI
 * @param prompt -- The prompt to generate images
 * @param model -- The model to use for generating images
 * @returns -- The generated images
 */
async function generateImages(prompt: string, model: string): Promise<string> {
	return new Promise<string>(async (resolve) => {
		const response = await together.images.create({
			"prompt": `${prompt}`,
			"model": `${model}`,
			steps: 4,
			n: 4
		});

		if (response.data && response.data[0].b64_json) {
			logger.info(`⚡Together AI response: `);
			resolve(response.data[0].b64_json);
		} else {
			logger.error('⚡Together AI response is undefined or invalid');
			resolve('✨Something Went Wrong! Please try again later.');
		}
	});
}



// Function to create the model selection menu
function getModelMenu() {
	const keyboard = new InlineKeyboard();
	Object.keys(models).forEach((key) => {
		keyboard.text(key, key).row();
	});
	return keyboard;
}


export const run = () => {
	init;
	bot.command("start", (ctx) => {
		ctx.reply(`Hello ${ctx.from?.first_name}! Select an AI model: `, {
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
			// Gracefully stop the bot before exiting
			bot.stop();
			process.exit(0);
		});
	});

	bot.command("start", (ctx) => { bot.start(); });


	bot.on("callback_query:data", async (ctx) => {
		const modelKey = ctx.callbackQuery.data as keyof typeof models;
		if (models[modelKey]) {
			userModelMap.set(ctx.from.id, models[modelKey]);
			await Promise.all([ctx.answerCallbackQuery(`Model set to ${modelKey}!`), ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } }), ctx.reply(`✅ You selected ** ${modelKey} **.Now send a message!`)]);
		}
	});


	bot.on("message", async (ctx) => {
		const userMessage = ctx.message.text || "";
		const model = userModelMap.get(ctx.from.id) || models["DeepSeek R1 Distill Llama 70B Free"];

		// Send "Thinking..." message and store the sent message
		const thinkingMessage = await ctx.reply("Thinking... 🤖");

		logger.info(`👤 User message: ${model}`);
		if (model === 'black-forest-labs/FLUX.1-schnell-Free') {
			const aiResponse = await generateImages(userMessage, model);
			await ctx.reply(aiResponse);
			await ctx.api.deleteMessage(ctx.chat.id, thinkingMessage.message_id);
		} else {
			// Get AI response
			const aiResponse = await getAIResponse(userMessage, model);
			await ctx.reply(aiResponse);
			await ctx.api.deleteMessage(ctx.chat.id, thinkingMessage.message_id);
		}

		// Delete the "Thinking..." message

		// Send AI response
	});


	bot.start();
	logger.info("🤖 Bot is running...");

};;