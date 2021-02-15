/* eslint-disable no-await-in-loop */
/* eslint-disable no-loop-func */
const WordPOS = require('wordpos');
const cartesian = require('cartesian');
const R = require('ramda');
const fs = require('fs');
const shortid = require('shortid');
const logger = require('loglevel');

const synonymsFilter = arr => arr.map(a => a.toLowerCase() // normalize
  .replace(/[-_]/g, ' ') // swap out hyphens and underscores for spaces
  .replace(/\b.+?[()]{1,}.+?\b/g, ' ') // bin words with one or more weird characters - ie brackets
  .trim()) // trim the fat
  .filter(s => s.length > 0); // after all that cleaning make sure we dont include empty words

const sentencesFilter = (arr, minLength) => R.uniq(
  arr.map(s => s.replace(/[-_]/g, ' ') // swap out hyphens and underscores for spaces
    .replace(/\b.+?[()]{1,}.+?\b/g, ' ') // bin words with one or more weird characters - ie brackets
    .trim()) // trim the fat
    .filter(
      s => s.split(' ').length >= minLength // don't give me sentences shorter than my example
    )
);

// use the function provided to get first definition from wordnet and use its synonyms
const simpleBuilder = async (fn) => {
  const res = await fn();
  return synonymsFilter(res[0].synonyms);
};

// use the function provided to get all definitions from wordnet and use all synonyms
const aggressiveBuilder = async (fn) => {
  const res = await fn();
  const masterSynList = [];
  res.forEach(lookup => synonymsFilter(lookup.synonyms) // filter for good synonyms
    .forEach((s) => {
      if (!masterSynList.includes(s)) {
        masterSynList.push(s);
      }
    }));
  return masterSynList;
};

async function main(sentence, aggressive = false) {
  const wordpos = new WordPOS();
  const wordArray = sentence.toLowerCase().split(' ');
  const megaSentenceList = [];
  for (let i = 0; i < wordArray.length; i += 1) {
    const w = wordArray[i];
    let fn = async () => [{ synonyms: [w] }]; // basic synonym list is just itself
    if (!WordPOS.stopwords.includes(w)) { // don't bother swapping stop words
      if (await wordpos.isNoun(w)) {
        fn = async () => wordpos.lookupNoun(w); // function to lookup a given noun in wordnet
      } else if (await wordpos.isVerb(w)) {
        fn = async () => wordpos.lookupVerb(w); // function to lookup a given verb in wordnet
      } else if (await wordpos.isAdjective(w)) {
        fn = async () => wordpos.lookupAdjective(w); // function to lookup a given adjective in wordnet
      }
    }
    if (aggressive) {
      megaSentenceList.push(await aggressiveBuilder(fn)); // apply the aggressive function and add the sentence to our megaSentenceList
    } else {
      megaSentenceList.push(await simpleBuilder(fn)); // apply the simple function and add the sentence to our megaSentenceList
    }
  }
  const cartesianProduct = cartesian(megaSentenceList) // get the cartesian product of our sentences
    .map(a => a.join(' ')); // join each word array using a space
  const filteredSentences = sentencesFilter(cartesianProduct, wordArray.length);
  logger.debug(filteredSentences);

  const fileName = `${shortid.generate()}.txt`;
  const stream = fs.createWriteStream(fileName, { flags: 'a' });
  filteredSentences.forEach((item) => {
    stream.write(`${item}\n`);
  });
  stream.end();
  logger.info(`dataset written to ${fileName}`);
}


logger.setDefaultLevel('info');
const sentence = 'what price is this home';
main(sentence);
