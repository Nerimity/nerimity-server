const BadWords = ['kys', 'kill yourself', 'kill youself', 'kill urself', 'kill myself', 'kms', 'i hope you die', 'i hope u die', 'nigger', 'n!gger', 'n1gger', 'nigg3r', 'niggers', 'niggerz', 'faggot', 'fag', 'f@g', 'tranny', 'killing myself'];

for (let i = 0; i < BadWords.length; i++) {
  const word = BadWords[i]!;
  BadWords[i] = word.replaceAll('l', '(l|i)');
}

const badWordsRegex = new RegExp(BadWords.map((w) => ` ${w} `).join('|'), 'gi');

const badWordsWholeRegex = new RegExp(BadWords.map((w) => `^${w}$`).join('|'), 'i');

const goodWords = ['I love myself', 'I love you', "I'm a good person!", 'uwu <3', "You're nice :)", 'Nerimity is Awesome!', 'I love Positivity!', 'Keep yourself safe 💖', 'I will restore your faith in humanity 😇', 'This venerable one loves you', "I'm feeling a little insecure today 👉👈🥺", 'I love [@:s] 😊', '🥰', '||Ty for clicking! ^^||'];

export const replaceBadWords = (message: string) => {
  if (badWordsWholeRegex.test(message)) {
    const randomGoodWord = goodWords[Math.floor(Math.random() * goodWords.length)]!;
    return randomGoodWord;
  }

  let cleanMessage = ' ' + message + ' ';

  cleanMessage = cleanMessage.replaceAll(badWordsRegex, createHashes);
  return cleanMessage.trim();
};

const createHashes = (badWord: string) => {
  let str = '';
  for (let i = 0; i < badWord.length; i++) {
    const char = badWord[i];
    str += char === ' ' ? ' ' : '#';
  }
  return str;
};
