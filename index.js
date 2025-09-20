const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const input = require("input");
require("dotenv").config();

// Load Telegram API credentials from environment variables
const apiId = Number(process.env.TG_API_ID);
const apiHash = process.env.TG_API_HASH;
const stringSession = new StringSession(process.env.TG_STRING_SESSION || "");

// List of texts to ignore during message edits (comma-separated in .env)
const ignoreList = (process.env.IGNORE_LIST && process.env.IGNORE_LIST.split(", ")) || ["00:00"];

/**
 * Remove HTML tags from a string
 * @param {string} htmlText - Text containing HTML
 * @returns {string} Plain text without HTML tags
 */
function getPlainText(htmlText) {
    return htmlText.replace(/<\/?[^>]+(>|$)/g, "").trim();
}

/**
 * Check if a message should be skipped
 * @param {string} msgText - Original message text
 * @param {string} appendText - Text intended to append
 * @returns {boolean} True if message should be ignored
 */
function shouldIgnore(msgText, appendText) {
    const plainMsg = getPlainText(msgText);
    const plainAppend = getPlainText(appendText);

    if (plainMsg.includes(plainAppend)) return true;

    return ignoreList.some(ignore => plainMsg.includes(getPlainText(ignore)));
}

/**
 * Determine if a message is editable
 * Telegram only allows editing text messages
 * @param {object} msg - Message object from Telegram
 * @returns {boolean} True if message is editable
 */
function isEditable(msg) {
    return msg && typeof msg.message === "string" && msg.message.length > 0;
}

/**
 * Sleep function for async delays
 * @param {number} ms - milliseconds to delay
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

(async () => {
    // Initialize Telegram client
    const client = new TelegramClient(stringSession, apiId, apiHash, {
        connectionRetries: 5
    });

    // Login sequence
    await client.start({
        phoneNumber: async () => await input.text("Phone number: "),
        password: async () => await input.text("2FA password (if any): "),
        phoneCode: async () => await input.text("Code: "),
        onError: (err) => console.error("Login error:", err),
    });

    client.setParseMode("html"); // Set default parse mode

    console.log("Login successful");
    console.log("Session string:", client.session.save());

    // Collect user inputs
    const target = await input.text("Channel username (e.g. @mychannel): ");
    const appendText = await input.text("Text to append: ");
    const limit = Number(await input.text("How many messages to edit? ")) || 20;
    const delayMs = Number(await input.text("Delay between edits (ms): ")) || 1000;

    const entity = await client.getEntity(target);
    let offsetId = 0;
    let edited = 0;
    const failedIds = new Set();

    while (edited < limit) {
        // Fetch messages in batches
        const messages = await client.getMessages(entity, { limit: 100, offsetId });
        if (!messages || !messages.length) break;

        for (const msg of messages) {
            if (failedIds.has(msg.id) || edited >= limit) continue;

            if (!isEditable(msg)) {
                console.log(`Skipped message ${msg.id} (not editable)`);
                failedIds.add(msg.id);
                continue;
            }

            if (shouldIgnore(msg.message, appendText)) continue;

            // Parse HTML append text
            const [appendParsed, appendEntities = []] = client.parseMode.parse(appendText) || ["", []];

            const newText = msg.message + "\n\n" + appendParsed;

            if (newText.length > 4096) {
                console.log(`Message ${msg.id} too long, skipped`);
                failedIds.add(msg.id);
                continue;
            }

            try {
                const newEntities = [
                    ...(msg.entities || []),
                    ...appendEntities.map(ent => ({ ...ent, offset: ent.offset + msg.message.length + 2 }))
                ];

                const params = { message: msg.id, text: newText };
                if (newEntities.length) params.formattingEntities = newEntities;

                await client.editMessage(entity, params);

                console.log(`Edited message ${msg.id}`);
                edited++;
                await sleep(delayMs);
            } catch (err) {
                console.error(`Edit failed for ${msg.id}:`, err.message || err);

                // Skip uneditable or unchanged messages
                if (err.code === 400 || String(err).includes("MESSAGE_ID_INVALID") || String(err).includes("MESSAGE_NOT_MODIFIED")) {
                    console.warn(`Skipped message ${msg.id} due to invalid or unchanged content.`);
                    failedIds.add(msg.id);
                    continue;
                }

                // Stop on Telegram flood limit
                if (String(err).includes("FLOOD")) {
                    console.error("Flood error detected, stopping execution.");
                    return;
                }

                failedIds.add(msg.id);
            }
        }

        const minId = Math.min(...messages.map(m => m.id));
        if (!isFinite(minId)) break;

        offsetId = minId - 1;
    }

    console.log(`Done. Edited ${edited} messages.`);
})();

/**
 * @copyright
 * Code by Sobhan-SRZA (mr.sinre) | https://github.com/Sobhan-SRZA
 */