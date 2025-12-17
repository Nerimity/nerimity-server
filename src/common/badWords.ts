import anyAscii from 'any-ascii';

const BadWords = ['kys', 'kill yourself', 'kill youself', 'kill urself', 'kill myself', 'kms', 'i hope you die', 'i hope u die', 'nigger', 'n!gger', 'n1gger', 'nigg3r', 'niggers', 'niggerz', 'faggot', 'fag', 'f@g', 'tranny', 'killing myself'];
const BadWords2 = ['kill yourself', 'kill youself', 'kill urself', 'kill myself', 'i hope you die', 'i hope u die', 'nigger', 'n!gger', 'n1gger', 'nigg3r', 'niggers', 'niggerz', 'faggot', 'tranny', 'killing myself'];

for (let i = 0; i < BadWords.length; i++) {
  const word = BadWords[i]!;
  BadWords[i] = word.replaceAll('l', '(l|i)');
}
for (let i = 0; i < BadWords2.length; i++) {
  const word = BadWords2[i]!;
  BadWords2[i] = word.replaceAll('l', '(l|i)');
}

const badWordsRegex = new RegExp(BadWords.map((w) => `\\b${w}\\b`).join('|'), 'gi');

// This regex matches partial words, useful for finding offensive words within larger strings (e.g., "bad" will match "baddest").
const badWordsAnywhereRegex = new RegExp(BadWords.join('|'), 'gi');

const badWords2AnywhereRegex = new RegExp(BadWords2.join('|'), 'gi');

const badWordsWholeRegex = new RegExp(BadWords.map((w) => `^${w}$`).join('|'), 'i');

const goodWords = ['I love myself', 'I love you', "I'm a good person!", 'uwu <3', "You're nice :)", 'Nerimity is Awesome!', 'I love Positivity!', 'Keep yourself safe 💖', 'I will restore your faith in humanity 😇', 'This venerable one loves you', "I'm feeling a little insecure today 👉👈🥺", 'I love [@:s] 😊', '🥰', '||Ty for clicking! ^^||'];

export const replaceBadWords = (message: string) => {
  message = anyAscii(message);

  if (badWordsWholeRegex.test(message)) {
    const randomGoodWord = goodWords[Math.floor(Math.random() * goodWords.length)]!;
    return randomGoodWord;
  }

  const cleanMessage = message.replaceAll(badWordsRegex, createHashes);
  return cleanMessage;
};

export const hasBadWord = (message: string) => {
  message = anyAscii(message);
  return badWordsRegex.test(message) || badWords2AnywhereRegex.test(message);
};

const createHashes = (badWord: string) => {
  let str = '';
  for (let i = 0; i < badWord.length; i++) {
    const char = badWord[i];
    str += char === ' ' ? ' ' : '#';
  }
  return str;
};
