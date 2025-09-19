const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const input = require("input");
require("dotenv").config();

// Load Telegram API credentials from environment variables
const apiId = Number(process.env.TG_API_ID);
const apiHash = process.env.TG_API_HASH;
const stringSession = new StringSession(process.env.TG_STRING_SESSION || "");

// List of texts to ignore during message edits
// Any message containing these strings will remain unchanged
const ignoreList = (process.env.IGNORE_LIST && process.env.IGNORE_LIST.split(", ")) || [
    "00:00"
];
console.log("🚀 ~ ignoreList:", ignoreList)

/**
 * Strip HTML tags from a string to get plain text
 * Useful for comparing messages without formatting
 */
function getPlainText(htmlText) {
    return htmlText.replace(/<\/?[^>]+(>|$)/g, "").trim();
}

/**
 * Determines whether a message should be ignored
 * - Checks if the message already contains the text to append
 * - Checks against a predefined ignore list
 * @param {string} msgText - The current message text
 * @param {string} appendText - The text we want to append
 * @returns {boolean} true if message should be skipped
 */
function shouldIgnore(msgText, appendText) {
    const plainMsg = getPlainText(msgText);
    const plainAppend = getPlainText(appendText);

    // Skip if message already contains the append text
    if (plainMsg.includes(plainAppend)) return true;

    // Skip if message contains any text in the ignore list
    for (const ignore of ignoreList) {
        if (plainMsg.includes(getPlainText(ignore)))
            return true;
    }

    return false;
}

/**
 * Simple sleep function for delaying async operations
 * @param {number} ms - milliseconds to wait
 */
function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

(async () => {
    // Initialize Telegram client
    const client = new TelegramClient(stringSession, apiId, apiHash, {
        connectionRetries: 5, // Retry connection on failure
    });

    // Start client and handle login
    await client.start({
        phoneNumber: async () => await input.text("Phone number: "),
        password: async () => await input.text("2FA password (if any): "),
        phoneCode: async () => await input.text("Code: "),
        onError: (err) => console.log("Login error:", err),
    });

    console.log("Login successful");
    console.log("Session:", client.session.save());

    // Get target channel and user input for editing
    const target = await input.text("Channel username (e.g. @mychannel): ");
    const appendText = await input.text("Text to append: ");
    const limit = Number(await input.text("How many messages to edit? ")) || 20;
    const delayMs = Number(await input.text("Delay between edits (ms): ")) || 1000;

    const entity = await client.getEntity(target);
    let offsetId = 0; // Used to paginate through messages
    let edited = 0;   // Counter for how many messages were edited

    while (edited < limit) {
        // Fetch messages in batches of 100
        const messages = await client.getMessages(entity, { limit: 100, offsetId });
        if (!messages || !messages.length) break;

        for (const msg of messages) {
            if (edited >= limit)
                break;

            // Skip messages with no text
            if (!msg.message || typeof msg.message !== "string")
                continue;

            // Skip messages that should be ignored
            if (shouldIgnore(msg.message, appendText))
                continue;

            // Parse append text for HTML formatting
            client.setParseMode("html")
            const [appendParsed, appendEntities] = client.parseMode.parse(appendText);

            // Combine current message text with new append text
            const newText = msg.message + "\n\n" + appendParsed;

            // Telegram messages cannot exceed 4096 characters
            if (newText.length > 4096) {
                console.log(`Message ${msg.id} too long, skipped.`);
                continue;
            }

            try {
                // Merge existing formatting entities with new entities
                // Offset new entities to appear after original text
                const newEntities = [
                    ...(msg.entities || []),
                    ...appendEntities.map(ent => {
                        ent.offset += msg.message.length + 2; // +2 for "\n\n" separator
                        return ent;
                    })
                ];

                // Edit message with new text and updated formatting
                await client.editMessage(entity, {
                    message: msg.id,
                    text: newText,
                    formattingEntities: newEntities || []
                });

                console.log("Edited:", msg.id);
                edited++;
                await sleep(delayMs); // Wait before editing next message
            }

            catch (err) {
                console.error("Edit failed:", msg.id, err.message || err);
                // Stop if Telegram flood limit is hit
                if (String(err).includes("FLOOD")) {
                    console.error("Flood error, stopping.");
                    process.exit(1);
                }
            }
        }

        // Update offsetId to paginate older messages
        offsetId = Math.min(...messages.map((m) => m.id)) - 1;
    }

    console.log(`Done. Edited ${edited} messages.`);
    process.exit(0);
})();
/**
 * @copyright
 * Code by Sobhan-SRZA (mr.sinre) | https://github.com/Sobhan-SRZA
 * Developed for Persian Caesar | https://github.com/Persian-Caesar | https://dsc.gg/persian-caesar
 *
 * If you encounter any issues or need assistance with this code,
 * please make sure to credit "Persian Caesar" in your documentation or communications.
 */