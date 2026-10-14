const AppError = require('../utils/AppError');
const errorCodes = require('../utils/errorCodes');
const { toIsoUtc } = require('../utils/dates');
const QuestionFactory = require('../factories/QuestionFactory');
const QuestionSetRepository = require('../repositories/QuestionSetRepository');

class QuestionSetService {
  async create(hostId, payload) {
    const set = QuestionFactory.parse(payload);
    const created = await QuestionSetRepository.create({ ...set, host_id: hostId });
    return {
      ...QuestionFactory.toRule3(set, { includeCorrectIndex: true }),
      id: created.id,
      question_count: set.questions.length,
      created_at: toIsoUtc(created.created_at),
    };
  }

  async listForHost(hostId) {
    const sets = await QuestionSetRepository.listByHost(hostId);
    return sets.map((s) => ({
      id: s.id,
      title: s.title,
      subject: s.subject,
      grade_level: s.grade_level,
      question_count: s.question_count,
      created_at: toIsoUtc(s.created_at),
    }));
  }

  // Full Rule 3 set for the owning host, INCLUDING correct_index (exportable).
  async getForHost(id, hostId) {
    const set = await this.getOwned(id, hostId);
    const questions = await QuestionSetRepository.listQuestions(set.id);
    const choices = await QuestionSetRepository.listChoices(questions.map((q) => q.id));
    const byQuestion = {};
    for (const c of choices) {
      (byQuestion[c.question_id] = byQuestion[c.question_id] || []).push(c);
    }
    return {
      ...QuestionFactory.toRule3(
        {
          title: set.title,
          description: set.description,
          subject: set.subject,
          grade_level: set.grade_level,
          questions: questions.map((q) => ({
            text: q.text,
            type: q.type,
            choices: (byQuestion[q.id] || []).map((c) => c.choice_text),
            correct_index: q.correct_index,
            time_limit_sec: q.time_limit_sec,
          })),
        },
        { includeCorrectIndex: true }
      ),
      id: set.id,
      question_count: questions.length,
      created_at: toIsoUtc(set.created_at),
    };
  }

  // Ownership rule: 404 if the set does not exist, 403 NOT_YOUR_QUESTION_SET if
  // it belongs to another host.
  async getOwned(id, hostId) {
    const set = await QuestionSetRepository.findById(id);
    if (!set) throw new AppError(404, errorCodes.QUESTION_SET_NOT_FOUND, 'No question set exists with that id.');
    if (set.host_id !== hostId) {
      throw new AppError(403, errorCodes.NOT_YOUR_QUESTION_SET, 'That question set belongs to another host.');
    }
    return set;
  }

  // Export: the full Rule 3 set (with correct_index) as a downloadable file.
  async exportSet(id, hostId) {
    return this.getForHost(id, hostId);
  }

  // Import: same validation as create; the body IS the Rule 3 set.
  async importSet(hostId, payload) {
    return this.create(hostId, payload);
  }

  // Copy: duplicate a set the host owns, with " (copy)" appended to the title.
  async copySet(id, hostId) {
    const existing = await this.getForHost(id, hostId);
    const copyPayload = {
      ...existing,
      title: `${existing.title.slice(0, 74)} (copy)`,
    };
    delete copyPayload.id;
    delete copyPayload.question_count;
    delete copyPayload.created_at;
    return this.create(hostId, copyPayload);
  }
}

module.exports = new QuestionSetService();
