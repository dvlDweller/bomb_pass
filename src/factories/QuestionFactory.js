const { z } = require('zod');
const AppError = require('../utils/AppError');
const errorCodes = require('../utils/errorCodes');

// Hub Contract Rule 3: the ONE question-set JSON format, validated/produced
// only here.
// { title, description, subject, grade_level,
//   questions: [{ text, type, choices: [string], correct_index, time_limit_sec }] }
// Extra fields (e.g. points) are accepted; a set with only the contract
// fields must validate. Failures -> 400 VALIDATION_FAILED.
const questionSchema = z
  .object({
    text: z.string().trim().min(1, 'Question text is required.').max(500),
    type: z.enum(['multiple_choice', 'true_false']).default('multiple_choice'),
    choices: z.array(
      z.string().trim().min(1, 'A choice cannot be empty.').max(120, 'A choice must be 120 characters or fewer.')
    ),
    correct_index: z
      .number({ invalid_type_error: 'correct_index must be a whole number.' })
      .int('correct_index must be a whole number.')
      .min(0, 'correct_index must be 0 or greater.'),
    time_limit_sec: z
      .number({ invalid_type_error: 'time_limit_sec must be a whole number.' })
      .int('time_limit_sec must be a whole number.')
      .min(5, 'time_limit_sec must be between 5 and 60.')
      .max(60, 'time_limit_sec must be between 5 and 60.')
      .default(20),
    points: z.number().int().positive().default(100),
  })
  .refine(
    (q) =>
      q.type === 'true_false'
        ? q.choices.length === 2
        : q.choices.length >= 2 && q.choices.length <= 4,
    {
      message: 'Multiple-choice questions need 2-4 choices; true/false questions need exactly 2.',
      path: ['choices'],
    }
  )
  .refine((q) => q.correct_index < q.choices.length, {
    message: 'correct_index must point to one of the choices.',
    path: ['correct_index'],
  });

const questionSetSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, 'title must be 3-80 characters.')
    .max(80, 'title must be 3-80 characters.'),
  description: z.string().trim().max(500).optional().default(''),
  subject: z.string().trim().max(100).optional().default(''),
  grade_level: z.string().trim().max(50).optional().default(''),
  questions: z
    .array(questionSchema)
    .min(1, 'A question set needs at least 1 question.')
    .max(50, 'A question set can have at most 50 questions.'),
});

class QuestionFactory {
  static parse(json) {
    const result = questionSetSchema.safeParse(json);
    if (!result.success) {
      throw new AppError(400, errorCodes.VALIDATION_FAILED, result.error.errors[0].message);
    }
    return QuestionFactory.build(result.data);
  }

  static build(data) {
    return {
      title: data.title,
      description: data.description,
      subject: data.subject,
      grade_level: data.grade_level,
      questions: data.questions.map((q, position) => ({
        text: q.text,
        type: q.type,
        choices: q.choices,
        correct_index: q.correct_index,
        time_limit_sec: q.time_limit_sec,
        points: q.points,
        position,
      })),
    };
  }

  // Rule 3 response shape. correct_index is included ONLY on host endpoints
  // (includeCorrectIndex) so a set can be exported/imported; it is NEVER sent
  // to players.
  static toRule3(set, { includeCorrectIndex = false } = {}) {
    const out = {
      title: set.title,
      description: set.description,
      subject: set.subject,
      grade_level: set.grade_level,
      questions: set.questions.map((q) => {
        const base = {
          text: q.text,
          type: q.type,
          choices: q.choices,
          time_limit_sec: q.time_limit_sec,
        };
        if (includeCorrectIndex) base.correct_index = q.correct_index;
        return base;
      }),
    };
    if (set.id !== undefined) out.id = set.id;
    if (set.question_count !== undefined) out.question_count = set.question_count;
    if (set.created_at !== undefined) out.created_at = set.created_at;
    return out;
  }
}

module.exports = QuestionFactory;
