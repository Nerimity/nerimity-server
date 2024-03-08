const BadWords = ['kys', 'kill yourself', 'kill myself', 'kms', 'nigger', 'n!gger', 'n1gger', 'nigg3r', 'faggot', 'fag', 'f@g'];

const goodWords = ['I love myself', 'I love you', "I'm a good person!", 'uwu <3', "You're nice :)", 'Nerimity is Awesome!', 'I love Positivity!', ''];

export const replaceBadWords = (message: string) => {
  if (BadWords.includes(message.toLowerCase().trim())) {
    const randomGoodWord = goodWords[Math.floor(Math.random() * goodWords.length)]!;
    return randomGoodWord;
  }

  return message
    .split(' ')
    .map((word) => {
      if (BadWords.includes(word.toLowerCase())) {
        return '*'.repeat(word.length);
      }
      return word;
    })
    .join(' ');
};
