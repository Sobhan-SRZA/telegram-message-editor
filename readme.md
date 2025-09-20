# Telegram Message Editor

A Node.js tool to **automatically edit messages in a Telegram channel** by appending custom text while keeping original formatting.  
You can also define an **ignore list** so messages containing certain text will remain unchanged.

---

## ✨ Features

- Append custom text to existing channel messages.
- Preserve original formatting (entities, bold, italic, links, etc.).
- Skip messages that:
  - Already contain the append text.
  - Contain predefined ignored phrases.
- Configurable edit limits and delays to avoid Telegram flood restrictions.
- Supports `.env` configuration for API keys and session management.

---

## 🚀 Getting Started

### 1. Clone the Repository
```bash
git clone https://github.com/Sobhan-SRZA/telegram-message-editor.git
cd telegram-message-editor
````

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

Create a `.env` file (or copy `example.env`) and fill in your Telegram credentials:

```env
TG_API_ID='123456'
TG_API_HASH='abcdef1234567890abcdef1234567890'
TG_STRING_SESSION=''
IGNORE_LIST='00:00, Do not edit this'
```

### 4. Run the Project

```bash
npm start
```

On the first run, you’ll be asked to log in with your phone number, code, and password (if 2FA is enabled).
Your session string will be generated and can be reused in `.env`.

---

## 📚 Common Functions Explained

### `getPlainText(htmlText)`

Removes HTML tags from a message string.
Useful for comparing messages without formatting.

```js
function getPlainText(htmlText) {
  return htmlText.replace(/<\/?[^>]+(>|$)/g, "").trim();
}
```

---

### `isEditable(msg)`

Determine if a message is editable.
Telegram only allows editing text messages.
Useful for fillter editable messages.

```js
function isEditable(msg) {
    return msg && typeof msg.message === "string" && msg.message.length > 0;
}
```

---

### `shouldIgnore(msgText, appendText)`

Determines whether a message should be skipped.

* Skips if message already contains the append text.
* Skips if message contains any text from the ignore list.

```js
function shouldIgnore(msgText, appendText) {
  const plainMsg = getPlainText(msgText);
  const plainAppend = getPlainText(appendText);

  if (plainMsg.includes(plainAppend)) return true;

  for (const ignore of ignoreList) {
    if (plainMsg.includes(getPlainText(ignore))) return true;
  }
  return false;
}
```

---

### `sleep(ms)`

Utility function to delay execution between edits (helps avoid flood bans).

```js
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
```

---

## 🛠️ Tools & Packages

This project uses the following npm packages:

| Package                                            | Version  | Purpose                    |
| -------------------------------------------------- | -------- | -------------------------- |
| [telegram](https://www.npmjs.com/package/telegram) | ^2.26.22 | Telegram client library    |
| [dotenv](https://www.npmjs.com/package/dotenv)     | ^17.2.2  | Load environment variables |
| [input](https://www.npmjs.com/package/input)       | ^1.0.1   | Interactive CLI input      |

---

## ⚠️ Notes

* **Message Length Limit:** Telegram messages cannot exceed **4096 characters**. Longer edits are skipped automatically.
* **Flood Control:** If Telegram returns a `FLOOD` error, the script will stop to protect your account.
* **Session Reuse:** Always save your generated `TG_STRING_SESSION` to avoid repeated logins.

---

## 📄 License

BSD 3-Clause License © 2025 [Sobhan-SRZA (mr.sinre)](https://github.com/Sobhan-SRZA)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

[BSD 3-Clause License Full Text](https://opensource.org/licenses/BSD-3-Clause)