const QuestionFactory = require('../../src/factories/QuestionFactory');
const AppError = require('../../src/utils/AppError');

// A set with ONLY the Hub Contract Rule 3 fields must be accepted.
const contractOnlySet = {
  title: 'Philippine Literature',
  questions: [
    {
      text: 'Who wrote Noli Me Tangere?',
      type: 'multiple_choice',
      choices: ['Jose Rizal', 'Andres Bonifacio', 'Apolinario Mabini', 'Emilio Aguinaldo'],
      correct_index: 0,
      time_limit_sec: 20,
    },
  ],
};

function expectValidationFailure(fn, messagePart) {
  try {
    fn();
    throw new Error('expected AppError');
  } catch (e) {
    expect(e).toBeInstanceOf(AppError);
    expect(e.status).toBe(400);
    expect(e.code).toBe('VALIDATION_FAILED');
    if (messagePart) expect(e.message).toMatch(messagePart);
  }
}

describe('QuestionFactory (Hub Contract Rule 3)', () => {
  test('accepts a set with only the contract fields', () => {
    const set = QuestionFactory.parse(contractOnlySet);
    expect(set.title).toBe('Philippine Literature');
    expect(set.questions).toHaveLength(1);
    expect(set.questions[0].time_limit_sec).toBe(20);
    expect(set.questions[0].points).toBe(100); // extra field default
    expect(set.questions[0].position).toBe(0);
  });

  test('applies defaults: time_limit_sec 20, points 100, type multiple_choice', () => {
    const set = QuestionFactory.parse({
      title: 'Minimal',
      questions: [{ text: 'Q?', choices: ['a', 'b'], correct_index: 0 }],
    });
    expect(set.questions[0].time_limit_sec).toBe(20);
    expect(set.questions[0].points).toBe(100);
    expect(set.questions[0].type).toBe('multiple_choice');
  });

  test('accepts extra fields like points', () => {
    const set = QuestionFactory.parse({
      title: 'With points',
      questions: [{ text: 'Q?', choices: ['a', 'b'], correct_index: 1, points: 250 }],
    });
    expect(set.questions[0].points).toBe(250);
  });

  test('title must be 3-80 chars', () => {
    expectValidationFailure(() => QuestionFactory.parse({ ...contractOnlySet, title: 'ab' }), /title/);
    expectValidationFailure(
      () => QuestionFactory.parse({ ...contractOnlySet, title: 'x'.repeat(81) }),
      /title/
    );
    expect(() => QuestionFactory.parse({ ...contractOnlySet, title: 'x'.repeat(80) })).not.toThrow();
  });

  test('1-50 questions', () => {
    const many = Array.from({ length: 50 }, () => contractOnlySet.questions[0]);
    expect(() => QuestionFactory.parse({ ...contractOnlySet, questions: many })).not.toThrow();
    const tooMany = Array.from({ length: 51 }, () => contractOnlySet.questions[0]);
    expectValidationFailure(() => QuestionFactory.parse({ ...contractOnlySet, questions: tooMany }), /50/);
    expectValidationFailure(() => QuestionFactory.parse({ ...contractOnlySet, questions: [] }), /at least 1/);
  });

  test('multiple_choice needs 2-4 choices', () => {
    const mk = (n) => ({
      ...contractOnlySet,
      questions: [{ text: 'Q?', type: 'multiple_choice', choices: Array(n).fill('x'), correct_index: 0 }],
    });
    expectValidationFailure(() => QuestionFactory.parse(mk(1)), /2-4/);
    expect(() => QuestionFactory.parse(mk(2))).not.toThrow();
    expect(() => QuestionFactory.parse(mk(4))).not.toThrow();
    expectValidationFailure(() => QuestionFactory.parse(mk(5)), /2-4/);
  });

  test('true_false needs exactly 2 choices', () => {
    const mk = (n) => ({
      ...contractOnlySet,
      questions: [{ text: 'Q?', type: 'true_false', choices: Array(n).fill('x'), correct_index: 0 }],
    });
    expect(() => QuestionFactory.parse(mk(2))).not.toThrow();
    expectValidationFailure(() => QuestionFactory.parse(mk(3)), /exactly 2/);
    expectValidationFailure(() => QuestionFactory.parse(mk(1)), /exactly 2/);
  });

  test('each choice 1-120 chars', () => {
    const mk = (choice) => ({
      ...contractOnlySet,
      questions: [{ text: 'Q?', choices: ['ok', choice, 'ok', 'ok'], correct_index: 0 }],
    });
    expectValidationFailure(() => QuestionFactory.parse(mk('')), /choice/);
    expectValidationFailure(() => QuestionFactory.parse(mk('x'.repeat(121))), /120/);
    expect(() => QuestionFactory.parse(mk('x'.repeat(120)))).not.toThrow();
  });

  test('correct_index must be a whole number inside choices', () => {
    const mk = (idx) => ({ ...contractOnlySet, questions: [{ ...contractOnlySet.questions[0], correct_index: idx }] });
    expectValidationFailure(() => QuestionFactory.parse(mk(4)), /correct_index/);
    expectValidationFailure(() => QuestionFactory.parse(mk(-1)), /correct_index/);
    expectValidationFailure(() => QuestionFactory.parse(mk(1.5)), /whole number/);
    expect(() => QuestionFactory.parse(mk(3))).not.toThrow();
  });

  test('time_limit_sec must be 5-60, default 20', () => {
    const mk = (t) => ({ ...contractOnlySet, questions: [{ ...contractOnlySet.questions[0], time_limit_sec: t }] });
    expectValidationFailure(() => QuestionFactory.parse(mk(4)), /5 and 60/);
    expectValidationFailure(() => QuestionFactory.parse(mk(61)), /5 and 60/);
    expect(() => QuestionFactory.parse(mk(5))).not.toThrow();
    expect(() => QuestionFactory.parse(mk(60))).not.toThrow();
  });

  test('toRule3 includes correct_index only for the host', () => {
    const set = QuestionFactory.parse(contractOnlySet);
    const hostView = QuestionFactory.toRule3(set, { includeCorrectIndex: true });
    expect(hostView.questions[0].correct_index).toBe(0);
    const playerView = QuestionFactory.toRule3(set);
    expect(playerView.questions[0].correct_index).toBeUndefined();
    expect(JSON.stringify(playerView)).not.toContain('correct_index');
  });
});
