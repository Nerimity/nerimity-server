const BadWords = ['kys', 'kill yourself', 'kill myself', 'kms', 'nigger', 'n!gger', 'n1gger', 'nigg3r', 'faggot', 'fag', 'f@g'];

const goodWords = ['I love myself', 'I love you', "I'm a good person!", 'uwu <3', "You're nice :)", 'Nerimity is Awesome!', 'I love Positivity!', ''];

export const replaceBadWords = (message: string) => {
  if (BadWords.includes(message.toLowerCase().trim())) {
    const randomGoodWord = goodWords[Math.floor(Math.random() * goodWords.length)]!;
    return randomGoodWord;
  }

  let cleanMessage = ' ' + message + ' ';

  for (let i = 0; i < BadWords.length; i++) {
    const badWord = BadWords[i]!;
    const hashes = createHashes(badWord);
    cleanMessage = cleanMessage.replaceAll(` ${badWord} `, ` ${hashes} `);
  }
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
